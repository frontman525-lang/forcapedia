// lib/google-indexing.ts
//
// Pings the Google Web Search Indexing API when a new article is published.
// Uses a service account stored in GOOGLE_INDEXING_SA_KEY (full JSON string).
//
// Prerequisites (one-time setup):
//   1. console.cloud.google.com → create project → enable "Web Search Indexing API"
//   2. IAM → Service Accounts → create → download JSON key
//   3. Google Search Console → Settings → Users & permissions → add SA email as Owner
//   4. Vercel env: GOOGLE_INDEXING_SA_KEY=<paste entire JSON key file content>
//
// Call: pingGoogleIndexing(url)  — fire-and-forget, never throws.

// ── Helpers ─────────────────────────────────────────────────────────────────

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

async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // Build unsigned JWT (RS256)
  const header  = toBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64url(JSON.stringify({
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))
  const unsigned = `${header}.${payload}`

  // Sign with private key
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

  // Exchange JWT for access token
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
    throw new Error(`Token exchange ${tokenRes.status}: ${body}`)
  }
  const { access_token } = await tokenRes.json() as { access_token: string }
  return access_token
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function pingGoogleIndexing(url: string): Promise<void> {
  const saJson = process.env.GOOGLE_INDEXING_SA_KEY
  if (!saJson) return  // env var not configured — skip silently

  let sa: { client_email: string; private_key: string }
  try {
    sa = JSON.parse(saJson) as { client_email: string; private_key: string }
  } catch {
    console.warn('[google-indexing] GOOGLE_INDEXING_SA_KEY is not valid JSON — skipping')
    return
  }

  try {
    const token = await getAccessToken(sa.client_email, sa.private_key)
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ url, type: 'URL_UPDATED' }),
    })
    if (res.ok) {
      console.log(`[google-indexing] ✓ pinged ${url}`)
    } else {
      const body = await res.text().catch(() => '')
      console.warn(`[google-indexing] ✗ ${res.status}: ${body}`)
    }
  } catch (err) {
    console.warn('[google-indexing] ✗ error:', err instanceof Error ? err.message : err)
  }
}
