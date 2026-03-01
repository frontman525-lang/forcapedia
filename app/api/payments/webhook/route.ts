// POST /api/payments/webhook
// Cashfree sends signed webhook events here.
// This is the source of truth for subscription state changes — never trust the return_url alone.
//
// IMPORTANT: Add this URL in Cashfree Dashboard → Developers → Webhooks:
//   https://forcapedia.com/api/payments/webhook
//
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyCashfreeWebhook, CashfreeWebhookPayload } from '@/lib/cashfree/webhook'
import { sendEmail } from '@/lib/email/send'
import { PaymentSuccessEmail } from '@/lib/email/templates/PaymentSuccessEmail'
import { PaymentFailedEmail } from '@/lib/email/templates/PaymentFailedEmail'
import * as React from 'react'

// ── Admin Supabase client (service role) ──────────────────────────────────────
// Required to bypass RLS when updating user tier after a payment event.
function getAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ── Disable body parsing — we need the raw body for signature verification ───
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // ── Read raw body for HMAC verification ──────────────────────────────────
  const rawBody   = await req.text()
  // Support both 2022-09-01 and 2025-01-01 webhook header names
  const timestamp =
    req.headers.get('x-cashfree-timestamp') ??
    req.headers.get('x-webhook-timestamp') ?? ''
  const signature =
    req.headers.get('x-cashfree-signature') ??
    req.headers.get('x-webhook-signature') ?? ''

  // ── Verify authenticity ───────────────────────────────────────────────────
  if (!verifyCashfreeWebhook(rawBody, timestamp, signature)) {
    console.error('[webhook] ✗ Signature mismatch — rejecting request')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── Parse event ───────────────────────────────────────────────────────────
  let event: CashfreeWebhookPayload
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { subscription, payment } = event.data
  const userId         = subscription.customer_details.customer_id
  const subscriptionId = subscription.subscription_id

  console.log(`[webhook] type=${event.type}  sub=${subscriptionId}  user=${userId}`)

  const admin = getAdminClient()

  // ── Log every event (audit trail) ────────────────────────────────────────
  admin.from('payment_events').insert({
    user_id:         userId,
    cashfree_sub_id: subscriptionId,
    event_type:      event.type,
    cf_payment_id:   payment?.cf_payment_id,
    amount:          payment?.payment_amount,
    currency:        payment?.payment_currency,
    raw_payload:     event,
  }).then(({ error }) => { if (error) console.error('[webhook] audit log:', error) })

  // ── Helper — get user email + name ────────────────────────────────────────
  async function getUserInfo() {
    const { data } = await admin.auth.admin.getUserById(userId)
    const u = data.user
    return {
      email:     u?.email ?? null,
      firstName: (u?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there',
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  switch (event.type) {

    // ── Mandate authorised — subscription is now live ────────────────────────
    case 'SUBSCRIPTION_ACTIVATED': {
      const { data: sub } = await admin
        .from('subscriptions')
        .update({
          status:               'active',
          cf_sub_id:            subscription.cf_subscription_id,
          current_period_start: new Date().toISOString(),
          updated_at:           new Date().toISOString(),
        })
        .eq('cashfree_sub_id', subscriptionId)
        .select('tier, billing_cycle')
        .single()

      if (sub) {
        // Upgrade the user's tier in user_usage
        await admin
          .from('user_usage')
          .update({ tier: sub.tier })
          .eq('user_id', userId)

        console.log(`[webhook] ✓ ACTIVATED — user=${userId} tier=${sub.tier}`)
      }
      break
    }

    // ── Recurring charge succeeded ───────────────────────────────────────────
    case 'SUBSCRIPTION_PAYMENT_SUCCESS': {
      const { data: sub } = await admin
        .from('subscriptions')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('cashfree_sub_id', subscriptionId)
        .select('tier, billing_cycle, amount, currency')
        .single()

      if (!sub) break

      // Keep tier current (safety net)
      await admin.from('user_usage').update({ tier: sub.tier }).eq('user_id', userId)

      // Send payment receipt email
      const { email, firstName } = await getUserInfo()
      if (email && payment) {
        const planName = sub.tier === 'tier1' ? 'Scholar' : 'Researcher'
        const planPrice = `₹${sub.amount.toLocaleString('en-IN')}`
        const tokens   = sub.tier === 'tier1' ? '2,000,000' : '4,000,000'

        sendEmail({
          to:       email,
          subject:  `Payment confirmed — ${planName} plan`,
          template: React.createElement(PaymentSuccessEmail, {
            firstName,
            planName,
            planPrice,
            tokens,
            orderId:     payment.cf_payment_id,
            date:        new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
            nextBilling: 'Your next billing cycle',
          }),
        }).catch(console.error)
      }

      console.log(`[webhook] ✓ PAYMENT_SUCCESS — user=${userId} tier=${sub.tier} amount=${sub.currency}${sub.amount}`)
      break
    }

    // ── Recurring charge failed ───────────────────────────────────────────────
    case 'SUBSCRIPTION_PAYMENT_FAILED': {
      const { data: sub } = await admin
        .from('subscriptions')
        .select('tier, billing_cycle')
        .eq('cashfree_sub_id', subscriptionId)
        .single()

      const { email, firstName } = await getUserInfo()
      if (email && sub) {
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

      console.warn(`[webhook] ✗ PAYMENT_FAILED — user=${userId}`)
      break
    }

    // ── User or admin cancelled the subscription ──────────────────────────────
    case 'SUBSCRIPTION_CANCELLED':
    case 'SUBSCRIPTION_ENDED': {
      const newStatus = event.type === 'SUBSCRIPTION_CANCELLED' ? 'cancelled' : 'expired'

      await admin
        .from('subscriptions')
        .update({
          status:       newStatus,
          cancelled_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        })
        .eq('cashfree_sub_id', subscriptionId)

      // Downgrade user to free tier
      await admin
        .from('user_usage')
        .update({ tier: 'free' })
        .eq('user_id', userId)

      console.log(`[webhook] ✓ ${event.type} — user=${userId} downgraded to free`)
      break
    }

    default:
      console.log(`[webhook] unhandled event type: ${event.type}`)
  }
  // ═══════════════════════════════════════════════════════════════════════════

  // Always return 200 — Cashfree retries on non-2xx
  return NextResponse.json({ ok: true })
}
