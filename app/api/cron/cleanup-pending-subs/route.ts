// GET /api/cron/cleanup-pending-subs
// Vercel cron — runs every 30 minutes.
// Expires subscription rows that were created but never paid (abandoned checkouts).
// Stripe expires incomplete subscriptions after 23 hours — we match that exactly.
//
// Also downgrades any user whose subscription is past_due AND was last updated
// more than 7 days ago (all retries exhausted, no webhook received).
// Razorpay retries halted subscriptions up to 3 times; PayPal retries over 3-7 days.
// 7 days is the outer bound — generous enough to cover all provider retry windows.
import { NextResponse }      from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin   = createAdminClient()
  const now     = new Date()

  // ── 1. Expire stale pending rows (abandoned checkouts > 23 hours old) ────────
  // Matches Stripe's incomplete_expired threshold exactly (23 hours).
  const pendingCutoff = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString()

  const { data: expiredPending, error: expireErr } = await admin
    .from('subscriptions')
    .update({ status: 'expired', updated_at: now.toISOString() })
    .eq('status', 'pending')
    .lt('created_at', pendingCutoff)
    .select('id')

  if (expireErr) console.error('[cleanup-pending-subs] expire error:', expireErr)

  // ── 2. Downgrade users whose past_due subscription is > 7 days old ───────────
  // This is a safety net: if Razorpay/PayPal fails to send the cancellation
  // webhook after exhausting retries, we still downgrade after 7 days.
  const pastDueCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: stalePastDue } = await admin
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'past_due')
    .lt('updated_at', pastDueCutoff)

  let downgradedCount = 0

  for (const sub of stalePastDue ?? []) {
    await admin
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('id', sub.id)

    await admin
      .from('user_usage')
      .update({ tier: 'free' })
      .eq('user_id', sub.user_id)

    downgradedCount++
    console.log(`[cleanup-pending-subs] downgraded past_due user=${sub.user_id} after 7 days`)
  }

  console.log(`[cleanup-pending-subs] expired=${expiredPending?.length ?? 0}  downgraded=${downgradedCount}`)

  return NextResponse.json({
    ok:          true,
    expired:     expiredPending?.length ?? 0,
    downgraded:  downgradedCount,
  })
}
