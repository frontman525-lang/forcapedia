// ─── Razorpay REST API Client ─────────────────────────────────────────────────
// Authentication: HTTP Basic Auth — key_id as username, key_secret as password.
// All monetary values the API sends/receives are in paise (1 INR = 100 paise).
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.razorpay.com'

function getAuthHeader(): string {
  const keyId     = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error('[Razorpay] RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in env')
  }
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

export async function razorpayRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path:   string,
  body?:  unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type':  'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const data = await res.json()

  if (!res.ok) {
    // Razorpay error shape: { error: { code, description, ... } }
    const description = (data?.error?.description as string | undefined) ??
      `Razorpay API error ${res.status}`
    console.error(`[Razorpay] ${method} ${path} → ${res.status}:`, data)
    const err = new Error(description) as Error & { status: number; razorpayCode?: string }
    err.status       = res.status
    err.razorpayCode = data?.error?.code as string | undefined
    throw err
  }

  return data as T
}
