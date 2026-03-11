// lib/getEffectiveTier.ts
//
// Single source of truth for "what tier does this user actually have access to?"
//
// Problem: user_usage.tier is written by the webhook processor. But Razorpay fires
// subscription.cancelled IMMEDIATELY on cancel-at-period-end — before the period ends.
// The old processor set tier='free' on that event, making ALL feature gates break even
// though the user still has paid access until current_period_end.
//
// Fix: always check subscriptions table first (authoritative), fall back to user_usage
// only when no real subscription row exists.
//
// Usage:
//   const admin = createAdminClient()
//   const tier  = await getEffectiveTier(user.id, admin)

import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export async function getEffectiveTier(
  userId: string,
  admin: AdminClient,
): Promise<string> {
  const [subRes, usageRes] = await Promise.all([
    // Authoritative: ignore pending/expired checkout rows
    admin
      .from('subscriptions')
      .select('tier, status, cancel_at_period_end, current_period_end')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Fallback: user_usage (may be stale after Razorpay early-cancel webhook)
    admin
      .from('user_usage')
      .select('tier')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const s = subRes.data
  const hasActiveSub = s && (
    s.status === 'active' ||
    s.status === 'past_due' ||
    (
      s.status === 'cancelled' &&
      s.cancel_at_period_end &&
      s.current_period_end &&
      new Date(s.current_period_end) > new Date()
    )
  )

  return hasActiveSub ? (s!.tier as string) : (usageRes.data?.tier ?? 'free')
}
