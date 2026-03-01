// POST /api/rooms/[code]/join
// Joins an active room. Free-tier users join as observers.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMBER_COLORS, isObserverTier } from '@/lib/rooms'

interface Props { params: Promise<{ code: string }> }

export async function POST(_req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (!room)                  return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.status !== 'active') return NextResponse.json({ error: 'Room has ended.' }, { status: 410 })

  // Check if already a member
  const { data: existing } = await admin
    .from('room_members')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.kicked_at) {
    return NextResponse.json({ error: 'You have been removed from this room.' }, { status: 403 })
  }

  if (existing) {
    // Re-joining (e.g. refreshed page) — clear left_at
    await admin.from('room_members')
      .update({ left_at: null })
      .eq('id', existing.id)
    return NextResponse.json({ member: existing, room })
  }

  // Count current active members
  const { count } = await admin
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id)
    .is('kicked_at', null)
    .is('left_at', null)

  if ((count ?? 0) >= room.max_members) {
    return NextResponse.json({ error: 'Room is full.' }, { status: 409 })
  }

  // Pick color by position
  const colorIndex = Math.min((count ?? 0), MEMBER_COLORS.length - 1)
  const avatarColor = MEMBER_COLORS[colorIndex]

  const { data: usage } = await supabase
    .from('user_usage')
    .select('tier')
    .eq('user_id', user.id)
    .single()

  const tier       = usage?.tier ?? 'free'
  const isObserver = isObserverTier(tier)

  const displayName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user.email?.split('@')[0]
    ?? 'Guest'

  const { data: member } = await admin.from('room_members').insert({
    room_id:      room.id,
    user_id:      user.id,
    display_name: displayName,
    avatar_color: avatarColor,
    is_host:      false,
    is_observer:  isObserver,
  }).select().single()

  // System message: "X joined"
  await admin.from('room_messages').insert({
    room_id:      room.id,
    user_id:      user.id,
    display_name: displayName,
    avatar_color: avatarColor,
    content:      `${displayName} joined the room`,
    kind:         'system',
  })

  return NextResponse.json({ member, room })
}
