// POST /api/rooms/[code]/join
// Joins an active room. New members enter as 'pending' — host must approve.
// Optional password check before entering pending queue.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMBER_COLORS, isObserverTier, getDefaultBadge, verifyRoomPassword } from '@/lib/rooms'
import { broadcast, ch } from '@/lib/soketi/server'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { password } = body

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (!room)                    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.status !== 'active') return NextResponse.json({ error: 'Room has ended.' }, { status: 410 })

  // Password check (if room has one)
  if (room.password_hash) {
    if (!password) return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 403 })
    if (!verifyRoomPassword(password, room.password_hash)) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 403 })
    }
  }

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
  if (existing?.join_status === 'rejected') {
    return NextResponse.json({ error: 'Your join request was declined.' }, { status: 403 })
  }

  if (existing) {
    // Re-joining (e.g. refresh within session) — restore active status
    const updates: Record<string, unknown> = { left_at: null }
    if (existing.join_status === 'pending') {
      // Still pending — let them back to waiting screen
    } else {
      updates.join_status = 'approved'
    }
    await admin.from('room_members').update(updates).eq('id', existing.id)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _ph1, ...safeRoom1 } = room as typeof room & { password_hash?: string }
    return NextResponse.json({ member: { ...existing, ...updates }, room: safeRoom1, pending: existing.join_status === 'pending' })
  }

  // Count active approved members
  const { count } = await admin
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id)
    .eq('join_status', 'approved')
    .is('kicked_at', null)
    .is('left_at', null)

  if ((count ?? 0) >= room.max_members) {
    return NextResponse.json({ error: 'Room is full.' }, { status: 409 })
  }

  const colorIndex  = Math.min((count ?? 0), MEMBER_COLORS.length - 1)
  const avatarColor = MEMBER_COLORS[colorIndex]

  const { data: usageData } = await supabase
    .from('user_usage')
    .select('tier')
    .eq('user_id', user.id)
    .single()

  const tier       = usageData?.tier ?? 'free'
  const isObserver = isObserverTier(tier)
  const badge      = getDefaultBadge(tier)

  const displayName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user.email?.split('@')[0]
    ?? 'Guest'

  // New members enter as 'pending' — host must approve
  const { data: member } = await admin.from('room_members').insert({
    room_id:      room.id,
    user_id:      user.id,
    display_name: displayName,
    avatar_color: avatarColor,
    is_host:      false,
    is_observer:  isObserver,
    join_status:  'pending',
    badge,
  }).select().single()

  // Instantly notify the host via Soketi — fixes the 20-30s admission delay (BUG 1)
  await broadcast(ch.admission(code), 'join_request', {
    userId:      user.id,
    displayName,
    avatarColor,
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash: _ph2, ...safeRoom2 } = room as typeof room & { password_hash?: string }
  return NextResponse.json({ member, room: safeRoom2, pending: true })
}
