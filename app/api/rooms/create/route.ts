// POST /api/rooms/create
// Creates a new study room. Tier1: max 20 members. Tier2: max 50 members.
// One active room per user enforced.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateRoomCode,
  getMaxMembers,
  canCreateRoom,
  MEMBER_COLORS,
  getDefaultBadge,
  hashRoomPassword,
} from '@/lib/rooms'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { articleSlug, articleTitle, roomName, topic, password } = body

  if (!articleSlug || !articleTitle) {
    return NextResponse.json({ error: 'articleSlug and articleTitle are required' }, { status: 400 })
  }
  if (!roomName?.trim()) {
    return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
  }
  if (!password?.trim()) {
    return NextResponse.json({ error: 'Room password is required' }, { status: 400 })
  }

  const { data: usage } = await supabase
    .from('user_usage')
    .select('tier')
    .eq('user_id', user.id)
    .single()

  const tier = usage?.tier ?? 'free'
  if (!canCreateRoom(tier)) {
    return NextResponse.json(
      { error: 'Study Together rooms require a Scholar or Researcher plan.' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()

  // Enforce one active room per user
  const { data: existingRoom } = await admin
    .from('study_rooms')
    .select('id, code')
    .eq('host_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (existingRoom) {
    return NextResponse.json(
      { error: 'You already have an active room.', existingCode: existingRoom.code },
      { status: 409 },
    )
  }

  let code = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateRoomCode()
    const { data: existing } = await admin
      .from('study_rooms')
      .select('id')
      .eq('code', candidate)
      .eq('status', 'active')
      .maybeSingle()
    if (!existing) { code = candidate; break }
  }
  if (!code) return NextResponse.json({ error: 'Could not generate room code. Try again.' }, { status: 500 })

  const maxMembers  = getMaxMembers(tier)
  const displayName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user.email?.split('@')[0]
    ?? 'Host'

  const { data: room, error: roomErr } = await admin
    .from('study_rooms')
    .insert({
      code,
      host_id:       user.id,
      article_slug:  articleSlug,
      article_title: articleTitle,
      max_members:   maxMembers,
      room_name:     roomName.trim().slice(0, 60),
      topic:         topic?.trim().slice(0, 120) || null,
      password_hash: password?.trim() ? hashRoomPassword(password.trim()) : null,
    })
    .select()
    .single()

  if (roomErr || !room) {
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 })
  }

  const badge = getDefaultBadge(tier)

  await admin.from('room_members').insert({
    room_id:      room.id,
    user_id:      user.id,
    display_name: displayName,
    avatar_color: MEMBER_COLORS[0],
    is_host:      true,
    is_observer:  false,
    join_status:  'approved',
    badge,
  })

  await admin.from('room_navigation_history').insert({
    room_id:       room.id,
    article_slug:  articleSlug,
    article_title: articleTitle,
    navigated_by:  user.id,
  })

  return NextResponse.json({ code: room.code, roomId: room.id })
}
