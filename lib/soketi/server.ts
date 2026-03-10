// ─── Soketi server client ─────────────────────────────────────────────────────
// Used by API routes to broadcast events to all connected room clients.
// Soketi is a self-hosted, Pusher-compatible WebSocket server on Hetzner.
//
// Required env vars:
//   SOKETI_APP_ID, SOKETI_APP_SECRET
//   NEXT_PUBLIC_SOKETI_APP_KEY, NEXT_PUBLIC_SOKETI_HOST, NEXT_PUBLIC_SOKETI_PORT
//
import Pusher from 'pusher'

let _pusher: Pusher | null = null

export function getSoketi(): Pusher {
  if (!_pusher) {
    _pusher = new Pusher({
      appId:   process.env.SOKETI_APP_ID!,
      key:     process.env.NEXT_PUBLIC_SOKETI_APP_KEY!,
      secret:  process.env.SOKETI_APP_SECRET!,
      host:    process.env.NEXT_PUBLIC_SOKETI_HOST!,
      port:    process.env.NEXT_PUBLIC_SOKETI_PORT ?? '443',
      useTLS:  (process.env.NEXT_PUBLIC_SOKETI_PORT ?? '443') === '443',
      cluster: 'mt1', // Soketi ignores this; required by Pusher SDK types
    })
  }
  return _pusher
}

/** Channel name helpers — centralised so client + server always agree */
export const ch = {
  chat     : (code: string) => `room-${code.toLowerCase()}-chat`,
  doubts   : (code: string) => `room-${code.toLowerCase()}-doubts`,
  article  : (code: string) => `room-${code.toLowerCase()}-article`,
  admission: (code: string) => `room-${code.toLowerCase()}-admission`,
  presence : (code: string) => `room-${code.toLowerCase()}-presence`,
}

/**
 * Fire-and-forget broadcast to a Soketi channel.
 * Pass socketId to exclude the sender (matches Supabase `self: false` behaviour).
 */
// 3-second hard cap — if Hetzner is unreachable, API routes must not hang.
const BROADCAST_TIMEOUT_MS = 3_000

export async function broadcast(
  channel: string,
  event: string,
  data: unknown,
  socketId?: string,
): Promise<void> {
  try {
    const pusher = getSoketi()
    const trigger = pusher.trigger(
      channel,
      event,
      data,
      socketId ? { socket_id: socketId } : undefined,
    )
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('soketi broadcast timeout')), BROADCAST_TIMEOUT_MS)
    )
    await Promise.race([trigger, timeout])
  } catch (err) {
    // Never crash an API route because of a broadcast failure
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('broadcast timeout')) {
      console.error('[soketi] broadcast error:', channel, event, err)
    }
  }
}
