// ─── Webhook Event Processor ──────────────────────────────────────────────────
//
// Single source of truth for translating normalized webhook events into DB +
// user-tier updates. Called by EVERY provider's webhook route — adding a new
// provider never requires touching this file.
//
// Flow:
//   Provider webhook route
//     → provider.verifyAndParseWebhook()   [verify sig + normalize event]
//     → processWebhookEvent()              [this file — update DB & send emails]
//
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { NormalizedWebhookEvent } from './types'
import { sendEmail } from '@/lib/email/send'
import { PaymentSuccessEmail } from '@/lib/email/templates/PaymentSuccessEmail'
import { PaymentFailedEmail } from '@/lib/email/templates/PaymentFailedEmail'
import * as React from 'react'

// ── Admin client (bypasses RLS) ───────────────────────────────────────────────
function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
type SubRow = {
  id:            string
  user_id:       string
  tier:          string
  billing_cycle: string
  amount:        number
  currency:      string
}

async function findSubByProviderSubId(
  admin:         ReturnType<typeof getAdminClient>,
  providerSubId: string,
): Promise<SubRow | null> {
  const { data } = await admin
    .from('subscriptions')
    .select('id, user_id, tier, billing_cycle, amount, currency')
    .eq('provider_sub_id', providerSubId)
    .maybeSingle()
  return data ?? null
}

async function getUserInfo(admin: ReturnType<typeof getAdminClient>, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId)
  const u = data.user
  return {
    email:     u?.email ?? null,
    firstName: (u?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there',
  }
}

// ── Main processor ────────────────────────────────────────────────────────────
export async function processWebhookEvent(
  event:        NormalizedWebhookEvent,
  providerName: string,
): Promise<void> {
  const admin = getAdminClient()

  // Always log the raw event for audit / debugging
  admin
    .from('payment_events')
    .insert({
      user_id:          event.userId ?? null,
      provider_sub_id:  event.providerSubId,
      payment_provider: providerName,
      event_type:       event.type,
      payment_id:       event.paymentId ?? null,
      amount:           event.amount ?? null,
      currency:         event.currency ?? null,
      raw_payload:      event.raw,
      // Legacy Cashfree columns — kept so existing queries / dashboards don't break
      cashfree_sub_id:  providerName === 'cashfree' ? event.providerSubId : null,
      cf_payment_id:    providerName === 'cashfree' ? event.paymentId ?? null : null,
    })
    .then(({ error }) => {
      if (error) console.error('[processor] audit log error:', error)
    })

  console.log(`[processor] type=${event.type}  providerSubId=${event.providerSubId}  provider=${providerName}`)

  // ═══════════════════════════════════════════════════════════════════════════
  switch (event.type) {

    // ── Mandate / approval confirmed — subscription is live ──────────────────
    case 'subscription.activated': {
      const sub = await findSubByProviderSubId(admin, event.providerSubId)
      if (!sub) {
        console.warn(`[processor] ACTIVATED: no row for providerSubId=${event.providerSubId}`)
        break
      }

      await admin
        .from('subscriptions')
        .update({
          status:               'active',
          current_period_start: new Date().toISOString(),
          updated_at:           new Date().toISOString(),
        })
        .eq('id', sub.id)

      await admin
        .from('user_usage')
        .update({ tier: sub.tier })
        .eq('user_id', sub.user_id)

      console.log(`[processor] ✓ ACTIVATED — user=${sub.user_id}  tier=${sub.tier}  provider=${providerName}`)
      break
    }

    // ── Recurring charge succeeded ────────────────────────────────────────────
    case 'subscription.payment.success': {
      const sub = await findSubByProviderSubId(admin, event.providerSubId)
      if (!sub) break

      await admin
        .from('subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', sub.id)

      // Safety-net: ensure user tier is correct
      await admin.from('user_usage').update({ tier: sub.tier }).eq('user_id', sub.user_id)

      // Send payment receipt email
      const { email, firstName } = await getUserInfo(admin, sub.user_id)
      if (email) {
        const planName  = sub.tier === 'tier1' ? 'Scholar' : 'Researcher'
        const planPrice = sub.currency === 'INR'
          ? `₹${sub.amount.toLocaleString('en-IN')}`
          : `$${sub.amount.toFixed(2)}`
        const tokens = sub.tier === 'tier1' ? '2,000,000' : '4,000,000'

        sendEmail({
          to:       email,
          subject:  `Payment confirmed — ${planName} plan`,
          template: React.createElement(PaymentSuccessEmail, {
            firstName,
            planName,
            planPrice,
            tokens,
            orderId:     event.paymentId ?? '—',
            date:        new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
            nextBilling: 'Your next billing cycle',
          }),
        }).catch(console.error)
      }

      console.log(`[processor] ✓ PAYMENT_SUCCESS — user=${sub.user_id}  amount=${sub.currency}${sub.amount}`)
      break
    }

    // ── Recurring charge failed ───────────────────────────────────────────────
    case 'subscription.payment.failed': {
      const sub = await findSubByProviderSubId(admin, event.providerSubId)
      if (!sub) break

      const { email, firstName } = await getUserInfo(admin, sub.user_id)
      if (email) {
        const planName = sub.tier === 'tier1' ? 'Scholar' : 'Researcher'
        sendEmail({
          to:       email,
          subject:  'Action required — payment failed',
          template: React.createElement(PaymentFailedEmail, {
            firstName,
            planName,
            retryUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'}/pricing`,
          }),
        }).catch(console.error)
      }

      console.warn(`[processor] ✗ PAYMENT_FAILED — providerSubId=${event.providerSubId}`)
      break
    }

    // ── Subscription cancelled or naturally expired ───────────────────────────
    case 'subscription.cancelled':
    case 'subscription.ended': {
      const sub = await findSubByProviderSubId(admin, event.providerSubId)
      if (!sub) break

      const newStatus = event.type === 'subscription.cancelled' ? 'cancelled' : 'expired'

      await admin
        .from('subscriptions')
        .update({
          status:       newStatus,
          cancelled_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        })
        .eq('id', sub.id)

      // Downgrade user to free
      await admin.from('user_usage').update({ tier: 'free' }).eq('user_id', sub.user_id)

      console.log(`[processor] ✓ ${event.type.toUpperCase()} — user=${sub.user_id}  → free`)
      break
    }

    // ── Subscription paused / resumed — no tier change, log only ─────────────
    case 'subscription.paused':
    case 'subscription.resumed': {
      console.log(`[processor] ℹ ${event.type}  providerSubId=${event.providerSubId}`)
      break
    }

    default: {
      // TypeScript exhaustiveness check — if you add a new NormalizedEventType,
      // the compiler will flag this line until you handle it above.
      const _exhaustive: never = event.type
      console.log(`[processor] unhandled event type: ${_exhaustive}`)
    }
  }
  // ═══════════════════════════════════════════════════════════════════════════
}
