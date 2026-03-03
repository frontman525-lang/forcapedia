// GET /api/payments/history
// Returns the authenticated user's billing event history.
// Queries payment_events joined through the user's subscriptions.
import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all the user's provider sub IDs across all subscriptions
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('provider_sub_id, cashfree_sub_id, tier, billing_cycle, currency')
    .eq('user_id', user.id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ events: [] })
  }

  // Collect all sub IDs (provider_sub_id for new rows, cashfree_sub_id for legacy)
  const subIds = [
    ...subs.map(s => s.provider_sub_id).filter(Boolean),
    ...subs.map(s => s.cashfree_sub_id).filter(Boolean),
  ].filter((v, i, a) => a.indexOf(v) === i) as string[]  // dedupe

  if (subIds.length === 0) {
    return NextResponse.json({ events: [] })
  }

  // Build a quick lookup: subId → { tier, billing_cycle }
  const subMeta: Record<string, { tier: string; billing_cycle: string }> = {}
  for (const s of subs) {
    if (s.provider_sub_id) subMeta[s.provider_sub_id] = { tier: s.tier, billing_cycle: s.billing_cycle }
    if (s.cashfree_sub_id) subMeta[s.cashfree_sub_id] = { tier: s.tier, billing_cycle: s.billing_cycle }
  }

  // Use admin client — payment_events RLS may not cover all rows
  const admin = createAdminClient()
  const { data: events } = await admin
    .from('payment_events')
    .select('id, event_type, provider_sub_id, cashfree_sub_id, payment_provider, amount, currency, created_at')
    .in('provider_sub_id', subIds)
    .in('event_type', ['subscription.activated', 'subscription.payment.success'])
    .order('created_at', { ascending: false })
    .limit(50)

  const rows = (events ?? []).map(e => {
    const sid = e.provider_sub_id ?? e.cashfree_sub_id ?? ''
    const meta = subMeta[sid] ?? {}
    return {
      id:            e.id,
      event_type:    e.event_type,
      provider:      e.payment_provider,
      amount:        e.amount,
      currency:      e.currency,
      tier:          meta.tier ?? null,
      billing_cycle: meta.billing_cycle ?? null,
      created_at:    e.created_at,
    }
  })

  return NextResponse.json({ events: rows })
}
