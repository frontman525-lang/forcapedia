'use client'

import Link from 'next/link'
import { useState } from 'react'

type Billing = 'monthly' | 'yearly'

interface PricingPlansProps {
  user: boolean
  currentTier: string
  initialBilling: Billing
}

const YEARLY_PRICING: Record<string, { price: string; period: string; note?: string }> = {
  tier1: { price: '$69.99', period: '/ year', note: 'Billed annually' },
  tier2: { price: '$149.99', period: '/ year', note: 'Billed annually' },
}

const TIERS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Everything you need to get started.',
    features: [
      '50,000 tokens per month',
      '5 follow-up Tokens',
      'All subjects and topics',
    ],
    cta: 'Start for free',
    highlight: false,
  },
  {
    key: 'tier1',
    name: 'Scholar',
    price: '$6.99',
    period: '/ month',
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
    price: '$14.99',
    period: '/ month',
    tagline: 'For professionals who demand more.',
    features: [
      '4,000,000 tokens per month',
      'Memory Progress Tracking',
      'Unlimited follow-up questions',
      'More usage than Scholar',
      'Collaborative rooms for Max 50',
      'Priority processing + dedicated support',
    ],
    cta: 'Upgrade to Researcher',
    highlight: false,
  },
]

export default function PricingPlans({ user, currentTier, initialBilling }: PricingPlansProps) {
  const [billing, setBilling] = useState<Billing>(initialBilling)
  const isYearly = billing === 'yearly'

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px', letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--gold)',
          marginBottom: '0.9rem',
        }}>
          Pricing
        </p>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
          fontWeight: 300, lineHeight: 1.1,
          color: 'var(--text-primary)',
          marginBottom: '0.9rem',
        }}>
          Simple, honest pricing.
        </h1>
        <p style={{
          fontSize: '15px', color: 'var(--text-secondary)',
          fontWeight: 300, lineHeight: 1.75,
          maxWidth: '460px', margin: '0 auto',
        }}>
          No hidden fees. No credit card required to start.
          Tokens reset monthly.
        </p>

        <div style={{
          marginTop: '1.1rem',
          position: 'relative',
          display: 'inline-grid',
          gridTemplateColumns: '1fr 1fr',
          alignItems: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '999px',
          padding: '4px',
          minWidth: '226px',
        }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: '4px',
              bottom: '4px',
              left: isYearly ? 'calc(50% + 2px)' : '4px',
              width: 'calc(50% - 6px)',
              borderRadius: '999px',
              background: 'var(--gold)',
              transition: 'left 180ms ease',
            }}
          />
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            style={{
              position: 'relative',
              zIndex: 1,
              border: 0,
              background: 'transparent',
              padding: '0.42rem 0.85rem',
              borderRadius: '999px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: !isYearly ? 'var(--ink)' : 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
            aria-pressed={!isYearly}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling('yearly')}
            style={{
              position: 'relative',
              zIndex: 1,
              border: 0,
              background: 'transparent',
              padding: '0.42rem 0.85rem',
              borderRadius: '999px',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: isYearly ? 'var(--ink)' : 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
            aria-pressed={isYearly}
          >
            Yearly
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
        alignItems: 'stretch',
      }}>
        {TIERS.map((tier) => {
          const isCurrent = currentTier === tier.key
          const isHighlighted = tier.highlight
          const yearly = YEARLY_PRICING[tier.key]
          const displayPrice = isYearly && yearly ? yearly.price : tier.price
          const displayPeriod = isYearly && yearly ? yearly.period : tier.period
          const billingNote = isYearly && yearly?.note ? yearly.note : null

          return (
            <div
              key={tier.key}
              id={tier.name.toLowerCase()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface)',
                border: `1px solid ${
                  isCurrent ? 'var(--gold)'
                  : isHighlighted ? 'var(--border-gold)'
                  : 'var(--border)'
                }`,
                borderRadius: '16px',
                padding: '1.4rem',
                position: 'relative',
                boxShadow: isHighlighted
                  ? '0 0 0 1px rgba(201,169,110,0.12), 0 20px 60px rgba(0,0,0,0.35)'
                  : '0 4px 24px rgba(0,0,0,0.18)',
              }}
            >
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--gold)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px', letterSpacing: '0.12em',
                  textTransform: 'uppercase', fontWeight: 700,
                  padding: '4px 14px', borderRadius: '100px',
                  whiteSpace: 'nowrap',
                }}>
                  Current plan
                </div>
              )}

              {isHighlighted && !isCurrent && (
                <div style={{
                  position: 'absolute', top: '-13px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--gold-dim)',
                  border: '1px solid var(--border-gold)',
                  color: 'var(--gold)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px', letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '4px 14px', borderRadius: '100px',
                  whiteSpace: 'nowrap',
                }}>
                  Most popular
                </div>
              )}

              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--gold)', marginBottom: '0.45rem',
              }}>
                {tier.name}
              </p>

              <p style={{
                fontSize: '13px', color: 'var(--text-tertiary)',
                fontWeight: 300, marginBottom: '0.95rem', lineHeight: 1.5,
              }}>
                {tier.tagline}
              </p>

              <div style={{
                display: 'flex', alignItems: 'baseline',
                gap: '0.3rem', marginBottom: '1rem',
              }}>
                <span style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '2.3rem', fontWeight: 300,
                  color: 'var(--text-primary)', lineHeight: 1,
                }}>
                  {displayPrice}
                </span>
                <span style={{
                  fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 300,
                }}>
                  {displayPeriod}
                </span>
              </div>
              {billingNote && (
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  marginBottom: '0.75rem',
                }}>
                  {billingNote}
                </p>
              )}

              <div style={{
                height: '1px', background: 'var(--border)', marginBottom: '0.95rem',
              }} />

              <ul style={{
                listStyle: 'none', padding: 0,
                margin: '0 0 1.05rem',
                flex: 1,
                display: 'flex', flexDirection: 'column', gap: '0.45rem',
              }}>
                {tier.features.map((feature) => (
                  <li key={feature} style={{
                    display: 'flex', alignItems: 'flex-start',
                    gap: '0.6rem',
                    fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300,
                  }}>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="var(--gold)" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, marginTop: '2px' }}
                    >
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div style={{
                  padding: '0.62rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-gold)',
                  background: 'var(--gold-dim)',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--gold)',
                }}>
                  Your current plan
                </div>
              ) : tier.key === 'free' ? (
                <Link href="/" style={{
                  display: 'block', padding: '0.62rem',
                  borderRadius: '12px', border: '1px solid var(--border)',
                  background: 'var(--ink-3)', textAlign: 'center',
                  fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500,
                  color: 'var(--text-primary)', textDecoration: 'none',
                  transition: 'border-color 0.2s, background 0.2s',
                }}>
                  {user ? 'Go to search' : 'Get started free'}
                </Link>
              ) : (
                <button
                  disabled
                  style={{
                    width: '100%', padding: '0.62rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-gold)',
                    background: isHighlighted ? 'var(--gold)' : 'var(--gold-dim)',
                    color: isHighlighted ? 'var(--ink)' : 'var(--gold)',
                    fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500,
                    cursor: 'not-allowed', opacity: 0.65,
                  }}
                  title="Payments coming soon"
                >
                  {tier.cta} - Coming soon
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        gap: '0.8rem',
        marginTop: '3rem',
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}>
          Cancel anytime
        </span>
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>&bull;</span>
        <Link
          href="/terms"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          Terms
        </Link>
        <span style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>&bull;</span>
        <Link
          href="/refund"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          Refund Policy
        </Link>
      </div>
    </>
  )
}
