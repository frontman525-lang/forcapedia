// POST /api/payments/cancel
// Cancels the user's active Cashfree subscription at the end of the current billing period.
// The user keeps their tier until the period ends (Cashfree fires SUBSCRIPTION_CANCELLED webhook).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelCashfreeSubscription } from '@/lib/cashfree/subscriptions'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the active subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('cashfree_sub_id, status, tier')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!sub?.cashfree_sub_id) {
    return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 })
  }

  if (sub.status !== 'active') {
    return NextResponse.json({ error: 'Subscription is not active.' }, { status: 409 })
  }

  // Cancel in Cashfree (triggers SUBSCRIPTION_CANCELLED webhook eventually)
  try {
    await cancelCashfreeSubscription(sub.cashfree_sub_id)
  } catch (err) {
    console.error('[cancel] Cashfree error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to cancel with payment provider.' },
      { status: 502 },
    )
  }

  // Mark locally as cancel_at_period_end — webhook will set status='cancelled' when it fires
  await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('cashfree_sub_id', sub.cashfree_sub_id)

  return NextResponse.json({
    ok: true,
    message: 'Your subscription has been cancelled. You will retain access until the end of your current billing period.',
  })
}
