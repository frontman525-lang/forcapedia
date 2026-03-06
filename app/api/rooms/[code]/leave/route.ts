// POST /api/rooms/[code]/leave
// If HOST leaves → close room for everyone + save session summary.
// If member leaves → mark left_at. If no one remains → close.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { saveAndCloseRoom, type SessionSummary } from '@/lib/rooms'

interface Props { params: Promise<{ code: string }> }

export async function POST(_req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true }) // silent for beacon calls

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id, status')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room) return NextResponse.json({ ok: true })

  const isHost = room.host_id === user.id

  // Mark member as left
  await admin.from('room_members')
    .update({ left_at: new Date().toISOString() })
    .eq('room_id', room.id)
    .eq('user_id', user.id)

  const { data: memberRow } = await admin
    .from('room_members')
    .select('display_name, avatar_color')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberRow && !isHost) {
    await admin.from('room_messages').insert({
      room_id:      room.id,
      user_id:      user.id,
      display_name: memberRow.display_name,
      avatar_color: memberRow.avatar_color,
      content:      `${memberRow.display_name} left the room`,
      kind:         'system',
    })
  }

  // Host leaves → close room for everyone
  if (isHost) {
    const summary = await saveAndCloseRoom(admin, room.id)
    return NextResponse.json({ ok: true, hostLeft: true, summary })
  }

  // Check if any active approved members remain
  const { count } = await admin
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id)
    .eq('join_status', 'approved')
    .is('kicked_at', null)
    .is('left_at', null)

  if ((count ?? 0) === 0) {
    await saveAndCloseRoom(admin, room.id)
  }

  return NextResponse.json({ ok: true })
}

// Re-export for backward compat (used by close/route.ts)
export { saveAndCloseRoom as closeAndWipe }
