'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAlert } from './Alert'
import LoginModal from './LoginModal'

export default function SearchBox() {
  const router = useRouter()
  const { showAlert } = useAlert()
  const supabase = createClient()

  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [searching, setSearching] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    const pending = sessionStorage.getItem('forcapedia_pending_search')
    if (!pending) return
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        sessionStorage.removeItem('forcapedia_pending_search')
        setQuery(pending)
        setTimeout(() => executeSearch(pending, true), 300)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const executeSearch = useCallback(async (q: string, skipAuthCheck = false) => {
    const trimmed = q.trim()
    if (!trimmed) return

    if (!skipAuthCheck) {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { setShowLogin(true); return }
    }

    setSearching(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showAlert(err.error ?? 'Search failed. Please try again.', 'error')
        setSearching(false)
        return
      }
      const { slug } = await res.json()
      router.push(`/article/${slug}`)
    } catch {
      showAlert('Search failed. Please check your connection.', 'error')
      setSearching(false)
    }
  }, [supabase, router, showAlert])

  // Listen for topic clicks from the carousel
  useEffect(() => {
    const handler = (e: Event) => {
      const title = (e as CustomEvent<string>).detail
      if (!title) return
      setQuery(title)
      inputRef.current?.focus()
      setTimeout(() => executeSearch(title), 50)
    }
    window.addEventListener('forcapedia:topic', handler)
    return () => window.removeEventListener('forcapedia:topic', handler)
  }, [executeSearch])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    executeSearch(query)
  }

  const isActive = query.trim().length > 0 && !searching

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div style={{
          position: 'relative',
          borderRadius: '14px',
          // ── All background/border/shadow now use CSS variables ──
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
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search anything…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            disabled={searching}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              padding: '1rem 0',
              fontSize: '15px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 300,
              caretColor: 'var(--gold)',
              minWidth: 0,
            }}
          />

          {/* Submit button */}
          <button
            type="submit"
            disabled={!isActive}
            aria-label="Search"
            style={{
              margin: '0.375rem',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: 'none',
              // ── Uses CSS vars so light/dark both correct ──
              background: isActive ? 'var(--gold)' : 'var(--ink-3)',
              color: isActive ? 'var(--ink)' : 'var(--text-tertiary)',
              cursor: isActive ? 'pointer' : 'default',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {searching ? (
              <span style={{
                width: '14px',
                height: '14px',
                border: '2px solid var(--border)',
                borderTopColor: isActive ? 'var(--ink)' : 'var(--gold)',
                borderRadius: '50%',
                display: 'block',
                animation: 'searchSpin 0.7s linear infinite',
              }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            )}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes searchSpin { to { transform: rotate(360deg); } }
        input::placeholder { color: var(--text-tertiary); }
      `}</style>

      {showLogin && (
        <LoginModal pendingQuery={query} onClose={() => setShowLogin(false)} />
      )}
    </>
  )
}
