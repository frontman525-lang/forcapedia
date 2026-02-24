'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAlert } from './Alert'
import { createClient } from '@/lib/supabase/client'
import type { NewsItem } from '@/app/api/news/route'

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

export default function ArticleView({ article }: { article: Article }) {
  const { showAlert } = useAlert()
  const supabase = createClient()
  const articleContentRef = useRef<HTMLDivElement | null>(null)
  const tocButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const activeSectionIdRef = useRef('')

  const [followUp, setFollowUp] = useState('')
  const [followUpResult, setFollowUpResult] = useState('')
  const [loadingFollowUp, setLoadingFollowUp] = useState(false)
  const [usedFollowUp, setUsedFollowUp] = useState(false)
  const [news, setNews] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [activeSectionId, setActiveSectionId] = useState('')
  const [isDesktopLayout, setIsDesktopLayout] = useState(false)

  const { html: contentWithAnchors, items: tocItems } = useMemo(
    () => buildArticleContentWithToc(article.content),
    [article.content],
  )

  useEffect(() => {
    fetch(`/api/news?topic=${encodeURIComponent(article.title)}`)
      .then(r => r.json())
      .then(d => setNews(d.items ?? []))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [article.title])

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

  useEffect(() => {
    activeSectionIdRef.current = activeSectionId
  }, [activeSectionId])

  useEffect(() => {
    const root = articleContentRef.current
    if (!root || tocItems.length === 0) return

    const headings = tocItems
      .map(item => document.getElementById(item.id))
      .filter((node): node is HTMLElement => !!node && root.contains(node))

    if (headings.length === 0) return

    const scrollTargets: Array<Window | HTMLElement> = [window]
    let parent: HTMLElement | null = root.parentElement
    while (parent) {
      const styles = window.getComputedStyle(parent)
      const isScrollable = /(auto|scroll)/.test(styles.overflowY)
      if (isScrollable && parent.scrollHeight > parent.clientHeight + 1) {
        scrollTargets.push(parent)
      }
      parent = parent.parentElement
    }

    let rafId = 0
    const runSpy = () => {
      rafId = 0

      // Keep activation near the top reading line (below fixed nav) for consistent, non-late switching.
      const activationLine = 120
      let nextActiveIndex = 0
      for (let i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= activationLine) {
          nextActiveIndex = i
          continue
        }
        break
      }

      const currentIndex = headings.findIndex(h => h.id === activeSectionIdRef.current)
      if (currentIndex !== -1 && Math.abs(nextActiveIndex - currentIndex) > 1) {
        nextActiveIndex = currentIndex + Math.sign(nextActiveIndex - currentIndex)
      }

      const nextActive = headings[nextActiveIndex]
      if (nextActive?.id) {
        setActiveSectionId(prev => (prev === nextActive.id ? prev : nextActive.id))
      }
    }

    const onScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(runSpy)
    }

    runSpy()
    window.addEventListener('resize', onScroll)
    for (const target of scrollTargets) {
      target.addEventListener('scroll', onScroll, { passive: true })
    }

    return () => {
      window.removeEventListener('resize', onScroll)
      for (const target of scrollTargets) {
        target.removeEventListener('scroll', onScroll as EventListener)
      }
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [tocItems, contentWithAnchors])

  const verifiedDate = new Date(article.verified_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const verifiedTime = new Date(article.verified_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  async function handleFollowUp(e: React.FormEvent) {
    e.preventDefault()
    if (!followUp.trim()) return

    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      showAlert('Sign in to ask follow-up questions.', 'warning')
      return
    }

    if (usedFollowUp) {
      showAlert('Free plan: 1 follow-up per article. Upgrade for unlimited.', 'warning')
      return
    }

    setLoadingFollowUp(true)
    try {
      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: followUp, articleSlug: article.slug }),
      })
      if (!res.ok) throw new Error()
      const { answer } = await res.json()
      setFollowUpResult(answer)
      setUsedFollowUp(true)
      showAlert('Answer generated and verified.', 'success')
    } catch {
      showAlert('Failed to get answer. Please try again.', 'error')
    } finally {
      setLoadingFollowUp(false)
    }
  }

  function scrollToSection(id: string) {
    const heading = document.getElementById(id)
    if (!heading) return
    setActiveSectionId(id)
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleTocWheel(e: React.WheelEvent<HTMLElement>) {
    const el = e.currentTarget
    const canScrollInside = el.scrollHeight > el.clientHeight + 1

    // If TOC content does not overflow, never trap wheel events.
    if (!canScrollInside) {
      window.scrollBy({ top: e.deltaY, behavior: 'auto' })
      e.preventDefault()
      return
    }

    const atTop = el.scrollTop <= 0
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    const scrollingUp = e.deltaY < 0
    const scrollingDown = e.deltaY > 0

    // If TOC is at an edge, continue scrolling the page.
    if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
      window.scrollBy({ top: e.deltaY, behavior: 'auto' })
      e.preventDefault()
    }
  }

  const hasToc = tocItems.length > 0
  const showDesktopToc = hasToc && isDesktopLayout
  const showMobileToc = hasToc && !isDesktopLayout

  useEffect(() => {
    if (!activeSectionId) return
    const target = tocButtonRefs.current[activeSectionId]
    if (!target) return
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeSectionId])

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
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--gold)',
                marginBottom: '0.9rem',
              }}
            >
              On this page
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {tocItems.map(item => (
                <button
                  key={item.id}
                  ref={node => {
                    tocButtonRefs.current[item.id] = node
                  }}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  style={{
                    textAlign: 'left',
                    border: 'none',
                    background: item.id === activeSectionId ? 'var(--gold-dim)' : 'transparent',
                    color: item.id === activeSectionId ? 'var(--gold)' : 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: item.level === 2 ? '13px' : '12px',
                    lineHeight: 1.45,
                    fontWeight: item.level === 2 ? 400 : 300,
                    padding: item.level === 2 ? '0.45rem 0.55rem' : '0.35rem 0.55rem 0.35rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (item.id !== activeSectionId) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (item.id !== activeSectionId) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-tertiary)'
                    }
                  }}
                >
                  {item.text}
                </button>
              ))}
            </div>
          </aside>
        )}

        <div style={{ minWidth: 0 }}>
          <div style={{ margin: 0, padding: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '2rem',
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
                    ref={node => {
                      tocButtonRefs.current[item.id] = node
                    }}
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

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
              }}
            >
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
                Verified {'\u00B7'} {verifiedDate} {'\u00B7'} {verifiedTime}
              </div>

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
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--border-gold)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-1 3v2H9v2h2v6h2V9h2V7h-2V5h-2z" />
                  </svg>
                  Wikipedia source
                </a>
              )}
            </div>

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
          </div>

          <div
            ref={articleContentRef}
            className="article-prose"
            style={{ margin: 0, padding: 0 }}
            dangerouslySetInnerHTML={{ __html: contentWithAnchors }}
          />

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
                          onMouseEnter={e => {
                            e.currentTarget.style.borderBottomColor = 'var(--gold)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderBottomColor = 'var(--border-gold)'
                          }}
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
                    const ageLabel = age < 1 ? 'just now' : age < 24 ? `${age}h ago` : `${Math.round(age / 24)}d ago`
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
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem',
                            textDecoration: 'none',
                            color: 'inherit',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '14px',
                              color: 'var(--text-primary)',
                              fontWeight: 300,
                              lineHeight: 1.4,
                              transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = 'var(--gold)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = 'var(--text-primary)'
                            }}
                          >
                            {item.title}
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              color: 'var(--text-tertiary)',
                              letterSpacing: '0.04em',
                            }}
                          >
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

          <div style={{ margin: '2rem 0 0', padding: 0 }}>
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                padding: '1.5rem',
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
                Ask a follow-up{' '}
                {usedFollowUp && (
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>{'\u00B7'} 1/1 used (free plan)</span>
                )}
              </p>

              {followUpResult && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    background: 'var(--gold-dim)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                    fontWeight: 300,
                  }}
                >
                  {followUpResult}
                </div>
              )}

              <form onSubmit={handleFollowUp} style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  value={followUp}
                  onChange={e => setFollowUp(e.target.value)}
                  placeholder="Ask anything about this topic\u2026"
                  disabled={loadingFollowUp || usedFollowUp}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '0.7rem 1rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    fontWeight: 300,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--border-gold)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                />
                <button
                  type="submit"
                  disabled={!followUp.trim() || loadingFollowUp || usedFollowUp}
                  style={{
                    padding: '0.7rem 1.25rem',
                    borderRadius: '10px',
                    border: 'none',
                    background:
                      !followUp.trim() || loadingFollowUp || usedFollowUp ? 'rgba(255,255,255,0.04)' : 'var(--gold)',
                    color:
                      !followUp.trim() || loadingFollowUp || usedFollowUp ? 'var(--text-tertiary)' : 'var(--ink)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: !followUp.trim() || loadingFollowUp || usedFollowUp ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  {loadingFollowUp ? '\u2026' : 'Ask'}
                </button>
              </form>

              {usedFollowUp && (
                <p
                  style={{
                    marginTop: '0.75rem',
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Upgrade to Tier 1 for unlimited follow-up questions.
                </p>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
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
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--gold)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                }}
              >
                &larr; Back to search
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
