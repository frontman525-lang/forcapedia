// GET /api/cron/cleanup-rooms
// Vercel cron — runs every 2 minutes.
// 1. Marks members whose last_heartbeat_at is > 90s ago as left.
// 2. Broadcasts member_left to presence channel for each ghost member.
// 3. If host is gone and other members remain, auto-closes the room.
// 4. If all members are gone, auto-closes the room.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { broadcast, ch } from '@/lib/soketi/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  // Verify this is called by Vercel cron (or manually with the secret)
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 90_000).toISOString() // 90 seconds ago

  // Find all active rooms
  const { data: activeRooms } = await admin
    .from('study_rooms')
    .select('id, code, host_id, max_duration_seconds, created_at')
    .eq('status', 'active')

  if (!activeRooms?.length) return NextResponse.json({ ok: true, cleaned: 0 })

  let cleaned = 0

  for (const room of activeRooms) {
    // ── Time limit enforcement ─────────────────────────────────────────────────
    if (room.max_duration_seconds && room.created_at) {
      const ageSeconds = (Date.now() - new Date(room.created_at).getTime()) / 1000
      if (ageSeconds >= room.max_duration_seconds) {
        await admin.from('study_rooms').update({ status: 'closed' }).eq('id', room.id)
        await broadcast(ch.admission(room.code), 'room_closed', { summary: null })
        cleaned++
        continue
      }
    }

    // Get all current approved members
    const { data: members } = await admin
      .from('room_members')
      .select('id, user_id, display_name, avatar_color, is_host, last_heartbeat_at')
      .eq('room_id', room.id)
      .eq('join_status', 'approved')
      .is('kicked_at', null)
      .is('left_at', null)

    if (!members?.length) continue

    // Find ghost members (heartbeat stale or never set)
    const ghosts = members.filter(m =>
      m.last_heartbeat_at && m.last_heartbeat_at < cutoff
    )

    for (const ghost of ghosts) {
      // Mark as left
      await admin.from('room_members')
        .update({ left_at: new Date().toISOString() })
        .eq('id', ghost.id)

      // System message
      await admin.from('room_messages').insert({
        room_id:      room.id,
        user_id:      ghost.user_id,
        display_name: ghost.display_name,
        avatar_color: ghost.avatar_color,
        content:      `${ghost.display_name} disconnected`,
        kind:         'system',
      }).catch(() => null)

      // Broadcast to remaining members
      await broadcast(ch.presence(room.code), 'member_left', { userId: ghost.user_id })
      cleaned++
    }

    // Re-check who's still active after marking ghosts as left
    const remaining = members.filter(m => !ghosts.find(g => g.id === m.id))

    if (remaining.length === 0) {
      // Empty room — close it
      await admin.from('study_rooms').update({ status: 'closed' }).eq('id', room.id)
      await broadcast(ch.admission(room.code), 'room_closed', { summary: null })
      continue
    }

    const hostStillActive = remaining.some(m => m.user_id === room.host_id)
    if (!hostStillActive && remaining.length > 0) {
      // Host disconnected — transfer to next non-observer member
      const nextHost = remaining.find(m => !m.is_host)
      if (nextHost) {
        await admin.from('room_members').update({ is_host: true }).eq('id', nextHost.id)
        await admin.from('study_rooms').update({ host_id: nextHost.user_id }).eq('id', room.id)
        await broadcast(ch.admission(room.code), 'host_transferred', {
          newHostId:   nextHost.user_id,
          newHostName: nextHost.display_name,
        })
      } else {
        // Only observers remain — close room
        await admin.from('study_rooms').update({ status: 'closed' }).eq('id', room.id)
        await broadcast(ch.admission(room.code), 'room_closed', { summary: null })
      }
    }
  }

  return NextResponse.json({ ok: true, cleaned })
}
