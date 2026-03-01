'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

// Load Cashfree JS SDK from CDN on demand — never bundled into the app
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
    script.id  = 'cashfree-sdk'
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
    script.onload  = init
    script.onerror = () => reject(new Error('Failed to load Cashfree script'))
    document.head.appendChild(script)
  })
}

type Billing = 'monthly' | 'yearly'
type Region  = 'IN' | 'GLOBAL'

interface PricingEntry {
  price:   string
  anchor:  string | null
  label:   string | null
  note?:   string
}

interface PricingPlansProps {
  user:           boolean
  currentTier:    string
  initialBilling: Billing
}

// ── Pricing config ─────────────────────────────────────────────────────────────
// anchor = crossed-out "was" price shown next to the actual price
const PRICING_CONFIG = {
  IN: {
    tier1: {
      monthly: { price: '₹499',    anchor: '₹999',    label: '50% OFF' },
      yearly:  { price: '₹4,999',  anchor: '₹9,999',  label: '50% OFF', note: 'Billed annually' },
    },
    tier2: {
      monthly: { price: '₹1,099',  anchor: '₹2,199',  label: '50% OFF' },
      yearly:  { price: '₹9,999',  anchor: '₹19,999', label: '50% OFF', note: 'Billed annually' },
    },
  },
  GLOBAL: {
    tier1: {
      monthly: { price: '$7.99',   anchor: null, label: null },
      yearly:  { price: '$79.99',  anchor: null, label: null, note: 'Billed annually' },
    },
    tier2: {
      monthly: { price: '$14.99',  anchor: null, label: null },
      yearly:  { price: '$149.99', anchor: null, label: null, note: 'Billed annually' },
    },
  },
} as const

const TIERS = [
  {
    key: 'free',
    name: 'Free',
    tagline: 'Everything you need to get started.',
    features: ['50,000 tokens per month', '5 follow-up Tokens', 'All subjects and topics'],
    cta: 'Start for free',
    highlight: false,
  },
  {
    key: 'tier1',
    name: 'Scholar',
    tagline: 'For students who need more depth.',
    features: [
      '2,000,000 tokens per month',
      'Unlimited follow-up questions',
      'Memory Progress Tracking',
      'Collaborative Room for Max 25',
      'Priority support',
    ],
    cta: 'Upgrade to Scholar',
    highlight: true,
  },
  {
    key: 'tier2',
    name: 'Researcher',
    tagline: 'For professionals who demand more.',
    features: [
      '4,000,000 tokens per month',
      'Unlimited follow-up questions',
      'Memory Progress Tracking',
      'More usage than Scholar',
      'Collaborative rooms for Max 50',
      'Priority processing + dedicated support',
    ],
    cta: 'Upgrade to Researcher',
    highlight: false,
  },
]

// Free tier display pricing (region-aware)
const FREE_DISPLAY = { IN: '₹0', GLOBAL: '$0' }

export default function PricingPlans({ user, currentTier, initialBilling }: PricingPlansProps) {
  const [billing, setBilling]   = useState<Billing>(initialBilling)
  const [region, setRegion]     = useState<Region>('GLOBAL')
  const [geoLoaded, setGeoLoaded] = useState(false)
  const isYearly = billing === 'yearly'

  // ── Payment state ────────────────────────────────────────────────────────
  const [buying, setBuying]           = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [phoneModal, setPhoneModal]   = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [phone, setPhone]             = useState('')
  const [phoneError, setPhoneError]   = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)

  // ── Geo detection ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/geo')
      .then(r => r.json())
      .then(({ country }: { country: string }) => {
        setRegion(country === 'IN' ? 'IN' : 'GLOBAL')
      })
      .catch(() => { /* keep GLOBAL default */ })
      .finally(() => setGeoLoaded(true))
  }, [])

  // ── Subscribe flow ────────────────────────────────────────────────────────
  async function initSubscribe(tierKey: string, providedPhone?: string) {
    // Global users: Cashfree only handles INR — notify them
    if (region === 'GLOBAL') {
      setGlobalError('International card payments (USD) are coming soon. Currently we support UPI / NetBanking / Indian cards via Cashfree.')
      setBuying(null)
      return
    }

    const planKey     = `${tierKey}_${billing}`
    const billingCycle = billing

    setBuying(planKey)
    setGlobalError(null)

    const body: Record<string, string> = { tier: tierKey, billingCycle }
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
        const mode = (data.cashfreeMode ?? 'sandbox') as 'sandbox' | 'production'
        const cashfree = await loadCashfreeSDK(mode)
        const result = await cashfree.subscriptionsCheckout({
          subsSessionId: data.sessionId,
          redirectTarget: '_self',
        })
        if (result?.error) {
          setGlobalError(result.error.message)
          setBuying(null)
        }
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

  function handleUpgradeClick(tierKey: string) {
    if (!user) { window.location.href = '/login'; return }
    initSubscribe(tierKey)
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) { setPhoneError('Enter a valid 10-digit mobile number.'); return }
    if (!pendingPlan) return

    const [tierKey] = pendingPlan.split('_')
    setSubmitting(true)
    setPhoneError(null)
    setPhoneModal(false)
    await initSubscribe(tierKey, digits.slice(-10))
    setSubmitting(false)
  }

  // ── Price display helper ──────────────────────────────────────────────────
  function getPricing(tierKey: 'tier1' | 'tier2'): PricingEntry {
    const cycle = isYearly ? 'yearly' : 'monthly'
    return PRICING_CONFIG[region][tierKey][cycle] as PricingEntry
  }

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
          maxWidth: '460px', margin: '0 auto',
        }}>
          No hidden fees. No credit card required to start. Tokens reset monthly.
        </p>

        {/* India Launch banner */}
        {geoLoaded && region === 'IN' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            marginTop: '1rem',
            padding: '6px 16px',
            background: 'linear-gradient(135deg, rgba(201,169,110,0.15), rgba(201,169,110,0.06))',
            border: '1px solid rgba(201,169,110,0.3)',
            borderRadius: '100px',
            animation: 'fadeIn 0.4s ease',
          }}>
            <span style={{ fontSize: '14px' }}>🇮🇳</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--gold)', fontWeight: 600,
            }}>
              India Launch Offer — Up to 50% off
            </span>
          </div>
        )}

        {/* Monthly / Yearly toggle */}
        <div style={{
          marginTop: '1.1rem',
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
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Plan cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem', alignItems: 'stretch',
      }}>
        {TIERS.map((tier) => {
          const isCurrent     = currentTier === tier.key
          const isHighlighted = tier.highlight
          const planKey       = `${tier.key}_${billing}`
          const isLoading     = buying === planKey

          // Pricing for paid tiers
          const pricing = tier.key !== 'free'
            ? getPricing(tier.key as 'tier1' | 'tier2')
            : null

          const displayPrice  = tier.key === 'free'
            ? FREE_DISPLAY[region]
            : pricing!.price

          const displayPeriod = tier.key === 'free'
            ? 'forever'
            : (isYearly ? '/ year' : '/ month')

          const anchor     = pricing?.anchor ?? null
          const offerLabel = pricing?.label ?? null
          const billingNote = pricing?.note ?? null

          return (
            <div key={tier.key} id={tier.name.toLowerCase()} style={{
              display: 'flex', flexDirection: 'column',
              background: 'var(--surface)',
              border: `1px solid ${isCurrent ? 'var(--gold)' : isHighlighted ? 'var(--border-gold)' : 'var(--border)'}`,
              borderRadius: '16px', padding: '1.4rem',
              position: 'relative',
              boxShadow: isHighlighted
                ? '0 0 0 1px rgba(201,169,110,0.12), 0 20px 60px rgba(0,0,0,0.35)'
                : '0 4px 24px rgba(0,0,0,0.18)',
            }}>

              {/* ── Badges ── */}
              {isCurrent && (
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
              {isHighlighted && !isCurrent && (
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

              {/* ── Plan header ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)',
                }}>
                  {tier.name}
                </p>
                {/* India launch badge */}
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

              {/* ── Price block ── */}
              <div style={{ marginBottom: '1rem' }}>
                {/* Anchor price (India only) */}
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
                      {isYearly ? '/ year' : '/ month'}
                    </span>
                  </div>
                )}

                {/* Actual price */}
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

                {/* Annual billing note */}
                {billingNote && (
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: 'var(--text-tertiary)', marginTop: '0.3rem',
                  }}>
                    {billingNote}
                  </p>
                )}
              </div>

              <div style={{ height: '1px', background: 'var(--border)', marginBottom: '0.95rem' }} />

              {/* ── Features ── */}
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

              {/* ── CTA ── */}
              {isCurrent ? (
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
                  onClick={() => handleUpgradeClick(tier.key)}
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Redirecting…
                    </>
                  ) : (
                    <>
                      {tier.cta}
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

      {/* ── Trust footer ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.8rem', marginTop: '3rem',
      }}>
        {[
          { label: 'Cancel anytime', href: null },
          { label: 'Secure payments via Cashfree', href: null },
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

      {/* ── Phone modal ── */}
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
              animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
              position: 'relative',
            }}>
              <div style={{
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.55), transparent)',
              }} />
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
                >
                  ✕
                </button>
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
                  Cashfree requires your mobile number to set up the payment mandate (UPI / NetBanking / Card).
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
                    Shared with Cashfree only for mandate verification.
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
