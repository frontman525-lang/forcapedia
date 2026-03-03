// ─── PayPal REST API Client ───────────────────────────────────────────────────
// Handles OAuth2 client-credentials token acquisition + all API calls.
// Docs: https://developer.paypal.com/api/rest/
//
// Token caching: module-level — best-effort in serverless (may not persist
// across cold starts, but that just means an extra token request, not an error).

const BASE_URL =
  process.env.PAYPAL_ENV === 'PRODUCTION'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

export { BASE_URL as PAYPAL_BASE_URL }

// ── Typed error ───────────────────────────────────────────────────────────────
export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'PayPalError'
  }
}

// ── OAuth2 token cache ────────────────────────────────────────────────────────
let tokenCache: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  // Return cached token with 5-minute safety buffer
  if (tokenCache && Date.now() < tokenCache.expiresAt - 300_000) {
    return tokenCache.value
  }

  const clientId = process.env.PAYPAL_CLIENT_ID
  const secret   = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !secret) {
    throw new PayPalError('PayPal credentials not configured', 500, 'MISSING_CREDENTIALS')
  }

  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64')

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'application/json',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json().catch(() => ({})) as Record<string, unknown>

  if (!res.ok) {
    const msg = (data.error_description as string | undefined) ?? `PayPal OAuth failed (HTTP ${res.status})`
    throw new PayPalError(msg, res.status, 'OAUTH_FAILED')
  }

  tokenCache = {
    value:     data.access_token as string,
    expiresAt: Date.now() + ((data.expires_in as number) ?? 3600) * 1000,
  }

  return tokenCache.value
}

// ── Generic request wrapper ───────────────────────────────────────────────────
export async function paypalRequest<T = unknown>(
  method:          'GET' | 'POST' | 'PATCH' | 'DELETE',
  path:            string,
  body?:           unknown,
  idempotencyKey?: string,   // PayPal-Request-Id header — prevents duplicate charges
): Promise<T> {
  const token = await getAccessToken()

  const reqHeaders: Record<string, string> = {
    Authorization:  `Bearer ${token}`,
    Accept:         'application/json',
    'Content-Type': 'application/json',
  }
  if (idempotencyKey) {
    reqHeaders['PayPal-Request-Id'] = idempotencyKey
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body:    body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content (e.g. subscription cancel)
  if (res.status === 204) return {} as T

  const data = await res.json().catch(() => ({})) as Record<string, unknown>

  if (!res.ok) {
    const msg =
      (data.message          as string | undefined) ??
      (data.error_description as string | undefined) ??
      `PayPal HTTP ${res.status}`
    throw new PayPalError(msg, res.status, data.name as string | undefined)
  }

  return data as T
}
