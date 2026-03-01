'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function EyeOpen() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeClosed() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F0EDE8',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  fontWeight: 300,
  outline: 'none',
  transition: 'border-color 0.2s, background 0.2s',
  boxSizing: 'border-box',
}

export default function UpdatePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { setError(error.message); return }

    setDone(true)
    setTimeout(() => router.replace('/'), 2800)
  }

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
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(201,169,110,0.12) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.875rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <p style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.1rem',
              fontWeight: 300,
              color: '#F0EDE8',
              letterSpacing: '0.01em',
              margin: '0 0 0.3rem',
              lineHeight: 1,
            }}>
              Forca<em style={{ fontStyle: 'italic', color: '#C9A96E' }}>pedia</em>
            </p>
          </Link>
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(240,237,232,0.25)',
          }}>
            Knowledge, explained.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(22, 20, 18, 0.97)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 48px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.025)',
        }}>
          {/* Gold hairline top */}
          <div style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(201,169,110,0.55) 50%, transparent 100%)',
          }} />

          <div style={{ padding: '2rem' }}>

            {/* ── Success state ── */}
            {done ? (
              <div style={{ textAlign: 'center', padding: '0.5rem 0', animation: 'fadeIn 0.25s ease' }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: 'rgba(111,207,151,0.08)',
                  border: '1px solid rgba(111,207,151,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6FCF97" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h1 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.8rem',
                  fontWeight: 300,
                  color: '#F0EDE8',
                  marginBottom: '0.5rem',
                }}>
                  Password updated.
                </h1>
                <p style={{
                  fontSize: '13.5px',
                  color: 'rgba(240,237,232,0.42)',
                  fontWeight: 300,
                  lineHeight: 1.55,
                }}>
                  Redirecting you to Forcapedia…
                </p>
              </div>
            ) : (
              /* ── Form state ── */
              <div style={{ animation: 'fadeIn 0.22s ease' }}>
                <h1 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.8rem',
                  fontWeight: 300,
                  color: '#F0EDE8',
                  marginBottom: '0.3rem',
                  lineHeight: 1.15,
                }}>
                  New password.
                </h1>
                <p style={{
                  fontSize: '13.5px',
                  color: 'rgba(240,237,232,0.42)',
                  marginBottom: '1.625rem',
                  fontWeight: 300,
                  lineHeight: 1.55,
                }}>
                  Choose a strong password for your Forcapedia account.
                </p>

                <form onSubmit={handleSubmit}>
                  {/* Password */}
                  <div style={{ position: 'relative', marginBottom: '0.55rem' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      autoComplete="new-password"
                      disabled={loading}
                      style={{ ...inputBase, paddingRight: '44px' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.45)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      tabIndex={-1}
                      style={{
                        position: 'absolute', right: '14px', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none',
                        color: 'rgba(240,237,232,0.28)',
                        cursor: 'pointer', padding: '4px',
                        display: 'flex', alignItems: 'center',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.6)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.28)' }}
                    >
                      {showPass ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </div>

                  {/* Confirm */}
                  <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      disabled={loading}
                      style={{ ...inputBase, paddingRight: '44px' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.45)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    />
                  </div>

                  {/* Strength hint */}
                  {password.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      marginBottom: '1rem',
                    }}>
                      {[1, 2, 3, 4].map(i => {
                        const strength = password.length < 6 ? 1 : password.length < 10 ? 2 : /[^a-zA-Z0-9]/.test(password) ? 4 : 3
                        const active = i <= strength
                        const color = strength === 1 ? '#F47C7C' : strength === 2 ? '#F7C97E' : strength === 3 ? '#6FCF97' : '#C9A96E'
                        return (
                          <div key={i} style={{
                            flex: 1, height: '3px', borderRadius: '2px',
                            background: active ? color : 'rgba(255,255,255,0.08)',
                            transition: 'background 0.3s',
                          }} />
                        )
                      })}
                    </div>
                  )}

                  {error && (
                    <p style={{
                      fontSize: '12.5px',
                      color: '#F47C7C',
                      lineHeight: 1.55,
                      padding: '9px 13px',
                      background: 'rgba(244,124,124,0.07)',
                      border: '1px solid rgba(244,124,124,0.18)',
                      borderRadius: '10px',
                      marginBottom: '0.875rem',
                    }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !password || !confirm}
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(201,169,110,0.35)',
                      background: 'rgba(201,169,110,0.1)',
                      color: '#C9A96E',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: loading || !password || !confirm ? 'default' : 'pointer',
                      letterSpacing: '0.02em',
                      transition: 'all 0.2s',
                      opacity: loading || !password || !confirm ? 0.45 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!loading && password && confirm) {
                        e.currentTarget.style.background = 'rgba(201,169,110,0.18)'
                        e.currentTarget.style.borderColor = 'rgba(201,169,110,0.5)'
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(201,169,110,0.1)'
                      e.currentTarget.style.borderColor = 'rgba(201,169,110,0.35)'
                    }}
                  >
                    {loading ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontSize: '11px',
          color: 'rgba(240,237,232,0.18)',
          marginTop: '1.375rem',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          <Link href="/terms" style={{ color: 'rgba(201,169,110,0.4)', textDecoration: 'none' }}>Terms</Link>
          {' · '}
          <Link href="/privacy" style={{ color: 'rgba(201,169,110,0.4)', textDecoration: 'none' }}>Privacy</Link>
        </p>
      </div>
    </main>
  )
}
