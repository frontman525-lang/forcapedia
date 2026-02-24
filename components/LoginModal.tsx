'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LoginModalProps {
  pendingQuery: string
  onClose: () => void
}

function mapAuthError(message: string, mode: 'signin' | 'signup') {
  const m = message.toLowerCase()

  if (m.includes('email rate limit exceeded') || m.includes('rate limit')) {
    return mode === 'signup'
      ? 'Signup email limit hit. For direct signup, disable "Confirm email" in Supabase Auth settings, then try again.'
      : 'Too many attempts. Please wait a minute and try again.'
  }

  if (m.includes('already registered') || m.includes('user already registered')) {
    return 'Account already exists. Switch to Sign in.'
  }

  if (m.includes('invalid login credentials')) {
    return 'Invalid email or password.'
  }

  if (m.includes('email not confirmed')) {
    return 'Email confirmation is required for this project. Confirm your email or disable confirmation in Supabase.'
  }

  return message
}

export default function LoginModal({ pendingQuery, onClose }: LoginModalProps) {
  const supabase = createClient()
  const [mounted, setMounted] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  // Portal needs client mount
  useEffect(() => { setMounted(true) }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleGoogleLogin() {
    if (pendingQuery) sessionStorage.setItem('forcapedia_pending_search', pendingQuery)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = email.trim().toLowerCase()
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)

    if (!isEmail) {
      setEmailError('Enter a valid email address.')
      setEmailStatus(null)
      return
    }

    if (!password) {
      setEmailError('Enter your password.')
      setEmailStatus(null)
      return
    }

    if (authMode === 'signup' && password.length < 6) {
      setEmailError('Password must be at least 6 characters.')
      setEmailStatus(null)
      return
    }

    if (pendingQuery && authMode === 'signin') {
      sessionStorage.setItem('forcapedia_pending_search', pendingQuery)
    }

    setEmailLoading(true)
    setEmailError(null)
    setEmailStatus(null)

    if (authMode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleaned,
        password,
      })

      if (error) {
        setEmailError(mapAuthError(error.message || 'Failed to sign in.', 'signin'))
        setEmailLoading(false)
        return
      }

      setEmailLoading(false)
      onClose()
      if (pendingQuery) window.location.reload()
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleaned,
      password,
    })

    if (error) {
      const mapped = mapAuthError(error.message || 'Failed to create account.', 'signup')
      setEmailError(mapped)
      if (mapped.includes('Switch to Sign in')) {
        setAuthMode('signin')
      }
      setEmailLoading(false)
      return
    }

    setEmailLoading(false)
    if (data.session) {
      setEmailStatus('Account created. You are now signed in.')
      onClose()
      return
    }

    setEmailStatus('Signup created but email confirmation is enabled. Disable "Confirm email" in Supabase for direct signup.')
  }

  if (!mounted) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,10,0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 9000,
          animation: 'fadeIn 0.2s ease forwards',
        }}
      />

      {/* Modal — always viewport-centered via portal, no parent transform issues */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to Forcapedia"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9001,
          padding: '1rem',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'all',
            width: '100%',
            maxWidth: '400px',
            background: 'var(--surface)',
            border: '1px solid var(--border-gold)',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            position: 'relative',
          }}
        >
          {/* Subtle gold glow top */}
          <div style={{
            position: 'absolute',
            top: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: '160px', height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--gold), transparent)',
            borderRadius: '0 0 100px 100px',
          }} />

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'rgba(255,255,255,0.06)',
              border: 'none', borderRadius: '50%',
              width: '28px', height: '28px',
              color: 'var(--text-tertiary)',
              cursor: 'pointer', fontSize: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          >
            ✕
          </button>

          {/* Logo */}
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--gold)',
            letterSpacing: '0.04em',
            marginBottom: '1.25rem',
          }}>
            Forcapedia
          </p>

          {/* Heading */}
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.65rem',
            fontWeight: 300,
            lineHeight: 1.2,
            marginBottom: '0.5rem',
            color: 'var(--text-primary)',
          }}>
            {authMode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>

          <p style={{
            fontSize: '13.5px',
            color: 'var(--text-secondary)',
            fontWeight: 300,
            lineHeight: 1.55,
            marginBottom: '1.5rem',
          }}>
            {authMode === 'signin'
              ? 'Sign in with email + password or Google.'
              : 'Sign up with email + password, then start searching.'}
          </p>

          {/* Pending query pill */}
          {pendingQuery && (
            <div style={{
              marginBottom: '1.25rem',
              padding: '0.5rem 0.875rem',
              background: 'var(--gold-dim)',
              border: '1px solid var(--border-gold)',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--gold)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pendingQuery}
              </span>
            </div>
          )}

          {/* Email login */}
          <form onSubmit={handleEmailAuth} style={{ marginBottom: '0.9rem' }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.currentTarget.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={emailLoading}
              style={{
                width: '100%',
                padding: '0.72rem 0.9rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 300,
                marginBottom: '0.65rem',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-gold)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.currentTarget.value)}
              placeholder={authMode === 'signin' ? 'Password' : 'Create password (min 6 chars)'}
              autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
              disabled={emailLoading}
              style={{
                width: '100%',
                padding: '0.72rem 0.9rem',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 300,
                marginBottom: '0.65rem',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-gold)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            <button
              type="submit"
              disabled={emailLoading || !email.trim() || !password}
              style={{
                width: '100%',
                padding: '0.74rem 1rem',
                borderRadius: '10px',
                border: '1px solid var(--border-gold)',
                background: emailLoading || !email.trim() || !password ? 'rgba(255,255,255,0.04)' : 'var(--gold-dim)',
                color: emailLoading || !email.trim() || !password ? 'var(--text-tertiary)' : 'var(--gold)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: emailLoading || !email.trim() || !password ? 'default' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {emailLoading
                ? (authMode === 'signin' ? 'Signing in...' : 'Creating account...')
                : (authMode === 'signin' ? 'Sign in with Email' : 'Sign up with Email')}
            </button>
          </form>

          {emailError && (
            <p style={{
              fontSize: '12px',
              color: 'var(--red)',
              marginBottom: '0.75rem',
              lineHeight: 1.5,
            }}>
              {emailError}
            </p>
          )}

          {emailStatus && (
            <p style={{
              fontSize: '12px',
              color: 'var(--green)',
              marginBottom: '0.75rem',
              lineHeight: 1.5,
            }}>
              {emailStatus}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'signin' ? 'signup' : 'signin')
              setEmailError(null)
              setEmailStatus(null)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--gold)',
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              cursor: 'pointer',
              marginBottom: '1rem',
              textDecoration: 'underline',
            }}
          >
            {authMode === 'signin' ? 'New user? Create account' : 'Already have an account? Sign in'}
          </button>

          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            marginBottom: '0.75rem',
          }}>
            or continue with
          </p>

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.625rem',
              padding: '0.8rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--ink-3)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--ink-2)'
              e.currentTarget.style.borderColor = 'var(--border-gold)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--ink-3)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <svg width="17" height="17" viewBox="0 0 48 48" fill="none">
              <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
              <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2c-7.7 0-14.4 4.4-17.7 10.7z" fill="#FF3D00"/>
              <path d="M24 46c5.5 0 10.5-2 14.3-5.4l-6.6-5.6C29.7 36.8 27 38 24 38c-6 0-11.1-4-13-9.5L4 34.1C7.3 41.4 15 46 24 46z" fill="#4CAF50"/>
              <path d="M44.5 20H24v8.5h11.8c-.9 2.9-2.8 5.4-5.3 7.1l6.6 5.6C41.1 38 45 32 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
