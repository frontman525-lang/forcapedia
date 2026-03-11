// npx tsx scripts/test-vertex.ts
// Tests that Vertex AI credentials work and the model responds.

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function toBase64url(input: ArrayBuffer | string): Promise<string> {
  let b64: string
  if (typeof input === 'string') {
    b64 = Buffer.from(input).toString('base64')
  } else {
    b64 = Buffer.from(input).toString('base64')
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getToken(): Promise<string> {
  const saJson = process.env.VERTEX_SA_KEY!
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string }

  const now = Math.floor(Date.now() / 1000)
  const header  = await toBase64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = await toBase64url(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))
  const unsigned = `${header}.${payload}`

  // Use crypto.subtle if available, else fallback to node crypto
  let sigB64: string
  try {
    const { createSign } = await import('crypto')
    const sign = createSign('RSA-SHA256')
    sign.update(unsigned)
    sigB64 = sign.sign(sa.private_key, 'base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch (e) {
    throw new Error('crypto.createSign failed: ' + e)
  }

  const jwt = `${unsigned}.${sigB64}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    throw new Error(`Token exchange failed ${tokenRes.status}: ${body}`)
  }

  const { access_token } = await tokenRes.json() as { access_token: string }
  return access_token
}

async function main() {
  const project  = process.env.VERTEX_PROJECT_ID!
  const location = process.env.VERTEX_LOCATION ?? 'us-central1'
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${location}/endpoints/openapi/chat/completions`

  console.log('1. Getting access token...')
  let token: string
  try {
    token = await getToken()
    console.log('   ✓ Token obtained')
  } catch (e) {
    console.error('   ✗ Token failed:', e)
    process.exit(1)
  }

  console.log('2. Sending test ping to Vertex AI (gemini-2.0-flash-001)...')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: 'Reply with only the word: ONLINE' },
        { role: 'user',   content: 'Status check.' },
      ],
      max_tokens: 10,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(e => { console.error('   ✗ Fetch failed:', e); process.exit(1) })

  if (!res.ok) {
    const body = await res.text()
    console.error(`   ✗ HTTP ${res.status}: ${body}`)
    process.exit(1)
  }

  const data = await res.json()
  const reply = data?.choices?.[0]?.message?.content ?? '(empty)'
  console.log(`   ✓ Reply: "${reply}"`)
  console.log('\n✅ Vertex AI is working correctly.')
}

main().catch(e => { console.error(e); process.exit(1) })
