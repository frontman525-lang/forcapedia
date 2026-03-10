// POST /api/rooms/[code]/heartbeat
// Called every 20 seconds by connected clients.
// Broadcasts member_online to the presence channel so all clients know who's active.
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

  const { socketId } = await req.json().catch(() => ({}))

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room) return NextResponse.json({ ok: true })

  const { data: member } = await admin
    .from('room_members')
    .select('display_name, avatar_color, is_host, is_observer, kicked_at')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.kicked_at) return NextResponse.json({ ok: true })

  // Stamp last_heartbeat_at — used by cleanup cron to detect disconnected members
  // Wrapped in try/catch in case the column doesn't exist yet
  try {
    await admin.from('room_members')
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq('room_id', room.id)
      .eq('user_id', user.id)
  } catch { /* column not yet added — safe to ignore */ }

  // Broadcast to all OTHER members that this user is still online
  await broadcast(ch.presence(code), 'member_online', {
    userId:      user.id,
    displayName: member.display_name,
    avatarColor: member.avatar_color,
    isHost:      member.is_host,
    isObserver:  member.is_observer,
  }, socketId)

  return NextResponse.json({ ok: true })
}
