// ─── Cashfree Plan Definitions ─────────────────────────────────────────────
// All monetary amounts are in INR (Indian Rupee) — India Launch Pricing.
// Global USD payments (Stripe) to be added in a future sprint.
// Plan IDs are permanent — never rename after creating them in Cashfree.

export const PLAN_PREFIX = 'forcapedia'

// ── India Launch Pricing (INR) ───────────────────────────────────────────────
// These are the actual Cashfree charge amounts.
// Anchor prices (crossed out in the UI) are 2× these values.
export const PLAN_AMOUNTS = {
  tier1_monthly:  499,    // ₹499 /mo   (anchor ₹999  — 50% off)
  tier1_yearly:  4999,    // ₹4,999 /yr (anchor ₹9,999 — 50% off)
  tier2_monthly: 1099,    // ₹1,099 /mo  (anchor ₹2,199 — 50% off)
  tier2_yearly:  9999,    // ₹9,999 /yr  (anchor ₹19,999 — 50% off)
} as const

export const CASHFREE_PLANS = {
  tier1_monthly: {
    plan_id:            `${PLAN_PREFIX}_scholar_monthly_v2`,
    plan_name:          'Forcapedia Scholar – Monthly',
    plan_type:          'PERIODIC' as const,
    plan_currency:      'INR',
    plan_amount:        PLAN_AMOUNTS.tier1_monthly,
    plan_interval_type: 'MONTH' as const,
    plan_intervals:     1,
    tier:               'tier1',
    billing_cycle:      'monthly',
    display_price:      `₹${PLAN_AMOUNTS.tier1_monthly.toLocaleString('en-IN')}`,
  },
  tier1_yearly: {
    plan_id:            `${PLAN_PREFIX}_scholar_yearly_v2`,
    plan_name:          'Forcapedia Scholar – Yearly',
    plan_type:          'PERIODIC' as const,
    plan_currency:      'INR',
    plan_amount:        PLAN_AMOUNTS.tier1_yearly,
    plan_interval_type: 'MONTH' as const,  // 12-month billing = 1 charge per year
    plan_intervals:     12,
    tier:               'tier1',
    billing_cycle:      'yearly',
    display_price:      `₹${PLAN_AMOUNTS.tier1_yearly.toLocaleString('en-IN')}`,
  },
  tier2_monthly: {
    plan_id:            `${PLAN_PREFIX}_researcher_monthly_v2`,
    plan_name:          'Forcapedia Researcher – Monthly',
    plan_type:          'PERIODIC' as const,
    plan_currency:      'INR',
    plan_amount:        PLAN_AMOUNTS.tier2_monthly,
    plan_interval_type: 'MONTH' as const,
    plan_intervals:     1,
    tier:               'tier2',
    billing_cycle:      'monthly',
    display_price:      `₹${PLAN_AMOUNTS.tier2_monthly.toLocaleString('en-IN')}`,
  },
  tier2_yearly: {
    plan_id:            `${PLAN_PREFIX}_researcher_yearly_v2`,
    plan_name:          'Forcapedia Researcher – Yearly',
    plan_type:          'PERIODIC' as const,
    plan_currency:      'INR',
    plan_amount:        PLAN_AMOUNTS.tier2_yearly,
    plan_interval_type: 'MONTH' as const,  // 12-month billing = 1 charge per year
    plan_intervals:     12,
    tier:               'tier2',
    billing_cycle:      'yearly',
    display_price:      `₹${PLAN_AMOUNTS.tier2_yearly.toLocaleString('en-IN')}`,
  },
} as const

export type PlanKey = keyof typeof CASHFREE_PLANS

export function getPlan(tier: string, billingCycle: string): (typeof CASHFREE_PLANS)[PlanKey] | null {
  const key = `${tier}_${billingCycle}` as PlanKey
  return CASHFREE_PLANS[key] ?? null
}
