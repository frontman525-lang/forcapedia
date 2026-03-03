// POST /api/payments/webhook
//
// Cashfree webhook endpoint — URL kept as-is for backward compatibility
// with existing subscriptions already registered in the Cashfree dashboard.
//
// New Cashfree subscriptions can use /api/payments/webhook/cashfree if you
// create a separate entry in the Cashfree dashboard later.
//
// Register / verify this URL in:
//   Cashfree Dashboard → Developers → Webhooks
//   URL: https://forcapedia.com/api/payments/webhook
//
import { NextResponse } from 'next/server'
import { getPaymentProvider }  from '@/lib/payments'
import { processWebhookEvent } from '@/lib/payments/processor'

// Disable Next.js body parsing — we need the raw bytes for HMAC verification
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const rawBody = await req.text()

  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => { headers[key] = value })

  const provider = getPaymentProvider('cashfree')
  const result   = await provider.verifyAndParseWebhook(rawBody, headers)

  if (!result.ok) {
    console.warn('[webhook/cashfree] Rejected —', result.reason)
    return NextResponse.json({ error: result.reason }, { status: 401 })
  }

  if (result.event) {
    await processWebhookEvent(result.event, 'cashfree')
  } else {
    console.log('[webhook/cashfree] Unhandled event type — acknowledged')
  }

  // Always 200 — Cashfree retries on non-2xx
  return NextResponse.json({ ok: true })
}
