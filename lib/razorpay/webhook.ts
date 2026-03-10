// ─── Razorpay Webhook Signature Verification & Event Parsing ─────────────────
//
// Two distinct signature verifications:
//
//  1. Webhook (inbound from Razorpay):
//     Header:    x-razorpay-signature
//     Algorithm: HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
//     Secret:    Set in Razorpay Dashboard → Webhooks (separate from the API key)
//
//  2. Checkout callback (client-side handler after popup):
//     Payload:   razorpay_payment_id + "|" + razorpay_subscription_id
//     Algorithm: HMAC-SHA256(payload, RAZORPAY_KEY_SECRET)
//     Secret:    The API key secret (not the webhook secret)
//
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto'
import type { NormalizedWebhookEvent, WebhookVerifyResult } from '@/lib/payments/types'

// ── 1. Webhook signature (inbound events from Razorpay) ───────────────────────
export function verifyRazorpayWebhookSignature(
  rawBody:   string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Razorpay webhook] RAZORPAY_WEBHOOK_SECRET is not set')
    return false
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    )
  } catch {
    return false  // mismatched lengths throw — treat as invalid
  }
}

// ── 2. Checkout callback signature (post-popup, verified server-side) ─────────
export function verifyRazorpayCheckoutSignature(
  paymentId:      string,
  subscriptionId: string,
  signature:      string,
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) {
    console.error('[Razorpay] RAZORPAY_KEY_SECRET is not set')
    return false
  }
  const payload  = `${paymentId}|${subscriptionId}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    )
  } catch {
    return false
  }
}

// ── Event type mapping ────────────────────────────────────────────────────────
// null = valid event, intentionally unhandled (no DB action needed)
const RAZORPAY_EVENT_MAP: Record<string, NormalizedWebhookEvent['type'] | null> = {
  'subscription.authenticated': null,                       // mandate saved, charge not yet done
  'subscription.activated':     'subscription.activated',
  'subscription.charged':       'subscription.payment.success',
  'subscription.halted':        'subscription.cancelled',      // all retries exhausted — subscription is dead
  'subscription.cancelled':     'subscription.cancelled',
  'subscription.completed':     'subscription.ended',
  'subscription.paused':        'subscription.paused',
  'subscription.resumed':       'subscription.resumed',
  'subscription.pending':       null,                       // payment processing — wait for outcome
  'subscription.updated':       null,                       // plan metadata update — no tier change
}

// ── Webhook payload shape (Razorpay v2 format) ────────────────────────────────
interface RazorpayWebhookPayload {
  entity:   string
  event:    string
  event_id: string    // Razorpay's unique event ID — used for idempotency
  contains: string[]
  payload: {
    subscription?: {
      entity: {
        id:              string
        status:          string
        current_start?:  number   // Unix timestamp — billing period start
        current_end?:    number   // Unix timestamp — billing period end
        charge_at?:      number   // Unix timestamp — next charge date
        notes?:          Record<string, string>
      }
    }
    payment?: {
      entity: {
        id:       string
        amount:   number    // paise
        currency: string
      }
    }
  }
  created_at: number
}

// ── Parse ─────────────────────────────────────────────────────────────────────
export function parseRazorpayWebhookEvent(rawBody: string): WebhookVerifyResult {
  let body: RazorpayWebhookPayload
  try {
    body = JSON.parse(rawBody)
  } catch (err) {
    console.error('[Razorpay webhook] JSON parse error:', err)
    return { ok: false, reason: 'parse_error' }
  }

  const sub = body.payload?.subscription?.entity
  const pay = body.payload?.payment?.entity

  if (!sub?.id) {
    // Valid signature but payload has no subscription — safely ignore
    return { ok: true, event: null }
  }

  const eventName = body.event
  const mapped    = RAZORPAY_EVENT_MAP[eventName]

  if (mapped === undefined) {
    console.log(`[Razorpay webhook] unknown event type: ${eventName}`)
    return { ok: true, event: null }
  }

  if (mapped === null) {
    // Intentionally unhandled event (e.g. subscription.authenticated)
    return { ok: true, event: null }
  }

  // current_end is a Unix timestamp (seconds); convert to ISO string
  const currentPeriodEnd = sub.current_end
    ? new Date(sub.current_end * 1000).toISOString()
    : undefined

  const event: NormalizedWebhookEvent = {
    type:             mapped,
    providerSubId:    sub.id,
    eventId:          body.event_id,    // unique per delivery — used for idempotency
    userId:           sub.notes?.user_id,
    amount:           pay ? pay.amount / 100 : undefined,   // paise → rupees
    currency:         pay?.currency ?? 'INR',
    paymentId:        pay?.id,
    currentPeriodEnd,
    raw:              body,
  }

  return { ok: true, event }
}
