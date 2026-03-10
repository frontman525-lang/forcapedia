// POST /api/payments/verify/razorpay
//
// Called immediately after the Razorpay checkout popup closes successfully.
// The Razorpay JS SDK handler provides three fields that we verify here:
//   { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
//
// Verification algorithm:
//   HMAC-SHA256( razorpay_payment_id + "|" + razorpay_subscription_id, RAZORPAY_KEY_SECRET )
//   Must equal razorpay_signature
//
// On valid signature → immediately activate the subscription in DB so the user
// gets access without waiting for the webhook (which can take seconds).
// The webhook (subscription.activated) will also fire — the processor is
// idempotent on already-active rows, so there is no double-activation risk.
//
import { NextResponse }           from 'next/server'
import { createClient }           from '@/lib/supabase/server'
import { createAdminClient }      from '@/lib/supabase/admin'
import { verifyRazorpayCheckoutSignature } from '@/lib/razorpay/webhook'

export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse body ────────────────────────────────────────────────────────────
  let paymentId: string, subscriptionId: string, signature: string
  try {
    const body     = await req.json()
    paymentId      = body.razorpay_payment_id
    subscriptionId = body.razorpay_subscription_id
    signature      = body.razorpay_signature
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!paymentId || !subscriptionId || !signature) {
    return NextResponse.json(
      { error: 'razorpay_payment_id, razorpay_subscription_id, and razorpay_signature are required' },
      { status: 400 },
    )
  }

  // ── Verify HMAC signature ─────────────────────────────────────────────────
  // Prevents a malicious actor from faking a successful payment by simply
  // calling this endpoint with a fabricated subscription ID.
  if (!verifyRazorpayCheckoutSignature(paymentId, subscriptionId, signature)) {
    console.warn(`[verify/razorpay] invalid signature — user=${user.id}  sub=${subscriptionId}`)
    return NextResponse.json(
      { error: 'Payment verification failed. Please contact support if you were charged.' },
      { status: 400 },
    )
  }

  console.log(`[verify/razorpay] ✓ signature valid — user=${user.id}  sub=${subscriptionId}  pay=${paymentId}`)

  // ── Find the pending subscription row ────────────────────────────────────
  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, tier, status')
    .eq('user_id', user.id)
    .eq('provider_sub_id', subscriptionId)
    .maybeSingle()

  if (!sub) {
    // Row should exist (created by /api/payments/subscribe).
    // If not found, it means the subscribe route's DB insert failed.
    console.error(`[verify/razorpay] CRITICAL: no subscription row found for sub=${subscriptionId} user=${user.id}. The subscribe API insert may have failed.`)
    return NextResponse.json(
      { error: 'Subscription record not found. Please contact support with your payment ID: ' + paymentId },
      { status: 404 },
    )
  }

  // ── Activate subscription row ─────────────────────────────────────────────
  if (sub.status !== 'active') {
    const { error: subErr } = await admin
      .from('subscriptions')
      .update({
        status:               'active',
        current_period_start: new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      })
      .eq('id', sub.id)

    if (subErr) console.error(`[verify/razorpay] subscriptions update error:`, subErr)
  }

  // ── Update user tier — ALWAYS run regardless of subscription status ───────
  // Runs even if subscription was already active (e.g. webhook beat us here),
  // because the webhook processor's user_usage update may have failed silently.
  const { error: usageErr } = await admin
    .from('user_usage')
    .update({ tier: sub.tier })
    .eq('user_id', user.id)

  if (usageErr) {
    console.error(`[verify/razorpay] user_usage update error for user=${user.id}:`, usageErr)
    // Even if user_usage update fails, return ok — the tier will be set by
    // the subscription.activated webhook as a fallback.
  }

  console.log(`[verify/razorpay] ✓ ACTIVATED — user=${user.id}  tier=${sub.tier}  sub=${subscriptionId}  prevStatus=${sub.status}`)

  return NextResponse.json({ ok: true })
}
