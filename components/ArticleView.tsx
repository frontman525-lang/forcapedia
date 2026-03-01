'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { NewsItem } from '@/types/news'
import ExplainPanel from './ExplainPanel'
import HelpfulButton from './HelpfulButton'

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

function buildArticleContentWithToc(content: string): { html: string; items: TocItem[] } {
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

  return { html, items }
}

function calcReadingTime(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(w => w.length > 0).length
  return Math.max(1, Math.ceil(words / 200))
}

// ── Study Together Button ──────────────────────────────────────────────────────
function StudyTogetherButton({
  articleSlug, articleTitle, isLoggedIn,
}: { articleSlug: string; articleTitle: string; isLoggedIn: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [tier, setTier]         = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [readers, setReaders]   = useState(0)
  const [copied, setCopied]     = useState(false)
  const [roomLink, setRoomLink] = useState<string | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(null)

  // Load tier
  useEffect(() => {
    if (!isLoggedIn) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('user_usage').select('tier').eq('user_id', user.id).single()
        .then(({ data }) => setTier(data?.tier ?? 'free'))
    })
  }, [isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live reader presence
  useEffect(() => {
    const channel = supabase.channel(`article-readers:${articleSlug}`, {
      config: { presence: { key: `reader-${Math.random()}` } },
    })
    channel.on('presence', { event: 'sync' }, () => {
      setReaders(Object.keys(channel.presenceState()).length)
    }).subscribe(async status => {
      if (status === 'SUBSCRIBED') await channel.track({ slug: articleSlug })
    })
    return () => { supabase.removeChannel(channel) }
  }, [articleSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick() {
    if (!isLoggedIn) { router.push(`/login?next=/article/${articleSlug}`); return }
    if (tier === 'free') {
      router.push('/pricing')
      return
    }
    setCreating(true)
    const res = await fetch('/api/rooms/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleSlug, articleTitle }),
    })
    if (res.ok) {
      const { code } = await res.json()
      setRoomCode(code)
      setRoomLink(`${window.location.origin}/room/${code}`)
    } else {
      const { error } = await res.json()
      alert(error || 'Could not create room.')
    }
    setCreating(false)
  }

  if (roomLink) {
    const wa = `https://wa.me/?text=${encodeURIComponent(`Join my Forcapedia study room → ${roomLink}`)}`
    return (
      <div style={{
        margin: '2rem 0', padding: '1.25rem',
        background: 'rgba(111,207,151,0.06)', border: '1px solid rgba(111,207,151,0.2)',
        borderRadius: '16px',
      }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6FCF97', marginBottom: '0.75rem' }}>
          Room created! Share this link:
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <code style={{
            flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '13px', color: '#6FCF97',
            fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {roomLink}
          </code>
          <button onClick={() => { navigator.clipboard.writeText(roomLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{
            background: 'rgba(111,207,151,0.1)', border: '1px solid rgba(111,207,151,0.2)',
            borderRadius: '8px', color: '#6FCF97', fontSize: '12px', padding: '0 1rem', cursor: 'pointer', flexShrink: 0,
          }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <a href={wa} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)',
            borderRadius: '8px', color: '#25D166', fontSize: '12px', padding: '0 1rem', textDecoration: 'none', flexShrink: 0,
          }}>
            WhatsApp
          </a>
          <button onClick={() => router.push(`/room/${roomCode}`)} style={{
            background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.2)',
            borderRadius: '8px', color: '#C9A96E', fontSize: '12px', padding: '0 1rem', cursor: 'pointer', flexShrink: 0,
          }}>
            Enter room →
          </button>
        </div>
      </div>
    )
  }

  const isPaid = tier === 'tier1' || tier === 'tier2'

  return (
    <div style={{ margin: '2rem 0' }}>
      {/* Live reader count */}
      {readers > 1 && (
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.06em',
          color: 'rgba(111,207,151,0.7)', marginBottom: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6FCF97', display: 'inline-block', animation: 'pulseGold 2s ease-in-out infinite' }} />
          {readers} students reading this right now
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={creating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
          background: isPaid ? 'rgba(111,207,151,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isPaid ? 'rgba(111,207,151,0.25)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '12px', padding: '0.75rem 1.25rem', cursor: 'pointer',
          color: isPaid ? '#6FCF97' : 'rgba(240,237,232,0.5)', fontSize: '14px',
          fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
        }}
        onMouseEnter={e => { if (isPaid) { e.currentTarget.style.background = 'rgba(111,207,151,0.14)'; e.currentTarget.style.borderColor = 'rgba(111,207,151,0.4)' } }}
        onMouseLeave={e => { e.currentTarget.style.background = isPaid ? 'rgba(111,207,151,0.08)' : 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = isPaid ? 'rgba(111,207,151,0.25)' : 'rgba(255,255,255,0.08)' }}
      >
        <span style={{ fontSize: '16px' }}>{!isPaid ? '🔒' : '📖'}</span>
        <span>{creating ? 'Creating room…' : 'Study Together'}</span>
        {isPaid && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', opacity: 0.6 }}>→</span>}
        {!isPaid && isLoggedIn && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#C9A96E', marginLeft: '0.25rem' }}>
            Scholar+
          </span>
        )}
      </button>
      {!isPaid && isLoggedIn && tier !== null && (
        <p style={{ marginTop: '0.4rem', fontSize: '12px', color: 'rgba(240,237,232,0.3)' }}>
          <Link href="/pricing" style={{ color: '#C9A96E' }}>Upgrade to Scholar</Link> to create study rooms
        </p>
      )}
    </div>
  )
}

export default function ArticleView({ article }: { article: Article }) {
  const supabase = createClient()
  const articleContentRef = useRef<HTMLDivElement | null>(null)
  const tocButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [activeSectionId, setActiveSectionId] = useState('')
  const [isDesktopLayout, setIsDesktopLayout] = useState(false)
  const [related, setRelated] = useState<RelatedArticle[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [readSlugs, setReadSlugs] = useState<Set<string>>(new Set())

  const { html: contentWithAnchors, items: tocItems } = useMemo(
    () => buildArticleContentWithToc(article.content),
    [article.content],
  )

  const readingTime = useMemo(() => calcReadingTime(article.content), [article.content])

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

  // Record this article as read + fetch user's read history for personalisation
  useEffect(() => {
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

  useEffect(() => {
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

  // Auto-scroll active TOC button into view inside the sidebar
  useEffect(() => {
    if (!activeSectionId) return
    const target = tocButtonRefs.current[activeSectionId]
    if (!target) return
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeSectionId])

  function scrollToSection(id: string) {
    const heading = document.getElementById(id)
    if (!heading) return
    setActiveSectionId(id)
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  const showDesktopToc = hasToc && isDesktopLayout
  const showMobileToc = hasToc && !isDesktopLayout

  const layoutStyle = showDesktopToc
    ? {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 1.5rem 0',
        display: 'grid',
        gridTemplateColumns: '240px minmax(0, 760px)',
        gap: '2.5rem',
        justifyContent: 'center',
        alignItems: 'start',
      }
    : {
        maxWidth: '760px',
        margin: '0 auto',
        padding: '4rem 1.5rem 0',
      }

  return (
    <div
      style={{
        minHeight: '100vh',
        paddingTop: '64px',
        paddingBottom: '6rem',
        background: 'var(--ink)',
      }}
    >
      <div className={`article-layout ${hasToc ? 'has-toc' : ''}`} style={layoutStyle}>

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
                color: 'var(--gold)',
                marginBottom: '1rem',
                paddingBottom: '0.6rem',
                borderBottom: '1px solid var(--border)',
              }}
            >
              On this page
            </p>

            {/* TOC links */}
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

            {/* Reading time at bottom of sidebar */}
            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
              }}
            >
              {readingTime} min read
            </div>
          </aside>
        )}

        {/* ── Main Content ──────────────────────────────── */}
        <div style={{ minWidth: 0 }}>

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
          </div>

          {/* Mobile TOC pills */}
          {showMobileToc && (
            <div
              className="article-toc-mobile"
              style={{
                display: 'flex',
                gap: '0.45rem',
                overflowX: 'auto',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
                scrollbarWidth: 'none',
              }}
            >
              {tocItems.map(item => (
                <button
                  key={`mobile-${item.id}`}
                  ref={node => { tocButtonRefs.current[item.id] = node }}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  style={{
                    flexShrink: 0,
                    border: '1px solid',
                    borderColor: item.id === activeSectionId ? 'var(--border-gold)' : 'var(--border)',
                    background: item.id === activeSectionId ? 'var(--gold-dim)' : 'rgba(255,255,255,0.02)',
                    color: item.id === activeSectionId ? 'var(--gold)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderRadius: '999px',
                    padding: '0.35rem 0.65rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {item.text}
                </button>
              ))}
            </div>
          )}

          {/* Badges row — Verified · date | hint | reading time | Wikipedia */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.75rem',
            }}
          >
            {/* Verified badge — shows event_date or month+year of verified_at */}
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

            {/* Explain hint — inline beside Verified badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '4px 11px 4px 8px',
              borderRadius: '100px',
              border: '1px solid var(--border-gold)',
              background: 'var(--gold-glow)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              userSelect: 'none',
            }}>
              <span style={{ color: 'var(--gold)', animation: 'pulseGold 2.5s ease-in-out infinite', fontSize: '8px', lineHeight: 1 }}>✦</span>
              Highlight text — AI explains it
            </div>

            {/* Reading time badge (mobile only — desktop shows in sidebar) */}
            {!isDesktopLayout && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  color: 'var(--text-tertiary)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  padding: '4px 12px',
                  borderRadius: '100px',
                }}
              >
                {readingTime} min read
              </div>
            )}

            {/* Wikipedia source badge */}
            {article.wiki_url && (
              <a
                href={article.wiki_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  padding: '4px 12px 4px 10px',
                  borderRadius: '100px',
                  textDecoration: 'none',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-gold)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-1 3v2H9v2h2v6h2V9h2V7h-2V5h-2z" />
                </svg>
                Wikipedia source
              </a>
            )}
          </div>

          {/* Study Together ──────────────────────────────────────────────── */}
          <StudyTogetherButton
            articleSlug={article.slug}
            articleTitle={article.title}
            isLoggedIn={isLoggedIn}
          />

          {/* Article title */}
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

          {/* Summary */}
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

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
                marginBottom: '2.5rem',
              }}
            >
              {article.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '100px',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Article body */}
          <div
            ref={articleContentRef}
            className="article-prose"
            style={{ margin: 0, padding: 0 }}
            dangerouslySetInnerHTML={{ __html: contentWithAnchors }}
          />

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
                  {news.map((item, i) => {
                    const age = Math.round((Date.now() - new Date(item.publishedAt).getTime()) / 3_600_000)
                    const ageLabel =
                      age < 1 ? 'just now' : age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`
                    return (
                      <li
                        key={i}
                        style={{
                          borderBottom: i < news.length - 1 ? '1px solid var(--border)' : 'none',
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
                  {displayList.map(rel => (
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
    </div>
  )
}
