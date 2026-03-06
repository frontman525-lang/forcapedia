// POST /api/rooms/[code]/pin
// Host pins or unpins a message. Only one message can be pinned at a time.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messageId, pinned } = await req.json().catch(() => ({}))
  if (!messageId || typeof pinned !== 'boolean') {
    return NextResponse.json({ error: 'messageId and pinned required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room)                    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.host_id !== user.id) return NextResponse.json({ error: 'Only the host can pin messages.' }, { status: 403 })

  if (pinned) {
    // Unpin any currently pinned messages first
    await admin.from('room_messages')
      .update({ pinned: false })
      .eq('room_id', room.id)
      .eq('pinned', true)
  }

  await admin.from('room_messages')
    .update({ pinned })
    .eq('id', messageId)
    .eq('room_id', room.id)

  return NextResponse.json({ ok: true })
}
