// ─── Payment Abstraction Layer — Core Types ──────────────────────────────────
//
// ARCHITECTURE GOAL:
//   Swapping to a new payment provider (e.g. Stripe, Razorpay) requires only:
//     1. Create a new class in lib/payments/providers/<name>/index.ts
//        that implements the PaymentProvider interface below.
//     2. Register it in lib/payments/index.ts (one line).
//     3. Add a webhook route at app/api/payments/webhook/<name>/route.ts.
//   Zero changes to API routes, components, or DB processor logic.
//
// ─────────────────────────────────────────────────────────────────────────────

export type PlanKey =
  | 'tier1_monthly'
  | 'tier1_yearly'
  | 'tier2_monthly'
  | 'tier2_yearly'

// Extend this union when you add a new provider
export type PaymentProviderName = 'cashfree' | 'paypal' | 'razorpay'

export type CheckoutMode = 'sdk' | 'redirect' | 'razorpay_popup'

// ── What the subscribe route sends to the provider ───────────────────────────
export interface CreateSubscriptionParams {
  userId:    string
  email:     string
  phone?:    string    // Cashfree mandate requirement — not required by other providers
  planKey:   PlanKey
  returnUrl: string   // Where to send the user after approval
  cancelUrl: string   // Where to send the user if they cancel on the provider
  notifyUrl: string   // Webhook URL for this provider
  // Proration: if set, the first billing cycle is charged at this amount instead
  // of the plan's standard price (unused credit from a previous plan applied).
  // Providers that don't support this field will ignore it (Cashfree, etc.)
  firstPaymentAmount?: number
}

// ── What the provider returns to the subscribe route ─────────────────────────
export interface CreateSubscriptionResult {
  providerSubId: string       // Provider's stable subscription ID (used for all future lookups)
  sessionId?:    string       // Cashfree JS SDK session token (checkoutMode === 'sdk')
  approvalUrl?:  string       // Redirect URL for user approval  (checkoutMode === 'redirect')
  checkoutMode:  CheckoutMode
}

// ── Normalized event types — provider-agnostic ───────────────────────────────
export type NormalizedEventType =
  | 'subscription.activated'
  | 'subscription.payment.success'
  | 'subscription.payment.failed'
  | 'subscription.cancelled'
  | 'subscription.ended'
  | 'subscription.paused'
  | 'subscription.resumed'

// ── Normalized webhook event ──────────────────────────────────────────────────
// Sent to processWebhookEvent() regardless of which provider emitted it.
export interface NormalizedWebhookEvent {
  type:              NormalizedEventType
  providerSubId:     string       // Provider's subscription ID — used to look up the DB row
  eventId?:          string       // Provider's unique event ID — used for idempotency dedup
  userId?:           string       // Our internal user ID (available in some providers, not all)
  amount?:           number
  currency?:         string
  paymentId?:        string       // Provider payment/charge ID (for receipts, dedup)
  currentPeriodEnd?: string       // ISO timestamp — used to store renewal date in DB
  raw:               unknown      // Original payload — stored verbatim in payment_events for audit
}

// ── Result of webhook verification ──────────────────────────────────────────
// Distinguishes "bad signature" (→ 401) from "valid but unhandled event" (→ 200).
export type WebhookVerifyResult =
  | { ok: false; reason: 'invalid_signature' | 'parse_error' }
  | { ok: true;  event: NormalizedWebhookEvent | null }  // null = valid sig, unhandled type

// ── The interface every payment provider MUST implement ───────────────────────
export interface PaymentProvider {
  readonly name: PaymentProviderName

  /**
   * Creates a new subscription.
   * Returns checkout data appropriate for the provider's flow:
   *   - 'sdk'      → sessionId for JS SDK (Cashfree)
   *   - 'redirect' → approvalUrl to redirect the user (PayPal)
   */
  createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult>

  /**
   * Cancels a subscription.
   * The provider typically fires a webhook (subscription.cancelled) when done.
   *
   * options.atPeriodEnd = true  → cancel at end of current billing period (user retains access)
   * options.atPeriodEnd = false → cancel immediately (used for upgrade flows)
   * Providers that do not support this distinction may ignore options.
   */
  cancelSubscription(providerSubId: string, options?: { atPeriodEnd?: boolean }): Promise<void>

  /**
   * Verifies the inbound webhook signature.
   * Returns { ok: false } on bad signature or parse failure.
   * Returns { ok: true, event: null } for valid-but-unhandled event types.
   * Returns { ok: true, event: NormalizedWebhookEvent } for actionable events.
   *
   * Must NEVER throw — swallow provider errors and return { ok: false }.
   */
  verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<WebhookVerifyResult>
}
