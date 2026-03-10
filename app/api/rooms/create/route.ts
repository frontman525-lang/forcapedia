// POST /api/rooms/create
// Creates a new study room. Tier1: max 20 members. Tier2: max 50 members.
// One active room per user enforced.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateRoomCode,
  getMaxMembers,
  getMaxDurationSeconds,
  getMidnightISTasUTC,
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

  if (!roomName?.trim()) {
    return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
  }

  const { data: usage } = await supabase
    .from('user_usage')
    .select('tier, preferred_badge')
    .eq('user_id', user.id)
    .maybeSingle()

  const tier = usage?.tier ?? 'free'

  const admin = createAdminClient()

  if (tier === 'free') {
    // Free plan: 1 room per day — resets at midnight IST
    const midnightIST = getMidnightISTasUTC()
    const { data: todayRoom } = await admin
      .from('study_rooms')
      .select('id')
      .eq('host_id', user.id)
      .gte('created_at', midnightIST.toISOString())
      .limit(1)
      .maybeSingle()

    if (todayRoom) {
      const nextMidnight = new Date(midnightIST.getTime() + 24 * 3600_000)
      const minsLeft = Math.max(1, Math.ceil((nextMidnight.getTime() - Date.now()) / 60_000))
      const timeStr = minsLeft >= 60
        ? `${Math.ceil(minsLeft / 60)} hour${Math.ceil(minsLeft / 60) !== 1 ? 's' : ''}`
        : `${minsLeft} minute${minsLeft !== 1 ? 's' : ''}`
      return NextResponse.json({
        error: `Free plan allows 1 room per day. Resets at midnight IST — ${timeStr} left. Upgrade to Scholar for unlimited rooms.`,
        upgradeUrl: '/pricing',
      }, { status: 429 })
    }
  } else if (tier !== 'tier1' && tier !== 'tier2') {
    return NextResponse.json(
      { error: 'Creating study rooms requires a Scholar or Researcher plan. Visit /pricing to upgrade.' },
      { status: 403 },
    )
  }

  // Enforce one active room per user (all tiers)
  const { data: existingRoom } = await admin
    .from('study_rooms')
    .select('id, code')
    .eq('host_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (existingRoom) {
    return NextResponse.json(
      { error: 'You already have an active room running.', existingCode: existingRoom.code },
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

  const maxMembers         = getMaxMembers(tier)
  const maxDurationSeconds = getMaxDurationSeconds(tier)
  const displayName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user.email?.split('@')[0]
    ?? 'Host'

  const { data: room, error: roomErr } = await admin
    .from('study_rooms')
    .insert({
      code,
      host_id:              user.id,
      article_slug:         articleSlug?.trim() || '',
      article_title:        articleTitle?.trim() || '',
      max_members:          maxMembers,
      room_name:            roomName.trim().slice(0, 60),
      topic:                topic?.trim().slice(0, 120) || null,
      password_hash:        password?.trim() ? hashRoomPassword(password.trim()) : null,
      max_duration_seconds: maxDurationSeconds,
    })
    .select()
    .single()

  if (roomErr || !room) {
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 })
  }

  const badge = usage?.preferred_badge ?? getDefaultBadge(tier)

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

  if (articleSlug?.trim()) {
    await admin.from('room_navigation_history').insert({
      room_id:       room.id,
      article_slug:  articleSlug.trim(),
      article_title: articleTitle?.trim() || '',
      navigated_by:  user.id,
    })
  }

  return NextResponse.json({ code: room.code, roomId: room.id })
}
