// ─── PayPal Webhook Verification + Normalization ─────────────────────────────
// PayPal does NOT use simple HMAC — it requires calling their verification API.
// Docs: https://developer.paypal.com/api/rest/webhooks/
//
import { paypalRequest } from './client'
import type { NormalizedWebhookEvent, NormalizedEventType } from '../../types'

// ── Event type mapping ────────────────────────────────────────────────────────
const EVENT_MAP: Record<string, NormalizedEventType> = {
  'BILLING.SUBSCRIPTION.ACTIVATED':      'subscription.activated',
  'PAYMENT.SALE.COMPLETED':              'subscription.payment.success',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED': 'subscription.payment.failed',
  'BILLING.SUBSCRIPTION.CANCELLED':      'subscription.cancelled',
  'BILLING.SUBSCRIPTION.EXPIRED':        'subscription.ended',
  'BILLING.SUBSCRIPTION.SUSPENDED':      'subscription.paused',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED':   'subscription.resumed',
}

// ── Raw PayPal event shape ────────────────────────────────────────────────────
export interface PayPalWebhookEvent {
  id:         string
  event_type: string
  resource:   Record<string, unknown>
  summary?:   string
}

// ── Signature verification via PayPal API ─────────────────────────────────────
// PayPal sends signed events; we verify by calling /v1/notifications/verify-webhook-signature.
// This makes one outbound HTTP call per webhook — acceptable for correctness.
export async function verifyPayPalWebhook(
  rawBody: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    console.error('[paypal-webhook] PAYPAL_WEBHOOK_ID env var not set')
    return false
  }

  // PayPal headers are case-insensitive; normalize to lowercase for safety
  const h = (name: string) =>
    headers[name.toLowerCase()] ?? headers[name.toUpperCase()] ?? ''

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return false
  }

  try {
    const result = await paypalRequest<{ verification_status: string }>(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      {
        auth_algo:         h('paypal-auth-algo'),
        cert_url:          h('paypal-cert-url'),
        transmission_id:   h('paypal-transmission-id'),
        transmission_sig:  h('paypal-transmission-sig'),
        transmission_time: h('paypal-transmission-time'),
        webhook_id:        webhookId,
        webhook_event:     parsedBody,
      },
    )

    return result.verification_status === 'SUCCESS'
  } catch (err) {
    console.error('[paypal-webhook] Verification API call failed:', err)
    return false
  }
}

// ── Event normalization ───────────────────────────────────────────────────────
export function parsePayPalWebhookEvent(rawBody: string): NormalizedWebhookEvent | null {
  let payload: PayPalWebhookEvent
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return null
  }

  const normalizedType = EVENT_MAP[payload.event_type]
  if (!normalizedType) return null  // Valid but unhandled — caller returns 200

  const resource = payload.resource

  // For subscription events: resource.id = PayPal subscription ID (I-XXXXXXXX)
  // For PAYMENT.SALE.COMPLETED: resource.billing_agreement_id = subscription ID,
  //                             resource.id = payment ID
  const isPaymentEvent = payload.event_type === 'PAYMENT.SALE.COMPLETED'

  const providerSubId = isPaymentEvent
    ? (resource.billing_agreement_id as string | undefined) ?? ''
    : (resource.id                   as string | undefined) ?? ''

  if (!providerSubId) {
    console.warn('[paypal-webhook] Could not extract providerSubId from event:', payload.event_type)
    return null
  }

  // Amount is only meaningful on payment events
  const amountObj = resource.amount as { total?: string; currency?: string } | undefined

  return {
    type:          normalizedType,
    providerSubId,
    // PayPal webhooks don't carry our user ID — processor looks it up via providerSubId
    amount:        isPaymentEvent && amountObj?.total    ? parseFloat(amountObj.total) : undefined,
    currency:      isPaymentEvent && amountObj?.currency ? amountObj.currency          : undefined,
    paymentId:     isPaymentEvent                        ? (resource.id as string | undefined) : undefined,
    raw:           payload,
  }
}
