// ─── Razorpay Subscription Operations ────────────────────────────────────────
import { razorpayRequest }                         from './client'
import { getRazorpayPlanId, RAZORPAY_PLAN_CYCLES } from './plans'
import type { PlanKey }                            from '@/lib/payments/types'

interface RazorpaySubscriptionResponse {
  id:          string   // "sub_XXXXXXXXXXXX"
  status:      string   // "created" | "authenticated" | "active" | "cancelled" | "completed"
  plan_id:     string
  total_count: number
  paid_count:  number
  short_url:   string   // shareable hosted link (not used in popup flow)
}

// ── Create ────────────────────────────────────────────────────────────────────
export async function createRazorpaySubscription(params: {
  planKey: PlanKey
  userId:  string
  email:   string
}): Promise<{ subscriptionId: string }> {
  const planId = getRazorpayPlanId(params.planKey)
  const { totalCount } = RAZORPAY_PLAN_CYCLES[params.planKey]

  const data = await razorpayRequest<RazorpaySubscriptionResponse>(
    'POST',
    '/v1/subscriptions',
    {
      plan_id:         planId,
      total_count:     totalCount,
      quantity:        1,
      customer_notify: 1,   // Razorpay sends payment confirmation emails/SMS
      notes: {
        user_id: params.userId,
        email:   params.email,
      },
    },
  )

  return { subscriptionId: data.id }
}

// ── Cancel ────────────────────────────────────────────────────────────────────
// atCycleEnd = true  → cancel at end of current billing period (user keeps access)
// atCycleEnd = false → cancel immediately (used for upgrades)
export async function cancelRazorpaySubscription(
  subscriptionId: string,
  atCycleEnd:     boolean,
): Promise<void> {
  await razorpayRequest(
    'POST',
    `/v1/subscriptions/${subscriptionId}/cancel`,
    { cancel_at_cycle_end: atCycleEnd ? 1 : 0 },
  )
}
