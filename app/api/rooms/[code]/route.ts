// GET /api/rooms/[code]
// Returns room data + members + last 20 messages + highlights + nav history.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props { params: Promise<{ code: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get room (RLS: must be a member — checked via admin below for join flow)
  // For the join check we use admin client temporarily
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.status !== 'active') return NextResponse.json({ error: 'Room has ended.' }, { status: 410 })

  // Check membership
  const { data: member } = await admin
    .from('room_members')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'NOT_MEMBER' }, { status: 403 })
  if (member.kicked_at) return NextResponse.json({ error: 'You have been removed from this room.' }, { status: 403 })

  const [membersRes, messagesRes, highlightsRes, navRes] = await Promise.all([
    admin.from('room_members')
      .select('*')
      .eq('room_id', room.id)
      .is('kicked_at', null)
      .order('joined_at'),
    admin.from('room_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('room_highlights')
      .select('*')
      .eq('room_id', room.id)
      .eq('article_slug', room.article_slug)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('room_navigation_history')
      .select('*')
      .eq('room_id', room.id)
      .order('navigated_at')
      .limit(20),
  ])

  return NextResponse.json({
    room,
    member,
    members:    membersRes.data ?? [],
    messages:   (messagesRes.data ?? []).reverse(),
    highlights: highlightsRes.data ?? [],
    navHistory: navRes.data ?? [],
  })
}
