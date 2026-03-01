// GET /api/payments/status
// Returns the authenticated user's current subscription + usage summary.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Active or pending subscription (most recent first)
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, tier, billing_cycle, status, amount, currency, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, created_at')
    .eq('user_id', user.id)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Token usage for the current billing month
  const { data: usage } = await supabase
    .from('user_usage')
    .select('tier, tokens_used, period_start')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ subscription, usage })
}
