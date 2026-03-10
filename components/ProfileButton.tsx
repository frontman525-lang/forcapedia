'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function ProfileButton() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [imgError, setImgError] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  async function signOut() {
    setShowSignOutModal(false)
    await supabase.auth.signOut()
    setUser(null)
  }

  function requestSignOut() {
    setShowDropdown(false)
    setShowSignOutModal(true)
  }

  // ── Not logged in: user icon → opens login modal ─
  if (!user) {
    return (
      <Link
        href="/login"
        aria-label="Sign in"
        title="Sign in"
        style={{
          width: '36px', height: '36px',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
          flexShrink: 0,
          textDecoration: 'none',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--border-gold)'
          e.currentTarget.style.color = 'var(--gold)'
          e.currentTarget.style.background = 'var(--gold-dim)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.color = 'var(--text-tertiary)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </Link>
    )
  }

  // ── Logged in: avatar → dropdown ─────────────────
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const fullName = user.user_metadata?.full_name as string | undefined
  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase()

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Avatar button */}
      <button
        onClick={() => setShowDropdown(v => !v)}
        aria-label="Profile menu"
        style={{
          width: '34px', height: '34px',
          borderRadius: '50%',
          border: `2px solid ${showDropdown ? 'var(--gold)' : 'rgba(201,169,110,0.3)'}`,
          overflow: 'hidden',
          cursor: 'pointer',
          padding: 0,
          background: 'var(--avatar-bg)',
          transition: 'border-color 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {avatarUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={fullName ?? 'Profile'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--avatar-text)',
            letterSpacing: '0.02em',
          }}>
            {initials}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 0.75rem)',
          right: 0,
          minWidth: '200px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          animation: 'slideDown 0.2s ease forwards',
          zIndex: 500,
        }}>
          {/* User info */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid var(--border)',
          }}>
            <p style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {fullName ?? 'User'}
            </p>
            <p style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.email}
            </p>
          </div>

          {/* Nav links */}
          {[
            { href: '/profile', label: 'Account', icon: (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )},
            { href: '/study', label: 'Study Together', icon: (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )},
            { href: '/pricing', label: 'Pricing', icon: (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            )},
          ].map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setShowDropdown(false)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                background: 'none',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 400,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--gold-dim)'
                ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--gold)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'none'
                ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'
              }}
            >
              {icon}
              {label}
            </Link>
          ))}

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '0 1rem' }} />

          {/* Sign out */}
          <button
            onClick={requestSignOut}
            style={{
              width: '100%',
              padding: '0.65rem 1rem',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: 400,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(244,124,124,0.08)'
              e.currentTarget.style.color = '#F47C7C'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes soModalIn {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes soOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* ── Sign-out confirmation modal ─────────────────────────── */}
      {showSignOutModal && (
        <div
          onClick={() => setShowSignOutModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.60)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            animation: 'soOverlayIn 0.18s ease forwards',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '340px',
              margin: '0 1rem',
              background: 'linear-gradient(160deg, rgba(255,255,255,0.032) 0%, rgba(255,255,255,0.010) 100%), #0d0d0d',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 24px 64px rgba(0,0,0,0.7)',
              borderRadius: '20px',
              padding: '1.75rem 1.5rem 1.5rem',
              animation: 'soModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
          >
            {/* Icon */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(244,124,124,0.10)',
              border: '1px solid rgba(244,124,124,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1rem',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F47C7C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>

            <p style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.1rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: '0.4rem',
            }}>
              Sign out?
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.02em',
              lineHeight: 1.5,
              marginBottom: '1.5rem',
            }}>
              You&apos;ll need to sign in again to access your account.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {/* Cancel */}
              <button
                onClick={() => setShowSignOutModal(false)}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>

              {/* Confirm sign out */}
              <button
                onClick={signOut}
                style={{
                  flex: 1,
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(244,124,124,0.25)',
                  background: 'rgba(244,124,124,0.10)',
                  color: '#F47C7C',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(244,124,124,0.18)'
                  e.currentTarget.style.borderColor = 'rgba(244,124,124,0.45)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(244,124,124,0.10)'
                  e.currentTarget.style.borderColor = 'rgba(244,124,124,0.25)'
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
