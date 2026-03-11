// PATCH /api/rooms/[code]/badge
// Lets a room member change their badge (within their tier's allowed set).
// Broadcasts badge_changed to the admission channel so all members update.
import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveTier }  from '@/lib/getEffectiveTier'
import { broadcast, ch }     from '@/lib/soketi/server'
import { TIER1_BADGES, TIER2_BADGES } from '@/lib/rooms'

interface Props { params: Promise<{ code: string }> }

export async function PATCH(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { badge, socketId } = await req.json().catch(() => ({}))

  const admin = createAdminClient()

  // Verify room is active
  const { data: room } = await admin
    .from('study_rooms')
    .select('id, status')
    .eq('code', code.toUpperCase())
    .single()
  if (!room || room.status !== 'active') {
    return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  }

  // Verify membership
  const { data: member } = await admin
    .from('room_members')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Not in room.' }, { status: 403 })

  // Get user tier (authoritative — checks subscriptions table to avoid stale user_usage.tier)
  const tier = await getEffectiveTier(user.id, admin)

  // Validate badge is allowed for this tier (null = remove badge)
  if (badge !== null && badge !== undefined) {
    const allowed =
      tier === 'tier2' ? { ...TIER1_BADGES, ...TIER2_BADGES } :
      tier === 'tier1' ? TIER1_BADGES : {}
    if (!Object.prototype.hasOwnProperty.call(allowed, badge)) {
      return NextResponse.json({ error: 'Badge not available for your tier.' }, { status: 403 })
    }
  }

  // Update room_members
  await admin
    .from('room_members')
    .update({ badge: badge ?? null })
    .eq('room_id', room.id)
    .eq('user_id', user.id)

  // Broadcast so all members update their UI in real-time
  await broadcast(ch.admission(code), 'badge_changed', {
    userId: user.id,
    badge:  badge ?? null,
  }, socketId)

  return NextResponse.json({ ok: true })
}
