// ─── PayPal Provider ──────────────────────────────────────────────────────────
// Implements the PaymentProvider interface using PayPal's Subscriptions API.
// Checkout mode: 'redirect' — user is sent to PayPal, approves, then returns.
//
// Flow:
//   1. Server: createSubscription() → PayPal returns approval_url
//   2. Client: window.location.href = approvalUrl
//   3. User approves on PayPal
//   4. PayPal redirects → /payment/success?plan=...&subscription_id=I-XXXXX
//   5. PayPal fires webhook → BILLING.SUBSCRIPTION.ACTIVATED
//   6. Client polls /api/payments/status → confirms active
//
import type {
  PaymentProvider,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  WebhookVerifyResult,
} from '../../types'
import { paypalRequest }             from './client'
import { getPayPalPlanId, PAYPAL_BILLING_CYCLES, PAYPAL_PLAN_AMOUNTS } from './plans'
import { verifyPayPalWebhook, parsePayPalWebhookEvent } from './webhook'

interface PayPalSubscriptionResponse {
  id:     string   // e.g. "I-BW452GWLDKCN"
  status: string
  links:  Array<{ href: string; rel: string; method: string }>
}

export class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal' as const

  async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    const planId = getPayPalPlanId(params.planKey)

    const regularAmount  = PAYPAL_PLAN_AMOUNTS[params.planKey]
    const billingFreq    = PAYPAL_BILLING_CYCLES[params.planKey]
    const proratedAmount = params.firstPaymentAmount

    // If a prorated first payment is supplied (upgrade flow), override the first
    // billing cycle with a TRIAL cycle at the prorated amount, then continue at
    // the standard plan price. PayPal supports inline billing_cycles overrides.
    const planOverride = (proratedAmount !== undefined && proratedAmount !== regularAmount)
      ? {
          billing_cycles: [
            {
              frequency:      { interval_unit: billingFreq.interval_unit, interval_count: billingFreq.interval_count },
              tenure_type:    'TRIAL',
              sequence:       1,
              total_cycles:   1,
              pricing_scheme: { fixed_price: { value: proratedAmount.toFixed(2), currency_code: 'USD' } },
            },
            {
              frequency:      { interval_unit: billingFreq.interval_unit, interval_count: billingFreq.interval_count },
              tenure_type:    'REGULAR',
              sequence:       2,
              total_cycles:   0,
              pricing_scheme: { fixed_price: { value: regularAmount.toFixed(2), currency_code: 'USD' } },
            },
          ],
        }
      : undefined

    const payload = {
      plan_id: planId,
      // Do NOT pre-fill subscriber.email_address — PayPal uses the logged-in
      // buyer's account email automatically. Pre-filling causes a mismatch
      // error when the buyer email differs from what we send.
      custom_id: params.userId,  // echoed in some webhooks; best-effort
      ...(planOverride ? { plan: planOverride } : {}),
      application_context: {
        brand_name:          'Forcapedia',
        locale:              'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action:         'SUBSCRIBE_NOW',
        return_url:          params.returnUrl,
        cancel_url:          params.cancelUrl,
      },
    }

    // Idempotency key: unique per attempt so intentional retries get a fresh session.
    // The timestamp makes each click a new request — PayPal de-dupes only exact
    // network retries (same key within milliseconds), not intentional user retries.
    const idempotencyKey = `fp_paypal_${params.userId}_${params.planKey}_${Date.now()}`

    const data = await paypalRequest<PayPalSubscriptionResponse>(
      'POST',
      '/v1/billing/subscriptions',
      payload,
      idempotencyKey,
    )

    const approveLink = data.links.find(l => l.rel === 'approve')
    if (!approveLink) {
      throw new Error('[PayPal] Subscription created but no approval URL returned')
    }

    return {
      providerSubId: data.id,            // e.g. "I-BW452GWLDKCN"
      approvalUrl:   approveLink.href,   // PayPal approval page
      checkoutMode:  'redirect',
    }
  }

  // options.atPeriodEnd is ignored — PayPal stops future billing on cancel;
  // the user retains access until the current period ends automatically.
  async cancelSubscription(providerSubId: string, _options?: { atPeriodEnd?: boolean }): Promise<void> {
    // PayPal expects a reason string (optional but recommended for records)
    await paypalRequest(
      'POST',
      `/v1/billing/subscriptions/${providerSubId}/cancel`,
      { reason: 'Cancelled by user request' },
    )
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookVerifyResult> {
    const valid = await verifyPayPalWebhook(rawBody, headers)

    if (!valid) {
      return { ok: false, reason: 'invalid_signature' }
    }

    // Signature verified — parse and normalize
    const event = parsePayPalWebhookEvent(rawBody)
    return { ok: true, event }  // event may be null for unhandled types
  }
}
