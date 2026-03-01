// POST /api/rooms/create
// Creates a new study room and makes the caller the host.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateRoomCode, getMaxMembers, canCreateRoom, MEMBER_COLORS } from '@/lib/rooms'

export async function POST(req: Request) {
  const supabase   = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { articleSlug, articleTitle } = body
  if (!articleSlug || !articleTitle) {
    return NextResponse.json({ error: 'articleSlug and articleTitle are required' }, { status: 400 })
  }

  // Check tier
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

  // Generate unique code (retry up to 5 times on collision)
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

  const maxMembers = getMaxMembers(tier)
  const displayName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user.email?.split('@')[0]
    ?? 'Host'

  // Create room
  const { data: room, error: roomErr } = await admin
    .from('study_rooms')
    .insert({
      code,
      host_id:       user.id,
      article_slug:  articleSlug,
      article_title: articleTitle,
      max_members:   maxMembers,
    })
    .select()
    .single()

  if (roomErr || !room) {
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 })
  }

  // Add host as first member
  await admin.from('room_members').insert({
    room_id:      room.id,
    user_id:      user.id,
    display_name: displayName,
    avatar_color: MEMBER_COLORS[0], // gold = host
    is_host:      true,
    is_observer:  false,
  })

  // Record initial nav history entry
  await admin.from('room_navigation_history').insert({
    room_id:       room.id,
    article_slug:  articleSlug,
    article_title: articleTitle,
    navigated_by:  user.id,
  })

  return NextResponse.json({ code: room.code, roomId: room.id })
}
