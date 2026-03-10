// POST /api/rooms/[code]/join
// Joins an active room. New members enter as 'pending' — host must approve.
// Optional password check before entering pending queue.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEMBER_COLORS, isObserverTier, getDefaultBadge, verifyRoomPassword } from '@/lib/rooms'
import { broadcast, ch } from '@/lib/soketi/server'

interface Props { params: Promise<{ code: string }> }

// ── In-memory rate limiters ──────────────────────────────────────────────────
// Key: `${userId}:${roomId}` → { failures, lockedUntil }
const pwdFailures = new Map<string, { failures: number; lockedUntil: number }>()
// Key: userId → timestamps of join attempts (last hour)
const joinAttempts = new Map<string, number[]>()

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to join a room.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { password } = body

  const admin = createAdminClient()
  const now   = Date.now()

  const { data: room } = await admin
    .from('study_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (!room)                    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.status !== 'active') return NextResponse.json({ error: 'This session has already ended.' }, { status: 410 })

  // ── Password check with 5-failure → 2-min lockout ──────────────────────────
  if (room.password_hash) {
    const pwdKey  = `${user.id}:${room.id}`
    const pwdData = pwdFailures.get(pwdKey) ?? { failures: 0, lockedUntil: 0 }

    if (now < pwdData.lockedUntil) {
      const secsLeft = Math.ceil((pwdData.lockedUntil - now) / 1000)
      return NextResponse.json({
        error: `Too many wrong passwords. Try again in ${secsLeft}s.`,
      }, { status: 429 })
    }

    if (!password) return NextResponse.json({ error: 'PASSWORD_REQUIRED' }, { status: 403 })

    if (!verifyRoomPassword(password, room.password_hash)) {
      pwdData.failures += 1
      if (pwdData.failures >= 5) {
        pwdData.lockedUntil = now + 2 * 60_000
        pwdData.failures    = 0
        pwdFailures.set(pwdKey, pwdData)
        return NextResponse.json({
          error: 'Incorrect password — 5 wrong attempts. Locked out for 2 minutes.',
        }, { status: 429 })
      }
      const remaining = 5 - pwdData.failures
      pwdFailures.set(pwdKey, pwdData)
      return NextResponse.json({
        error: `Incorrect password. ${remaining} attempt${remaining !== 1 ? 's' : ''} left before 2-minute lockout.`,
      }, { status: 403 })
    }

    // Correct password — reset failure count
    pwdFailures.delete(pwdKey)
  }

  // ── Check if already a member ───────────────────────────────────────────────
  const { data: existing } = await admin
    .from('room_members')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.kicked_at) {
    const kickedAt     = new Date(existing.kicked_at).getTime()
    const cooldownEnds = kickedAt + 10 * 60_000
    if (now < cooldownEnds) {
      const minsLeft = Math.max(1, Math.ceil((cooldownEnds - now) / 60_000))
      return NextResponse.json({
        error: `You were removed from this room. You cannot rejoin for ${minsLeft} more minute${minsLeft !== 1 ? 's' : ''}.`,
      }, { status: 403 })
    }
    return NextResponse.json({
      error: 'You were removed from this room and cannot rejoin.',
    }, { status: 403 })
  }
  if (existing?.join_status === 'rejected') {
    return NextResponse.json({ error: 'The host declined your request to join this room.' }, { status: 403 })
  }

  if (existing) {
    // Re-joining (e.g. page refresh) — restore active status
    const updates: Record<string, unknown> = { left_at: null }
    if (existing.join_status !== 'pending') updates.join_status = 'approved'
    await admin.from('room_members').update(updates).eq('id', existing.id)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _ph1, ...safeRoom1 } = room as typeof room & { password_hash?: string }
    return NextResponse.json({ member: { ...existing, ...updates }, room: safeRoom1, pending: existing.join_status === 'pending' })
  }

  // ── Global join rate limit: 15 NEW attempts per hour per user ───────────────
  // Only counts genuine new join attempts, not reconnections (handled above).
  const hourAgo      = now - 3600_000
  const userAttempts = (joinAttempts.get(user.id) ?? []).filter(t => t > hourAgo)
  if (userAttempts.length >= 15) {
    const minsLeft = Math.max(1, Math.ceil((userAttempts[0] + 3600_000 - now) / 60_000))
    return NextResponse.json({
      error: `Too many join attempts. Try again in ${minsLeft} minute${minsLeft !== 1 ? 's' : ''}.`,
    }, { status: 429 })
  }
  userAttempts.push(now)
  joinAttempts.set(user.id, userAttempts)

  // ── Cannot be in 2 rooms at once ────────────────────────────────────────────
  const { count: activeInOtherRoom } = await admin
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('join_status', 'approved')
    .is('kicked_at', null)
    .is('left_at', null)
    .neq('room_id', room.id)

  if ((activeInOtherRoom ?? 0) > 0) {
    return NextResponse.json({
      error: 'You are already in another room. Leave that room before joining a new one.',
    }, { status: 409 })
  }

  // ── Room capacity check ─────────────────────────────────────────────────────
  const { count } = await admin
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', room.id)
    .eq('join_status', 'approved')
    .is('kicked_at', null)
    .is('left_at', null)

  if ((count ?? 0) >= room.max_members) {
    return NextResponse.json({ error: 'This room is full.' }, { status: 409 })
  }

  const colorIndex  = Math.min((count ?? 0), MEMBER_COLORS.length - 1)
  const avatarColor = MEMBER_COLORS[colorIndex]

  const { data: usageData } = await supabase
    .from('user_usage')
    .select('tier, preferred_badge')
    .eq('user_id', user.id)
    .single()

  const tier       = usageData?.tier ?? 'free'
  const isObserver = isObserverTier(tier)
  const badge      = usageData?.preferred_badge ?? getDefaultBadge(tier)

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

  await broadcast(ch.admission(code), 'join_request', {
    userId:      user.id,
    displayName,
    avatarColor,
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash: _ph2, ...safeRoom2 } = room as typeof room & { password_hash?: string }
  return NextResponse.json({ member, room: safeRoom2, pending: true })
}
