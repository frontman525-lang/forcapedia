// POST /api/rooms/[code]/leave
// Marks member as left. If no active members remain, closes and wipes the room.
// Also called via navigator.sendBeacon on tab close.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

  // Mark member as left
  await admin.from('room_members')
    .update({ left_at: new Date().toISOString() })
    .eq('room_id', room.id)
    .eq('user_id', user.id)

  // System message
  const { data: memberRow } = await admin
    .from('room_members')
    .select('display_name, avatar_color')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberRow) {
    await admin.from('room_messages').insert({
      room_id:      room.id,
      user_id:      user.id,
      display_name: memberRow.display_name,
      avatar_color: memberRow.avatar_color,
      content:      `${memberRow.display_name} left the room`,
      kind:         'system',
    })
  }

  // Check if any active members remain
  const { count } = await admin
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id)
    .is('kicked_at', null)
    .is('left_at', null)

  if ((count ?? 0) === 0) {
    await closeAndWipe(admin, room.id)
  }

  return NextResponse.json({ ok: true })
}

export async function closeAndWipe(admin: ReturnType<typeof createAdminClient>, roomId: string) {
  await admin.from('study_rooms').update({
    status:   'ended',
    ended_at: new Date().toISOString(),
  }).eq('id', roomId)

  // Wipe temporary data
  await Promise.all([
    admin.from('room_messages').delete().eq('room_id', roomId),
    admin.from('room_highlights').delete().eq('room_id', roomId),
    admin.from('room_navigation_history').delete().eq('room_id', roomId),
  ])
}
