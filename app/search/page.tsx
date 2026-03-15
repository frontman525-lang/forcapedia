'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { useAlert } from '@/components/Alert'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface WikiResult { pageid: number; title: string; snippet: string }
interface HistoryItem { article_slug: string; article_title: string; article_category: string }

function stripHtml(h: string) { return h.replace(/<[^>]*>/g, '') }

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <p style={{
      fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.16em',
      textTransform: 'uppercase', color: 'var(--text-tertiary)',
      marginBottom: '0.6rem', paddingLeft: '1px', userSelect: 'none',
    }}>
      <span style={{ marginRight: '0.35em' }}>{icon}</span>{label}
    </p>
  )
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  const base: React.CSSProperties = {
    flexShrink: 0, display: 'inline-flex', alignItems: 'center',
    padding: '5px 14px', background: 'var(--btn-bg)',
    border: '1px solid var(--border)', borderRadius: '100px',
    textDecoration: 'none', color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em',
    whiteSpace: 'nowrap', maxWidth: '220px',
    overflow: 'hidden', textOverflow: 'ellipsis',
    cursor: 'pointer', transition: 'border-color 0.18s, color 0.18s, background 0.18s',
  }
  const onE = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'var(--border-gold)'
    e.currentTarget.style.color       = 'var(--gold)'
    e.currentTarget.style.background  = 'var(--gold-dim)'
  }
  const onL = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'var(--border)'
    e.currentTarget.style.color       = 'var(--text-secondary)'
    e.currentTarget.style.background  = 'var(--btn-bg)'
  }
  if (href) return <a href={href} style={base} onMouseEnter={onE} onMouseLeave={onL}>{label}</a>
  return (
    <button style={{ ...base, border: '1px solid var(--border)' }} onClick={onClick} onMouseEnter={onE} onMouseLeave={onL}>
      {label}
    </button>
  )
}

// ─── Result card ──────────────────────────────────────────────────────────────
function ResultCard({
  r, i, navigating, onClick,
}: { r: WikiResult; i: number; navigating: number | null; onClick: () => void }) {
  const isNav  = navigating === i
  const dimmed = navigating !== null && !isNav
  return (
    <div style={{
      opacity: 0,
      // Stagger each card: first few snappy, later ones capped at 200ms delay
      animation: `fadeIn 0.32s ${Math.min(i * 38, 200)}ms ease forwards`,
    }}>
      <button
        onClick={onClick}
        disabled={navigating !== null}
        style={{
          width: '100%', textAlign: 'left', borderRadius: '14px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
          padding: 'clamp(0.8rem, 2vw, 1rem) clamp(1rem, 2.5vw, 1.25rem)',
          cursor: navigating !== null ? 'default' : 'pointer',
          transition: 'transform 0.18s ease, border-color 0.18s, background 0.18s, box-shadow 0.18s',
          opacity: dimmed ? 0.28 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}
        onMouseEnter={e => {
          if (navigating !== null) return
          const el = e.currentTarget
          el.style.transform   = 'translateX(3px)'
          el.style.borderColor = 'var(--border-gold)'
          el.style.background  = 'var(--gold-dim)'
          el.style.boxShadow   = 'var(--shadow-md)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget
          el.style.transform   = 'translateX(0)'
          el.style.borderColor = 'var(--border)'
          el.style.background  = 'var(--surface)'
          el.style.boxShadow   = 'var(--shadow-sm)'
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 'clamp(13px, 2vw, 14px)', fontWeight: 400,
            color: isNav ? 'var(--gold)' : 'var(--text-primary)',
            marginBottom: '0.25rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.15s', letterSpacing: '0.01em',
          }}>{r.title}</p>
          <p style={{
            fontSize: 'clamp(11px, 1.8vw, 12px)', fontWeight: 300,
            color: 'var(--text-tertiary)', lineHeight: 1.55,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{stripHtml(r.snippet)}</p>
        </div>
        {isNav ? (
          <span style={{
            width: '16px', height: '16px', flexShrink: 0, display: 'block',
            border: '2px solid var(--border)', borderTopColor: 'var(--gold)',
            borderRadius: '50%', animation: 'searchSpin 0.7s linear infinite',
          }} />
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
            <line x1="7" y1="17" x2="17" y2="7"/>
            <polyline points="7 7 17 7 17 17"/>
          </svg>
        )}
      </button>
    </div>
  )
}

// ─── Main content ─────────────────────────────────────────────────────────────
function SearchContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { showAlert } = useAlert()
  const supabase = useRef(createClient()).current

  const q = searchParams.get('q') ?? ''
  const open = searchParams.get('open') ?? ''

  const [inputValue, setInputValue] = useState(q)
  const [results, setResults]       = useState<WikiResult[]>([])
  const [sroffset, setSroffset]     = useState<number | null>(null)

  // Two-layer loading state:
  // loadingResults — true while fetching (controls skeleton visibility)
  // resultsReady   — flips to true after minimum skeleton display, triggers card fade-in
  const [loadingResults, setLoading]   = useState(false)
  const [resultsReady, setReady]       = useState(false)
  const [loadingMore, setLoadingMore]  = useState(false)
  const [navigating, setNavigating]    = useState<number | null>(null)
  const [historyPills, setHistory]     = useState<HistoryItem[]>([])
  const [trending, setTrending]        = useState<string[]>([])

  const fetchStartRef = useRef<number>(0)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef      = useRef<HTMLInputElement>(null)
  const resumeAttemptedRef = useRef(false)

  // Reading history
  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(d => {
        const all: HistoryItem[] = d.items ?? []
        if (!all.length) return
        const last    = all[0]
        const related = all.slice(1).find(i => i.article_category === last.article_category) ?? all[1] ?? null
        setHistory(related ? [last, related] : [last])
      })
      .catch(() => {})
  }, [])

  // Real trending (server-side proxy — no CORS, no garbage)
  useEffect(() => {
    fetch('/api/trending')
      .then(r => r.json())
      .then(d => { if (d.topics?.length) setTrending(d.topics) })
      .catch(() => {})
  }, [])

  // ── Core fetch function ────────────────────────────────────────────────────
  const fetchWiki = useCallback(async (search: string, offset = 0) => {
    if (!search.trim()) { setResults([]); setSroffset(null); return }

    if (offset === 0) {
      setLoading(true)
      setReady(false)
      setResults([])             // clear immediately so skeleton shows clean
      fetchStartRef.current = Date.now()
    } else {
      setLoadingMore(true)
    }

    try {
      const url =
        `https://en.wikipedia.org/w/api.php?action=query&list=search` +
        `&srsearch=${encodeURIComponent(search.trim())}&srlimit=50&sroffset=${offset}` +
        `&format=json&origin=*`
      const res  = await fetch(url)
      const data = await res.json()
      const batch: WikiResult[] = data?.query?.search ?? []
      const next: number | null  = data?.continue?.sroffset ?? null

      if (offset === 0) {
        // ── Minimum skeleton display: 500 ms ──────────────────────────────
        const elapsed   = Date.now() - fetchStartRef.current
        const holdMs    = Math.max(0, 500 - elapsed)
        setTimeout(() => {
          setResults(batch)
          setSroffset(next)
          setLoading(false)
          // Small second tick so cards mount before opacity animation fires
          requestAnimationFrame(() => setReady(true))
        }, holdMs)
      } else {
        setResults(prev => [...prev, ...batch])
        setSroffset(next)
        setLoadingMore(false)
      }
    } catch {
      if (offset === 0) { setResults([]); setLoading(false); setReady(true) }
      else              { setLoadingMore(false) }
    }
  }, [])

  // Sync URL param → input + fetch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(q)
    if (q) fetchWiki(q)
    else   { setResults([]); setReady(false) }
  }, [q, fetchWiki])

  // ── Live search: debounced 300ms as user types ────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)

    // Clear any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = val.trim()
    if (!trimmed) { setResults([]); setReady(false); return }

    // Don't re-fetch if it matches the current URL query (already done)
    if (trimmed === q) return

    debounceRef.current = setTimeout(() => {
      fetchWiki(trimmed)
    }, 300)
  }

  const loginRedirectUrlForTitle = useCallback((title: string) => {
    const searchValue = (inputValue.trim() || q).trim()
    const nextPath = searchValue
      ? `/search?q=${encodeURIComponent(searchValue)}&open=${encodeURIComponent(title)}`
      : `/search?open=${encodeURIComponent(title)}`
    return `/login?next=${encodeURIComponent(nextPath)}`
  }, [inputValue, q])

  const openResult = useCallback(async (title: string, idx: number) => {
    setNavigating(idx)

    // Auth check
    let user: { id: string } | null = null
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
    } catch {
      user = null
    }

    if (!user) {
      setNavigating(null)
      router.push(loginRedirectUrlForTitle(title))
      return
    }

    // Fetch article — up to 3 attempts (1 initial + 2 retries on 5xx/network errors)
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise<void>(r => setTimeout(r, 800))

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: title }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.streaming) {
            // Store topic so ArticleGenerator can read it — keeps the URL clean
            try { sessionStorage.setItem(`pending:${data.slug}`, data.topic) } catch { /* private mode */ }
          }
          // Always navigate to the clean article URL — no ?topic= query params
          router.push(`/article/${data.slug}`)
          return
        }

        if (res.status === 401) {
          setNavigating(null)
          router.push(loginRedirectUrlForTitle(title))
          return
        }

        // 4xx client error — don't retry
        if (res.status < 500) {
          const err = await res.json().catch(() => ({}))
          showAlert(err.error ?? 'Failed to load article.', 'error')
          setNavigating(null)
          return
        }

        // 5xx server error — retry unless last attempt
        if (attempt === 2) {
          showAlert('Failed to load article. Please try again.', 'error')
          setNavigating(null)
          return
        }
      } catch {
        // Network error — retry unless last attempt
        if (attempt === 2) {
          showAlert('Failed to load article. Check your connection.', 'error')
          setNavigating(null)
          return
        }
      }
    }
  }, [loginRedirectUrlForTitle, router, showAlert, supabase.auth])

  function handleResultClick(title: string, idx: number) {
    void openResult(title, idx)
  }

  // After login, resume the exact result click user attempted via ?open=
  useEffect(() => {
    if (!open || resumeAttemptedRef.current) return
    resumeAttemptedRef.current = true

    const currentSearch = (q || inputValue).trim()
    const cleanUrl = currentSearch
      ? `/search?q=${encodeURIComponent(currentSearch)}`
      : '/search'
    window.history.replaceState(null, '', cleanUrl)

    const timer = setTimeout(() => {
      void openResult(open, -1)
    }, 0)
    return () => clearTimeout(timer)
  }, [open, q, inputValue, openResult])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const t = inputValue.trim()
    if (t) router.push(`/search?q=${encodeURIComponent(t)}`)
  }

  const hasResults = resultsReady && results.length > 0

  return (
    <>
      <div style={{
        width: '100%', maxWidth: '700px', margin: '0 auto',
        padding: 'clamp(1.5rem, 5vw, 2.5rem) clamp(1rem, 4vw, 1.75rem) 0',
      }}>

        {/* ── Hero (idle only) ────────────────────────────────────────────── */}
        {!q && !inputValue && (
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(2.2rem, 7vw, 4rem)',
            fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.02em',
            color: 'var(--text-primary)', marginBottom: 'clamp(1.25rem, 3vw, 2rem)',
            opacity: 0, animation: 'fadeIn 0.35s ease forwards',
          }}>
            Search <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>anything.</em>
          </h1>
        )}

        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ opacity: 0, animation: 'fadeIn 0.35s 0.04s ease forwards' }}>
          <div style={{
            display: 'flex', alignItems: 'center', borderRadius: '14px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-sm)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
          }}>
            <div style={{ padding: '0 0.9rem 0 1.25rem', color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <input
              ref={inputRef} type="text" value={inputValue}
              onChange={handleInputChange}
              placeholder="Search anything…"
              autoComplete="off" autoCorrect="off" spellCheck={false}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                padding: 'clamp(0.85rem, 2vw, 1rem) 0',
                fontSize: 'clamp(14px, 2vw, 15px)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)', fontWeight: 300,
                caretColor: 'var(--gold)', minWidth: 0,
              }}
            />
            <button
              type="submit" disabled={!inputValue.trim()}
              style={{
                margin: '0.375rem', width: '36px', height: '36px', borderRadius: '10px',
                border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: inputValue.trim() ? 'var(--gold)' : 'var(--ink-3)',
                color:      inputValue.trim() ? 'var(--ink)'  : 'var(--text-tertiary)',
                cursor:     inputValue.trim() ? 'pointer'  : 'default',
                transition: 'all 0.2s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </form>

        {/* ── Continue Learning ─────────────────────────────────────────────── */}
        {historyPills.length > 0 && (
          <div style={{ marginTop: 'clamp(1.1rem, 3vw, 1.5rem)', opacity: 0, animation: 'fadeIn 0.35s 0.10s ease forwards' }}>
            <SectionLabel icon="↩" label="Continue learning" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {historyPills.map(i => (
                <Pill key={i.article_slug} label={i.article_title} href={`/article/${i.article_slug}`} />
              ))}
            </div>
          </div>
        )}

        {/* ── Trending Today ─────────────────────────────────────────────────── */}
        {trending.length > 0 && (
          <div style={{ marginTop: 'clamp(0.9rem, 2.5vw, 1.25rem)', opacity: 0, animation: 'fadeIn 0.35s 0.18s ease forwards' }}>
            <SectionLabel icon="↱" label="Trending today" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {trending.map(t => (
                <Pill key={t} label={t} onClick={() => router.push(`/search?q=${encodeURIComponent(t)}`)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Thin divider when search is active ──────────────────────────── */}
        {(loadingResults || hasResults || (!loadingResults && !!inputValue.trim() && results.length === 0 && resultsReady)) && (
          <div style={{ marginTop: 'clamp(1.25rem, 4vw, 2rem)', borderTop: '1px solid var(--border)', marginBottom: '3px' }} />
        )}

        {/* ── Skeleton — guaranteed ≥ 500ms visibility ────────────────────── */}
        {loadingResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{
                height: '76px', borderRadius: '14px',
                background: 'linear-gradient(90deg, var(--surface) 0%, var(--ink-3) 50%, var(--surface) 100%)',
                backgroundSize: '200% 100%',
                border: '1px solid var(--border)',
                opacity: 1 - i * 0.08,
                animation: 'shimmer 1.8s linear infinite',
                animationDelay: `${i * 100}ms`,
              }} />
            ))}
          </div>
        )}

        {/* ── Results — staggered fade-in after skeleton lifts ──────────────── */}
        {hasResults && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {results.map((r, i) => (
                <ResultCard
                  key={r.pageid} r={r} i={i}
                  navigating={navigating}
                  onClick={() => handleResultClick(r.title, i)}
                />
              ))}
            </div>

            {sroffset !== null && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button
                  onClick={() => fetchWiki(inputValue.trim() || q, sroffset)}
                  disabled={loadingMore}
                  style={{
                    padding: '0.6rem 2rem',
                    background: 'var(--btn-bg)',
                    border: '1px solid var(--border)', borderRadius: '100px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)', fontSize: '11px',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: loadingMore ? 'default' : 'pointer', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Empty state ────────────────────────────────────────────────────── */}
        {resultsReady && !loadingResults && inputValue.trim() && results.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '3.5rem 1rem',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            opacity: 0, animation: 'fadeIn 0.35s ease forwards',
          }}>
            <p style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(1rem, 3vw, 1.25rem)',
              fontWeight: 300, color: 'var(--text-primary)', marginBottom: '0.5rem',
            }}>
              No topics found for &ldquo;{inputValue.trim()}&rdquo;
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 300 }}>
              Try different keywords or a broader term.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes searchSpin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        input::placeholder { color: var(--text-tertiary); }

        /* ── Static starfield background (no animated canvas) ─── */
        .sp-bg {
          position: fixed; inset: 0; z-index: 0;
          background: #000; overflow: hidden;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          will-change: transform;
        }
        .sp-bg::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            radial-gradient(1px   1px   at  6%  6%,  rgba(255,255,255,0.75) 0%, transparent 100%),
            radial-gradient(1px   1px   at 18% 12%,  rgba(255,255,255,0.45) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 31%  4%,  rgba(255,255,255,0.65) 0%, transparent 100%),
            radial-gradient(1px   1px   at 44% 19%,  rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px   1px   at 57%  8%,  rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 70%  3%,  rgba(255,255,255,0.85) 0%, transparent 100%),
            radial-gradient(1px   1px   at 82% 15%,  rgba(255,255,255,0.45) 0%, transparent 100%),
            radial-gradient(1px   1px   at 93% 22%,  rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1px   1px   at  3% 28%,  rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px   1px   at 12% 38%,  rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 25% 32%,  rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1px   1px   at 38% 44%,  rgba(255,255,255,0.32) 0%, transparent 100%),
            radial-gradient(1px   1px   at 52% 36%,  rgba(255,255,255,0.42) 0%, transparent 100%),
            radial-gradient(1px   1px   at 65% 28%,  rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 77% 40%,  rgba(255,255,255,0.60) 0%, transparent 100%),
            radial-gradient(1px   1px   at 88% 33%,  rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px   1px   at  8% 55%,  rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px   1px   at 48% 70%,  rgba(255,255,255,0.22) 0%, transparent 100%),
            radial-gradient(1px   1px   at 91% 62%,  rgba(255,255,255,0.22) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 35% 80%,  rgba(255,255,255,0.32) 0%, transparent 100%),
            radial-gradient(1px   1px   at 72% 75%,  rgba(255,255,255,0.20) 0%, transparent 100%),
            radial-gradient(1px   1px   at 15% 65%,  rgba(255,255,255,0.20) 0%, transparent 100%),
            radial-gradient(1px   1px   at 58% 88%,  rgba(255,255,255,0.18) 0%, transparent 100%);
        }
        html.light .sp-bg {
          background: #F7F5F0;
        }
        html.light .sp-bg::before {
          display: none;
        }
      `}</style>
    </>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────
export default function SearchPage() {
  return (
    <>
      <div className="sp-bg" />
      <Nav />
      <main style={{
        minHeight: 'var(--app-h)',
        paddingTop: 'clamp(72px, 10vw, 90px)',
        paddingBottom: '6rem',
        position: 'relative',
        zIndex: 10,
        width: '100%',
      }}>
        <Suspense fallback={
          <div style={{
            maxWidth: '700px', margin: '0 auto',
            padding: 'clamp(1.5rem, 5vw, 2.5rem) clamp(1rem, 4vw, 1.75rem)',
            textAlign: 'center', fontFamily: 'var(--font-mono)',
            fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}>
            Loading…
          </div>
        }>
          <SearchContent />
        </Suspense>
      </main>
    </>
  )
}
