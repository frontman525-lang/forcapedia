// ─── Razorpay Plan Definitions ────────────────────────────────────────────────
// Plan IDs are created once via: npx tsx scripts/setup-razorpay-plans.ts
// After creation, add the printed plan IDs to your environment variables.
//
// TEST PRICING (₹1 plans for pre-launch verification):
//   1. Run: RAZORPAY_TEST_PRICING=true npx tsx scripts/setup-razorpay-plans.ts
//   2. Add the printed plan IDs to .env.local
//   3. Set NEXT_PUBLIC_RAZORPAY_TEST_PRICING=true in .env.local
//   4. Test payments end-to-end with ₹1
//
// SWITCHING TO LIVE PRICING:
//   1. Run: npx tsx scripts/setup-razorpay-plans.ts   (no flag = real prices)
//   2. Update plan IDs in .env.local with the new values
//   3. Remove (or set false) NEXT_PUBLIC_RAZORPAY_TEST_PRICING
//   4. Restart dev server / redeploy
//
// Razorpay API expects amounts in PAISE (rupees × 100).
// ─────────────────────────────────────────────────────────────────────────────

import type { PlanKey } from '@/lib/payments/types'

const isTestPricing = process.env.NEXT_PUBLIC_RAZORPAY_TEST_PRICING === 'true'

// ── INR amounts (rupees) — used for DB storage and display ───────────────────
export const RAZORPAY_PLAN_AMOUNTS: Record<PlanKey, number> = isTestPricing ? {
  tier1_monthly:  1,
  tier1_yearly:   1,
  tier2_monthly:  1,
  tier2_yearly:   1,
} : {
  tier1_monthly:  499,
  tier1_yearly:  4999,
  tier2_monthly: 1099,
  tier2_yearly:  9999,
}

// ── INR amounts in paise — passed to Razorpay API ────────────────────────────
export const RAZORPAY_PLAN_AMOUNTS_PAISE: Record<PlanKey, number> = isTestPricing ? {
  tier1_monthly:  100,
  tier1_yearly:   100,
  tier2_monthly:  100,
  tier2_yearly:   100,
} : {
  tier1_monthly:  49900,
  tier1_yearly:  499900,
  tier2_monthly: 109900,
  tier2_yearly:  999900,
}

// ── Human-readable plan names (shown in Razorpay checkout popup) ─────────────
export const RAZORPAY_PLAN_NAMES: Record<PlanKey, string> = {
  tier1_monthly:  'Forcapedia Scholar – Monthly',
  tier1_yearly:   'Forcapedia Scholar – Yearly',
  tier2_monthly:  'Forcapedia Researcher – Monthly',
  tier2_yearly:   'Forcapedia Researcher – Yearly',
}

// ── Billing period config ─────────────────────────────────────────────────────
// total_count = max billing cycles before subscription expires.
// We use a large number to simulate "until cancelled" (no auto-end).
export const RAZORPAY_PLAN_CYCLES: Record<PlanKey, {
  period:     'monthly' | 'yearly'
  interval:   number
  totalCount: number
}> = {
  tier1_monthly:  { period: 'monthly', interval: 1, totalCount: 120 },  // 10 yr
  tier1_yearly:   { period: 'yearly',  interval: 1, totalCount: 10  },  // 10 yr
  tier2_monthly:  { period: 'monthly', interval: 1, totalCount: 120 },
  tier2_yearly:   { period: 'yearly',  interval: 1, totalCount: 10  },
}

// ── Env var name per plan ─────────────────────────────────────────────────────
const PLAN_ID_ENV: Record<PlanKey, string> = {
  tier1_monthly:  'RAZORPAY_PLAN_SCHOLAR_MONTHLY',
  tier1_yearly:   'RAZORPAY_PLAN_SCHOLAR_YEARLY',
  tier2_monthly:  'RAZORPAY_PLAN_RESEARCHER_MONTHLY',
  tier2_yearly:   'RAZORPAY_PLAN_RESEARCHER_YEARLY',
}

export function getRazorpayPlanId(planKey: PlanKey): string {
  const envVar = PLAN_ID_ENV[planKey]
  const planId = process.env[envVar]
  if (!planId) {
    throw new Error(
      `[Razorpay] Missing env var: ${envVar}\n` +
      `Run: npx tsx scripts/setup-razorpay-plans.ts  — then add the printed IDs to .env`,
    )
  }
  return planId
}
