import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'

export const metadata: Metadata = { title: 'Pricing — Forcapedia' }

const TIERS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Get started with verified knowledge.',
    tokens: '50,000',
    features: [
      '50,000 tokens / month',
      '1 follow-up per article',
      'Full article access',
      'Light & dark mode',
      'Community support',
    ],
    cta: 'Get started',
    ctaHref: '/',
  },
  {
    key: 'tier1',
    name: 'Scholar',
    price: '$6.99',
    period: 'per month',
    tagline: 'For curious minds who go deep.',
    tokens: '2,000,000',
    features: [
      '2,000,000 tokens / month',
      'Unlimited follow-ups',
      'Full article access',
      'Search history',
      'Priority support',
    ],
    cta: 'Upgrade to Scholar',
    ctaHref: '/pricing#scholar',
    highlight: true,
  },
  {
    key: 'tier2',
    name: 'Researcher',
    price: '$14.99',
    period: 'per month',
    tagline: 'For professionals who demand more.',
    tokens: '4,000,000',
    features: [
      '4,000,000 tokens / month',
      'Unlimited follow-ups',
      'Full article access',
      'Search history',
      'Priority processing',
      'Dedicated support',
    ],
    cta: 'Upgrade to Researcher',
    ctaHref: '/pricing#researcher',
  },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let currentTier = 'none'
  if (user) {
    const { data: usage } = await supabase
      .from('user_usage')
      .select('tier')
      .eq('id', user.id)
      .single()
    currentTier = usage?.tier ?? 'free'
  }

  return (
    <>
      <Nav />
      <main style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem' }}>
        <div style={{ maxWidth: '1020px', margin: '0 auto', padding: '4rem 1.5rem 0' }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px', letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--gold)',
              marginBottom: '1rem',
            }}>
              Pricing
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
              fontWeight: 300, lineHeight: 1.1,
              color: 'var(--text-primary)',
              marginBottom: '1rem',
            }}>
              Simple, honest pricing.
            </h1>
            <p style={{
              fontSize: '15px', color: 'var(--text-secondary)',
              fontWeight: 300, lineHeight: 1.7,
              maxWidth: '480px', margin: '0 auto',
            }}>
              No surprises. Pay for what you use. Every plan includes full access to verified articles.
            </p>
          </div>

          {/* Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            alignItems: 'start',
          }}>
            {TIERS.map((tier) => {
              const isCurrent = currentTier === tier.key
              const isHighlighted = tier.highlight

              return (
                <div
                  key={tier.key}
                  id={tier.name.toLowerCase()}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isCurrent ? 'var(--gold)' : isHighlighted ? 'var(--border-gold)' : 'var(--border)'}`,
                    borderRadius: '20px',
                    padding: '2rem',
                    position: 'relative',
                    transform: isHighlighted ? 'translateY(-8px)' : 'none',
                    boxShadow: isHighlighted
                      ? '0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,169,110,0.08)'
                      : '0 4px 24px rgba(0,0,0,0.2)',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Current plan badge */}
                  {isCurrent && (
                    <div style={{
                      position: 'absolute', top: '-12px', left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--gold)',
                      color: 'var(--ink)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px', letterSpacing: '0.1em',
                      textTransform: 'uppercase', fontWeight: 600,
                      padding: '4px 12px', borderRadius: '100px',
                      whiteSpace: 'nowrap',
                    }}>
                      Current plan
                    </div>
                  )}

                  {/* Popular badge for Scholar */}
                  {isHighlighted && !isCurrent && (
                    <div style={{
                      position: 'absolute', top: '-12px', left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--gold-dim)',
                      border: '1px solid var(--border-gold)',
                      color: 'var(--gold)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px', letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      padding: '4px 12px', borderRadius: '100px',
                      whiteSpace: 'nowrap',
                    }}>
                      Most popular
                    </div>
                  )}

                  {/* Plan name + tagline */}
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem',
                  }}>
                    {tier.name}
                  </p>
                  <p style={{
                    fontSize: '12.5px', color: 'var(--text-tertiary)',
                    fontWeight: 300, marginBottom: '1.5rem', lineHeight: 1.5,
                  }}>
                    {tier.tagline}
                  </p>

                  {/* Price */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '1.75rem' }}>
                    <span style={{
                      fontFamily: 'var(--font-serif)', fontSize: '2.75rem', fontWeight: 300,
                      color: 'var(--text-primary)', lineHeight: 1,
                    }}>
                      {tier.price}
                    </span>
                    <span style={{
                      fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 300,
                    }}>
                      {tier.period}
                    </span>
                  </div>

                  {/* Features */}
                  <ul style={{
                    listStyle: 'none', padding: 0, margin: '0 0 2rem',
                    display: 'flex', flexDirection: 'column', gap: '0.625rem',
                  }}>
                    {tier.features.map((feature) => (
                      <li key={feature} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                        fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 300,
                      }}>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ flexShrink: 0, marginTop: '2px' }}
                        >
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrent ? (
                    <div style={{
                      width: '100%', padding: '0.8rem',
                      borderRadius: '12px', border: '1px solid var(--border-gold)',
                      background: 'var(--gold-dim)',
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: '12px',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      color: 'var(--gold)',
                    }}>
                      Your current plan
                    </div>
                  ) : tier.key === 'free' ? (
                    <Link href={user ? '/' : '/'} style={{
                      display: 'block', width: '100%', padding: '0.8rem',
                      borderRadius: '12px', border: '1px solid var(--border)',
                      background: 'var(--ink-3)', textAlign: 'center',
                      fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500,
                      color: 'var(--text-primary)', textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}>
                      {user ? 'Go to search' : tier.cta}
                    </Link>
                  ) : (
                    <button
                      disabled
                      style={{
                        width: '100%', padding: '0.8rem',
                        borderRadius: '12px', border: '1px solid var(--border-gold)',
                        background: isHighlighted ? 'var(--gold)' : 'var(--gold-dim)',
                        color: isHighlighted ? 'var(--ink)' : 'var(--gold)',
                        fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500,
                        cursor: 'not-allowed', opacity: 0.6,
                      }}
                      title="Payments coming soon"
                    >
                      {tier.cta} — Coming soon
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer note */}
          <p style={{
            textAlign: 'center', marginTop: '3rem',
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            color: 'var(--text-tertiary)', lineHeight: 1.7,
          }}>
            Tokens reset monthly. Unused tokens do not carry over.{' '}
            {!user && (
              <>All plans require a free Google account to sign in.</>
            )}
          </p>

        </div>
      </main>
    </>
  )
}
