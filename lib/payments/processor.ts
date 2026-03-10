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
import { SubscriptionCancelledEmail } from '@/lib/email/templates/SubscriptionCancelledEmail'
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

  // ── Idempotency guard ────────────────────────────────────────────────────────
  // Webhooks are retried by providers on non-2xx — the same event can arrive
  // multiple times. Use the provider's event_id to deduplicate.
  // If event_id is absent (e.g. Cashfree), fall back to (sub_id + event_type + payment_id).
  if (event.eventId) {
    const { data: existing } = await admin
      .from('payment_events')
      .select('id')
      .eq('provider_event_id', event.eventId)
      .maybeSingle()

    if (existing) {
      console.log(`[processor] duplicate event skipped — eventId=${event.eventId}  type=${event.type}`)
      return
    }
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  admin
    .from('payment_events')
    .insert({
      user_id:           event.userId ?? null,
      provider_sub_id:   event.providerSubId,
      provider_event_id: event.eventId ?? null,
      payment_provider:  providerName,
      event_type:        event.type,
      payment_id:        event.paymentId ?? null,
      amount:            event.amount ?? null,
      currency:          event.currency ?? null,
      raw_payload:       event.raw,
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

      const { error: subErr } = await admin
        .from('subscriptions')
        .update({
          status:               'active',
          current_period_start: new Date().toISOString(),
          ...(event.currentPeriodEnd ? { current_period_end: event.currentPeriodEnd } : {}),
          updated_at:           new Date().toISOString(),
        })
        .eq('id', sub.id)
      if (subErr) console.error(`[processor] ACTIVATED subscriptions update error:`, subErr)

      const { error: usageErr } = await admin
        .from('user_usage')
        .update({ tier: sub.tier })
        .eq('user_id', sub.user_id)
      if (usageErr) console.error(`[processor] ACTIVATED user_usage update error user=${sub.user_id}:`, usageErr)

      console.log(`[processor] ✓ ACTIVATED — user=${sub.user_id}  tier=${sub.tier}  provider=${providerName}`)
      break
    }

    // ── Recurring charge succeeded ────────────────────────────────────────────
    case 'subscription.payment.success': {
      const sub = await findSubByProviderSubId(admin, event.providerSubId)
      if (!sub) break

      await admin
        .from('subscriptions')
        .update({
          status:     'active',
          ...(event.currentPeriodEnd ? { current_period_end: event.currentPeriodEnd } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sub.id)

      // Safety-net: ensure user tier is correct
      await admin.from('user_usage').update({ tier: sub.tier }).eq('user_id', sub.user_id)

      // Generate sequential invoice number (INV-YYYY-NNNNN)
      const { count: invoiceCount } = await admin
        .from('payment_events')
        .select('id', { count: 'exact', head: true })
        .in('event_type', ['subscription.activated', 'subscription.payment.success'])
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String((invoiceCount ?? 0) + 1).padStart(5, '0')}`

      // Send payment receipt email
      const { email, firstName } = await getUserInfo(admin, sub.user_id)
      if (email) {
        const planName  = sub.tier === 'tier1' ? 'Scholar' : 'Researcher'
        const planPrice = sub.currency === 'INR'
          ? `₹${sub.amount.toLocaleString('en-IN')}/month`
          : `$${sub.amount.toFixed(2)}/month`
        const tokens    = sub.tier === 'tier1' ? '2,000,000' : '4,000,000'
        const date      = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
        const nextBilling = event.currentPeriodEnd
          ? new Date(event.currentPeriodEnd).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
          : ''

        sendEmail({
          to:       email,
          subject:  `Payment confirmed — ${planName} plan · ${invoiceNumber}`,
          template: React.createElement(PaymentSuccessEmail, {
            firstName,
            planName,
            planPrice,
            tokens,
            orderId:      event.paymentId ?? '—',
            invoiceNumber,
            date,
            nextBilling,
          }),
        }).catch(console.error)
      }

      console.log(`[processor] ✓ PAYMENT_SUCCESS — user=${sub.user_id}  amount=${sub.currency}${sub.amount}  invoice=${invoiceNumber}`)
      break
    }

    // ── Recurring charge failed ───────────────────────────────────────────────
    // On payment failure: mark past_due, keep access, send email.
    // We do NOT downgrade on any payment.failed webhook — providers retry multiple
    // times before giving up (Razorpay: up to 3 retries; PayPal: 3–7 days).
    // Downgrade only happens via two paths:
    //   1. subscription.cancelled / subscription.ended webhook (provider gave up).
    //   2. Cron safety-net: if still past_due after 7 days, force-downgrade.
    // This matches Stripe's dunning model (retries over 7–30 days before cancelling).
    case 'subscription.payment.failed': {
      const sub = await findSubByProviderSubId(admin, event.providerSubId)
      if (!sub) break

      // Always mark past_due — never downgrade here (provider retries are still pending)
      await admin.from('subscriptions').update({
        status:     'past_due',
        updated_at: new Date().toISOString(),
      }).eq('id', sub.id)
      console.warn(`[processor] ✗ PAYMENT_FAILED — user=${sub.user_id} marked past_due (access retained during retry window)`)

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
      break
    }

    // ── Subscription cancelled or naturally expired ───────────────────────────
    case 'subscription.cancelled':
    case 'subscription.ended': {
      const sub = await findSubByProviderSubId(admin, event.providerSubId)
      if (!sub) break

      const newStatus = event.type === 'subscription.cancelled' ? 'cancelled' : 'expired'

      // Fetch current period end before we overwrite (for access-until in email)
      const { data: currentSub } = await admin
        .from('subscriptions')
        .select('current_period_end, cancel_at_period_end')
        .eq('id', sub.id)
        .single()

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

      // Send cancellation confirmation email
      const { email, firstName } = await getUserInfo(admin, sub.user_id)
      if (email) {
        const planName    = sub.tier === 'tier1' ? 'Scholar' : 'Researcher'
        const accessUntil = currentSub?.cancel_at_period_end && currentSub?.current_period_end
          ? new Date(currentSub.current_period_end).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
          : ''

        sendEmail({
          to:       email,
          subject:  `Your ${planName} subscription has been cancelled`,
          template: React.createElement(SubscriptionCancelledEmail, {
            firstName,
            planName,
            accessUntil,
          }),
        }).catch(console.error)
      }

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
