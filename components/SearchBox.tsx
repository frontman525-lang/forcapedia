'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Placeholder pools ──────────────────────────────────────────────────────────
const GUEST_PLACEHOLDERS = [
  "What's confusing you today?",
  "What do you want to learn?",
  "Search anything…",
  "What are you curious about?",
  "What's on your mind?",
]

function getPersonalisedPlaceholders(name: string) {
  return [
    `What's on your mind, ${name}?`,
    `Continue learning, ${name}…`,
    `What are you curious about, ${name}?`,
    `Search anything, ${name}…`,
  ]
}

export default function SearchBox() {
  const router   = useRouter()
  const supabase = createClient()

  const [query, setQuery]   = useState('')
  const [focused, setFocused] = useState(false)

  // ── Personalisation ────────────────────────────────────────────────────────
  const [displayName, setDisplayName]       = useState<string | null>(null)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [loadingUser, setLoadingUser]       = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta     = data.user?.user_metadata
      const nickname = meta?.nickname as string | undefined
      setDisplayName(nickname ?? null)
      setLoadingUser(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const pool = displayName ? getPersonalisedPlaceholders(displayName) : GUEST_PLACEHOLDERS
    setPlaceholderIdx(Math.floor(Math.random() * pool.length))
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % pool.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [displayName])

  // ── Smooth navigation with black-overlay fade ──────────────────────────────
  // Creates a temporary full-screen overlay, fades it in, navigates, then removes it.
  // The search page's own fadeIn animations handle the "enter" side.
  const navigating = useRef(false)
  function navigateWithFade(url: string) {
    if (navigating.current) return
    navigating.current = true

    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position:        'fixed',
      inset:           '0',
      zIndex:          '99999',
      background:      '#000',
      opacity:         '0',
      transition:      'opacity 0.22s ease',
      pointerEvents:   'none',
    })
    document.body.appendChild(overlay)

    // Force reflow so transition fires
    overlay.getBoundingClientRect()
    overlay.style.opacity = '0.85'

    setTimeout(() => {
      router.push(url)
      // Remove overlay after next page's fade-in has started
      setTimeout(() => {
        overlay.style.opacity = '0'
        setTimeout(() => overlay.remove(), 250)
        navigating.current = false
      }, 120)
    }, 220)
  }

  // ── Topic carousel events → search page ───────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const title = (e as CustomEvent<string>).detail
      if (!title) return
      navigateWithFade(`/search?q=${encodeURIComponent(title.trim())}`)
    }
    window.addEventListener('forcapedia:topic', handler)
    return () => window.removeEventListener('forcapedia:topic', handler)
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    navigateWithFade(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const pool               = displayName ? getPersonalisedPlaceholders(displayName) : GUEST_PLACEHOLDERS
  const currentPlaceholder = pool[placeholderIdx % pool.length]
  const isActive           = query.trim().length > 0

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        position: 'relative',
        borderRadius: '14px',
        border: `1px solid ${focused ? 'rgba(201,169,110,0.45)' : 'var(--search-border)'}`,
        background: 'var(--surface)',
        boxShadow: focused ? 'var(--shadow-focus)' : 'var(--shadow-sm)',
        transition: 'all 0.25s',
        display: 'flex',
        alignItems: 'center',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>

        {/* Search icon */}
        <div style={{
          padding: '0 0.875rem 0 1.25rem',
          color: focused ? 'var(--gold)' : 'var(--text-tertiary)',
          transition: 'color 0.25s',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={currentPlaceholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          className={loadingUser && !query ? 'sb-ph-loading' : ''}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            padding: '1rem 0', fontSize: '15px',
            color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
            fontWeight: 300, caretColor: 'var(--gold)', minWidth: 0,
          }}
        />

        {/* Placeholder shimmer bar — visible while user session resolves */}
        {loadingUser && !query && !focused && (
          <div style={{
            position: 'absolute',
            left: '3.1rem',
            top: '50%', transform: 'translateY(-50%)',
            height: '9px',
            width: 'clamp(110px, 32%, 190px)',
            borderRadius: '5px',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.05) 100%)',
            backgroundSize: '200% 100%',
            animation: 'phShimmer 1.5s linear infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!isActive}
          aria-label="Search"
          style={{
            margin: '0.375rem', width: '36px', height: '36px', borderRadius: '10px',
            border: 'none',
            background: isActive ? 'var(--gold)' : 'var(--ink-3)',
            color:      isActive ? 'var(--ink)' : 'var(--text-tertiary)',
            cursor:     isActive ? 'pointer'    : 'default',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>

      <style>{`
        input::placeholder { color: var(--text-tertiary); }
        .sb-ph-loading::placeholder { color: transparent; }
        @keyframes phShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </form>
  )
}
