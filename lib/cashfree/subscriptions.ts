// ─── Cashfree Subscription Operations ──────────────────────────────────────
import { cashfreeRequest, CashfreeError } from './client'
import { CASHFREE_PLANS, PlanKey } from './plans'

// ── Types ────────────────────────────────────────────────────────────────────
interface CashfreeSubscriptionResponse {
  subscription_id: string
  cf_subscription_id?: string
  subscription_status: string
  // API 2023-08-01: hosted mandate session ID
  subscription_session_id?: string
  plan_details?: { plan_id: string }
  customer_details?: {
    customer_id: string
    customer_email: string
    customer_phone: string
  }
  // Legacy field names from older API versions
  authorization?: { auth_link?: string }
  auth_link?: string
  sub_authorization_details?: { auth_link?: string }
}

// ── Create subscription ───────────────────────────────────────────────────────
export async function createCashfreeSubscription(params: {
  userId:      string
  email:       string
  phone:       string   // E.164 or 10-digit Indian number
  planKey:     PlanKey
  returnUrl:   string
  notifyUrl:   string
}) {
  const plan = CASHFREE_PLANS[params.planKey]
  // Plans must be pre-created in the Cashfree Dashboard (one-time setup).
  // See: Dashboard → Subscriptions → Plans → Create Plan

  // Build a unique, URL-safe subscription ID  (≤ 50 chars)
  const shortUserId = params.userId.replace(/-/g, '').slice(0, 12)
  const subscriptionId = `fp_${shortUserId}_${plan.tier}_${plan.billing_cycle}_${Date.now()}`

  // Normalise phone — Cashfree wants 10 digits or +91XXXXXXXXXX
  const phone = params.phone.replace(/\D/g, '').slice(-10)

  const payload = {
    subscription_id: subscriptionId,
    // Cashfree API 2023-08-01 uses nested plan_details (not top-level plan_id)
    plan_details: {
      plan_id: plan.plan_id,
    },
    customer_details: {
      customer_id:    params.userId,
      customer_email: params.email,
      customer_phone: phone,
    },
    auth_details: {
      auth_amount: 1,         // ₹1 authorisation charge
      auth_mode:   'EMANDATE' // Supports UPI / NetBanking / Debit card
    },
    subscription_note: `${plan.plan_name} — Forcapedia`,
    // API 2023-08-01: return_url and notify_url go inside subscription_meta
    subscription_meta: {
      return_url: params.returnUrl,
      notify_url: params.notifyUrl,
    },
  }

  const data = await cashfreeRequest<CashfreeSubscriptionResponse>('POST', '/subscriptions', payload)

  // API 2023-08-01 returns subscription_session_id — used with the Cashfree JS SDK
  // SDK call: cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: "_self" })
  const sessionId = data.subscription_session_id

  if (!sessionId) {
    console.error('[cashfree] Full response:', JSON.stringify(data))
    throw new CashfreeError('Cashfree did not return a subscription_session_id', 502)
  }

  return {
    subscriptionId,
    cfSubId:   data.cf_subscription_id,
    sessionId,
  }
}

// ── Cancel subscription ───────────────────────────────────────────────────────
export async function cancelCashfreeSubscription(subscriptionId: string): Promise<void> {
  await cashfreeRequest('POST', `/subscriptions/${subscriptionId}/cancel`, {})
}

// ── Get subscription details ──────────────────────────────────────────────────
export async function getCashfreeSubscription(subscriptionId: string) {
  return cashfreeRequest<CashfreeSubscriptionResponse>('GET', `/subscriptions/${subscriptionId}`)
}
