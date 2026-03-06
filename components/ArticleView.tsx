'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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




export default function ArticleView({ article }: { article: Article }) {
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
  const [studyModal, setStudyModal] = useState(false)
  const [studyRoomCode, setStudyRoomCode] = useState<string | null>(null)
  const [studyRoomLink, setStudyRoomLink] = useState<string | null>(null)
  const [studyRoomCopied, setStudyRoomCopied] = useState(false)
  const [studyJoinCode, setStudyJoinCode] = useState('')
  const [studyJoining, setStudyJoining] = useState(false)
  const [studyJoinError, setStudyJoinError] = useState<string | null>(null)
  const [studyTier, setStudyTier] = useState<string | null>(null)
  const [studyRoomName, setStudyRoomName] = useState('')
  const [studyRoomTopic, setStudyRoomTopic] = useState('')
  const [studyRoomPassword, setStudyRoomPassword] = useState('')
  const [studyCreateError, setStudyCreateError] = useState<string | null>(null)
  const [studyJoinPassword, setStudyJoinPassword] = useState('')
  const [studyJoinNeedsPassword, setStudyJoinNeedsPassword] = useState(false)
  const [openSectionId, setOpenSectionId] = useState('')
  const recordedRef = useRef(false)

  const { html: contentWithAnchors, items: tocItems, sections: articleSections } = useMemo(
    () => buildArticleContentWithToc(article.content),
    [article.content],
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

      // Load tier for study toggle
      supabase.from('user_usage').select('tier').eq('user_id', user.id).single()
        .then(({ data, error }) => { if (!error) setStudyTier(data?.tier ?? 'free') })

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

  async function doJoinRoom() {
    if (!studyJoinCode || studyJoining) return
    if (studyJoinNeedsPassword && !studyJoinPassword) {
      setStudyJoinError('Please enter the room password.')
      return
    }
    setStudyJoining(true)
    setStudyJoinError(null)
    try {
      const res = await fetch(`/api/rooms/${studyJoinCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: studyJoinPassword || undefined }),
      })
      if (res.ok) {
        router.push(`/room/${studyJoinCode}`)
        return
      }
      const d = await res.json().catch(() => ({}))
      if (d.error === 'PASSWORD_REQUIRED') {
        setStudyJoinNeedsPassword(true)
        setStudyJoinError('This room requires a password.')
      } else if (d.error === 'Incorrect password.') {
        setStudyJoinNeedsPassword(true)
        setStudyJoinError('Incorrect password. Try again.')
      } else if (res.status === 404) {
        setStudyJoinError('Room not found or already closed.')
      } else {
        // Room found but might have other errors — just navigate and let the page handle it
        router.push(`/room/${studyJoinCode}`)
      }
    } finally {
      setStudyJoining(false)
    }
  }

  const closeStudyModal = () => {
    setStudyModal(false)
    setStudyMode('solo')
    setStudyRoomCode(null)
    setStudyRoomLink(null)
    setStudyRoomCopied(false)
    setStudyJoinCode('')
    setStudyJoinError(null)
    setStudyRoomName('')
    setStudyRoomTopic('')
    setStudyRoomPassword('')
    setStudyCreateError(null)
    setStudyJoinPassword('')
    setStudyJoinNeedsPassword(false)
  }

  // Close study modal on Escape
  useEffect(() => {
    if (!studyModal) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeStudyModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studyModal]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const showDesktopToc = hasToc && isDesktopLayout
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
              onClick={() => {
                if (m === 'solo') { setStudyMode('solo'); setStudyModal(false); return }
                if (!isLoggedIn) { router.push(`/login?next=/article/${article.slug}`); return }
                setStudyMode('together')
                setStudyModal(true)
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
              {m === 'solo' ? 'Solo' : 'Study Together'}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Study Together modal ══════════════════════════════════════════════ */}
      {studyModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeStudyModal}
            style={{
              position: 'fixed', inset: 0, zIndex: 998,
              backdropFilter: 'blur(10px) saturate(0.6)',
              WebkitBackdropFilter: 'blur(10px) saturate(0.6)',
              background: 'rgba(0,0,0,0.3)',
              animation: 'fadeIn 0.18s ease',
            }}
          />
          {/* Modal card */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 999,
            width: 'min(460px, calc(100vw - 2rem))',
            background: 'var(--ink-2)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '2rem',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
            animation: 'modalIn 0.22s cubic-bezier(0.34, 1.1, 0.64, 1)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 300, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                  Study Together
                </h2>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                  {studyRoomCode ? 'Room is ready. Share and dive in.' : 'Collaborate live while reading.'}
                </p>
              </div>
              <button onClick={closeStudyModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── Room-created state ── */}
            {studyRoomCode ? (
              <div style={{ animation: 'fadeIn 0.2s ease' }}>
                {/* Success label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#22c55e', letterSpacing: '0.06em' }}>Room created</span>
                </div>

                {/* Share link row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.625rem 0.75rem',
                  background: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: '10px',
                  marginBottom: '1rem',
                }}>
                  <span style={{
                    flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.04em',
                  }}>
                    {studyRoomLink}
                  </span>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(studyRoomLink ?? '').catch(() => null)
                      setStudyRoomCopied(true)
                      setTimeout(() => setStudyRoomCopied(false), 2000)
                    }}
                    title={studyRoomCopied ? 'Copied!' : 'Copy link'}
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: '8px',
                      border: studyRoomCopied ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border)',
                      background: studyRoomCopied ? 'rgba(34,197,94,0.1)' : 'transparent',
                      color: studyRoomCopied ? '#22c55e' : 'var(--text-tertiary)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {studyRoomCopied ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                    )}
                  </button>
                </div>

                {/* WhatsApp share */}
                <button
                  onClick={() => {
                    const text = encodeURIComponent(`Join my Forcapedia study room! ${studyRoomLink ?? ''}`)
                    window.open(`https://wa.me/?text=${text}`, '_blank')
                  }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    padding: '0.6rem', marginBottom: '0.6rem',
                    background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: '10px',
                    color: '#25d366', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.06em',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  Share via WhatsApp
                </button>

                {/* Enter Room CTA */}
                <button
                  onClick={() => router.push(`/room/${studyRoomCode}`)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    padding: '0.875rem',
                    background: 'var(--gold-dim)', border: '1px solid var(--border-gold)', borderRadius: '14px',
                    color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  Enter Room
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </div>
            ) : (
              <>
                {/* ── Default state: Create Room + Join ── */}
                {studyTier === null ? (
                  <div style={{ textAlign: 'center', padding: '1rem 0', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>Loading…</div>
                ) : studyTier === 'free' ? (
                  <div style={{ padding: '1rem', borderRadius: '14px', marginBottom: '1.25rem', background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.15)', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>Study rooms require Scholar plan</p>
                    <Link href="/pricing" onClick={closeStudyModal} style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.06em' }}>Upgrade to Scholar →</Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                    {/* Room name (required) */}
                    <input
                      type="text" placeholder="Room name (required)" value={studyRoomName}
                      onChange={e => { setStudyRoomName(e.target.value); setStudyCreateError(null) }}
                      maxLength={60}
                      style={{ background: 'var(--ink-3)', border: studyCreateError && !studyRoomName.trim() ? '1px solid rgba(244,124,124,0.4)' : '1px solid var(--border)', borderRadius: '10px', padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', letterSpacing: '0.04em' }}
                    />
                    {/* Topic (optional) */}
                    <input
                      type="text" placeholder="Topic / description (optional)" value={studyRoomTopic}
                      onChange={e => setStudyRoomTopic(e.target.value)}
                      maxLength={120}
                      style={{ background: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', letterSpacing: '0.04em' }}
                    />
                    {/* Password (required) */}
                    <input
                      type="password" placeholder="Room password (required)" value={studyRoomPassword}
                      onChange={e => { setStudyRoomPassword(e.target.value); setStudyCreateError(null) }}
                      style={{ background: 'var(--ink-3)', border: studyCreateError && !studyRoomPassword.trim() ? '1px solid rgba(244,124,124,0.4)' : '1px solid var(--border)', borderRadius: '10px', padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', letterSpacing: '0.04em' }}
                    />
                    {studyCreateError && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red, #F47C7C)', letterSpacing: '0.04em' }}>{studyCreateError}</p>
                    )}
                    <button
                      onClick={async () => {
                        if (!studyRoomName.trim()) { setStudyCreateError('Room name is required.'); return }
                        if (!studyRoomPassword.trim()) { setStudyCreateError('Room password is required.'); return }
                        setStudyCreating(true)
                        setStudyCreateError(null)
                        try {
                          const res = await fetch('/api/rooms/create', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              articleSlug: article.slug, articleTitle: article.title,
                              roomName: studyRoomName.trim(),
                              topic: studyRoomTopic.trim() || undefined,
                              password: studyRoomPassword || undefined,
                            }),
                          })
                          if (res.ok) {
                            const { code } = await res.json()
                            setStudyRoomCode(code)
                            setStudyRoomLink(`${window.location.origin}/room/${code}`)
                          } else {
                            const d = await res.json().catch(() => ({}))
                            if (res.status === 409 && d.existingCode) {
                              setStudyCreateError(`You already have an active room. Join it at /room/${d.existingCode}`)
                            } else {
                              setStudyCreateError(d.error ?? 'Failed to create room.')
                            }
                          }
                        } finally {
                          setStudyCreating(false)
                        }
                      }}
                      disabled={studyCreating}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        padding: '0.875rem',
                        background: 'var(--gold-dim)', border: '1px solid var(--border-gold)', borderRadius: '14px',
                        color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em',
                        cursor: studyCreating ? 'default' : 'pointer', transition: 'opacity 0.15s',
                      }}
                    >
                      {studyCreating ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}>
                            <path d="M12 2a10 10 0 0 1 10 10" />
                          </svg>
                          Creating…
                        </>
                      ) : '+ Create Room'}
                    </button>
                  </div>
                )}

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>

                {/* Join existing room */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Room code row */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Enter room code…"
                      value={studyJoinCode}
                      onChange={e => {
                        setStudyJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                        setStudyJoinError(null)
                        setStudyJoinNeedsPassword(false)
                        setStudyJoinPassword('')
                      }}
                      onKeyDown={async e => {
                        if (e.key !== 'Enter' || !studyJoinCode || studyJoining) return
                        if (studyJoinNeedsPassword && !studyJoinPassword) return
                        doJoinRoom()
                      }}
                      style={{
                        flex: 1, background: 'var(--ink-3)',
                        border: studyJoinError ? '1px solid rgba(244,124,124,0.4)' : '1px solid var(--border)',
                        borderRadius: '10px', padding: '0.625rem 0.875rem',
                        fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em',
                        color: 'var(--text-primary)', outline: 'none',
                      }}
                    />
                    <button
                      onClick={doJoinRoom}
                      disabled={!studyJoinCode || studyJoining}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        padding: '0.625rem 1.25rem', borderRadius: '10px', flexShrink: 0,
                        background: studyJoinCode ? 'var(--ink-3)' : 'transparent',
                        border: '1px solid var(--border)',
                        color: studyJoinCode ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.06em',
                        cursor: studyJoinCode && !studyJoining ? 'pointer' : 'default', transition: 'all 0.15s',
                        minWidth: 80,
                      }}
                    >
                      {studyJoining ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                      ) : 'Join →'}
                    </button>
                  </div>

                  {/* Password field — shown when room requires it */}
                  {studyJoinNeedsPassword && (
                    <input
                      type="password"
                      placeholder="Room password…"
                      value={studyJoinPassword}
                      autoFocus
                      onChange={e => { setStudyJoinPassword(e.target.value); setStudyJoinError(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') doJoinRoom() }}
                      style={{
                        background: 'var(--ink-3)',
                        border: studyJoinError ? '1px solid rgba(244,124,124,0.4)' : '1px solid rgba(201,169,110,0.3)',
                        borderRadius: '10px', padding: '0.625rem 0.875rem',
                        fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em',
                        color: 'var(--text-primary)', outline: 'none',
                        animation: 'fadeIn 0.15s ease',
                      }}
                    />
                  )}

                  {studyJoinError && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', letterSpacing: '0.04em', animation: 'fadeIn 0.15s ease' }}>
                      {studyJoinError}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

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

            {/* "? Doubt" pill — animated, tooltip on hover */}
            <div
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
            </div>

          </div>{/* /left pills */}

          {/* Share article — icon-only, aligned with pills */}
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
              flexShrink: 0,
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
          </div>{/* /badges row */}

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

          {/* Wikipedia info box — person / species / notable entity */}
          <WikiInfoBox wikiUrl={article.wiki_url} articleTitle={article.title} />

          {/* Article body */}
          {isDesktopLayout ? (
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
                  {news.slice(0, 4).map((item, i, arr) => {
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
    </div>
  )
}
