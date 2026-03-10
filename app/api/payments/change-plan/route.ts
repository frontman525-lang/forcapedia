// POST /api/payments/change-plan
//
// Handles plan switching for existing subscribers.
//
// Upgrade  (higher tier OR same tier monthly→yearly):
//   1. Cancel current subscription immediately via provider API
//   2. Mark current DB row as 'cancelled'
//   3. Create new subscription → return approval URL / sessionId
//
// Downgrade (lower tier OR same tier yearly→monthly):
//   1. Cancel current subscription at period end via provider API
//   2. Mark current DB row cancel_at_period_end = true
//   3. Return { type: 'downgrade_scheduled' } — user re-subscribes manually after period ends
//
import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPaymentProvider } from '@/lib/payments'
import type { PaymentProviderName, PlanKey } from '@/lib/payments/types'
import { getPlan }                 from '@/lib/cashfree/plans'
import { PAYPAL_PLAN_AMOUNTS }     from '@/lib/payments/providers/paypal/plans'
import { RAZORPAY_PLAN_AMOUNTS }   from '@/lib/razorpay/plans'

const TIER_LEVEL:  Record<string, number> = { free: 0, tier1: 1, tier2: 2 }
const CYCLE_LEVEL: Record<string, number> = { monthly: 0, yearly: 1 }

/** Returns the unused credit from a subscription billing period (in USD). */
function calcProrationCredit(
  periodStart: string | null,
  billingCycle: string,
  paidAmount:  number,
): number {
  if (!periodStart || !paidAmount) return 0
  const start      = new Date(periodStart)
  const now        = new Date()
  const totalDays  = billingCycle === 'yearly' ? 365 : 30
  const elapsedMs  = now.getTime() - start.getTime()
  const elapsedDays = Math.min(Math.floor(elapsedMs / 86_400_000), totalDays)
  const remaining  = Math.max(0, totalDays - elapsedDays)
  const credit     = (remaining / totalDays) * paidAmount
  return Math.round(credit * 100) / 100   // round to cents
}

export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse body ────────────────────────────────────────────────────────────
  let newTier: string, newCycle: string, rawProvider: string | undefined
  try {
    const body = await req.json()
    newTier      = body.tier
    newCycle     = body.billingCycle
    rawProvider  = body.paymentProvider
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!newTier || !newCycle) {
    return NextResponse.json({ error: 'tier and billingCycle are required' }, { status: 400 })
  }

  const plan = getPlan(newTier, newCycle)
  if (!plan) return NextResponse.json({ error: 'Invalid plan selection' }, { status: 400 })

  const newPlanKey = `${newTier}_${newCycle}` as PlanKey
  const newProviderName: PaymentProviderName =
    rawProvider === 'paypal'   ? 'paypal'   :
    rawProvider === 'cashfree' ? 'cashfree' :
    rawProvider === 'razorpay' ? 'razorpay' :
    'razorpay'

  // ── Find current active subscription ──────────────────────────────────────
  const { data: rows } = await supabase
    .from('subscriptions')
    .select('id, tier, billing_cycle, payment_provider, provider_sub_id, cashfree_sub_id, current_period_start, amount')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  const currentSub = rows?.[0] ?? null
  if (!currentSub) {
    return NextResponse.json({ error: 'No active subscription to change.' }, { status: 404 })
  }

  const providerSubId = (currentSub.provider_sub_id ?? currentSub.cashfree_sub_id) as string | null
  if (!providerSubId) {
    return NextResponse.json({ error: 'Subscription has no provider ID on record.' }, { status: 500 })
  }

  // ── Determine upgrade vs downgrade ────────────────────────────────────────
  const currentTierLevel  = TIER_LEVEL[currentSub.tier]           ?? 0
  const newTierLevel      = TIER_LEVEL[newTier]                   ?? 0
  const currentCycleLevel = CYCLE_LEVEL[currentSub.billing_cycle] ?? 0
  const newCycleLevel     = CYCLE_LEVEL[newCycle]                 ?? 0

  const isUpgrade = newTierLevel > currentTierLevel ||
    (newTierLevel === currentTierLevel && newCycleLevel > currentCycleLevel)

  const admin           = createAdminClient()
  const currentProvider = getPaymentProvider(
    ((currentSub.payment_provider as string | null) ?? 'cashfree') as PaymentProviderName,
  )

  // ── Downgrade: cancel at period end — user re-subscribes manually after ──
  if (!isUpgrade) {
    try {
      // atPeriodEnd: true — Razorpay fires subscription.cancelled at cycle end;
      // other providers: same semantics managed by their own period-end logic.
      await currentProvider.cancelSubscription(providerSubId, { atPeriodEnd: true })
    } catch (err) {
      console.error('[change-plan] downgrade cancel error:', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to schedule plan downgrade.' },
        { status: 502 },
      )
    }

    await admin
      .from('subscriptions')
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq('id', currentSub.id)

    return NextResponse.json({ ok: true, type: 'downgrade_scheduled', targetPlan: newPlanKey })
  }

  // ── Upgrade: cancel immediately + start new subscription ──────────────────
  try {
    // atPeriodEnd: false — cancel now so the new plan can start immediately.
    await currentProvider.cancelSubscription(providerSubId, { atPeriodEnd: false })
  } catch (err) {
    console.error('[change-plan] upgrade cancel error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to cancel current plan.' },
      { status: 502 },
    )
  }

  await admin
    .from('subscriptions')
    .update({
      status:       'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('id', currentSub.id)

  // Build URLs
  const origin    = new URL(req.url).origin
  const siteUrl   = process.env.NEXT_PUBLIC_SITE_URL ?? origin
  const returnUrl = `${origin}/payment/success?plan=${newPlanKey}`
  const cancelUrl = `${origin}/pricing`
  const notifyUrl =
    newProviderName === 'paypal'   ? `${siteUrl}/api/payments/webhook/paypal`   :
    newProviderName === 'razorpay' ? `${siteUrl}/api/payments/webhook/razorpay` :
    `${siteUrl}/api/payments/webhook`

  // ── Calculate proration credit (unused days on old plan) ─────────────────
  // Only prorated when upgrading with PayPal (PayPal supports inline billing
  // cycle overrides). Razorpay and Cashfree: no automatic proration.
  const newPlanAmount = PAYPAL_PLAN_AMOUNTS[newPlanKey]
  let firstPaymentAmount: number | undefined
  if (newProviderName === 'paypal') {
    const credit = calcProrationCredit(
      currentSub.current_period_start as string | null,
      currentSub.billing_cycle as string,
      currentSub.amount as number,
    )
    if (credit > 0) {
      firstPaymentAmount = Math.max(0, newPlanAmount - credit)
      console.log(`[change-plan] proration: credit=$${credit} → firstPayment=$${firstPaymentAmount}`)
    }
  }

  // Create new subscription
  const newProvider = getPaymentProvider(newProviderName)
  let result: Awaited<ReturnType<typeof newProvider.createSubscription>>

  try {
    result = await newProvider.createSubscription({
      userId:    user.id,
      email:     user.email!,
      planKey:   newPlanKey,
      returnUrl,
      cancelUrl,
      notifyUrl,
      firstPaymentAmount,
    })
  } catch (err) {
    console.error('[change-plan] create new sub error:', err)
    // Current sub already cancelled — surface the error so user can retry
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start new subscription.' },
      { status: 502 },
    )
  }

  // Persist new pending subscription
  const amount   =
    newProviderName === 'paypal'   ? PAYPAL_PLAN_AMOUNTS[newPlanKey]   :
    newProviderName === 'razorpay' ? RAZORPAY_PLAN_AMOUNTS[newPlanKey] :
    plan.plan_amount
  const currency = newProviderName === 'paypal' ? 'USD' : 'INR'

  await admin.from('subscriptions').insert({
    user_id:          user.id,
    payment_provider: newProviderName,
    provider_sub_id:  result.providerSubId,
    cashfree_sub_id:  newProviderName === 'cashfree' ? result.providerSubId : null,
    cf_sub_id:        null,
    cashfree_plan_id: plan.plan_id,
    tier:             newTier,
    billing_cycle:    newCycle,
    status:           'pending',
    amount,
    currency,
  })

  if (result.checkoutMode === 'sdk') {
    const cashfreeMode = process.env.CASHFREE_ENV === 'PROD' ? 'production' : 'sandbox'
    return NextResponse.json({ checkoutMode: 'sdk', sessionId: result.sessionId, cashfreeMode })
  }

  if (result.checkoutMode === 'redirect') {
    return NextResponse.json({ checkoutMode: 'redirect', approvalUrl: result.approvalUrl })
  }

  if (result.checkoutMode === 'razorpay_popup') {
    const keyId = process.env.RAZORPAY_KEY_ID
    if (!keyId) return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 })
    return NextResponse.json({
      checkoutMode:   'razorpay_popup',
      subscriptionId: result.providerSubId,
      keyId,
    })
  }

  return NextResponse.json({ error: 'Unexpected checkout mode from provider' }, { status: 500 })
}
