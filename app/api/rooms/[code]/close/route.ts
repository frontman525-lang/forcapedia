// POST /api/rooms/[code]/close
// Host explicitly ends the session for everyone. Saves session summary.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveAndCloseRoom } from '@/lib/rooms'
import { broadcast, ch } from '@/lib/soketi/server'

interface Props { params: Promise<{ code: string }> }

export async function POST(_req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room)                    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.host_id !== user.id) return NextResponse.json({ error: 'Only the host can close the room.' }, { status: 403 })

  const summary = await saveAndCloseRoom(admin, room.id)

  await broadcast(ch.admission(code), 'room_closed', { summary })

  return NextResponse.json({ ok: true, summary })
}
