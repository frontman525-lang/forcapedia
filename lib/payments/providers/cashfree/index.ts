// ─── Cashfree Provider ────────────────────────────────────────────────────────
// Wraps the existing lib/cashfree/* modules and exposes them through the
// PaymentProvider interface. Zero logic duplication — all Cashfree internals
// remain in lib/cashfree/.
//
import type {
  PaymentProvider,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  WebhookVerifyResult,
  NormalizedEventType,
} from '../../types'
import { createCashfreeSubscription, cancelCashfreeSubscription } from '@/lib/cashfree/subscriptions'
import { verifyCashfreeWebhook, type CashfreeWebhookPayload } from '@/lib/cashfree/webhook'
import type { PlanKey } from '@/lib/cashfree/plans'

// ── Cashfree event type → normalized type ─────────────────────────────────────
const EVENT_MAP: Record<string, NormalizedEventType> = {
  SUBSCRIPTION_ACTIVATED:       'subscription.activated',
  SUBSCRIPTION_PAYMENT_SUCCESS: 'subscription.payment.success',
  SUBSCRIPTION_PAYMENT_FAILED:  'subscription.payment.failed',
  SUBSCRIPTION_CANCELLED:       'subscription.cancelled',
  SUBSCRIPTION_ENDED:           'subscription.ended',
  SUBSCRIPTION_PAUSED:          'subscription.paused',
  SUBSCRIPTION_RESUMED:         'subscription.resumed',
}

export class CashfreeProvider implements PaymentProvider {
  readonly name = 'cashfree' as const

  async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    // Cashfree mandates require a phone number — enforce it here so the error
    // surfaces cleanly before any API call.
    if (!params.phone) {
      const err = new Error('PHONE_REQUIRED') as Error & { code: string }
      err.code  = 'PHONE_REQUIRED'
      throw err
    }

    const result = await createCashfreeSubscription({
      userId:    params.userId,
      email:     params.email,
      phone:     params.phone,
      planKey:   params.planKey as PlanKey,
      returnUrl: params.returnUrl,
      notifyUrl: params.notifyUrl,
    })

    return {
      providerSubId: result.subscriptionId,
      sessionId:     result.sessionId,
      checkoutMode:  'sdk',
    }
  }

  // options.atPeriodEnd is ignored — Cashfree cancels immediately; period-end
  // semantics are managed via our DB cancel_at_period_end flag.
  async cancelSubscription(providerSubId: string, _options?: { atPeriodEnd?: boolean }): Promise<void> {
    await cancelCashfreeSubscription(providerSubId)
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookVerifyResult> {
    // Support both the 2022-09-01 and 2025-01-01 Cashfree webhook header names
    const timestamp =
      headers['x-cashfree-timestamp'] ??
      headers['x-webhook-timestamp']  ?? ''
    const signature =
      headers['x-cashfree-signature'] ??
      headers['x-webhook-signature']  ?? ''

    if (!verifyCashfreeWebhook(rawBody, timestamp, signature)) {
      return { ok: false, reason: 'invalid_signature' }
    }

    let payload: CashfreeWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return { ok: false, reason: 'parse_error' }
    }

    const normalizedType = EVENT_MAP[payload.type]
    if (!normalizedType) {
      // Valid signature, event type we don't handle — tell the route to return 200
      return { ok: true, event: null }
    }

    const { subscription, payment } = payload.data

    return {
      ok: true,
      event: {
        type:          normalizedType,
        providerSubId: subscription.subscription_id,           // Our generated ID (fp_xxx_...)
        userId:        subscription.customer_details.customer_id,
        amount:        payment?.payment_amount,
        currency:      payment?.payment_currency,
        paymentId:     payment?.cf_payment_id,
        raw:           payload,
      },
    }
  }
}
