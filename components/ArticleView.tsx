'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { NewsItem } from '@/types/news'
import ExplainPanel from './ExplainPanel'
import HelpfulButton from './HelpfulButton'
import WikiInfoBox from './WikiInfoBox'

interface Article {
  id: string
  slug: string
  title: string
  content: string
  summary: string
  category: string
  tags: string[]
  verified_at: string
  created_at: string
  sources: string[]
  wiki_url?: string | null
  event_date?: string | null
}

interface RelatedArticle {
  slug: string
  title: string
  summary: string
  category: string
}

interface ExplainHistoryItem {
  hash: string
  highlighted_text: string
  explanation: string
  mode: string
  article_slug: string | null
  created_at: string
}

interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

interface ArticleSection {
  id: string
  heading: string
  level: 2 | 3
  contentHtml: string // the h-tag + everything until the next h2
}

function buildArticleContentWithToc(content: string): { html: string; items: TocItem[]; sections: ArticleSection[] } {
  const items: TocItem[] = []
  const usedIds = new Map<string, number>()

  const html = content.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (full, levelText: string, rawAttrs: string, inner: string) => {
      const level = Number(levelText) as 2 | 3
      const text = decodeEntities(stripHtml(inner))
      if (!text) return full

      const existingId = rawAttrs.match(/\sid=(['"])(.*?)\1/i)?.[2]?.trim()
      const baseId = existingId || slugifyHeading(text) || `section-${items.length + 1}`
      const seenCount = usedIds.get(baseId) ?? 0
      const uniqueId = seenCount === 0 ? baseId : `${baseId}-${seenCount + 1}`
      usedIds.set(baseId, seenCount + 1)

      const attrsWithId = /\sid=(['"])(.*?)\1/i.test(rawAttrs)
        ? rawAttrs.replace(/\sid=(['"])(.*?)\1/i, ` id="${uniqueId}"`)
        : `${rawAttrs} id="${uniqueId}"`

      items.push({ id: uniqueId, text, level })
      return `<h${level}${attrsWithId}>${inner}</h${level}>`
    },
  )

  // Build sections by splitting at <h2> boundaries (for mobile accordion)
  const sections: ArticleSection[] = []
  const h2Items = items.filter(i => i.level === 2)
  if (h2Items.length > 0) {
    // Split on lookahead at each <h2 ...> opening tag
    const rawParts = html.split(/(?=<h2[^>]+id=")/i)
    rawParts.forEach((chunk, i) => {
      if (i === 0 && !chunk.trim().startsWith('<h2')) return // preamble before first h2
      const idMatch = chunk.match(/<h2[^>]*id="([^"]+)"/i)
      if (!idMatch) return
      const id = idMatch[1]
      const tocItem = items.find(it => it.id === id)
      if (!tocItem) return
      sections.push({
        id,
        heading: tocItem.text,
        level: tocItem.level,
        contentHtml: chunk,
      })
    })
  }

  return { html, items, sections }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function ArticleView({ article, isGenerating = false }: { article: Article; isGenerating?: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const articleContentRef = useRef<HTMLDivElement | null>(null)
  const tocButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [activeSectionId, setActiveSectionId] = useState('')
  const [isDesktopLayout, setIsDesktopLayout] = useState(false)
  const [related, setRelated] = useState<RelatedArticle[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [readSlugs, setReadSlugs] = useState<Set<string>>(new Set())
  const [doubtTooltip, setDoubtTooltip] = useState(false)
  const [doubtPressed, setDoubtPressed] = useState(false)
  const [articleCopied, setArticleCopied] = useState(false)
  const [studyMode, setStudyMode] = useState<'solo' | 'together'>('solo')
  const [studyCreating, setStudyCreating] = useState(false)
  const [openSectionId, setOpenSectionId] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<ExplainHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const recordedRef = useRef(false)

  const { html: contentWithAnchors, items: tocItems, sections: articleSections } = useMemo(
    // Skip expensive TOC computation on partial streaming HTML — only compute when done
    () => isGenerating ? { html: '', items: [], sections: [] } : buildArticleContentWithToc(article.content),
    [article.content, isGenerating],
  )

  // Badge date: prefer AI-provided event_date, else fall back to month+year of verified_at
  const badgeDate = useMemo(() => {
    if (article.event_date) return article.event_date
    const d = new Date(article.verified_at || article.created_at)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }, [article.event_date, article.verified_at, article.created_at])

  useEffect(() => {
    fetch(`/api/news?topic=${encodeURIComponent(article.title)}`)
      .then(r => r.json())
      .then(d => setNews(d.items ?? []))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [article.title])

  // Fast auth prime: reads from the in-memory session cache — no network call.
  // Prevents the "Study Together" button from briefly redirecting to /login
  // while the slower getUser() network validation is still in flight.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setIsLoggedIn(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Record this article as read + fetch user's read history for personalisation
  useEffect(() => {
    if (recordedRef.current) return
    recordedRef.current = true

    async function recordAndPersonalise() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setIsLoggedIn(true)

      // Fire-and-forget: record the read (upsert updates read_at on revisit)
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: article.slug,
          title: article.title,
          category: article.category,
        }),
      }).catch(() => null)

      // Fetch read slugs so we can identify unread related articles
      const { data: history } = await supabase
        .from('reading_history')
        .select('article_slug')
        .eq('user_id', user.id)
      setReadSlugs(new Set((history ?? []).map((h: { article_slug: string }) => h.article_slug)))
    }
    recordAndPersonalise()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch related articles — tag overlap first (topic-smart), category fallback
  useEffect(() => {
    async function fetchRelated() {
      // Stage 1: articles that share at least one tag with this article
      if (article.tags?.length > 0) {
        const { data: tagMatches } = await supabase
          .from('articles')
          .select('slug, title, summary, category')
          .overlaps('tags', article.tags)
          .neq('slug', article.slug)
          .limit(4)
        if (tagMatches && tagMatches.length > 0) {
          setRelated(tagMatches)
          return
        }
      }
      // Stage 2: fallback — same category
      const { data: catMatches } = await supabase
        .from('articles')
        .select('slug, title, summary, category')
        .eq('category', article.category)
        .neq('slug', article.slug)
        .limit(3)
      setRelated(catMatches ?? [])
    }
    fetchRelated()
  }, [article.slug, article.category, article.tags]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch AI explain history when panel opens (lazy — only if logged in)
  useEffect(() => {
    if (!historyOpen || !isLoggedIn) return
    let cancelled = false
    setHistoryLoading(true)
    ;(async () => {
      try {
        const { data } = await supabase
          .from('explain_shares')
          .select('hash, highlighted_text, explanation, mode, article_slug, created_at')
          .order('created_at', { ascending: false })
          .limit(30)

        if (!cancelled) setHistoryItems(data ?? [])
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [historyOpen, isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // useLayoutEffect runs synchronously before the browser paints, so the correct
  // desktop/mobile layout is applied before the user sees anything — no accordion flash
  // when ArticleGenerator swaps to ArticleView. SSR still renders isDesktopLayout=false
  // (matches server HTML) so hydration is clean.
  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1100px)')
    const apply = () => setIsDesktopLayout(mq.matches)
    apply()
    if (mq.addEventListener) {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    mq.addListener(apply)
    return () => mq.removeListener(apply)
  }, [])

  useEffect(() => {
    setActiveSectionId(prev =>
      tocItems.some(item => item.id === prev) ? prev : (tocItems[0]?.id ?? ''),
    )
    // Initialize accordion: open first section by default
    setOpenSectionId(prev => prev || (tocItems[0]?.id ?? ''))
  }, [tocItems])

  // Scroll spy ─────────────────────────────────────────────────
  // Two key design choices that make this reliable:
  //
  // 1. document.addEventListener + capture:true
  //    Scroll events do NOT bubble. capture:true intercepts them during
  //    the capture phase (before they reach the target), so we catch
  //    scrolls on window, body, or any nested scrollable element.
  //
  // 2. document.getElementById() called fresh every frame (no cached refs).
  //    Any state update (news load, related articles) re-renders the
  //    component and React might move DOM nodes. Fresh ID lookups are
  //    O(1) hash-table ops — negligible cost for 5 headings.
  useEffect(() => {
    if (tocItems.length === 0) return

    // 120 px = nav height (64px) + breathing room so the active section
    // switches just before the heading reaches the top of the viewport.
    const THRESHOLD = 120

    let rafId = 0
    const runSpy = () => {
      rafId = 0
      let activeId = tocItems[0]?.id ?? ''

      for (const { id } of tocItems) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= THRESHOLD) {
          activeId = id   // last heading above the threshold = active section
        } else {
          break           // headings are in DOM order; none below can qualify
        }
      }

      setActiveSectionId(prev => (prev === activeId ? prev : activeId))
    }

    const onScroll = () => { if (!rafId) rafId = window.requestAnimationFrame(runSpy) }

    runSpy()   // set correct initial section without waiting for a scroll

    // capture:true → fires for scroll events on window AND any inner container
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onScroll)

    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onScroll)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [tocItems])

  // Auto-scroll active TOC button into view inside the sidebar (desktop only)
  useEffect(() => {
    if (!activeSectionId || !isDesktopLayout) return
    const target = tocButtonRefs.current[activeSectionId]
    if (!target) return
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeSectionId, isDesktopLayout])

  function scrollToSection(id: string) {
    const heading = document.getElementById(id)
    if (!heading) return
    setActiveSectionId(id)
    // Offset by 80px to avoid heading hiding under the sticky nav bar
    const top = heading.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  function handleTocWheel(e: React.WheelEvent<HTMLElement>) {
    const el = e.currentTarget
    const canScrollInside = el.scrollHeight > el.clientHeight + 1
    if (!canScrollInside) {
      window.scrollBy({ top: e.deltaY, behavior: 'auto' })
      e.preventDefault()
      return
    }
    const atTop = el.scrollTop <= 0
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    const scrollingUp = e.deltaY < 0
    const scrollingDown = e.deltaY > 0
    if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
      window.scrollBy({ top: e.deltaY, behavior: 'auto' })
      e.preventDefault()
    }
  }

  const hasToc = tocItems.length > 0
  // Always reserve two-column space on desktop to prevent layout shift when TOC arrives
  const showDesktopToc = isDesktopLayout
  const showMobileToc = hasToc && !isDesktopLayout

  const layoutStyle = showDesktopToc
    ? {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 1.5rem 0',
        display: 'grid',
        gridTemplateColumns: '240px minmax(0, 760px)',
        gap: '2.5rem',
        justifyContent: 'center',
        alignItems: 'start',
      }
    : {
        maxWidth: '760px',
        margin: '0 auto',
        padding: isDesktopLayout ? '3rem 1.5rem 0' : '1rem 1.25rem 0',
      }

  return (
    <div
      className="starfield-content"
      style={{
        minHeight: '100vh',
        paddingTop: '64px',
        paddingBottom: '6rem',
        background: 'var(--ink)',
      }}
    >
      {/* ══ [Solo | Study Together] — compact full-width top control bar ════ */}
      <div style={{
        width: '100%',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'center',
        padding: '6px 0',
        background: 'var(--ink)',
      }}>
        <div style={{
          display: 'inline-flex',
          background: 'var(--ink-2)',
          border: '1px solid var(--border)',
          borderRadius: '100px',
          padding: '3px',
          gap: '2px',
        }}>
          {(['solo', 'together'] as const).map(m => (
            <button
              key={m}
              onClick={async () => {
                if (m === 'solo') { setStudyMode('solo'); return }
                if (!isLoggedIn) { router.push(`/login?next=/article/${article.slug}`); return }
                setStudyMode('together')
                setStudyCreating(true)
                try {
                  const res = await fetch('/api/rooms/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      articleSlug:  article.slug,
                      articleTitle: article.title,
                      roomName:     article.title.slice(0, 50) + ' Room',
                    }),
                  })
                  const d = await res.json().catch(() => ({}))
                  if (res.ok) {
                    router.push(`/room/${d.code}`)
                  } else if (res.status === 409 && d.existingCode) {
                    router.push(`/room/${d.existingCode}`)
                  } else if (res.status === 403) {
                    router.push('/study')
                  } else {
                    setStudyMode('solo')
                    setStudyCreating(false)
                  }
                } catch {
                  setStudyMode('solo')
                  setStudyCreating(false)
                }
              }}
              style={{
                padding: '7px 22px',
                borderRadius: '100px',
                border: 'none',
                background: studyMode === m ? 'var(--gold-dim)' : 'transparent',
                color: studyMode === m ? 'var(--gold)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {m === 'together' && studyCreating ? 'Creating room…' : m === 'solo' ? 'Solo' : 'Study Together'}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Study Together: toggle navigates directly to /room/[code] ════ */}

      <div className={`article-layout ${showDesktopToc ? 'has-toc' : ''}`} style={layoutStyle}>

        {/* ── Desktop Fixed Sidebar ─────────────────────── */}
        {showDesktopToc && (
          <aside
            className="article-toc-desktop"
            onWheel={handleTocWheel}
            style={{
              position: 'sticky',
              top: '96px',
              alignSelf: 'start',
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
              paddingRight: '0.25rem',
            }}
          >
            {/* Sidebar header */}
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: hasToc ? 'var(--gold)' : 'var(--ink-3)',
                marginBottom: '1rem',
                paddingBottom: '0.6rem',
                borderBottom: '1px solid var(--border)',
                transition: 'color 0.3s',
              }}
            >
              On this page
            </p>

            {/* TOC links — real items or skeleton during generation */}
            {hasToc ? (
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {tocItems.map(item => {
                    const isActive = item.id === activeSectionId
                    return (
                      <button
                        key={item.id}
                        ref={node => { tocButtonRefs.current[item.id] = node }}
                        type="button"
                        onClick={() => scrollToSection(item.id)}
                        style={{
                          textAlign: 'left',
                          border: 'none',
                          borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                          background: isActive ? 'var(--gold-dim)' : 'transparent',
                          color: isActive ? 'var(--gold)' : 'var(--text-tertiary)',
                          fontFamily: 'var(--font-sans)',
                          fontSize: item.level === 2 ? '13px' : '12px',
                          lineHeight: 1.45,
                          fontWeight: isActive ? 500 : 300,
                          padding: item.level === 2
                            ? '0.5rem 0.6rem 0.5rem 0.75rem'
                            : '0.4rem 0.6rem 0.4rem 1.4rem',
                          borderRadius: '0 8px 8px 0',
                          cursor: 'pointer',
                          transition: 'background 0.18s, color 0.18s, border-color 0.18s, font-weight 0.18s',
                          width: '100%',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--text-tertiary)'
                          }
                        }}
                      >
                        {item.text}
                      </button>
                    )
                  })}
              </nav>
            ) : (
              /* Skeleton sidebar — holds space during generation so layout never shifts */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[70, 55, 80, 50, 65, 45, 75].map((w, i) => (
                  <div
                    key={i}
                    className="skeleton"
                    style={{
                      height: '12px',
                      width: `${w}%`,
                      borderRadius: '4px',
                      marginLeft: i % 3 === 0 ? 0 : '12px',
                    }}
                  />
                ))}
              </div>
            )}

          </aside>
        )}

        {/* ── Main Content ──────────────────────────────── */}
        <div ref={articleContentRef} style={{ minWidth: 0 }}>

          {/* Breadcrumb */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
            }}
          >
            <Link href="/" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              Forcapedia
            </Link>
            {isGenerating && !article.category ? (
              <div className="skeleton" style={{ height: '10px', width: '120px', borderRadius: '4px' }} />
            ) : (
              <>
                <span>/</span>
                <span style={{ color: 'var(--text-secondary)' }}>{article.category}</span>
                <span>/</span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '200px',
                  }}
                >
                  {article.title}
                </span>
              </>
            )}
          </div>


          {/* Badges row — Verified · date | "? Doubt" | Active | [share button] */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              marginBottom: '1.75rem',
            }}
          >
          {/* Left: pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            {isGenerating && !article.title && (
              <div className="skeleton" style={{ height: '26px', width: '130px', borderRadius: '100px' }} />
            )}
            {/* Verified badge — shows event_date or month+year of verified_at */}
            {(!isGenerating || article.title) && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  background: 'var(--gold-dim)',
                  border: '1px solid var(--border-gold)',
                  padding: '4px 12px 4px 10px',
                  borderRadius: '100px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.4" />
                  <path
                    d="M3.5 6l1.8 1.8L8.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Verified {'\u00B7'} {badgeDate}
              </div>
            )}

            {/* "? Doubt" pill — animated, tooltip on hover */}
            {(!isGenerating || article.title) && <div
              style={{ position: 'relative', display: 'inline-flex' }}
              onMouseEnter={() => setDoubtTooltip(true)}
              onMouseLeave={() => { setDoubtTooltip(false); setDoubtPressed(false) }}
            >
              <div
                onMouseDown={() => setDoubtPressed(true)}
                onMouseUp={() => setDoubtPressed(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '4px 11px',
                  borderRadius: '100px',
                  border: doubtTooltip
                    ? '1px solid rgba(240,237,232,0.16)'
                    : '1px solid var(--border)',
                  background: doubtPressed
                    ? 'rgba(201,169,110,0.1)'
                    : doubtTooltip
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(255,255,255,0.02)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  color: doubtPressed ? 'var(--gold)' : doubtTooltip ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                  cursor: 'default',
                  userSelect: 'none',
                  transform: doubtPressed ? 'scale(0.94)' : doubtTooltip ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  animation: doubtTooltip || doubtPressed ? 'none' : 'doubtBreathe 4s ease-in-out infinite',
                }}>
                <span style={{ opacity: doubtTooltip ? 1 : 0.7, transition: 'opacity 0.2s' }}>?</span>
                {' '}Doubt
              </div>
              {doubtTooltip && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  background: 'var(--ink-3)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  zIndex: 100,
                  pointerEvents: 'none',
                  animation: 'fadeIn 0.15s ease',
                }}>
                  Select any text to understand instantly
                </div>
              )}
            </div>}

          </div>{/* /left pills */}

          {/* Share + History icons — side by side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={async () => {
                const url = window.location.href
                if (navigator.share) {
                  await navigator.share({ title: article.title, url }).catch(() => null)
                } else {
                  await navigator.clipboard.writeText(url).catch(() => null)
                  setArticleCopied(true)
                  setTimeout(() => setArticleCopied(false), 2000)
                }
              }}
              title={articleCopied ? 'Link copied!' : 'Share article'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: articleCopied ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border)',
                borderRadius: '50%',
                background: articleCopied ? 'rgba(34,197,94,0.08)' : 'transparent',
                color: articleCopied ? '#22c55e' : 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!articleCopied) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
              onMouseLeave={e => {
                if (!articleCopied) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                }
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              {articleCopied ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
              )}
            </button>

            {isLoggedIn && (
              <button
                onClick={() => setHistoryOpen(true)}
                title="Your AI explain history"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </button>
            )}
          </div>
          </div>{/* /badges row */}

          {/* Article title */}
          {isGenerating && !article.title ? (
            <div style={{ marginBottom: '1.25rem' }}>
              <div className="skeleton" style={{ height: '52px', width: '85%', borderRadius: '8px', marginBottom: '10px' }} />
              <div className="skeleton" style={{ height: '52px', width: '60%', borderRadius: '8px' }} />
            </div>
          ) : (
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                fontWeight: 300,
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                marginBottom: '1.25rem',
              }}
            >
              {article.title}
            </h1>
          )}

          {/* Summary */}
          {isGenerating && !article.summary ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ height: '14px', width: '100%', borderRadius: '4px' }} />
              <div className="skeleton" style={{ height: '14px', width: '95%', borderRadius: '4px' }} />
              <div className="skeleton" style={{ height: '14px', width: '80%', borderRadius: '4px' }} />
            </div>
          ) : (
            <p
              style={{
                fontSize: '17px',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                fontWeight: 300,
                marginBottom: '1.5rem',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {article.summary}
            </p>
          )}

          {/* Wikipedia info box — person / species / notable entity */}
          <WikiInfoBox wikiUrl={article.wiki_url} articleTitle={article.title} />

          {/* Article body */}
          {isGenerating ? (
            /* Streaming mode — show live content as it arrives, no TOC/accordion */
            <div style={{ margin: 0, padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
                  Generating article…
                </span>
              </div>
              {article.content ? (
                <div className="article-prose" dangerouslySetInnerHTML={{ __html: article.content }} style={{ opacity: 0.85 }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 0.9, 0.95, 0.7].map((w, i) => (
                    <div key={i} style={{ height: 14, width: `${w * 100}%`, borderRadius: 4, background: 'var(--ink-3)' }} />
                  ))}
                </div>
              )}
            </div>
          ) : isDesktopLayout ? (
            <div
              className="article-prose"
              style={{ margin: 0, padding: 0 }}
              dangerouslySetInnerHTML={{ __html: contentWithAnchors }}
            />
          ) : (
            /* Mobile: accordion sections */
            <div style={{ margin: 0, padding: 0 }}>
              {articleSections.length > 0 ? (
                articleSections.map(sec => (
                  <div key={sec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <button
                      onClick={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement
                        btn.blur()
                        const beforeTop = btn.getBoundingClientRect().top

                        // Disable smooth behavior during compensation so we don't
                        // get a second animated jump after the accordion reflow.
                        document.documentElement.style.scrollBehavior = 'auto'

                        flushSync(() => {
                          setOpenSectionId(prev => prev === sec.id ? '' : sec.id)
                        })

                        requestAnimationFrame(() => {
                          const afterTop = btn.getBoundingClientRect().top
                          const deltaY = afterTop - beforeTop
                          if (Math.abs(deltaY) > 0.5) {
                            window.scrollBy({ top: deltaY, left: 0, behavior: 'auto' })
                          }
                          document.documentElement.style.scrollBehavior = ''
                        })
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: 'transparent',
                        padding: '0.875rem 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '17px',
                        fontWeight: 600,
                        color: openSectionId === sec.id ? 'var(--gold)' : 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                        transition: 'color 0.18s',
                      }}
                    >
                      <span>{sec.heading}</span>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{
                          flexShrink: 0,
                          transition: 'transform 0.25s',
                          transform: openSectionId === sec.id ? 'rotate(180deg)' : 'rotate(0deg)',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {openSectionId === sec.id && (
                      <div
                        className="article-prose"
                        style={{ paddingBottom: '1rem', animation: 'fadeIn 0.22s ease' }}
                        dangerouslySetInnerHTML={{ __html: sec.contentHtml }}
                      />
                    )}
                  </div>
                ))
              ) : (
                /* Fallback: render full content if sections couldn't be parsed */
                <div
                  className="article-prose"
                  onContextMenu={e => e.preventDefault()}
                  dangerouslySetInnerHTML={{ __html: contentWithAnchors }}
                />
              )}
            </div>
          )}

          {/* Sources */}
          {article.sources?.length > 0 && (
            <div
              style={{
                margin: '3rem 0 0',
                padding: '1.5rem',
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  marginBottom: '0.75rem',
                }}
              >
                Sources
              </p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {article.sources.map((s, i) => {
                  const match = s.match(/^(.*?)\s*\((https?:\/\/[^)]+)\)\s*$/)
                  const name = match ? match[1].trim() : s
                  const url = match ? match[2] : null
                  return (
                    <li
                      key={i}
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      [{i + 1}]{' '}
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--gold)',
                            textDecoration: 'none',
                            borderBottom: '1px solid var(--border-gold)',
                            transition: 'border-color 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderBottomColor = 'var(--gold)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'var(--border-gold)' }}
                        >
                          {name}
                        </a>
                      ) : (
                        name
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Latest News */}
          {(newsLoading || news.length > 0) && (
            <div
              style={{
                margin: '2rem 0 0',
                padding: '1.5rem',
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                minHeight: newsLoading ? '120px' : undefined,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--gold)',
                  marginBottom: '1rem',
                }}
              >
                Latest News
              </p>

              {newsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      style={{
                        height: '14px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '4px',
                        width: i === 1 ? '80%' : i === 2 ? '65%' : '72%',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  ))}
                </div>
              ) : (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {news.slice(0, 5).map((item, i, arr) => {
                    const age = Math.round((Date.now() - new Date(item.publishedAt).getTime()) / 3_600_000)
                    const ageLabel =
                      age < 1 ? 'just now' : age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`
                    return (
                      <li
                        key={i}
                        style={{
                          borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                          padding: '0.75rem 0',
                        }}
                      >
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', textDecoration: 'none', color: 'inherit' }}
                        >
                          <span
                            style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 300, lineHeight: 1.4, transition: 'color 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                          >
                            {item.title}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                            {item.source} {'\u00B7'} {ageLabel}
                          </span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Helpful counter — vote button with live realtime count */}
          <HelpfulButton articleSlug={article.slug} />

          {/* Related Articles / Up next for you (personalised for logged-in users) */}
          {related.length > 0 && (() => {
            // For logged-in users prefer unread articles; fall back to full list
            const displayList = isLoggedIn && readSlugs.size > 0
              ? (related.filter(r => !readSlugs.has(r.slug)).length > 0
                  ? related.filter(r => !readSlugs.has(r.slug))
                  : related)
              : related
            const sectionLabel = isLoggedIn && readSlugs.size > 0 && related.some(r => !readSlugs.has(r.slug))
              ? 'Up next for you'
              : 'Related Articles'
            return (
              <div style={{ margin: '2rem 0 0' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--gold)',
                    marginBottom: '1rem',
                  }}
                >
                  {sectionLabel}
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  {displayList.slice(0, 4).map(rel => (
                    <Link
                      key={rel.slug}
                      href={`/article/${rel.slug}`}
                      style={{
                        display: 'block',
                        padding: '1rem',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--border-gold)'
                        e.currentTarget.style.background = 'var(--gold-glow)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.background = 'var(--surface)'
                      }}
                    >
                      <p
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: 'var(--gold)',
                          marginBottom: '0.4rem',
                        }}
                      >
                        {rel.category}
                      </p>
                      <p
                        style={{
                          fontSize: '14px',
                          fontWeight: 400,
                          color: 'var(--text-primary)',
                          lineHeight: 1.3,
                          marginBottom: '0.4rem',
                        }}
                      >
                        {rel.title}
                      </p>
                      <p
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-tertiary)',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {rel.summary}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Back to search */}
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              &larr; Back to search
            </Link>
          </div>
        </div>
      </div>

      {/* Highlight & Explain — floating toolbar + slide-in panel */}
      <ExplainPanel articleSlug={article.slug} contentRef={articleContentRef} />

      {/* AI History Drawer */}
      {historyOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setHistoryOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 998,
              background: 'rgba(0,0,0,0.45)',
              animation: 'fadeIn 0.18s ease',
            }}
          />
          {/* Panel */}
          <div
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 999,
              width: 'min(420px, 100vw)',
              background: 'var(--ink-2)',
              borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              animation: 'slideInFromRight 0.22s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--gold)',
                }}>Your Explains</span>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', padding: '4px',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0' }}>
              {historyLoading ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '3rem',
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  color: 'var(--text-tertiary)',
                }}>
                  Loading…
                </div>
              ) : historyItems.length === 0 ? (
                <div style={{
                  padding: '3rem 1.5rem', textAlign: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: '12px',
                  color: 'var(--text-tertiary)', lineHeight: 1.6,
                }}>
                  No explains yet.<br />
                  <span style={{ fontSize: '10px', opacity: 0.6 }}>
                    Select text and click &quot;Explain&quot; to start.
                  </span>
                </div>
              ) : (
                historyItems.map((item) => (
                  <div
                    key={item.hash}
                    style={{
                      padding: '0.9rem 1.25rem',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Article + time row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: '0.5rem', gap: '0.5rem',
                    }}>
                      {item.article_slug ? (
                        <button
                          onClick={() => { router.push(`/article/${item.article_slug}`); setHistoryOpen(false) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: 'var(--font-mono)', fontSize: '9px',
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            color: 'var(--gold)', padding: 0,
                            textAlign: 'left', maxWidth: '200px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {item.article_slug.replace(/-/g, ' ')}
                        </button>
                      ) : (
                        <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>—</span>
                      )}
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '9px',
                        color: 'var(--text-tertiary)', flexShrink: 0,
                      }}>
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                    {/* Highlighted text quote */}
                    <blockquote style={{
                      borderLeft: '2px solid rgba(201,169,110,0.35)',
                      paddingLeft: '0.6rem',
                      margin: '0 0 0.6rem 0',
                      color: 'rgba(240,237,232,0.4)',
                      fontSize: '12px',
                      lineHeight: 1.5,
                      fontStyle: 'italic',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {item.highlighted_text}
                    </blockquote>
                    {/* Explanation */}
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {item.explanation}
                    </p>
                    {/* Mode badge */}
                    <div style={{ marginTop: '0.5rem' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '9px',
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--text-tertiary)',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px', padding: '2px 6px',
                      }}>
                        {item.mode === 'eli10' ? 'ELI10' : 'Simple'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
