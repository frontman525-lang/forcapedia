'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuccessContent() {
  const router      = useRouter()
  const params      = useSearchParams()
  const plan        = params.get('plan') ?? ''

  const planNames: Record<string, string> = {
    tier1_monthly: 'Scholar (Monthly)',
    tier1_yearly:  'Scholar (Yearly)',
    tier2_monthly: 'Researcher (Monthly)',
    tier2_yearly:  'Researcher (Yearly)',
  }
  const planName = planNames[plan] ?? 'your new plan'

  const [tick, setTick]     = useState(0)
  const [ready, setReady]   = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  // Poll subscription status for up to 30s (webhook may take a moment)
  useEffect(() => {
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      try {
        const res  = await fetch('/api/payments/status')
        const data = await res.json()
        if (data.subscription?.status === 'active') {
          setReady(true)
          clearInterval(interval)
          setTimeout(() => router.replace('/'), 2500)
        }
      } catch { /* ignore */ }
      setTick(attempts)
      if (attempts >= 15) {
        clearInterval(interval)
        setTimedOut(true)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [router])

  const dots = '.'.repeat((tick % 3) + 1)

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      position: 'relative',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: ready
          ? 'radial-gradient(ellipse 70% 45% at 50% 10%, rgba(111,207,151,0.08) 0%, transparent 65%)'
          : 'radial-gradient(ellipse 70% 45% at 50% 10%, rgba(201,169,110,0.1) 0%, transparent 65%)',
        transition: 'background 1s ease',
      }} />

      <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.75rem', fontWeight: 300,
            color: '#F0EDE8', marginBottom: '2rem',
          }}>
            Forca<em style={{ fontStyle: 'italic', color: '#C9A96E' }}>pedia</em>
          </p>
        </Link>

        {/* Card */}
        <div style={{
          background: 'rgba(22, 20, 18, 0.97)',
          border: `1px solid ${ready ? 'rgba(111,207,151,0.25)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 48px 120px rgba(0,0,0,0.65)',
          transition: 'border-color 0.6s ease',
        }}>
          <div style={{
            height: '1px',
            background: ready
              ? 'linear-gradient(90deg, transparent, rgba(111,207,151,0.6), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(201,169,110,0.55), transparent)',
            transition: 'background 0.6s ease',
          }} />

          <div style={{ padding: '2.5rem 2rem' }}>
            {/* Icon */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: ready ? 'rgba(111,207,151,0.1)' : 'rgba(201,169,110,0.08)',
              border: `1px solid ${ready ? 'rgba(111,207,151,0.3)' : 'rgba(201,169,110,0.2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
              transition: 'all 0.6s ease',
            }}>
              {ready ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6FCF97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              )}
            </div>

            {ready ? (
              <>
                <h1 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.8rem', fontWeight: 300,
                  color: '#F0EDE8', marginBottom: '0.5rem',
                }}>
                  You&apos;re all set.
                </h1>
                <p style={{
                  fontSize: '14px',
                  color: 'rgba(240,237,232,0.5)',
                  fontWeight: 300, lineHeight: 1.65,
                  marginBottom: '1rem',
                }}>
                  <strong style={{ color: '#C9A96E', fontWeight: 500 }}>{planName}</strong> is now active.
                  Redirecting you back to Forcapedia…
                </p>
              </>
            ) : timedOut ? (
              <>
                <h1 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.8rem', fontWeight: 300,
                  color: '#F0EDE8', marginBottom: '0.5rem',
                }}>
                  Payment received.
                </h1>
                <p style={{
                  fontSize: '14px',
                  color: 'rgba(240,237,232,0.5)',
                  fontWeight: 300, lineHeight: 1.65,
                  marginBottom: '1rem',
                }}>
                  Your <strong style={{ color: '#C9A96E', fontWeight: 500 }}>{planName}</strong> plan
                  is being activated. It may take a minute to reflect — please check your profile shortly.
                </p>
              </>
            ) : (
              <>
                <h1 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.8rem', fontWeight: 300,
                  color: '#F0EDE8', marginBottom: '0.5rem',
                }}>
                  Activating your plan{dots}
                </h1>
                <p style={{
                  fontSize: '14px',
                  color: 'rgba(240,237,232,0.45)',
                  fontWeight: 300, lineHeight: 1.65,
                  marginBottom: '1.5rem',
                }}>
                  We&apos;re confirming your payment mandate with Cashfree.
                  This usually takes a few seconds.
                </p>
                <p style={{
                  fontSize: '12px',
                  color: 'rgba(240,237,232,0.25)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                }}>
                  Plan: <span style={{ color: 'rgba(201,169,110,0.7)' }}>{planName}</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Back link */}
        <p style={{ marginTop: '1.25rem', fontSize: '12px', color: 'rgba(240,237,232,0.25)' }}>
          <Link href="/" style={{ color: 'rgba(201,169,110,0.5)', textDecoration: 'none' }}>
            ← Return to Forcapedia
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  )
}
