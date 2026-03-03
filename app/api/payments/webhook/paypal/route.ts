// POST /api/payments/webhook/paypal
//
// PayPal sends signed webhook events here.
// Register this URL in: PayPal Developer Dashboard → Webhooks → Add Webhook
//   URL: https://forcapedia.com/api/payments/webhook/paypal
//
// Required webhook events to subscribe to:
//   BILLING.SUBSCRIPTION.ACTIVATED
//   BILLING.SUBSCRIPTION.CANCELLED
//   BILLING.SUBSCRIPTION.EXPIRED
//   BILLING.SUBSCRIPTION.SUSPENDED
//   BILLING.SUBSCRIPTION.RE-ACTIVATED
//   BILLING.SUBSCRIPTION.PAYMENT.FAILED
//   PAYMENT.SALE.COMPLETED
//
import { NextResponse } from 'next/server'
import { getPaymentProvider }    from '@/lib/payments'
import { processWebhookEvent }   from '@/lib/payments/processor'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const rawBody = await req.text()

  // Build a plain headers map for the provider (Next.js Headers are case-insensitive,
  // but provider code may need to iterate — flatten here once).
  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => { headers[key] = value })

  const provider = getPaymentProvider('paypal')
  const result   = await provider.verifyAndParseWebhook(rawBody, headers)

  if (!result.ok) {
    console.warn('[webhook/paypal] Rejected —', result.reason)
    return NextResponse.json({ error: result.reason }, { status: 401 })
  }

  if (result.event) {
    await processWebhookEvent(result.event, 'paypal')
  } else {
    // Valid signature but event type we don't act on — log and return 200
    // so PayPal doesn't retry.
    console.log('[webhook/paypal] Unhandled event type — acknowledged')
  }

  // Always 200 — PayPal retries delivery on any non-2xx response
  return NextResponse.json({ ok: true })
}
