// POST /api/rooms/[code]/typing
// Broadcasts a lightweight "user is typing" event to all room members.
// No DB writes — pure real-time signal. Auth check ensures only members can send.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { broadcast, ch } from '@/lib/soketi/server'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { displayName, socketId } = await req.json().catch(() => ({}))
  if (!displayName) return NextResponse.json({ ok: false }, { status: 400 })

  const admin = createAdminClient()

  // Verify member is in the room (lightweight — only checks room_members, no room_messages)
  const { data: room } = await admin
    .from('study_rooms')
    .select('id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room) return NextResponse.json({ ok: false }, { status: 404 })

  const { data: member } = await admin
    .from('room_members')
    .select('is_observer, kicked_at')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .single()

  if (!member || member.kicked_at || member.is_observer) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  // Fire-and-forget — don't await so the response is instant
  broadcast(ch.chat(code), 'typing', {
    userId: user.id,
    displayName,
  }, socketId).catch(() => null)

  return NextResponse.json({ ok: true })
}
