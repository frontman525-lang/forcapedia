// POST /api/payments/cancel
//
// Provider-agnostic subscription cancellation.
// Detects which provider manages the active subscription and calls it.
// The user retains access until the current billing period ends
// (provider fires subscription.cancelled webhook when period expires).
//
import { NextResponse }       from 'next/server'
import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { getPaymentProvider } from '@/lib/payments'
import type { PaymentProviderName } from '@/lib/payments/types'

export async function POST() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Find the active subscription ──────────────────────────────────────────
  // Use order + limit instead of maybeSingle() to safely handle the rare case
  // where duplicate active rows exist (e.g. from manual DB fixes during testing).
  const { data: rows } = await supabase
    .from('subscriptions')
    .select('id, payment_provider, provider_sub_id, cashfree_sub_id, status, tier')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  const sub = rows?.[0] ?? null

  if (!sub) {
    return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 })
  }

  // Resolve the provider's subscription ID.
  // New rows have provider_sub_id; legacy Cashfree rows may only have cashfree_sub_id.
  const providerSubId = (sub.provider_sub_id ?? sub.cashfree_sub_id) as string | null
  if (!providerSubId) {
    return NextResponse.json({ error: 'Subscription has no provider ID on record.' }, { status: 500 })
  }

  const providerName = ((sub.payment_provider as string | null) ?? 'cashfree') as PaymentProviderName
  const provider     = getPaymentProvider(providerName)

  // ── Cancel with provider ──────────────────────────────────────────────────
  const adminDb = createAdminClient()

  try {
    // atPeriodEnd: true — user keeps access until current billing period ends.
    // Razorpay uses cancel_at_cycle_end: 1; other providers ignore this option.
    await provider.cancelSubscription(providerSubId, { atPeriodEnd: true })
  } catch (err) {
    const msg    = err instanceof Error ? err.message : ''
    const isGone = /not exist|not found|no longer|invalid.*id|404/i.test(msg) ||
                   (err as { status?: number }).status === 404

    if (isGone) {
      // Subscription no longer exists at provider (e.g. expired test sub,
      // already cancelled externally). Mark it cancelled in our DB and let the
      // user proceed — they clearly have no active billing relationship.
      console.warn(`[cancel] ${providerName} sub not found at provider — marking cancelled locally. sub=${sub.id}`)
      await adminDb
        .from('subscriptions')
        .update({ status: 'cancelled', cancel_at_period_end: true, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', sub.id)
      // Downgrade tier since there's no real subscription backing it
      await adminDb.from('user_usage').update({ tier: 'free' }).eq('user_id', user.id)
      return NextResponse.json({ ok: true, message: 'Subscription cancelled.' })
    }

    console.error(`[cancel] ${providerName} error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to cancel with payment provider.' },
      { status: 502 },
    )
  }

  // ── Mark locally as pending cancellation ─────────────────────────────────
  // Status stays 'active' — the provider fires subscription.cancelled webhook
  // at period end, which is when the processor sets status = 'cancelled'.
  await adminDb
    .from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('id', sub.id)

  return NextResponse.json({
    ok:      true,
    message: 'Your subscription has been cancelled. You will retain access until the end of your current billing period.',
  })
}
