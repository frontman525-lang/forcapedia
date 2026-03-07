// ─── Soketi browser client ───────────────────────────────────────────────────
// Singleton — one WebSocket connection per page, shared across all rooms.
// Call getPusher() to get (or lazily create) the connection.
//
import PusherClient from 'pusher-js'

let _client: PusherClient | null = null

export function getPusher(): PusherClient {
  if (_client) return _client
  const port = Number(process.env.NEXT_PUBLIC_SOKETI_PORT ?? 443)
  _client = new PusherClient(process.env.NEXT_PUBLIC_SOKETI_APP_KEY!, {
    wsHost:            process.env.NEXT_PUBLIC_SOKETI_HOST!,
    wsPort:            port,
    wssPort:           port,
    forceTLS:          port === 443,
    disableStats:      true,
    enabledTransports: ['ws', 'wss'],
    cluster:           'mt1',
  })
  return _client
}

/** Channel name helpers — must match lib/soketi/server.ts */
export const ch = {
  chat     : (code: string) => `room-${code.toLowerCase()}-chat`,
  doubts   : (code: string) => `room-${code.toLowerCase()}-doubts`,
  article  : (code: string) => `room-${code.toLowerCase()}-article`,
  admission: (code: string) => `room-${code.toLowerCase()}-admission`,
  presence : (code: string) => `room-${code.toLowerCase()}-presence`,
}

export type { PusherClient }
