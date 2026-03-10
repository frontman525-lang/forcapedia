// POST /api/rooms/[code]/report
// Any member can report another member or a specific message.
// Rate limit: 5 reports per 10 minutes per user.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props { params: Promise<{ code: string }> }

// In-memory: userId → timestamps of reports in last 10 min
const reportTracker = new Map<string, number[]>()

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 5 reports per 10 minutes
  const now        = Date.now()
  const windowMs   = 10 * 60_000
  const windowStart = now - windowMs
  const recent = (reportTracker.get(user.id) ?? []).filter(t => t > windowStart)
  if (recent.length >= 5) {
    const oldestInWindow = recent[0]
    const secsLeft = Math.ceil((oldestInWindow + windowMs - now) / 1000)
    const minsLeft = Math.ceil(secsLeft / 60)
    return NextResponse.json({
      error: `You've submitted 5 reports recently. You can report again in ${minsLeft} minute${minsLeft !== 1 ? 's' : ''}.`,
    }, { status: 429 })
  }
  recent.push(now)
  reportTracker.set(user.id, recent)

  const { reportedUserId, messageId, reason = 'inappropriate' } = await req.json().catch(() => ({}))

  const admin = createAdminClient()
  const { data: room } = await admin
    .from('study_rooms')
    .select('id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

  await admin.from('room_reports').insert({
    room_id:     room.id,
    reporter_id: user.id,
    reported_id: reportedUserId ?? null,
    message_id:  messageId ?? null,
    reason,
  })

  return NextResponse.json({ ok: true })
}
