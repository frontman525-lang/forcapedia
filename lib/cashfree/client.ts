// ─── Cashfree API Client ────────────────────────────────────────────────────
// Thin fetch wrapper with auth headers.
// Docs: https://docs.cashfree.com/reference/pg-latest

const BASE_URL =
  process.env.CASHFREE_ENV === 'PROD'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg'

const API_VERSION = '2023-08-01'

export class CashfreeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
    this.name = 'CashfreeError'
  }
}

export async function cashfreeRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const appId  = process.env.CASHFREE_APP_ID
  const secret = process.env.CASHFREE_SECRET_KEY

  if (!appId || !secret) {
    throw new CashfreeError('Cashfree credentials not configured', 500, 'MISSING_CREDENTIALS')
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-client-id': appId,
      'x-client-secret': secret,
      'x-api-version': API_VERSION,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg =
      (data as { message?: string; error_description?: string }).message ??
      (data as { message?: string; error_description?: string }).error_description ??
      `Cashfree HTTP ${res.status}`
    throw new CashfreeError(msg, res.status, (data as { code?: string }).code)
  }

  return data as T
}
