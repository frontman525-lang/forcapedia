'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { useAlert } from '@/components/Alert'
import LoginModal from '@/components/LoginModal'
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
    padding: '5px 14px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)', borderRadius: '100px',
    textDecoration: 'none', color: 'rgba(240,237,232,0.55)',
    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em',
    whiteSpace: 'nowrap', maxWidth: '220px',
    overflow: 'hidden', textOverflow: 'ellipsis',
    cursor: 'pointer', transition: 'border-color 0.18s, color 0.18s, background 0.18s',
  }
  const onE = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'rgba(201,169,110,0.45)'
    e.currentTarget.style.color       = '#C9A96E'
    e.currentTarget.style.background  = 'rgba(201,169,110,0.08)'
  }
  const onL = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
    e.currentTarget.style.color       = 'rgba(240,237,232,0.55)'
    e.currentTarget.style.background  = 'rgba(255,255,255,0.05)'
  }
  if (href) return <a href={href} style={base} onMouseEnter={onE} onMouseLeave={onL}>{label}</a>
  return (
    <button style={{ ...base, border: '1px solid rgba(255,255,255,0.10)' }} onClick={onClick} onMouseEnter={onE} onMouseLeave={onL}>
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
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.30)',
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
          el.style.borderColor = 'rgba(201,169,110,0.28)'
          el.style.background  = 'linear-gradient(135deg, rgba(201,169,110,0.10) 0%, rgba(201,169,110,0.04) 60%, rgba(255,255,255,0.02) 100%)'
          el.style.boxShadow   = '0 8px 32px rgba(0,0,0,0.40), 0 0 18px rgba(201,169,110,0.06)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget
          el.style.transform   = 'translateX(0)'
          el.style.borderColor = 'rgba(255,255,255,0.09)'
          el.style.background  = 'rgba(255,255,255,0.05)'
          el.style.boxShadow   = '0 4px 20px rgba(0,0,0,0.30)'
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 'clamp(13px, 2vw, 14px)', fontWeight: 400,
            color: isNav ? '#C9A96E' : '#F0EDE8',
            marginBottom: '0.25rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.15s', letterSpacing: '0.01em',
          }}>{r.title}</p>
          <p style={{
            fontSize: 'clamp(11px, 1.8vw, 12px)', fontWeight: 300,
            color: 'rgba(240,237,232,0.38)', lineHeight: 1.55,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{stripHtml(r.snippet)}</p>
        </div>
        {isNav ? (
          <span style={{
            width: '16px', height: '16px', flexShrink: 0, display: 'block',
            border: '2px solid rgba(255,255,255,0.12)', borderTopColor: '#C9A96E',
            borderRadius: '50%', animation: 'searchSpin 0.7s linear infinite',
          }} />
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'rgba(240,237,232,0.22)', flexShrink: 0 }}>
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
  const supabase     = createClient()

  const q = searchParams.get('q') ?? ''

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
  const [showLogin, setShowLogin]      = useState(false)
  const [historyPills, setHistory]     = useState<HistoryItem[]>([])
  const [trending, setTrending]        = useState<string[]>([])

  const fetchStartRef = useRef<number>(0)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef      = useRef<HTMLInputElement>(null)

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

  async function handleResultClick(title: string, idx: number) {
    setNavigating(idx)
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) { setShowLogin(true); setNavigating(null); return }
      const res = await fetch('/api/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: title }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 401) { setShowLogin(true); setNavigating(null); return }
        showAlert(err.error ?? 'Failed to load article.', 'error')
        setNavigating(null); return
      }
      const { slug } = await res.json()
      router.push(`/article/${slug}`)
    } catch {
      showAlert('Failed to load article. Check your connection.', 'error')
      setNavigating(null)
    }
  }

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
            color: '#F0EDE8', marginBottom: 'clamp(1.25rem, 3vw, 2rem)',
            opacity: 0, animation: 'fadeIn 0.35s ease forwards',
          }}>
            Search <em style={{ fontStyle: 'italic', color: '#C9A96E' }}>anything.</em>
          </h1>
        )}

        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} style={{ opacity: 0, animation: 'fadeIn 0.35s 0.04s ease forwards' }}>
          <div style={{
            display: 'flex', alignItems: 'center', borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 4px 32px rgba(0,0,0,0.50)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
          }}>
            <div style={{ padding: '0 0.9rem 0 1.25rem', color: 'rgba(240,237,232,0.35)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
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
                fontSize: 'clamp(14px, 2vw, 15px)', color: '#F0EDE8',
                fontFamily: 'var(--font-sans)', fontWeight: 300,
                caretColor: '#C9A96E', minWidth: 0,
              }}
            />
            <button
              type="submit" disabled={!inputValue.trim()}
              style={{
                margin: '0.375rem', width: '36px', height: '36px', borderRadius: '10px',
                border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: inputValue.trim() ? '#C9A96E' : 'rgba(255,255,255,0.06)',
                color:      inputValue.trim() ? '#0D0B08'  : 'rgba(240,237,232,0.30)',
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
          <div style={{ marginTop: 'clamp(1.25rem, 4vw, 2rem)', borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: '3px' }} />
        )}

        {/* ── Skeleton — guaranteed ≥ 500ms visibility ────────────────────── */}
        {loadingResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{
                height: '76px', borderRadius: '14px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.07) 100%)',
                backgroundSize: '200% 100%',
                border: '1px solid rgba(255,255,255,0.10)',
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
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)', borderRadius: '100px',
                    color: 'rgba(240,237,232,0.50)',
                    fontFamily: 'var(--font-mono)', fontSize: '11px',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: loadingMore ? 'default' : 'pointer', transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.45)'; e.currentTarget.style.color = '#C9A96E' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'rgba(240,237,232,0.50)' }}
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
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            opacity: 0, animation: 'fadeIn 0.35s ease forwards',
          }}>
            <p style={{
              fontFamily: 'var(--font-serif)', fontSize: 'clamp(1rem, 3vw, 1.25rem)',
              fontWeight: 300, color: '#F0EDE8', marginBottom: '0.5rem',
            }}>
              No topics found for &ldquo;{inputValue.trim()}&rdquo;
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.35)', fontWeight: 300 }}>
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
        input::placeholder { color: rgba(240,237,232,0.28); }

        /* ── Static starfield background (no animated canvas) ─── */
        .sp-bg {
          position: fixed; inset: 0; z-index: 0;
          background: #000; overflow: hidden;
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
      `}</style>

      {showLogin && <LoginModal pendingQuery="" onClose={() => setShowLogin(false)} />}
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
        minHeight: '100vh',
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
            color: 'rgba(240,237,232,0.30)',
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
