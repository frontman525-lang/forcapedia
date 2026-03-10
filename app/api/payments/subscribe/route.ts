// POST /api/payments/subscribe
//
// Provider-agnostic subscription creation.
// Client sends { tier, billingCycle, paymentProvider, phone? }.
// Returns checkout data appropriate for the chosen provider:
//   Cashfree → { checkoutMode: 'sdk',      sessionId, cashfreeMode }
//   PayPal   → { checkoutMode: 'redirect', approvalUrl }
//
import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPaymentProvider } from '@/lib/payments'
import type { PaymentProviderName, PlanKey } from '@/lib/payments/types'
import { getPlan } from '@/lib/cashfree/plans'
import { PAYPAL_PLAN_AMOUNTS }   from '@/lib/payments/providers/paypal/plans'
import { RAZORPAY_PLAN_AMOUNTS } from '@/lib/razorpay/plans'

export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let tier: string
  let billingCycle: string
  let phone: string | undefined
  let rawProvider: string | undefined

  try {
    const body   = await req.json()
    tier         = body.tier
    billingCycle = body.billingCycle
    phone        = body.phone
    rawProvider  = body.paymentProvider  // 'cashfree' | 'paypal' | 'razorpay'
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!tier || !billingCycle) {
    return NextResponse.json({ error: 'tier and billingCycle are required' }, { status: 400 })
  }

  // ── Validate plan ─────────────────────────────────────────────────────────
  const plan = getPlan(tier, billingCycle)
  if (!plan) {
    return NextResponse.json({ error: 'Invalid plan selection' }, { status: 400 })
  }

  const planKey = `${tier}_${billingCycle}` as PlanKey

  // ── Determine provider ────────────────────────────────────────────────────
  // Whitelist: only accept known provider names; default to razorpay for India.
  const providerName: PaymentProviderName =
    rawProvider === 'paypal'   ? 'paypal'   :
    rawProvider === 'cashfree' ? 'cashfree' :
    rawProvider === 'razorpay' ? 'razorpay' :
    'razorpay'  // safe default — Razorpay handles UPI/Card/NetBanking for India

  // ── Duplicate / conflict guard ────────────────────────────────────────────
  const adminDb = createAdminClient()

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, tier, billing_cycle, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'past_due') {
      return NextResponse.json(
        { error: 'Your payment has failed. Please cancel your current plan from the profile page before subscribing again.' },
        { status: 409 },
      )
    }
    if (existing.tier === tier && existing.billing_cycle === billingCycle) {
      return NextResponse.json(
        { error: 'You are already subscribed to this plan. Visit your profile to manage it.' },
        { status: 409 },
      )
    }
    // User has an active subscription to a DIFFERENT plan.
    // They must go through change-plan, not subscribe fresh — otherwise they
    // get two concurrent subscriptions and are charged by both gateways.
    return NextResponse.json(
      { error: 'You already have an active subscription. To switch plans, use "Change plan" from your profile.' },
      { status: 409 },
    )
  }

  // Expire any stale pending rows for this user (abandoned checkouts).
  // Pending rows that were never paid accumulate on every abandoned checkout;
  // cleaning them ensures the status API never confuses them for an active plan.
  await adminDb
    .from('subscriptions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  // ── Cashfree: require phone ───────────────────────────────────────────────
  const resolvedPhone =
    phone?.trim() ??
    (user.user_metadata?.phone as string | undefined)?.trim() ??
    null

  if (providerName === 'cashfree' && !resolvedPhone) {
    return NextResponse.json(
      { error: 'PHONE_REQUIRED', message: 'A phone number is required to set up the payment mandate.' },
      { status: 422 },
    )
  }

  // ── Build URLs ────────────────────────────────────────────────────────────
  const origin    = new URL(req.url).origin
  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? origin
  const returnUrl = `${origin}/payment/success?plan=${planKey}`
  const cancelUrl = `${origin}/payment/cancel`
  // Each provider has its own webhook endpoint to keep routing explicit
  const notifyUrl =
    providerName === 'paypal'   ? `${siteUrl}/api/payments/webhook/paypal`   :
    providerName === 'razorpay' ? `${siteUrl}/api/payments/webhook/razorpay` :
    `${siteUrl}/api/payments/webhook`

  // ── Call provider ─────────────────────────────────────────────────────────
  const provider = getPaymentProvider(providerName)
  let result: Awaited<ReturnType<typeof provider.createSubscription>>

  try {
    result = await provider.createSubscription({
      userId:    user.id,
      email:     user.email!,
      phone:     resolvedPhone ?? undefined,
      planKey,
      returnUrl,
      cancelUrl,
      notifyUrl,
    })
  } catch (err: unknown) {
    console.error(`[subscribe] ${providerName} error:`, err)
    const code    = (err as { code?: string }).code
    const message = err instanceof Error ? err.message : 'Payment gateway error'

    if (code === 'PHONE_REQUIRED') {
      return NextResponse.json({ error: 'PHONE_REQUIRED', message }, { status: 422 })
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // ── Persist phone for future Cashfree purchases ───────────────────────────
  if (providerName === 'cashfree' && phone && !user.user_metadata?.phone) {
    await supabase.auth.updateUser({ data: { phone: resolvedPhone } }).catch(console.error)
  }

  // ── Resolve amount + currency per provider ────────────────────────────────
  const amount   =
    providerName === 'paypal'   ? PAYPAL_PLAN_AMOUNTS[planKey]   :
    providerName === 'razorpay' ? RAZORPAY_PLAN_AMOUNTS[planKey] :
    plan.plan_amount
  const currency = providerName === 'paypal' ? 'USD' : 'INR'

  // ── Upsert pending subscription record ────────────────────────────────────
  // All stale pending rows were cleared above; just insert fresh for this attempt.
  const newRow = {
    user_id:          user.id,
    payment_provider: providerName,
    provider_sub_id:  result.providerSubId,
    cashfree_sub_id:  providerName === 'cashfree' ? result.providerSubId : null,
    cf_sub_id:        null,
    cashfree_plan_id: plan.plan_id,
    tier,
    billing_cycle:    billingCycle,
    status:           'pending' as const,
    amount,
    currency,
  }

  const { error: insertErr } = await adminDb.from('subscriptions').insert(newRow)
  if (insertErr) console.error('[subscribe] DB insert error:', insertErr)

  // ── Return checkout data ───────────────────────────────────────────────────
  if (result.checkoutMode === 'sdk') {
    const cashfreeMode = process.env.CASHFREE_ENV === 'PROD' ? 'production' : 'sandbox'
    return NextResponse.json({
      checkoutMode:   'sdk',
      sessionId:      result.sessionId,
      subscriptionId: result.providerSubId,
      cashfreeMode,
    })
  }

  if (result.checkoutMode === 'redirect') {
    return NextResponse.json({
      checkoutMode: 'redirect',
      approvalUrl:  result.approvalUrl,
    })
  }

  if (result.checkoutMode === 'razorpay_popup') {
    const keyId = process.env.RAZORPAY_KEY_ID
    if (!keyId) {
      console.error('[subscribe] RAZORPAY_KEY_ID is not set')
      return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 })
    }
    return NextResponse.json({
      checkoutMode:   'razorpay_popup',
      subscriptionId: result.providerSubId,
      keyId,
    })
  }

  return NextResponse.json({ error: 'Unexpected checkout mode from provider' }, { status: 500 })
}
