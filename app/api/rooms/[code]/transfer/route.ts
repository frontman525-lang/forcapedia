// POST /api/rooms/[code]/transfer
// Current host transfers host role to another active member.
import { NextResponse } from 'next/server'
import { broadcast, ch } from '@/lib/soketi/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { newHostId } = await req.json().catch(() => ({}))
  if (!newHostId) return NextResponse.json({ error: 'newHostId required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room)               return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.host_id !== user.id) return NextResponse.json({ error: 'Only the host can transfer.' }, { status: 403 })

  // Verify new host is an active member
  const { data: newHostMember } = await admin
    .from('room_members')
    .select('display_name, is_observer')
    .eq('room_id', room.id)
    .eq('user_id', newHostId)
    .is('kicked_at', null)
    .is('left_at', null)
    .single()

  if (!newHostMember) return NextResponse.json({ error: 'Member not found in room.' }, { status: 404 })
  if (newHostMember.is_observer) return NextResponse.json({ error: 'Cannot transfer host to an observer.' }, { status: 400 })

  await Promise.all([
    admin.from('study_rooms').update({ host_id: newHostId }).eq('id', room.id),
    admin.from('room_members').update({ is_host: false }).eq('room_id', room.id).eq('user_id', user.id),
    admin.from('room_members').update({ is_host: true }).eq('room_id', room.id).eq('user_id', newHostId),
  ])

  await broadcast(ch.admission(code), 'host_transferred', {
    newHostId,
    newHostName: newHostMember.display_name,
  })

  return NextResponse.json({ ok: true, newHostName: newHostMember.display_name })
}
