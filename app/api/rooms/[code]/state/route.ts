// GET /api/rooms/[code]/state
// Returns current members + last 50 messages for reconnect rehydration.
// Called by the client when Soketi reconnects after a disconnect gap.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props { params: Promise<{ code: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('id, status')
    .eq('code', code.toUpperCase())
    .single()

  if (!room || room.status !== 'active') return NextResponse.json({ error: 'Room not active.' }, { status: 410 })

  const [membersRes, messagesRes] = await Promise.all([
    admin.from('room_members')
      .select('*')
      .eq('room_id', room.id)
      .is('kicked_at', null)
      .order('joined_at'),
    admin.from('room_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return NextResponse.json({
    members:  membersRes.data ?? [],
    messages: (messagesRes.data ?? []).reverse(),
  })
}
