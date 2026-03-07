// POST /api/rooms/[code]/kick
// Host removes a member. They cannot rejoin.
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

  const { targetUserId } = await req.json().catch(() => ({}))
  if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
  if (targetUserId === user.id) return NextResponse.json({ error: 'Cannot kick yourself.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room)               return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.host_id !== user.id) return NextResponse.json({ error: 'Only the host can kick members.' }, { status: 403 })

  await admin.from('room_members')
    .update({ kicked_at: new Date().toISOString() })
    .eq('room_id', room.id)
    .eq('user_id', targetUserId)

  await broadcast(ch.admission(code), 'member_kicked', { userId: targetUserId })

  return NextResponse.json({ ok: true })
}
