// POST /api/payments/subscribe
// Creates a Cashfree subscription and returns the hosted auth_link.
// The client redirects the user to auth_link to set up their payment mandate.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCashfreeSubscription } from '@/lib/cashfree/subscriptions'
import { getPlan, PlanKey } from '@/lib/cashfree/plans'

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let tier: string, billingCycle: string, phone: string | undefined
  try {
    const body = await req.json()
    tier         = body.tier
    billingCycle = body.billingCycle
    phone        = body.phone
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

  // ── Check for existing active subscription ────────────────────────────────
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('status, tier, cashfree_sub_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (existing && existing.tier === tier) {
    return NextResponse.json(
      { error: 'You are already subscribed to this plan. Visit your profile to manage it.' },
      { status: 409 },
    )
  }

  // ── Require phone number (Cashfree mandate requirement) ───────────────────
  const resolvedPhone =
    phone?.trim() ??
    (user.user_metadata?.phone as string | undefined)?.trim() ??
    null

  if (!resolvedPhone) {
    return NextResponse.json(
      { error: 'PHONE_REQUIRED', message: 'A phone number is required to set up the payment mandate.' },
      { status: 422 },
    )
  }

  // ── Create Cashfree subscription ──────────────────────────────────────────
  const origin    = new URL(req.url).origin
  const returnUrl = `${origin}/payment/success?plan=${tier}_${billingCycle}`
  const notifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/api/payments/webhook`

  let subscriptionId: string, cfSubId: string | undefined, sessionId: string

  try {
    const result = await createCashfreeSubscription({
      userId:    user.id,
      email:     user.email!,
      phone:     resolvedPhone,
      planKey:   `${tier}_${billingCycle}` as PlanKey,
      returnUrl,
      notifyUrl,
    })
    subscriptionId = result.subscriptionId
    cfSubId        = result.cfSubId
    sessionId      = result.sessionId
  } catch (err) {
    console.error('[subscribe] Cashfree error:', err)
    const message = err instanceof Error ? err.message : 'Payment gateway error'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // ── Persist phone to user metadata (for future purchases) ─────────────────
  if (phone && !user.user_metadata?.phone) {
    await supabase.auth.updateUser({ data: { phone: resolvedPhone } }).catch(console.error)
  }

  // ── Insert pending subscription record (admin client bypasses RLS) ───────
  const adminDb = createAdminClient()
  const { error: dbError } = await adminDb.from('subscriptions').insert({
    user_id:         user.id,
    cashfree_sub_id: subscriptionId,
    cf_sub_id:       cfSubId,
    cashfree_plan_id: plan.plan_id,
    tier,
    billing_cycle:   billingCycle,
    status:          'pending',
    amount:          plan.plan_amount,
    currency:        plan.plan_currency,
  })

  if (dbError) {
    console.error('[subscribe] DB insert error:', dbError)
    // Non-fatal — Cashfree already has the subscription. Proceed.
  }

  // ── Return session ID + Cashfree mode to client ──────────────────────────
  // Client uses Cashfree JS SDK: cashfree.checkout({ paymentSessionId: sessionId })
  const cashfreeMode = process.env.CASHFREE_ENV === 'PROD' ? 'production' : 'sandbox'
  return NextResponse.json({ sessionId, subscriptionId, cashfreeMode })
}
