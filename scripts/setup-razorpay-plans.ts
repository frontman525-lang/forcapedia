#!/usr/bin/env npx tsx
// ─── Razorpay Plan Setup Script ───────────────────────────────────────────────
// Creates the 4 subscription plans in your Razorpay account.
// Prints the plan IDs — paste them into your .env.local / Vercel env.
//
// LIVE PRICING (₹499 / ₹4,999 / ₹1,099 / ₹9,999):
//   npx tsx scripts/setup-razorpay-plans.ts
//
// TEST PRICING (₹1 for all plans — for end-to-end payment testing):
//   RAZORPAY_TEST_PRICING=true npx tsx scripts/setup-razorpay-plans.ts
//
// After running with test pricing:
//   1. Paste the printed plan IDs into .env.local
//   2. Add: NEXT_PUBLIC_RAZORPAY_TEST_PRICING=true
//   3. Test payments with ₹1
//
// To switch to live pricing:
//   1. Run script without RAZORPAY_TEST_PRICING flag
//   2. Replace plan IDs in .env.local with the new values
//   3. Remove NEXT_PUBLIC_RAZORPAY_TEST_PRICING (or set to false)
//   4. Restart / redeploy
//
// NOTE: Plans created with test keys (rzp_test_…) only work with test keys.
//       Plans created with live keys (rzp_live_…) only work with live keys.
// ─────────────────────────────────────────────────────────────────────────────

import * as dotenv from 'dotenv'
import * as path   from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env') })

const KEY_ID     = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

if (!KEY_ID || !KEY_SECRET) {
  console.error('❌  Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET before running this script.')
  process.exit(1)
}

const isTestPricing = process.env.RAZORPAY_TEST_PRICING === 'true'
const AUTH_HEADER   = 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')

interface PlanDefinition {
  envVar:    string
  name:      string
  amount:    number    // in paise
  period:    'monthly' | 'yearly'
  interval:  number
  notes:     Record<string, string>
}

// ── 1 paise = ₹0.01; ₹1 = 100 paise ─────────────────────────────────────────
const TEST_AMOUNT_PAISE = 100   // ₹1

const PLANS: PlanDefinition[] = [
  {
    envVar:   'RAZORPAY_PLAN_SCHOLAR_MONTHLY',
    name:     isTestPricing ? 'Forcapedia Scholar – Monthly [TEST ₹1]' : 'Forcapedia Scholar – Monthly',
    amount:   isTestPricing ? TEST_AMOUNT_PAISE : 49900,
    period:   'monthly',
    interval: 1,
    notes:    { tier: 'tier1', billing_cycle: 'monthly', test_pricing: String(isTestPricing) },
  },
  {
    envVar:   'RAZORPAY_PLAN_SCHOLAR_YEARLY',
    name:     isTestPricing ? 'Forcapedia Scholar – Yearly [TEST ₹1]' : 'Forcapedia Scholar – Yearly',
    amount:   isTestPricing ? TEST_AMOUNT_PAISE : 499900,
    period:   'yearly',
    interval: 1,
    notes:    { tier: 'tier1', billing_cycle: 'yearly', test_pricing: String(isTestPricing) },
  },
  {
    envVar:   'RAZORPAY_PLAN_RESEARCHER_MONTHLY',
    name:     isTestPricing ? 'Forcapedia Researcher – Monthly [TEST ₹1]' : 'Forcapedia Researcher – Monthly',
    amount:   isTestPricing ? TEST_AMOUNT_PAISE : 109900,
    period:   'monthly',
    interval: 1,
    notes:    { tier: 'tier2', billing_cycle: 'monthly', test_pricing: String(isTestPricing) },
  },
  {
    envVar:   'RAZORPAY_PLAN_RESEARCHER_YEARLY',
    name:     isTestPricing ? 'Forcapedia Researcher – Yearly [TEST ₹1]' : 'Forcapedia Researcher – Yearly',
    amount:   isTestPricing ? TEST_AMOUNT_PAISE : 999900,
    period:   'yearly',
    interval: 1,
    notes:    { tier: 'tier2', billing_cycle: 'yearly', test_pricing: String(isTestPricing) },
  },
]

async function createPlan(plan: PlanDefinition): Promise<string> {
  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method:  'POST',
    headers: { 'Authorization': AUTH_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      period:   plan.period,
      interval: plan.interval,
      item: {
        name:        plan.name,
        amount:      plan.amount,
        currency:    'INR',
        description: plan.name,
      },
      notes: plan.notes,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(`Failed to create plan "${plan.name}": ${JSON.stringify(data?.error ?? data)}`)
  }

  return data.id as string
}

async function main() {
  const keyMode = KEY_ID!.startsWith('rzp_test_') ? 'TEST' : 'LIVE'
  console.log(`\n🔑  Razorpay ${keyMode} mode  |  Pricing: ${isTestPricing ? '₹1 (TEST)' : 'LIVE (₹499 / ₹4,999 / ₹1,099 / ₹9,999)'}`)
  console.log(`    Key: ${KEY_ID}\n`)

  if (isTestPricing) {
    console.log('  ⚠️  Creating TEST plans at ₹1 each — for payment flow verification only.')
    console.log('      Set NEXT_PUBLIC_RAZORPAY_TEST_PRICING=true in .env.local after this.\n')
  }

  const results: Array<{ envVar: string; planId: string }> = []

  for (const plan of PLANS) {
    try {
      const price = isTestPricing ? '₹1' : `₹${(plan.amount / 100).toLocaleString('en-IN')}`
      process.stdout.write(`  Creating "${plan.name}" (${price})… `)
      const planId = await createPlan(plan)
      console.log(`✓  ${planId}`)
      results.push({ envVar: plan.envVar, planId })
    } catch (err) {
      console.error(`\n  ❌  ${(err as Error).message}`)
      process.exit(1)
    }
  }

  console.log('\n─────────────────────────────────────────────────────────')
  if (isTestPricing) {
    console.log('  ✅  TEST plans created. Add these to your .env.local:\n')
    console.log('  NEXT_PUBLIC_RAZORPAY_TEST_PRICING=true')
  } else {
    console.log('  ✅  LIVE plans created. Add these to your .env.local:\n')
    console.log('  # Remove or set false: NEXT_PUBLIC_RAZORPAY_TEST_PRICING')
  }
  console.log('')
  for (const { envVar, planId } of results) {
    console.log(`  ${envVar}=${planId}`)
  }
  console.log('\n  RAZORPAY_KEY_ID=' + KEY_ID)
  console.log('  RAZORPAY_KEY_SECRET=<your secret key>')
  console.log('  RAZORPAY_WEBHOOK_SECRET=<from Razorpay Dashboard → Webhooks>')
  console.log('\n─────────────────────────────────────────────────────────')
  console.log('  Webhook URL: https://forcapedia.com/api/payments/webhook/razorpay')
  console.log('  Events:      subscription.* (select all subscription events)')
  console.log('─────────────────────────────────────────────────────────\n')
}

main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
