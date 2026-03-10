'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ArticleView from './ArticleView'

interface Props { slug: string }

interface StreamMeta {
  title: string
  summary: string
  category: string
  tags: string[]
  sources: string[]
  content_date: string
}

export default function ArticleGenerator({ slug }: Props) {
  // ── 1. Read pending topic from sessionStorage ──────────────────
  // undefined = not yet read, null = not found, string = topic found
  const [topic, setTopic]       = useState<string | null | undefined>(undefined)
  const topicRef                = useRef<string | null>(null)

  useEffect(() => {
    if (topicRef.current !== null || topic !== undefined) return
    let t: string | null = null
    try { t = sessionStorage.getItem(`pending:${slug}`) } catch { /* private mode */ }
    if (t) { try { sessionStorage.removeItem(`pending:${slug}`) } catch { /* ignore */ } }
    topicRef.current = t ?? ''
    setTopic(t)
  }, [slug, topic])

  // ── 2. Streaming state ──────────────────────────────────────────
  const [meta,    setMeta]    = useState<StreamMeta | null>(null)
  const [content, setContent] = useState('')
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const contentRef  = useRef('')
  const flushRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef  = useRef(false)

  // ── 3. Start SSE stream once topic is known ────────────────────
  useEffect(() => {
    if (!topic) return            // null (not found) or undefined (not yet read)
    if (startedRef.current) return
    startedRef.current = true

    const ctrl = new AbortController()

    ;(async () => {
      try {
        const res = await fetch('/api/article/generate', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ topic, slug }),
          signal:  ctrl.signal,
        })

        if (!res.ok || !res.body) {
          const msg = await res.json().catch(() => ({}))
          setError((msg as { error?: string }).error ?? 'Failed to generate article.')
          return
        }

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let   buffer  = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            let ev: Record<string, unknown>
            try { ev = JSON.parse(line.slice(6)) } catch { continue }

            if (ev.type === 'meta') {
              setMeta({
                title:        String(ev.title        ?? ''),
                summary:      String(ev.summary      ?? ''),
                category:     String(ev.category     ?? ''),
                tags:         Array.isArray(ev.tags)    ? ev.tags    as string[] : [],
                sources:      Array.isArray(ev.sources) ? ev.sources as string[] : [],
                content_date: String(ev.content_date ?? ''),
              })
            } else if (ev.type === 'chunk') {
              contentRef.current += String(ev.html ?? '')
              // Batch DOM updates — flush at most every 50ms
              if (!flushRef.current) {
                flushRef.current = setTimeout(() => {
                  setContent(contentRef.current)
                  flushRef.current = null
                }, 50)
              }
            } else if (ev.type === 'done') {
              if (flushRef.current) { clearTimeout(flushRef.current); flushRef.current = null }
              setContent(contentRef.current)
              setDone(true)
            } else if (ev.type === 'error') {
              setError(String(ev.message ?? 'Generation failed.'))
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError('Connection lost. Please try again.')
        }
      }
    })()

    return () => { ctrl.abort() }
  }, [topic, slug])

  // ── 4. Render ──────────────────────────────────────────────────

  // Brief flash while reading sessionStorage (one microtask)
  if (topic === undefined) return null

  // Topic not found in sessionStorage — article truly doesn't exist
  if (!topic) {
    return (
      <div style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem', background: 'var(--ink)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '4rem 1.25rem', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 24 }}>
            Article not found.
          </p>
          <Link href="/search" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', borderRadius: 100, border: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em',
            color: 'var(--text-tertiary)', textDecoration: 'none',
          }}>
            ← Back to search
          </Link>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem', background: 'var(--ink)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '4rem 1.25rem', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#ef4444', marginBottom: 24 }}>
            {error}
          </p>
          <Link href="/search" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', borderRadius: 100, border: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em',
            color: 'var(--text-tertiary)', textDecoration: 'none',
          }}>
            ← Back to search
          </Link>
        </div>
      </div>
    )
  }

  // ── Always render ArticleView — skeleton placeholders show before meta arrives ──
  // React updates props in place when meta/content change — no unmount, no blink,
  // no intermediate standalone skeleton page.
  const now = new Date().toISOString()
  return (
    <ArticleView
      article={{
        id:          '',
        slug,
        title:       meta?.title    ?? '',
        content:     done ? contentRef.current : content,
        summary:     meta?.summary  ?? '',
        category:    meta?.category ?? '',
        tags:        meta?.tags     ?? [],
        sources:     meta?.sources  ?? [],
        verified_at: meta?.content_date || now,
        created_at:  meta?.content_date || now,
        wiki_url:    null,
        event_date:  meta?.content_date || null,
      }}
      isGenerating={!done}
    />
  )
}
