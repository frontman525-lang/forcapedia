// POST /api/payments/webhook/razorpay
//
// Razorpay sends subscription lifecycle events here.
// Register this URL in: Razorpay Dashboard → Webhooks → Add New Webhook
// Set a secret there — store it as RAZORPAY_WEBHOOK_SECRET.
//
// Events handled (via normalized processor):
//   subscription.authenticated → no-op (mandate saved, not yet charged)
//   subscription.activated     → activate DB row + set user tier
//   subscription.charged       → payment.success — log + send email
//   subscription.halted        → payment.failed  — send email
//   subscription.cancelled     → set status='cancelled', tier='free'
//   subscription.completed     → set status='expired',  tier='free'
//   subscription.paused/resumed → log only
//
// Razorpay retries on non-2xx. Always return 200 for valid-signature events.
//
export const runtime = 'nodejs'

import { NextResponse }           from 'next/server'
import { RazorpayProvider }       from '@/lib/payments/providers/razorpay'
import { processWebhookEvent }    from '@/lib/payments/processor'

// Disable Next.js body parsing — we need the raw bytes for HMAC verification.
export const dynamic = 'force-dynamic'

const provider = new RazorpayProvider()

export async function POST(req: Request) {
  // Read raw body as text — must happen BEFORE any JSON.parse to preserve bytes
  const rawBody = await req.text()

  // Extract all headers as a lowercase-key map
  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => { headers[key.toLowerCase()] = value })

  // Verify signature + parse event
  const result = await provider.verifyAndParseWebhook(rawBody, headers)

  if (!result.ok) {
    console.warn(`[webhook/razorpay] ${result.reason}`)
    return NextResponse.json({ error: result.reason }, { status: 401 })
  }

  if (!result.event) {
    // Valid signature, event type we don't handle — acknowledge immediately
    return NextResponse.json({ ok: true })
  }

  // Process the normalized event (updates DB, sends emails)
  try {
    await processWebhookEvent(result.event, 'razorpay')
  } catch (err) {
    console.error('[webhook/razorpay] processor error:', err)
    // Return 500 so Razorpay retries — do NOT return 200 on processor failure
    return NextResponse.json({ error: 'processor_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
