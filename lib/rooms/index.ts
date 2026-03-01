// ── Room utilities ────────────────────────────────────────────────────────────

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
  if (tier === 'tier1') return 30
  return 0 // free users cannot create rooms
}

export function canCreateRoom(tier: string): boolean {
  return tier === 'tier1' || tier === 'tier2'
}

export function isObserverTier(tier: string): boolean {
  return tier === 'free' || !tier
}

// ── Abuse prevention ──────────────────────────────────────────────────────────

const LINK_PATTERN   = /https?:\/\/\S+|www\.\S+|\b\S+\.(com|net|org|io|co|in|uk)\b/gi
const PHONE_PATTERN  = /\b\d{10,}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\+\d[\s\d\-]{9,}/g

export function containsBlockedContent(text: string): string | null {
  LINK_PATTERN.lastIndex = 0
  PHONE_PATTERN.lastIndex = 0
  if (LINK_PATTERN.test(text))  return 'Links are not allowed in room chat.'
  if (PHONE_PATTERN.test(text)) return 'Phone numbers are not allowed in room chat.'
  return null
}
