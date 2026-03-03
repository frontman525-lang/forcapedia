// ─── PayPal Plan Configuration ────────────────────────────────────────────────
//
// PayPal billing plan IDs are created once (run scripts/setup-paypal-plans.ts
// or create manually in PayPal Dashboard → Catalog → Plans).
//
// After creation, copy the plan IDs into your .env.local:
//   PAYPAL_PLAN_SCHOLAR_MONTHLY=P-XXXXXXXXXXXXXXXXXXXXXXXX
//   PAYPAL_PLAN_SCHOLAR_YEARLY=P-XXXXXXXXXXXXXXXXXXXXXXXX
//   PAYPAL_PLAN_RESEARCHER_MONTHLY=P-XXXXXXXXXXXXXXXXXXXXXXXX
//   PAYPAL_PLAN_RESEARCHER_YEARLY=P-XXXXXXXXXXXXXXXXXXXXXXXX
//
import type { PlanKey } from '../../types'

// ── USD pricing for global users ─────────────────────────────────────────────
// To test with $0.10: add NEXT_PUBLIC_PAYPAL_TEST_PRICING=true to .env.local,
// then re-run: npx tsx scripts/setup-paypal-plans.ts  (creates new $0.10 plans)
// Copy the new plan IDs to .env.local, restart. Revert both before going live.
const isTestPricing = process.env.NEXT_PUBLIC_PAYPAL_TEST_PRICING === 'true'

export const PAYPAL_PLAN_AMOUNTS: Record<PlanKey, number> = isTestPricing ? {
  tier1_monthly:  0.10,
  tier1_yearly:   0.10,
  tier2_monthly:  0.10,
  tier2_yearly:   0.10,
} : {
  tier1_monthly:   7.99,
  tier1_yearly:   79.99,
  tier2_monthly:  14.99,
  tier2_yearly:  149.99,
}

// ── Display names (used in email receipts, setup script) ─────────────────────
export const PAYPAL_PLAN_NAMES: Record<PlanKey, string> = {
  tier1_monthly:  'Forcapedia Scholar — Monthly',
  tier1_yearly:   'Forcapedia Scholar — Yearly',
  tier2_monthly:  'Forcapedia Researcher — Monthly',
  tier2_yearly:   'Forcapedia Researcher — Yearly',
}

// ── Billing frequency per plan ────────────────────────────────────────────────
export const PAYPAL_BILLING_CYCLES: Record<PlanKey, { interval_unit: string; interval_count: number }> = {
  tier1_monthly:  { interval_unit: 'MONTH', interval_count: 1  },
  tier1_yearly:   { interval_unit: 'YEAR',  interval_count: 1  },
  tier2_monthly:  { interval_unit: 'MONTH', interval_count: 1  },
  tier2_yearly:   { interval_unit: 'YEAR',  interval_count: 1  },
}

// ── Resolve plan ID from environment ─────────────────────────────────────────
const ENV_VAR_MAP: Record<PlanKey, string> = {
  tier1_monthly:  'PAYPAL_PLAN_SCHOLAR_MONTHLY',
  tier1_yearly:   'PAYPAL_PLAN_SCHOLAR_YEARLY',
  tier2_monthly:  'PAYPAL_PLAN_RESEARCHER_MONTHLY',
  tier2_yearly:   'PAYPAL_PLAN_RESEARCHER_YEARLY',
}

export function getPayPalPlanId(planKey: PlanKey): string {
  const envVar = ENV_VAR_MAP[planKey]
  const id     = process.env[envVar]

  if (!id) {
    throw new Error(
      `PayPal plan not configured for "${planKey}". ` +
      `Set ${envVar} in your environment. ` +
      `Run: npx tsx scripts/setup-paypal-plans.ts`,
    )
  }

  return id
}
