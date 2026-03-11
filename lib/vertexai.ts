// lib/vertexai.ts
//
// Vertex AI helper — OAuth2 Bearer token + OpenAI-compat endpoint.
// Token is cached in memory for 55 minutes to avoid excess JWT exchanges.
//
// Required env vars:
//   VERTEX_SA_KEY       — full contents of your service account JSON key file
//   VERTEX_PROJECT_ID   — Google Cloud project ID
//   VERTEX_LOCATION     — (optional) region, defaults to "us-central1"
//
// Model used: google/gemini-2.0-flash-001

// ── Helpers (same signing logic as lib/google-indexing.ts) ──────────────────

function toBase64url(input: ArrayBuffer | string): string {
  let b64: string
  if (typeof input === 'string') {
    b64 = btoa(input)
  } else {
    const bytes = new Uint8Array(input)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    b64 = btoa(bin)
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function pemToKeyBuffer(pem: string): Promise<ArrayBuffer> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(b64)
  const buf = new ArrayBuffer(binary.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  return buf
}

async function mintAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header  = toBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64url(JSON.stringify({
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))
  const unsigned = `${header}.${payload}`

  const keyBuf = await pemToKeyBuffer(privateKeyPem)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuf,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${toBase64url(sigBuf)}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '')
    throw new Error(`Vertex token exchange ${tokenRes.status}: ${body}`)
  }
  const { access_token } = await tokenRes.json() as { access_token: string }
  return access_token
}

// ── Token cache ─────────────────────────────────────────────────────────────

let _cache: { token: string; expiresAt: number } | null = null

export async function getVertexToken(): Promise<string> {
  const nowMs = Date.now()
  if (_cache && nowMs < _cache.expiresAt) return _cache.token

  const saJson = process.env.VERTEX_SA_KEY
  if (!saJson) throw new Error('VERTEX_SA_KEY not configured')

  const sa = JSON.parse(saJson) as { client_email: string; private_key: string }
  const token = await mintAccessToken(sa.client_email, sa.private_key)
  _cache = { token, expiresAt: nowMs + 55 * 60 * 1000 }   // cache 55 min
  return token
}

// ── Endpoint ─────────────────────────────────────────────────────────────────

export function getVertexEndpoint(): string {
  const project  = process.env.VERTEX_PROJECT_ID
  if (!project) throw new Error('VERTEX_PROJECT_ID not configured')
  const location = process.env.VERTEX_LOCATION ?? 'us-central1'
  return `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/endpoints/openapi/chat/completions`
}

export function isVertexConfigured(): boolean {
  return !!(process.env.VERTEX_SA_KEY && process.env.VERTEX_PROJECT_ID)
}

export const VERTEX_MODEL = 'google/gemini-2.0-flash-001'

// ── Pre-warm on module load (Option A) ──────────────────────────
// Mint the first token immediately so it's cached before any user request.
// The OAuth2 exchange adds ~300–800ms on cold start — this hides it entirely.
if (isVertexConfigured()) {
  getVertexToken().catch(() => { /* ignore — will retry on first real request */ })
}
