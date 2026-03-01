// ─── Cashfree Webhook Verification & Types ──────────────────────────────────
// Docs: https://docs.cashfree.com/reference/pgwebhookauthentication
import { createHmac } from 'crypto'

// ── Signature verification ───────────────────────────────────────────────────
/**
 * Verifies a Cashfree webhook signature.
 * Cashfree signs: HMAC-SHA256( timestamp + "." + rawBody, secretKey ) → base64
 */
export function verifyCashfreeWebhook(
  rawBody:   string,
  timestamp: string,
  signature: string,
  secret:    string = process.env.CASHFREE_SECRET_KEY ?? '',
): boolean {
  if (!secret) {
    console.error('[webhook] CASHFREE_SECRET_KEY not set')
    return false
  }

  const signedPayload = `${timestamp}.${rawBody}`
  const expected = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('base64')

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(expected, signature)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// ── Event types ──────────────────────────────────────────────────────────────
export type SubscriptionEventType =
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_PAYMENT_SUCCESS'
  | 'SUBSCRIPTION_PAYMENT_FAILED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_ENDED'
  | 'SUBSCRIPTION_PAUSED'
  | 'SUBSCRIPTION_RESUMED'

export interface CashfreeWebhookPayload {
  type: SubscriptionEventType | string
  data: {
    subscription: {
      subscription_id:             string    // Our subscription_id
      cf_subscription_id?:         string    // Cashfree's internal ID
      subscription_status:         string
      plan_id:                     string
      customer_details: {
        customer_id:     string              // Our userId
        customer_email:  string
        customer_phone:  string
      }
      subscription_first_charge_time?: string
      subscription_expiry_time?:       string
      subscription_current_cycle?:     number
    }
    payment?: {
      cf_payment_id:    string
      cf_charge_id?:    string
      payment_amount:   number
      payment_currency: string
      payment_status:   string
      payment_time?:    string
    }
  }
}
