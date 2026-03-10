// ─── Razorpay Provider ────────────────────────────────────────────────────────
// Implements PaymentProvider interface using Razorpay Subscriptions API.
//
// Checkout mode: 'razorpay_popup'
//   1. Server: createSubscription() → Razorpay returns subscription ID
//   2. Client: load checkout.js → new Razorpay({ subscription_id }) → rzp.open()
//   3. User pays in popup → handler fires with { payment_id, subscription_id, signature }
//   4. Client: POST /api/payments/verify/razorpay — server verifies HMAC
//   5. Server: immediate DB activation on valid signature
//   6. Razorpay: fires subscription.activated webhook (backup / recurring)
//
import type {
  PaymentProvider,
  CreateSubscriptionParams,
  CreateSubscriptionResult,
  WebhookVerifyResult,
} from '../../types'
import { createRazorpaySubscription, cancelRazorpaySubscription } from '@/lib/razorpay/subscriptions'
import { verifyRazorpayWebhookSignature, parseRazorpayWebhookEvent }  from '@/lib/razorpay/webhook'

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const

  async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    const { subscriptionId } = await createRazorpaySubscription({
      planKey: params.planKey,
      userId:  params.userId,
      email:   params.email,
    })

    return {
      providerSubId: subscriptionId,
      checkoutMode:  'razorpay_popup',
    }
  }

  // options.atPeriodEnd = true  → cancel_at_cycle_end (user keeps access till period end)
  // options.atPeriodEnd = false → immediate cancel (upgrade flow)
  // Default: true — always safe to cancel at period end for user-initiated actions
  async cancelSubscription(
    providerSubId: string,
    options?: { atPeriodEnd?: boolean },
  ): Promise<void> {
    await cancelRazorpaySubscription(
      providerSubId,
      options?.atPeriodEnd ?? true,
    )
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookVerifyResult> {
    const signature = headers['x-razorpay-signature']
    if (!signature) {
      return { ok: false, reason: 'invalid_signature' }
    }
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return { ok: false, reason: 'invalid_signature' }
    }
    return parseRazorpayWebhookEvent(rawBody)
  }
}
