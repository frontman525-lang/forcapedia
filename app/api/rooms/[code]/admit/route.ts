// POST /api/rooms/[code]/admit
// Host approves or rejects a pending join request.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { broadcast, ch } from '@/lib/soketi/server'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetUserId, approved } = await req.json().catch(() => ({}))
  if (!targetUserId || typeof approved !== 'boolean') {
    return NextResponse.json({ error: 'targetUserId and approved required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room)                    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.host_id !== user.id) return NextResponse.json({ error: 'Only the host can admit members.' }, { status: 403 })

  const newStatus = approved ? 'approved' : 'rejected'

  await admin.from('room_members')
    .update({ join_status: newStatus })
    .eq('room_id', room.id)
    .eq('user_id', targetUserId)
    .eq('join_status', 'pending')

  if (approved) {
    const { data: memberRow } = await admin
      .from('room_members')
      .select('display_name, avatar_color')
      .eq('room_id', room.id)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (memberRow) {
      await admin.from('room_messages').insert({
        room_id:      room.id,
        user_id:      targetUserId,
        display_name: memberRow.display_name,
        avatar_color: memberRow.avatar_color,
        content:      `${memberRow.display_name} joined the room`,
        kind:         'system',
      })
    }
  }

  // Broadcast result to all clients via Soketi
  const admission = ch.admission(code)
  if (approved && memberRow) {
    // Tell everyone the member is now approved (their client reloads)
    await broadcast(admission, 'admit_approved', { userId: targetUserId, member: memberRow })
    // Add member to everyone's member list
    await broadcast(admission, 'member_joined', { ...memberRow, user_id: targetUserId, join_status: 'approved', is_host: false })
  } else if (!approved) {
    await broadcast(admission, 'admit_rejected', { userId: targetUserId })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
