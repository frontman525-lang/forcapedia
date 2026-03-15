// ── Room utilities ─────────────────────────────────────────────────────────────
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const MEMBER_COLORS = [
  '#C9A96E', // gold   — host
  '#7EB8F7', // blue
  '#6FCF97', // green
  '#F7A87E', // orange
  '#B47EF7', // purple
  '#F7C97E', // amber
  '#7EF7E8', // teal
  '#F47C7C', // coral
]

// Excludes I, O, 0, 1 to avoid confusion
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join('')
}

export function getMaxMembers(tier: string): number {
  if (tier === 'tier2') return 50
  if (tier === 'tier1') return 20
  return 5 // free tier: up to 5 members
}

/** Max session length in seconds by tier. */
export function getMaxDurationSeconds(tier: string): number {
  if (tier === 'tier2') return 5 * 3600   // 5 hours
  if (tier === 'tier1') return 2 * 3600   // 2 hours
  return 25 * 60                           // 25 minutes (free)
}


export function canCreateRoom(tier: string): boolean {
  return tier === 'free' || tier === 'tier1' || tier === 'tier2'
}

export function isObserverTier(_tier: string): boolean {
  // All users (including free) can participate — chat, highlight, react.
  // Observer role removed as per product decision (BUG 3 fix).
  return false
}

// ── Badge system ───────────────────────────────────────────────────────────────

export const TIER1_BADGES: Record<string, string> = {
  scholar:  '🎓',
  star:     '⭐',
  science:  '🔬',
  bookworm: '📚',
}

export const TIER2_BADGES: Record<string, string> = {
  researcher: '👑',
  diamond:    '💎',
  explorer:   '🚀',
  elite:      '⚡',
  legend:     '🌟',
}

export function getBadgeEmoji(badge: string | null | undefined): string {
  if (!badge) return ''
  return TIER1_BADGES[badge] ?? TIER2_BADGES[badge] ?? ''
}

export function getDefaultBadge(tier: string): string | null {
  if (tier === 'tier1') return 'scholar'
  if (tier === 'tier2') return 'researcher'
  return null
}

// ── Abuse prevention ───────────────────────────────────────────────────────────

const LINK_PATTERN = /https?:\/\/\S+|www\.\S+|\b\S+\.(com|net|org|io|co|in|uk)\b/gi

export function containsBlockedContent(text: string): string | null {
  LINK_PATTERN.lastIndex = 0
  if (LINK_PATTERN.test(text)) return 'Links are not allowed in room chat.'
  return null
}

// ── IST time helpers ────────────────────────────────────────────────────────────

const IST_OFFSET_MS = 5.5 * 3600 * 1000

/**
 * Returns the UTC timestamp for the start of today in IST (midnight IST).
 * Free-tier room creation resets at this time each day.
 */
export function getMidnightISTasUTC(): Date {
  const nowIST     = new Date(Date.now() + IST_OFFSET_MS)
  // Build midnight in IST (as a UTC value with the IST date fields)
  const midnightUTC = Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate())
  // Shift back: this UTC value represents midnight IST → subtract offset
  return new Date(midnightUTC - IST_OFFSET_MS)
}

// ── Password hashing (SHA-256 via Node crypto) ─────────────────────────────────

export function hashRoomPassword(password: string): string {
  return createHash('sha256').update(password.trim()).digest('hex')
}

export function verifyRoomPassword(input: string, hash: string): boolean {
  return hashRoomPassword(input) === hash
}

// ── Session summary ────────────────────────────────────────────────────────────

export interface SessionSummary {
  roomId:          string
  roomName:        string
  roomCode:        string
  hostId:          string | null
  memberCount:     number
  memberNames:     string[]
  articleTitles:   string[]
  doubtsResolved:  number
  messageCount:    number
  durationSeconds: number
  startedAt:       string
  endedAt:         string
}

/**
 * Saves a session summary to DB, marks room as ended, wipes temporary data.
 * Returns the summary so callers can broadcast it to remaining members.
 */
export async function saveAndCloseRoom(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
): Promise<SessionSummary | null> {
  const endedAt = new Date()

  try {
    const [roomRes, membersRes, messagesRes, navRes] = await Promise.all([
      admin.from('study_rooms').select('*').eq('id', roomId).single(),
      admin.from('room_members').select('*').eq('room_id', roomId),
      admin.from('room_messages').select('*').eq('room_id', roomId).order('created_at'),
      admin.from('room_navigation_history').select('*').eq('room_id', roomId).order('navigated_at'),
    ])

    const room     = roomRes.data
    const members  = membersRes.data  ?? []
    const messages = messagesRes.data ?? []
    const navHist  = navRes.data      ?? []

    if (!room) {
      await admin.from('study_rooms')
        .update({ status: 'ended', ended_at: endedAt.toISOString() })
        .eq('id', roomId)
      return null
    }

    const durationSeconds = Math.round(
      (endedAt.getTime() - new Date(room.created_at).getTime()) / 1000
    )

    // Build unique article list (initial + navigation)
    const seen = new Set<string>([room.article_slug])
    const articleSlugs  = [room.article_slug]
    const articleTitles = [room.article_title]
    for (const n of navHist) {
      if (!seen.has(n.article_slug)) {
        seen.add(n.article_slug)
        articleSlugs.push(n.article_slug)
        articleTitles.push(n.article_title)
      }
    }

    const approvedMembers = members.filter(
      m => (m as { join_status?: string }).join_status !== 'pending' &&
           (m as { join_status?: string }).join_status !== 'rejected'
    )
    const memberIds   = approvedMembers.map(m => m.user_id as string)
    const memberNames = approvedMembers.map(m => m.display_name as string)

    const hostMember = approvedMembers.find((m: { is_host: boolean }) => m.is_host)
    const roomName   = (room as { room_name?: string }).room_name
      ?? `${hostMember?.display_name ?? 'Study'}'s Room`

    const doubtsResolved = messages.filter((m: { kind: string }) => m.kind === 'explain').length
    const messageCount   = messages.filter((m: { kind: string }) => m.kind === 'text').length

    const summary: SessionSummary = {
      roomId,
      roomName,
      roomCode:        room.code,
      hostId:          room.host_id,
      memberCount:     approvedMembers.length,
      memberNames,
      articleTitles,
      doubtsResolved,
      messageCount,
      durationSeconds,
      startedAt:       room.created_at,
      endedAt:         endedAt.toISOString(),
    }

    const { error: summaryInsertError } = await admin.from('session_summaries').insert({
      room_id:          roomId,
      host_id:          room.host_id,
      room_name:        roomName,
      room_code:        room.code,
      article_slugs:    articleSlugs,
      article_titles:   articleTitles,
      member_ids:       memberIds,
      member_names:     memberNames,
      member_count:     approvedMembers.length,
      doubts_resolved:  doubtsResolved,
      message_count:    messageCount,
      started_at:       room.created_at,
      ended_at:         endedAt.toISOString(),
      duration_seconds: durationSeconds,
      messages_json:    messages.length > 0 ? messages : null,
    })
    if (summaryInsertError) {
      console.error('[rooms] session_summaries insert error:', summaryInsertError)
    }

    await admin.from('study_rooms')
      .update({ status: 'ended', ended_at: endedAt.toISOString() })
      .eq('id', roomId)

    await Promise.all([
      admin.from('room_messages').delete().eq('room_id', roomId),
      admin.from('room_highlights').delete().eq('room_id', roomId),
      admin.from('room_navigation_history').delete().eq('room_id', roomId),
    ])

    return summary
  } catch (err) {
    console.error('[rooms] saveAndCloseRoom error:', err)
    await admin.from('study_rooms')
      .update({ status: 'ended', ended_at: endedAt.toISOString() })
      .eq('id', roomId)
    return null
  }
}

/** Backward-compat alias — prefer saveAndCloseRoom */
export async function closeAndWipe(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
): Promise<void> {
  await saveAndCloseRoom(admin, roomId)
}
