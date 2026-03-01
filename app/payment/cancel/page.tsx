'use client'

import Link from 'next/link'

export default function PaymentCancelPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      position: 'relative',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 45% at 50% 10%, rgba(244,124,124,0.07) 0%, transparent 65%)',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.75rem', fontWeight: 300,
            color: '#F0EDE8', marginBottom: '2rem',
          }}>
            Forca<em style={{ fontStyle: 'italic', color: '#C9A96E' }}>pedia</em>
          </p>
        </Link>

        <div style={{
          background: 'rgba(22, 20, 18, 0.97)',
          border: '1px solid rgba(244,124,124,0.15)',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 48px 120px rgba(0,0,0,0.65)',
        }}>
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(244,124,124,0.4), transparent)',
          }} />

          <div style={{ padding: '2.5rem 2rem' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(244,124,124,0.08)',
              border: '1px solid rgba(244,124,124,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F47C7C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.8rem', fontWeight: 300,
              color: '#F0EDE8', marginBottom: '0.5rem',
            }}>
              Payment cancelled.
            </h1>
            <p style={{
              fontSize: '14px',
              color: 'rgba(240,237,232,0.45)',
              fontWeight: 300, lineHeight: 1.65,
              marginBottom: '1.75rem',
            }}>
              No charge was made. You can start a new subscription at any time from the pricing page.
            </p>

            <Link href="/pricing" style={{
              display: 'block',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(201,169,110,0.35)',
              background: 'rgba(201,169,110,0.1)',
              color: '#C9A96E',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px', fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '0.02em',
              transition: 'all 0.2s',
            }}>
              View pricing
            </Link>
          </div>
        </div>

        <p style={{ marginTop: '1.25rem', fontSize: '12px', color: 'rgba(240,237,232,0.25)' }}>
          <Link href="/" style={{ color: 'rgba(201,169,110,0.5)', textDecoration: 'none' }}>
            ← Return to Forcapedia
          </Link>
        </p>
      </div>
    </main>
  )
}
