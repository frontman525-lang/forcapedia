#!/usr/bin/env node
// ─── PayPal Plan Setup Script ─────────────────────────────────────────────────
//
// Creates the Forcapedia product + 4 billing plans in PayPal (one-time setup).
// After running, copy the printed plan IDs into your .env.local.
//
// Usage:
//   npx tsx scripts/setup-paypal-plans.ts
//
// Required env vars (in .env.local):
//   PAYPAL_CLIENT_ID=
//   PAYPAL_CLIENT_SECRET=
//   PAYPAL_ENV=SANDBOX          # or PRODUCTION
//
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually — no dotenv dependency needed
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = val
  }
}

const BASE_URL =
  process.env.PAYPAL_ENV === 'PRODUCTION'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

const CLIENT_ID     = process.env.PAYPAL_CLIENT_ID
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in .env.local')
  process.exit(1)
}

// ── OAuth token ───────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const res   = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json() as { access_token: string }
  return data.access_token
}

// ── Generic request ───────────────────────────────────────────────────────────
async function pp<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('PayPal API error:', JSON.stringify(data, null, 2))
    throw new Error(`PayPal API ${method} ${path} → ${res.status}`)
  }
  return data as T
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀  Setting up PayPal plans in ${process.env.PAYPAL_ENV ?? 'SANDBOX'}...\n`)

  const token = await getToken()
  console.log('✓  OAuth token acquired\n')

  // 1. Create product (represents Forcapedia SaaS)
  const product = await pp<{ id: string }>(token, 'POST', '/v1/catalogs/products', {
    name:        'Forcapedia',
    description: 'AI-powered encyclopedia learning platform',
    type:        'SERVICE',
    category:    'EDUCATIONAL_AND_TEXTBOOKS',
  })
  const productId = product.id
  console.log(`✓  Product created: ${productId}\n`)

  // 2. Plan definitions
  // Set NEXT_PUBLIC_PAYPAL_TEST_PRICING=true in .env.local to create $0.10 test plans
  const isTest = process.env['NEXT_PUBLIC_PAYPAL_TEST_PRICING'] === 'true'
  const prices = isTest
    ? { s_m: '0.10', s_y: '0.10', r_m: '0.10', r_y: '0.10' }
    : { s_m: '7.99', s_y: '79.99', r_m: '14.99', r_y: '149.99' }

  if (isTest) console.log('⚠️  TEST MODE: creating $0.10 plans — revert before going live\n')

  const plans = [
    {
      envVar:      'PAYPAL_PLAN_SCHOLAR_MONTHLY',
      name:        'Forcapedia Scholar — Monthly',
      description: 'Scholar plan billed monthly',
      amount:      prices.s_m,
      interval:    { interval_unit: 'MONTH', interval_count: 1 },
    },
    {
      envVar:      'PAYPAL_PLAN_SCHOLAR_YEARLY',
      name:        'Forcapedia Scholar — Yearly',
      description: 'Scholar plan billed annually',
      amount:      prices.s_y,
      interval:    { interval_unit: 'YEAR', interval_count: 1 },
    },
    {
      envVar:      'PAYPAL_PLAN_RESEARCHER_MONTHLY',
      name:        'Forcapedia Researcher — Monthly',
      description: 'Researcher plan billed monthly',
      amount:      prices.r_m,
      interval:    { interval_unit: 'MONTH', interval_count: 1 },
    },
    {
      envVar:      'PAYPAL_PLAN_RESEARCHER_YEARLY',
      name:        'Forcapedia Researcher — Yearly',
      description: 'Researcher plan billed annually',
      amount:      prices.r_y,
      interval:    { interval_unit: 'YEAR', interval_count: 1 },
    },
  ]

  const results: Array<{ envVar: string; planId: string }> = []

  for (const p of plans) {
    const plan = await pp<{ id: string }>(token, 'POST', '/v1/billing/plans', {
      product_id:  productId,
      name:        p.name,
      description: p.description,
      status:      'ACTIVE',
      billing_cycles: [
        {
          frequency:      p.interval,
          tenure_type:    'REGULAR',
          sequence:       1,
          total_cycles:   0,  // 0 = infinite
          pricing_scheme: {
            fixed_price: { value: p.amount, currency_code: 'USD' },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding:     true,
        setup_fee_failure_action:  'CONTINUE',
        payment_failure_threshold: 3,
      },
    })

    results.push({ envVar: p.envVar, planId: plan.id })
    console.log(`✓  ${p.name}`)
    console.log(`     Plan ID: ${plan.id}`)
    console.log(`     Env var: ${p.envVar}=${plan.id}\n`)
  }

  // 3. Print .env block to copy-paste
  console.log('─────────────────────────────────────────────────')
  console.log('Copy these lines into your .env.local:\n')
  for (const { envVar, planId } of results) {
    console.log(`${envVar}=${planId}`)
  }
  console.log('\nAlso add:')
  console.log('PAYPAL_CLIENT_ID=<your client id>')
  console.log('PAYPAL_CLIENT_SECRET=<your client secret>')
  console.log('PAYPAL_ENV=SANDBOX  # change to PRODUCTION when going live')
  console.log('PAYPAL_WEBHOOK_ID=  # paste webhook ID from PayPal Developer Dashboard')
  console.log('─────────────────────────────────────────────────\n')
  console.log('✅  Done! Register your webhook URL in PayPal Developer Dashboard:')
  console.log('    https://forcapedia.com/api/payments/webhook/paypal\n')
  console.log('    Subscribe to these events:')
  console.log('      BILLING.SUBSCRIPTION.ACTIVATED')
  console.log('      BILLING.SUBSCRIPTION.CANCELLED')
  console.log('      BILLING.SUBSCRIPTION.EXPIRED')
  console.log('      BILLING.SUBSCRIPTION.SUSPENDED')
  console.log('      BILLING.SUBSCRIPTION.RE-ACTIVATED')
  console.log('      BILLING.SUBSCRIPTION.PAYMENT.FAILED')
  console.log('      PAYMENT.SALE.COMPLETED\n')
}

main().catch(err => {
  console.error('❌  Setup failed:', err)
  process.exit(1)
})
