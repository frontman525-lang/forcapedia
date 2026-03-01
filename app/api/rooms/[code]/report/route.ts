// POST /api/rooms/[code]/report
// Any member can report another member or a specific message.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
