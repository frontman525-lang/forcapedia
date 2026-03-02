'use client'

import Link from 'next/link'
import { useState } from 'react'

// ── Cashfree SDK (loaded from CDN on demand) ──────────────────────────────────
interface CashfreeInstance {
  subscriptionsCheckout: (opts: {
    subsSessionId: string
    redirectTarget: '_self' | '_blank'
  }) => Promise<{ error?: { message: string } } | null>
}

function loadCashfreeSDK(mode: 'sandbox' | 'production'): Promise<CashfreeInstance> {
  return new Promise((resolve, reject) => {
    const init = () => {
      if (window.Cashfree) { resolve(window.Cashfree({ mode })); return }
      reject(new Error('Cashfree SDK unavailable after load'))
    }
    if (window.Cashfree) { init(); return }
    const existing = document.getElementById('cashfree-sdk')
    if (existing) { existing.addEventListener('load', init); return }
    const script = document.createElement('script')
    script.id      = 'cashfree-sdk'
    script.src     = 'https://sdk.cashfree.com/js/v3/cashfree.js'
    script.onload  = init
    script.onerror = () => reject(new Error('Failed to load Cashfree script'))
    document.head.appendChild(script)
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Billing = 'monthly' | 'yearly'
type Region  = 'IN' | 'GLOBAL'

interface PricingEntry {
  price:    string        // Monthly charge (monthly) or annual total (yearly)
  perMonth: string | null // Monthly equivalent for yearly — shown as main price
  anchor:   string | null // Crossed-out original monthly price (monthly, IN only)
  label:    string | null // e.g. "50% OFF"
  note:     string | null // "Billed annually ₹X,XXX"
}

interface PricingPlansProps {
  user:                boolean
  currentTier:         string
  initialBilling:      Billing
  currentBillingCycle: Billing | null
  initialRegion:       Region
}

interface ConfirmState {
  tierKey:  string
  tierName: string
  billing:  Billing
  pricing:  PricingEntry
}

// ── Pricing config ─────────────────────────────────────────────────────────────
// For yearly plans: price = annual total, perMonth = monthly equivalent
// Anchor is only set for monthly (yearly uses the offer badge instead)
const PRICING_CONFIG: Record<Region, Record<'tier1' | 'tier2', Record<Billing, PricingEntry>>> = {
  IN: {
    tier1: {
      monthly: { price: '₹499',   perMonth: null,   anchor: '₹999',    label: '50% OFF', note: null },
      yearly:  { price: '₹4,999', perMonth: '₹417', anchor: null,       label: '50% OFF', note: 'Billed annually ₹4,999' },
    },
    tier2: {
      monthly: { price: '₹1,099',  perMonth: null,   anchor: '₹2,199',  label: '50% OFF', note: null },
      yearly:  { price: '₹9,999',  perMonth: '₹833', anchor: null,       label: '50% OFF', note: 'Billed annually ₹9,999' },
    },
  },
  GLOBAL: {
    tier1: {
      monthly: { price: '$7.99',   perMonth: null,    anchor: null, label: null, note: null },
      yearly:  { price: '$79.99',  perMonth: '$6.67', anchor: null, label: null, note: 'Billed annually $79.99' },
    },
    tier2: {
      monthly: { price: '$14.99',  perMonth: null,     anchor: null, label: null, note: null },
      yearly:  { price: '$149.99', perMonth: '$12.50', anchor: null, label: null, note: 'Billed annually $149.99' },
    },
  },
}

const TIERS = [
  {
    key:      'free',
    name:     'Free',
    tagline:  'Everything you need to get started.',
    features: ['50,000 tokens per month', '5 follow-up Tokens', 'All subjects and topics'],
    cta:      'Start for free',
    highlight: false,
  },
  {
    key:     'tier1',
    name:    'Scholar',
    tagline: 'For students who need more depth.',
    features: [
      '2,000,000 tokens per month',
      'Unlimited follow-up questions',
      'Memory Progress Tracking',
      'Collaborative Room for Max 25',
      'Priority support',
    ],
    cta:       'Get Scholar',
    highlight: true,
  },
  {
    key:     'tier2',
    name:    'Researcher',
    tagline: 'For professionals who demand more.',
    features: [
      '4,000,000 tokens per month',
      'Unlimited follow-up questions',
      'Memory Progress Tracking',
      'More usage than Scholar',
      'Collaborative rooms for Max 50',
      'Priority processing + dedicated support',
    ],
    cta:       'Get Researcher',
    highlight: false,
  },
]

const FREE_DISPLAY: Record<Region, string> = { IN: '₹0', GLOBAL: '$0' }
const TIER_LEVEL:   Record<string, number>  = { free: 0, tier1: 1, tier2: 2 }

// ── Component ─────────────────────────────────────────────────────────────────
export default function PricingPlans({
  user,
  currentTier,
  initialBilling,
  currentBillingCycle,
  initialRegion,
}: PricingPlansProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling)
  // Region is detected server-side — no client fetch needed, no flicker
  const [region]              = useState<Region>(initialRegion)
  const isYearly = billing === 'yearly'

  // ── Payment state ─────────────────────────────────────────────────────────
  const [buying, setBuying]           = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [phoneModal, setPhoneModal]   = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [phone, setPhone]             = useState('')
  const [phoneError, setPhoneError]   = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)

  // ── Confirmation modal ────────────────────────────────────────────────────
  const [confirmModal, setConfirmModal]       = useState<ConfirmState | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<'upi' | 'card'>('upi')

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getPricing(tierKey: 'tier1' | 'tier2', bill?: Billing): PricingEntry {
    return PRICING_CONFIG[region][tierKey][bill ?? billing]
  }

  function getRenewalDate(b: Billing): string {
    const d = new Date()
    if (b === 'yearly') d.setFullYear(d.getFullYear() + 1)
    else d.setMonth(d.getMonth() + 1)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // ── Subscribe flow ────────────────────────────────────────────────────────
  async function initSubscribe(tierKey: string, explicitBilling?: Billing, providedPhone?: string) {
    if (region === 'GLOBAL') {
      setGlobalError('International payments (USD) are coming soon. We currently support UPI / NetBanking / Indian cards.')
      setBuying(null)
      return
    }

    const effectiveBilling = explicitBilling ?? billing
    const planKey          = `${tierKey}_${effectiveBilling}`
    setBuying(planKey)
    setGlobalError(null)

    const body: Record<string, string> = { tier: tierKey, billingCycle: effectiveBilling }
    if (providedPhone) body.phone = providedPhone

    let data: { sessionId?: string; cashfreeMode?: string; error?: string }
    try {
      const res = await fetch('/api/payments/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      data = await res.json()
    } catch {
      setGlobalError('Network error. Please try again.')
      setBuying(null)
      return
    }

    if (data.error === 'PHONE_REQUIRED') {
      setPendingPlan(planKey)
      setPhoneModal(true)
      setBuying(null)
      return
    }

    if (data.error) {
      setGlobalError(data.error)
      setBuying(null)
      return
    }

    if (data.sessionId) {
      try {
        const mode     = (data.cashfreeMode ?? 'sandbox') as 'sandbox' | 'production'
        const cashfree = await loadCashfreeSDK(mode)
        const result   = await cashfree.subscriptionsCheckout({ subsSessionId: data.sessionId, redirectTarget: '_self' })
        if (result?.error) { setGlobalError(result.error.message); setBuying(null) }
      } catch (err) {
        console.error('[cashfree-sdk]', err)
        setGlobalError('Failed to open payment page. Please try again.')
        setBuying(null)
      }
      return
    }

    setGlobalError('Unexpected response from payment gateway.')
    setBuying(null)
  }

  function handleUpgradeClick(tierKey: string, tierName: string) {
    if (!user) { window.location.href = '/login'; return }
    if (region === 'GLOBAL') {
      setGlobalError('International payments (USD) are coming soon. We currently support UPI / NetBanking / Indian cards.')
      return
    }
    const pricing = getPricing(tierKey as 'tier1' | 'tier2')
    setConfirmModal({ tierKey, tierName, billing, pricing })
    setSelectedPayment('upi')
  }

  function handleConfirmPay() {
    if (!confirmModal) return
    const { tierKey, billing: confirmedBilling } = confirmModal
    setConfirmModal(null)
    initSubscribe(tierKey, confirmedBilling)
  }

  async function handlePhoneSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setPhoneError('Enter a valid 10-digit mobile number.'); return }
    if (!pendingPlan) return
    const [tierKey, savedBilling] = pendingPlan.split('_')
    setSubmitting(true)
    setPhoneError(null)
    setPhoneModal(false)
    await initSubscribe(tierKey, savedBilling as Billing, digits.slice(-10))
    setSubmitting(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Header + toggle ── */}
      <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--gold)', marginBottom: '0.9rem',
        }}>
          Pricing
        </p>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
          fontWeight: 300, lineHeight: 1.1,
          color: 'var(--text-primary)', marginBottom: '0.9rem',
        }}>
          Simple, honest pricing.
        </h1>
        <p style={{
          fontSize: '15px', color: 'var(--text-secondary)',
          fontWeight: 300, lineHeight: 1.75,
          maxWidth: '460px', margin: '0 auto 1.5rem',
        }}>
          No hidden fees. No credit card required to start. Tokens reset monthly.
        </p>

        {/* Monthly / Yearly toggle — centered */}
        <div style={{
          position: 'relative', display: 'inline-grid',
          gridTemplateColumns: '1fr 1fr', alignItems: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '999px', padding: '4px', minWidth: '226px',
        }}>
          <span aria-hidden style={{
            position: 'absolute', top: '4px', bottom: '4px',
            left: isYearly ? 'calc(50% + 2px)' : '4px',
            width: 'calc(50% - 6px)', borderRadius: '999px',
            background: 'var(--gold)', transition: 'left 180ms ease',
          }} />
          {(['monthly', 'yearly'] as Billing[]).map(b => (
            <button key={b} type="button" onClick={() => setBilling(b)} style={{
              position: 'relative', zIndex: 1, border: 0,
              background: 'transparent', padding: '0.42rem 0.85rem',
              borderRadius: '999px', fontFamily: 'var(--font-mono)',
              fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
              color: billing === b ? 'var(--ink)' : 'var(--text-tertiary)',
              cursor: 'pointer',
            }} aria-pressed={billing === b}>
              {b.charAt(0).toUpperCase() + b.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Global error ── */}
      {globalError && (
        <div style={{
          maxWidth: '560px', margin: '0 auto 1.5rem',
          padding: '10px 16px',
          background: 'rgba(244,124,124,0.08)',
          border: '1px solid rgba(244,124,124,0.2)',
          borderRadius: '12px', fontSize: '13px',
          color: '#F47C7C', lineHeight: 1.55, textAlign: 'center',
        }}>
          {globalError}
          <button
            onClick={() => setGlobalError(null)}
            style={{ background: 'none', border: 'none', color: '#F47C7C', cursor: 'pointer', marginLeft: '8px', fontSize: '12px' }}
          >✕</button>
        </div>
      )}

      {/* ── Plan cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem', alignItems: 'stretch',
      }}>
        {TIERS.map((tier) => {
          // isSamePlan: only true when exact tier + exact billing cycle match
          const isSamePlan    = currentTier === tier.key && (tier.key === 'free' || currentBillingCycle === billing)
          const currentLevel  = TIER_LEVEL[currentTier] ?? 0
          const thisLevel     = TIER_LEVEL[tier.key] ?? 0
          const isHighlighted = tier.highlight
          const planKey       = `${tier.key}_${billing}`
          const isLoading     = buying === planKey

          const pricing    = tier.key !== 'free' ? getPricing(tier.key as 'tier1' | 'tier2') : null
          const offerLabel = pricing?.label ?? null

          // Price display: yearly shows per-month equivalent, monthly shows direct price
          const displayPrice  = tier.key === 'free'
            ? FREE_DISPLAY[region]
            : (isYearly && pricing!.perMonth ? pricing!.perMonth : pricing!.price)
          const displayPeriod = tier.key === 'free' ? 'forever' : '/ month'
          const anchor        = pricing?.anchor ?? null   // only set for monthly in PRICING_CONFIG
          const billingNote   = pricing?.note ?? null

          // CTA label — context-aware
          let ctaLabel = tier.cta
          if (tier.key !== 'free' && !isSamePlan) {
            if (currentTier === tier.key && currentBillingCycle !== billing) {
              ctaLabel = billing === 'yearly' ? 'Switch to Annual' : 'Switch to Monthly'
            } else if (currentLevel > 0 && thisLevel < currentLevel) {
              ctaLabel = `Downgrade to ${tier.name}`
            } else if (currentLevel > 0 && thisLevel > currentLevel) {
              ctaLabel = `Upgrade to ${tier.name}`
            }
          }

          return (
            <div key={tier.key} id={tier.name.toLowerCase()} className="glass-card" style={{
              display: 'flex', flexDirection: 'column',
              borderColor: isSamePlan ? 'var(--gold)' : isHighlighted ? 'rgba(201,169,110,0.45)' : undefined,
              borderRadius: '16px', padding: '1.4rem',
              position: 'relative',
              boxShadow: isSamePlan
                ? 'inset 0 1px 0 rgba(201,169,110,0.15), 0 0 0 1px rgba(201,169,110,0.25), 0 0 55px rgba(201,169,110,0.18)'
                : isHighlighted
                  ? 'inset 0 1px 0 rgba(201,169,110,0.10), 0 0 0 1px rgba(201,169,110,0.18), 0 0 60px rgba(201,169,110,0.14)'
                  : undefined,
            }}>

              {/* Badges */}
              {isSamePlan && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--gold)', color: 'var(--ink)',
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
                  padding: '4px 14px', borderRadius: '100px', whiteSpace: 'nowrap',
                }}>
                  Current plan
                </div>
              )}
              {isHighlighted && !isSamePlan && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                  color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '9px',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '4px 14px', borderRadius: '100px', whiteSpace: 'nowrap',
                }}>
                  Most popular
                </div>
              )}

              {/* Plan name + offer badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)',
                }}>
                  {tier.name}
                </p>
                {region === 'IN' && offerLabel && tier.key !== 'free' && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '8.5px',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: '#6FCF97',
                    background: 'rgba(111,207,151,0.1)',
                    border: '1px solid rgba(111,207,151,0.25)',
                    padding: '2px 8px', borderRadius: '100px',
                    fontWeight: 600,
                  }}>
                    {offerLabel}
                  </span>
                )}
              </div>

              <p style={{
                fontSize: '13px', color: 'var(--text-tertiary)',
                fontWeight: 300, marginBottom: '0.95rem', lineHeight: 1.5,
              }}>
                {tier.tagline}
              </p>

              {/* Price block */}
              <div style={{ marginBottom: '1rem' }}>
                {/* Crossed-out anchor — monthly + India only */}
                {anchor && region === 'IN' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    marginBottom: '0.2rem',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-serif)', fontSize: '1.1rem',
                      fontWeight: 300, color: 'var(--text-tertiary)',
                      textDecoration: 'line-through',
                      textDecorationColor: 'rgba(240,237,232,0.3)',
                    }}>
                      {anchor}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px',
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'rgba(240,237,232,0.3)',
                    }}>
                      / month
                    </span>
                  </div>
                )}

                {/* Main price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                  <span style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '2.3rem', fontWeight: 300,
                    color: 'var(--text-primary)', lineHeight: 1,
                  }}>
                    {displayPrice}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 300 }}>
                    {displayPeriod}
                  </span>
                </div>

                {/* "Billed annually ₹X,XXX" — yearly only */}
                {billingNote && (
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    letterSpacing: '0.06em',
                    color: 'var(--text-tertiary)', marginTop: '0.3rem',
                  }}>
                    {billingNote}
                  </p>
                )}
              </div>

              <div style={{ height: '1px', background: 'var(--border)', marginBottom: '0.95rem' }} />

              {/* Features */}
              <ul style={{
                listStyle: 'none', padding: 0,
                margin: '0 0 1.05rem', flex: 1,
                display: 'flex', flexDirection: 'column', gap: '0.45rem',
              }}>
                {tier.features.map((feature) => (
                  <li key={feature} style={{
                    display: 'flex', alignItems: 'flex-start',
                    gap: '0.6rem', fontSize: '13px',
                    color: 'var(--text-secondary)', fontWeight: 300,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="var(--gold)" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, marginTop: '2px' }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isSamePlan ? (
                <div style={{
                  padding: '0.62rem', borderRadius: '12px',
                  border: '1px solid var(--border-gold)', background: 'var(--gold-dim)',
                  textAlign: 'center', fontFamily: 'var(--font-mono)',
                  fontSize: '12px', letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--gold)',
                }}>
                  Your current plan
                </div>
              ) : tier.key === 'free' ? (
                <Link href="/" style={{
                  display: 'block', padding: '0.62rem', borderRadius: '12px',
                  border: '1px solid var(--border)', background: 'var(--ink-3)',
                  textAlign: 'center', fontFamily: 'var(--font-sans)',
                  fontSize: '14px', fontWeight: 500,
                  color: 'var(--text-primary)', textDecoration: 'none',
                  transition: 'border-color 0.2s, background 0.2s',
                }}>
                  {user ? 'Go to search' : 'Get started free'}
                </Link>
              ) : (
                <button
                  onClick={() => handleUpgradeClick(tier.key, tier.name)}
                  disabled={isLoading || !!buying}
                  style={{
                    width: '100%', padding: '0.62rem', borderRadius: '12px',
                    border: '1px solid var(--border-gold)',
                    background: isHighlighted
                      ? (isLoading ? 'rgba(201,169,110,0.5)' : 'var(--gold)')
                      : 'var(--gold-dim)',
                    color: isHighlighted ? 'var(--ink)' : 'var(--gold)',
                    fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500,
                    cursor: isLoading || !!buying ? 'default' : 'pointer',
                    opacity: !!buying && !isLoading ? 0.6 : 1,
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {isLoading ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Redirecting…
                    </>
                  ) : (
                    <>
                      {ctaLabel}
                      {region === 'IN' && offerLabel && (
                        <span style={{
                          fontSize: '10px', fontFamily: 'var(--font-mono)',
                          letterSpacing: '0.06em', opacity: 0.75,
                        }}>
                          · {offerLabel}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Trust footer — no backend processor names ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.8rem', marginTop: '3rem',
      }}>
        {[
          { label: 'Cancel anytime', href: null },
          { label: 'Terms', href: '/terms' },
          { label: 'Refund Policy', href: '/refund' },
        ].map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {i > 0 && <span style={{ color: 'var(--text-tertiary)', opacity: 0.4 }}>&bull;</span>}
            {item.href ? (
              <Link href={item.href} style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)', textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}>
                {item.label}
              </Link>
            ) : (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}>
                {item.label}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* ── Plan confirmation modal ── */}
      {confirmModal && (() => {
        const cm = confirmModal
        const perMonthDisplay    = cm.billing === 'yearly' && cm.pricing.perMonth
          ? cm.pricing.perMonth + ' / month'
          : cm.pricing.price + ' / month'
        const totalBilledDisplay = cm.billing === 'yearly'
          ? cm.pricing.price + ' / year'
          : cm.pricing.price + ' / month'
        const renewalDate = getRenewalDate(cm.billing)

        type SummaryRow = { label: string; value: string; highlight?: boolean }
        const summaryRows: SummaryRow[] = [
          { label: 'Billing cycle', value: cm.billing === 'yearly' ? 'Annual'  : 'Monthly' },
          { label: 'Per month',     value: perMonthDisplay },
          { label: 'Billed today',  value: totalBilledDisplay },
          { label: 'Renews on',     value: renewalDate },
          ...(cm.pricing.label && region === 'IN'
            ? [{ label: 'You save', value: `${cm.pricing.label} — Limited time offer`, highlight: true }]
            : []),
        ]

        return (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setConfirmModal(null)}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(6,7,10,0.75)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                zIndex: 9000,
              }}
            />
            {/* Dialog */}
            <div style={{
              position: 'fixed', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9001, padding: '1rem', pointerEvents: 'none',
            }}>
              <div style={{
                pointerEvents: 'all',
                width: '100%', maxWidth: '400px',
                background: 'rgba(22, 20, 18, 0.99)',
                border: '1px solid rgba(201,169,110,0.18)',
                borderRadius: '20px', overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
                animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
                position: 'relative',
              }}>
                {/* Gold accent line */}
                <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.55), transparent)' }} />

                <div style={{ padding: '1.75rem' }}>
                  {/* Close */}
                  <button
                    onClick={() => setConfirmModal(null)}
                    style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      background: 'rgba(255,255,255,0.06)', border: 'none',
                      borderRadius: '50%', width: '28px', height: '28px',
                      color: 'var(--text-tertiary)', cursor: 'pointer',
                      fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>

                  {/* Title */}
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--gold)', marginBottom: '0.2rem',
                  }}>
                    Confirm your plan
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-serif)', fontSize: '1.5rem',
                    fontWeight: 300, color: '#F0EDE8', marginBottom: '1.25rem',
                  }}>
                    {cm.tierName}
                  </p>

                  {/* Plan summary */}
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px', padding: '0.875rem 1rem',
                    marginBottom: '1.25rem',
                  }}>
                    {summaryRows.map((row, i) => (
                      <div key={row.label} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.4rem 0',
                        borderBottom: i < summaryRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      }}>
                        <span style={{
                          fontSize: '11.5px', color: 'rgba(240,237,232,0.42)',
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                        }}>
                          {row.label}
                        </span>
                        <span style={{
                          fontSize: '12.5px',
                          color: row.highlight ? '#6FCF97' : '#F0EDE8',
                          fontWeight: 400, fontFamily: 'var(--font-sans)',
                        }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Payment method selector */}
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'rgba(240,237,232,0.35)', marginBottom: '0.55rem',
                  }}>
                    Pay with
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {(['upi', 'card'] as const).map(method => (
                      <button
                        key={method}
                        onClick={() => setSelectedPayment(method)}
                        style={{
                          flex: 1, padding: '9px 0',
                          borderRadius: '10px',
                          border: `1px solid ${selectedPayment === method ? 'rgba(201,169,110,0.45)' : 'rgba(255,255,255,0.08)'}`,
                          background: selectedPayment === method ? 'rgba(201,169,110,0.1)' : 'rgba(255,255,255,0.03)',
                          color: selectedPayment === method ? '#C9A96E' : 'rgba(240,237,232,0.42)',
                          fontFamily: 'var(--font-mono)', fontSize: '11px',
                          letterSpacing: '0.07em', textTransform: 'uppercase',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {method === 'upi' ? 'UPI' : 'Card'}
                      </button>
                    ))}
                    {/* Stripe — coming soon */}
                    <button disabled style={{
                      flex: 1, padding: '9px 0',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.04)',
                      background: 'rgba(255,255,255,0.02)',
                      color: 'rgba(240,237,232,0.2)',
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      letterSpacing: '0.06em', cursor: 'not-allowed',
                      lineHeight: 1.3,
                    }}>
                      Stripe<br/>
                      <span style={{ fontSize: '8px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Soon
                      </span>
                    </button>
                  </div>

                  {/* Pay button */}
                  <button
                    onClick={handleConfirmPay}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '12px',
                      border: '1px solid rgba(201,169,110,0.35)',
                      background: 'rgba(201,169,110,0.12)',
                      color: '#C9A96E', fontFamily: 'var(--font-sans)',
                      fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Continue to {selectedPayment === 'upi' ? 'UPI' : 'Card'} payment →
                  </button>

                  <p style={{
                    textAlign: 'center', fontSize: '11px',
                    color: 'rgba(240,237,232,0.22)',
                    marginTop: '0.75rem',
                  }}>
                    Secure, encrypted payment
                  </p>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Phone number modal ── */}
      {phoneModal && (
        <>
          <div
            onClick={() => { setPhoneModal(false); setBuying(null) }}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(6,7,10,0.75)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 9000,
            }}
          />
          <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9001, padding: '1rem', pointerEvents: 'none',
          }}>
            <div style={{
              pointerEvents: 'all',
              width: '100%', maxWidth: '380px',
              background: 'rgba(22, 20, 18, 0.99)',
              border: '1px solid rgba(201,169,110,0.18)',
              borderRadius: '20px', overflow: 'hidden',
              boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
              animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
              position: 'relative',
            }}>
              <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.55), transparent)' }} />
              <div style={{ padding: '1.75rem' }}>
                <button
                  onClick={() => { setPhoneModal(false); setBuying(null) }}
                  style={{
                    position: 'absolute', top: '1rem', right: '1rem',
                    background: 'rgba(255,255,255,0.06)', border: 'none',
                    borderRadius: '50%', width: '28px', height: '28px',
                    color: 'var(--text-tertiary)', cursor: 'pointer',
                    fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
                <p style={{
                  fontFamily: 'var(--font-serif)', fontSize: '1.5rem',
                  fontWeight: 300, color: '#F0EDE8', marginBottom: '0.35rem',
                }}>
                  One more step.
                </p>
                <p style={{
                  fontSize: '13px', color: 'rgba(240,237,232,0.45)',
                  fontWeight: 300, lineHeight: 1.55, marginBottom: '1.25rem',
                }}>
                  We need your mobile number to set up the payment mandate (UPI / NetBanking / Card).
                </p>
                <form onSubmit={handlePhoneSubmit}>
                  <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                    <span style={{
                      position: 'absolute', left: '12px', top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '13px', color: 'rgba(240,237,232,0.4)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      inputMode="numeric"
                      maxLength={10}
                      autoFocus
                      style={{
                        width: '100%', padding: '12px 16px 12px 44px',
                        borderRadius: '12px',
                        border: `1px solid ${phoneError ? 'rgba(244,124,124,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        background: 'rgba(255,255,255,0.04)',
                        color: '#F0EDE8', fontFamily: 'var(--font-sans)',
                        fontSize: '15px', fontWeight: 300, outline: 'none',
                        boxSizing: 'border-box', letterSpacing: '0.05em',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.45)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = phoneError ? 'rgba(244,124,124,0.4)' : 'rgba(255,255,255,0.08)' }}
                    />
                  </div>
                  {phoneError && (
                    <p style={{ fontSize: '12px', color: '#F47C7C', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                      {phoneError}
                    </p>
                  )}
                  <p style={{
                    fontSize: '11px', color: 'rgba(240,237,232,0.22)',
                    marginBottom: '1rem', lineHeight: 1.55,
                  }}>
                    Used only for payment mandate verification.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting || phone.replace(/\D/g, '').length < 10}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '12px',
                      border: '1px solid rgba(201,169,110,0.35)',
                      background: 'rgba(201,169,110,0.1)', color: '#C9A96E',
                      fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
                      cursor: submitting || phone.replace(/\D/g, '').length < 10 ? 'default' : 'pointer',
                      opacity: submitting || phone.replace(/\D/g, '').length < 10 ? 0.45 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {submitting ? 'Redirecting…' : 'Continue to payment →'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </>
  )
}
