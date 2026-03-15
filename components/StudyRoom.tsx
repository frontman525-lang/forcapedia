'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPusher, ch } from '@/lib/soketi/client'
import WikiInfoBox from '@/components/WikiInfoBox'
import HelpfulButton from '@/components/HelpfulButton'
import { createClient } from '@/lib/supabase/client'
import type { PusherClient } from '@/lib/soketi/client'
import { AvatarWithBadge } from '@/components/BadgeMarker'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member {
  id: string; user_id: string; display_name: string
  avatar_color: string; is_host: boolean; is_observer: boolean
  left_at: string | null; kicked_at: string | null
  join_status?: string; badge?: string | null
}
interface NavEntry {
  id: string; article_slug: string; article_title: string; navigated_at: string
}
interface Article {
  slug: string; title: string; content: string; summary: string; category: string
  wiki_url?: string | null; verified_at?: string | null; created_at?: string | null
  event_date?: string | null; tags?: string[]; sources?: string[]
}
interface RelatedArticle { slug: string; title: string; summary: string; category: string }
interface FloatingReaction { id: string; emoji: string; x: number; y: number; label: string }
interface SharedExplain  { selectedText: string; explanation: string | null; isLoading: boolean; triggeredBy: string; color: string }
interface PendingHighlight { id: string; userId: string; displayName: string; avatarColor: string; text: string }
interface NavNotification { slug: string; title: string }
interface NavRequest      { requestId: string; userId: string; displayName: string; targetSlug: string; targetTitle: string }
interface SearchResult    { slug: string; title: string; category: string }
interface PendingAdmission { userId: string; displayName: string; avatarColor: string }

interface Room {
  id: string; code: string; host_id: string
  article_slug: string; article_title: string; max_members: number
  room_name?: string; topic?: string; password_hash?: string | null
  max_duration_seconds?: number | null; created_at?: string | null
}

interface ChatMessage {
  id: string; user_id: string; display_name: string
  avatar_color: string; content: string; kind: string; created_at: string
  pinned?: boolean; deleted_at?: string | null; badge?: string | null
}

interface CurrentUser { id: string; name: string; avatarColor: string; isHost: boolean; isObserver: boolean; tier: string; badge?: string | null }

interface SessionSummary {
  roomName: string; memberCount: number; memberNames: string[]
  articleTitles: string[]; doubtsResolved: number; messageCount: number
  durationSeconds: number
}

interface StudyRoomProps {
  roomCode: string; room: Room
  initialMembers: Member[]; initialMessages: ChatMessage[]
  initialNavHistory: NavEntry[]; initialArticle: Article
  currentUser: CurrentUser; initialHighlights: unknown[]
  isPending?: boolean; needsPassword?: boolean
}

const REACTIONS = ['🔥', '💯', '🤔', '❓']

// ── Rotating topic topics (same list as VerifiedCarousel) ─────────────────────
const EMPTY_TOPICS = [
  { title: 'Quantum Computing', category: 'Technology' },
  { title: 'Ancient Rome', category: 'History' },
  { title: 'Space Exploration', category: 'Science' },
  { title: 'Neuroscience', category: 'Science' },
  { title: 'Artificial Intelligence', category: 'Technology' },
  { title: 'Philosophy of Mind', category: 'Philosophy' },
  { title: 'Climate Science', category: 'Environment' },
  { title: 'Black Holes', category: 'Astronomy' },
  { title: 'Nuclear Fusion', category: 'Energy' },
  { title: 'CRISPR Gene Editing', category: 'Biology' },
  { title: 'Game Theory', category: 'Mathematics' },
  { title: 'Dark Matter', category: 'Physics' },
]

function MobileEmptyState({ onSearch }: { onSearch: () => void }) {
  // Start with static order (SSR-safe), shuffle on client after hydration
  const [topics, setTopics] = React.useState(EMPTY_TOPICS)
  const [active, setActive] = React.useState(0)
  const [prev, setPrev] = React.useState<number | null>(null)
  const [animating, setAnimating] = React.useState(false)
  const [hovering, setHovering] = React.useState(false)
  const ANIM_MS = 380

  // Shuffle only on client (after mount) to avoid hydration mismatch
  React.useEffect(() => {
    const a = [...EMPTY_TOPICS]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    setTopics(a)
  }, [])

  const advance = React.useCallback(() => {
    if (animating) return
    const next = (active + 1) % topics.length
    setPrev(active); setActive(next); setAnimating(true)
    setTimeout(() => { setPrev(null); setAnimating(false) }, ANIM_MS)
  }, [animating, active, topics.length])

  React.useEffect(() => {
    if (hovering) return
    const id = setInterval(advance, 3500)
    return () => clearInterval(id)
  }, [hovering, advance])

  const rowStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center',
    gap: '0.75rem', padding: '0 1rem',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: '1.25rem',
      paddingTop: '3rem',
    }}>
      <p style={{
        fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: 300,
        color: 'rgba(201,169,110,0.55)', margin: 0, letterSpacing: '0.02em',
      }}>
        Ready to explore?
      </p>

      {/* Card stack */}
      <div style={{ position: 'relative', width: 'min(340px, calc(100vw - 3rem))', paddingBottom: '10px', overflow: 'visible' }}>
        {/* Ghost depth cards */}
        <div style={{ position: 'absolute', top: '10px', left: '6%', right: '6%', height: '58px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', opacity: 0.45, zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '5px', left: '3%', right: '3%', height: '58px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', opacity: 0.65, zIndex: 1 }} />

        {/* Main card */}
        <div
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onClick={() => onSearch()}
          style={{
            position: 'relative', zIndex: 2, height: '58px', borderRadius: '14px',
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            border: `1px solid ${hovering ? 'rgba(201,169,110,0.35)' : 'rgba(255,255,255,0.10)'}`,
            boxShadow: hovering
              ? '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(201,169,110,0.05)'
              : '0 4px 20px rgba(0,0,0,0.3)',
            cursor: 'pointer', overflow: 'hidden',
            transform: hovering ? 'translateY(-2px)' : 'translateY(0)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
          }}
        >
          <style>{`
            @keyframes emptyExitUp { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-18px); } }
            @keyframes emptyEnterBelow { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
            @keyframes fadeInUp { from { opacity:0; transform:translateX(-50%) translateY(6px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
          `}</style>
          {prev !== null && (
            <div style={{ ...rowStyle, animation: `emptyExitUp ${ANIM_MS}ms ease forwards` }}>
              <EmptyTopicRow topic={topics[prev]} hovering={false} />
            </div>
          )}
          <div style={{ ...rowStyle, animation: animating ? `emptyEnterBelow ${ANIM_MS}ms ease forwards` : 'none' }}>
            <EmptyTopicRow topic={topics[active]} hovering={hovering} />
          </div>
        </div>
      </div>

    </div>
  )
}

function EmptyTopicRow({ topic, hovering }: { topic: { title: string; category: string }; hovering: boolean }) {
  return (
    <>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A96E', flexShrink: 0, opacity: hovering ? 1 : 0.5, transition: 'opacity 0.2s' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,237,232,0.35)', display: 'block', marginBottom: '3px' }}>
          {topic.category}
        </span>
        <p style={{ fontSize: '13px', fontWeight: 500, color: '#F0EDE8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, lineHeight: 1.4 }}>
          {topic.title}
        </p>
      </div>
    </>
  )
}

function containsBlocked(t: string) {
  return /https?:\/\/\S+|www\.\S+|\b\S+\.(com|net|org|io|co|in|uk)\b/gi.test(t) ||
         /\b\d{10,}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\+\d[\s\d\-]{9,}/g.test(t)
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, color: '#191919', flexShrink: 0,
      fontFamily: 'var(--font-sans, system-ui)',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// AvatarWithBadge is imported from BadgeMarker.tsx (corner marker SVG approach)

// ═════════════════════════════════════════════════════════════════════════════
// ── Audio helpers ─────────────────────────────────────────────────────────────
function playSound(type: 'send' | 'receive' | 'alert' | 'bell' | 'chime') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const g = ctx.createGain()
    g.connect(ctx.destination)

    if (type === 'send') {
      // WhatsApp-like send: short ascending swoosh (imperceptible latency)
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.connect(g)
      o.frequency.setValueAtTime(480, ctx.currentTime)
      o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08)
      g.gain.setValueAtTime(0.07, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      o.start(); o.stop(ctx.currentTime + 0.14)
    }

    if (type === 'receive') {
      // WhatsApp-like receive: soft two-tone chime
      const t = ctx.currentTime
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.connect(g)
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.connect(g)
      o1.frequency.value = 880
      o2.frequency.value = 1108
      g.gain.setValueAtTime(0.0, t)
      g.gain.linearRampToValueAtTime(0.1, t + 0.01)
      g.gain.setValueAtTime(0.1, t + 0.12)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      o1.start(t);     o1.stop(t + 0.14)
      o2.start(t + 0.14); o2.stop(t + 0.38)
    }

    if (type === 'alert') {
      // Join request: three-pulse alert
      const o = ctx.createOscillator(); o.type = 'sine'; o.connect(g)
      o.frequency.value = 660
      g.gain.setValueAtTime(0.12, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      o.start(); o.stop(ctx.currentTime + 0.3)
    }

    if (type === 'bell' || type === 'chime') {
      // AI explain / highlight: warm bell tone
      const o = ctx.createOscillator(); o.type = 'sine'; o.connect(g)
      o.frequency.setValueAtTime(1047, ctx.currentTime)
      o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12)
      g.gain.setValueAtTime(0.12, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      o.start(); o.stop(ctx.currentTime + 0.55)
    }
  } catch { /* ignore — AudioContext blocked before user interaction */ }
}

function getBadgeEmoji(badge: string | null | undefined): string {
  const map: Record<string, string> = { scholar: '✶', star: '★', science: '◈', bookworm: '◉', researcher: '◆', diamond: '◇', explorer: '▷', elite: '◐', legend: '✦' }
  return badge ? (map[badge] ?? '') : ''
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const S = 14 // default icon size
function IconBell({ size = S, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 2 .7 3.2 1.3 4H2.2c.6-.8 1.3-2 1.3-4A4.5 4.5 0 0 1 8 1.5Z"/>
      <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0"/>
      {muted && <line x1="2" y1="2" x2="14" y2="14" strokeWidth="1.6"/>}
    </svg>
  )
}
function IconChat({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H9l-3 3v-3H3.5A1.5 1.5 0 0 1 2 9.5Z"/>
    </svg>
  )
}
function IconBooks({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="4" height="10" rx="0.5"/>
      <rect x="6" y="2" width="4" height="12" rx="0.5"/>
      <path d="M11 5.5l3.5-1.5v9L11 14.5"/>
    </svg>
  )
}
function IconPin({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5 L14.5 6.5 L10 11 L8 9 L3.5 13.5"/>
      <path d="M5 11 L1 15"/>
      <path d="M9.5 1.5 L14.5 6.5 L11.5 9.5 L6.5 4.5 Z"/>
    </svg>
  )
}
function IconClose({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="3" y1="3" x2="13" y2="13"/>
      <line x1="13" y1="3" x2="3" y2="13"/>
    </svg>
  )
}
function IconSparkle({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v14M1 8h14M4.5 4.5l7 7M11.5 4.5l-7 7" strokeWidth="1.1" opacity="0.5"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function IconQuestion({ size = S }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5"/>
      <path d="M6 6a2 2 0 0 1 4 0c0 1.5-2 2-2 3.5"/>
      <circle cx="8" cy="12" r="0.6" fill="currentColor" stroke="none"/>
    </svg>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ── SelectionToolbar (separate component = separate React tree) ─────────────
// When this component calls setSelection, ONLY this component re-renders.
// The parent StudyRoom (and the article DOM inside it) are never touched,
// so the browser text selection is never disturbed.
// ═════════════════════════════════════════════════════════════════════════════
interface SelectionToolbarProps {
  chatSidebarRef: React.RefObject<HTMLElement | null>
  isHost: boolean
  isObserver: boolean
  explainLoading: boolean
  onExplain: (text: string) => void
  onHighlight: (text: string) => void
  onAsk: (text: string) => void
}

function SelectionToolbar({ chatSidebarRef, isHost, isObserver, explainLoading, onExplain, onHighlight, onAsk }: SelectionToolbarProps) {
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const tbRef = useRef<HTMLDivElement>(null)
  // Component-level refs — survive effect re-runs, match ExplainPanel.tsx exactly
  const pointerDownRef = useRef(false)
  const selectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isObserver) return

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    const checkSelection = () => {
      const s = window.getSelection()
      if (!s || s.isCollapsed || !s.rangeCount) { setSel(null); return }
      const text = s.toString().trim()
      if (text.length < 3) { setSel(null); return }
      const range = s.getRangeAt(0)
      // Ignore selections inside the chat sidebar
      if (chatSidebarRef.current?.contains(range.commonAncestorContainer)) { setSel(null); return }
      const rects = range.getClientRects()
      if (!rects.length) { setSel(null); return }
      const last = rects[rects.length - 1], first = rects[0]
      const TH = 40, M = 8
      // On mobile, the 54px bottom action bar eats into the available space.
      // Reserve that space so the toolbar never appears behind the bar.
      const reservedBottom = window.innerWidth < 768 ? 54 : 0
      const below = window.innerHeight - last.bottom - reservedBottom
      const y = below < TH + M + 8 ? Math.max(M, first.top - TH - M) : last.bottom + M
      const tbHalfW = 130 // approximate half-width of the toolbar pill
      const x = Math.max(tbHalfW + 8, Math.min(window.innerWidth - tbHalfW - 8, last.left + last.width / 2))
      setSel({ text, x, y })
    }

    // Matches ExplainPanel.tsx onPointerDown exactly
    const onPointerDown = (e: PointerEvent) => {
      // Dismiss toolbar when clicking outside it
      if (tbRef.current && !tbRef.current.contains(e.target as Node)) {
        setSel(null)
        // Don't removeAllRanges here — user may be starting a new selection
      }
      pointerDownRef.current = true
      if (selectionDebounceRef.current) {
        clearTimeout(selectionDebounceRef.current)
        selectionDebounceRef.current = null
      }
    }

    // Matches ExplainPanel.tsx onPointerUp exactly — 20ms delay
    const onPointerUp = () => {
      pointerDownRef.current = false
      setTimeout(checkSelection, 20)
    }

    // Matches ExplainPanel.tsx onTouchEnd exactly — 80ms delay
    const onTouchEnd = () => {
      pointerDownRef.current = false
      setTimeout(checkSelection, 80)
    }

    // Matches ExplainPanel.tsx onSelectionChange exactly
    const onSelectionChange = () => {
      if (pointerDownRef.current && !isTouch) return
      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current)
      selectionDebounceRef.current = setTimeout(checkSelection, isTouch ? 350 : 120)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('selectionchange', onSelectionChange)
      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current)
    }
  }, [isObserver, chatSidebarRef])

  const act = (fn: (t: string) => void) => {
    if (!sel) return
    const t = sel.text
    setSel(null)
    window.getSelection()?.removeAllRanges()
    fn(t)
  }

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '5px 12px', borderRadius: '100px', border: 'none',
    background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
    color: active ? '#22c55e' : 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.06em',
    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
  })

  return (
    <div ref={tbRef} style={{
      display: sel ? 'flex' : 'none', alignItems: 'center',
      position: 'fixed', left: sel?.x ?? -9999, top: sel?.y ?? -9999,
      transform: 'translateX(-50%)', zIndex: 9000,
      background: 'var(--ink-3)', border: '1px solid var(--border)',
      borderRadius: '100px', padding: '4px', gap: '2px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      animation: 'fadeIn 0.15s ease forwards',
    }}>
      {isHost && (
        <>
          <button onMouseDown={e => e.preventDefault()} onClick={() => act(onExplain)}
            disabled={explainLoading}
            style={btnStyle()}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <span style={{ fontSize: '10px', color: 'var(--gold)' }}>✦</span>
            {explainLoading ? 'Explaining…' : 'Explain'}
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
        </>
      )}
      {!isHost && !isObserver && (
        <>
          <button onMouseDown={e => e.preventDefault()} onClick={() => act(onAsk)}
            style={btnStyle()}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <IconQuestion size={11} /> Ask
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
        </>
      )}
      <button onMouseDown={e => e.preventDefault()} onClick={() => act(onHighlight)}
        style={btnStyle()}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        🖊 Highlight
      </button>
      <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={() => {
          if (!sel) return
          const t = sel.text
          navigator.clipboard.writeText(t).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }).catch(() => null)
        }}
        style={btnStyle(copied)}
        onMouseEnter={e => { if (!copied) { e.currentTarget.style.background = 'var(--gold-dim)'; e.currentTarget.style.color = 'var(--gold)' } }}
        onMouseLeave={e => { if (!copied) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function StudyRoom({
  roomCode, room, initialMembers, initialMessages,
  initialNavHistory, initialArticle, currentUser,
  isPending: isPendingProp = false, needsPassword = false,
}: StudyRoomProps) {
  const router  = useRouter()
  const pusherRef          = useRef<PusherClient | null>(null)
  const articleRef         = useRef<HTMLDivElement>(null)
  const articleViewRef     = useRef<HTMLDivElement>(null)    // wraps full article: title+summary+body
  const articleContainerRef = useRef<HTMLDivElement>(null)   // the scrollable article wrapper
  const chatSidebarRef     = useRef<HTMLElement>(null)       // chat sidebar — exclude from selection check
  const chatInputRef       = useRef<HTMLInputElement>(null)    // desktop chat input for focus
  const chatBottomRef      = useRef<HTMLDivElement>(null)
  const mobileMsgsRef      = useRef<HTMLDivElement>(null)  // mobile chat messages container
  const msgTsRef           = useRef<number[]>([]) // retained (harmless)
  const articleCacheRef    = useRef<Map<string, Article>>(new Map())
  const navDebounceRef     = useRef(0)
  const sessionEndedRef    = useRef(false)
  const timeWarnedRef      = useRef(false)
  const timeLimitHitRef    = useRef(false)
  const typingTimersRef    = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const typingDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [members,         setMembers]         = useState<Member[]>(initialMembers)
  const [messages,        setMessages]        = useState<ChatMessage[]>(initialMessages)
  const [navHistory,      setNavHistory]      = useState<NavEntry[]>(initialNavHistory)
  const [article,         setArticle]         = useState<Article>(initialArticle)
  const [reactions,       setReactions]       = useState<FloatingReaction[]>([])
  const [chatOpen,        setChatOpen]        = useState(false)
  const [chatExpanded,    setChatExpanded]    = useState(false)
  const [chatInput,       setChatInput]       = useState('')
  const [cooldownUntil,   setCooldownUntil]   = useState(0)

  const [sharedExplain,   setSharedExplain]   = useState<SharedExplain | null>(null)
  // navNotif removed (Follow Admin popup deleted — BUG 2)
  const [navRequest,      setNavRequest]      = useState<NavRequest | null>(null)
  const [sessionEnded,    setSessionEnded]    = useState(false)
  const [timeWarning,     setTimeWarning]     = useState(false)
  const [timeLimitHit,    setTimeLimitHit]    = useState(false)
  const [hostLeaveModal,  setHostLeaveModal]  = useState(false)
  const [searchOpen,      setSearchOpen]      = useState(false)
  const [searchQ,         setSearchQ]         = useState('')
  const [searchResults,   setSearchResults]   = useState<SearchResult[]>([])
  const [searchLoading,   setSearchLoading]   = useState(false)
  const [generating,      setGenerating]      = useState(false)
  const [generateError,   setGenerateError]   = useState('')
  const [articleLoading,  setArticleLoading]  = useState(false)
  const [streamMeta,      setStreamMeta]      = useState<{ title: string; summary: string; category: string; content_date: string } | null>(null)
  const [streamContent,   setStreamContent]   = useState('')
  const streamContentRef = useRef('')
  const streamMetaRef    = useRef<{ title: string; summary: string; category: string; content_date: string } | null>(null)
  const streamFlushRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamQueryRef   = useRef('')   // search query used as placeholder title before meta arrives
  const [closedTabSlugs, setClosedTabSlugs] = useState<Set<string>>(new Set())
  const [hoveredTab,     setHoveredTab]     = useState<string | null>(null)
  const [articleFading,  setArticleFading]  = useState(false)
  const tabsContainerRef                    = useRef<HTMLDivElement>(null)
  const [canScrollTabsLeft,  setCanScrollTabsLeft]  = useState(false)
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false)
  const [wikiSuggestions, setWikiSuggestions] = useState<{pageid: number; title: string; snippet: string}[]>([])
  const [wikiLoading,     setWikiLoading]     = useState(false)
  const wikiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isMobile,        setIsMobile]        = useState(false)
  const [explainLoading,  setExplainLoading]  = useState(false)
  const [chatError,       setChatError]       = useState('')
  const [typingNames,     setTypingNames]     = useState<string[]>([])
  const [transferModal,   setTransferModal]   = useState(false)

  // ── v2 state ───────────────────────────────────────────────────────────────
  const [pendingHighlights,  setPendingHighlights]  = useState<PendingHighlight[]>([])
  const [isPendingState,     setIsPendingState]     = useState(isPendingProp)
  const [passwordInput,      setPasswordInput]      = useState('')
  const [passwordError,      setPasswordError]      = useState('')
  const [passwordLoading,    setPasswordLoading]    = useState(false)
  const [pendingAdmissions,  setPendingAdmissions]  = useState<PendingAdmission[]>([])
  const [pinnedMessage,      setPinnedMessage]      = useState<ChatMessage | null>(null)
  const [activeTab,          setActiveTab]          = useState<'chat' | 'doubts'>('chat')
  const [unreadDoubts,       setUnreadDoubts]       = useState(0)
  const [doNotDisturb,       setDoNotDisturb]       = useState(false)
  const doNotDisturbRef  = useRef(false)
  const [sessionSummary,     setSessionSummary]     = useState<SessionSummary | null>(null)
  const [related,            setRelated]            = useState<RelatedArticle[]>([])
  const timerSpanRef         = useRef<HTMLSpanElement>(null)
  const [reconnecting,       setReconnecting]       = useState(false)
  const [upgradePopupDismissed, setUpgradePopupDismissed] = useState(false)
  const [closingRoom,        setClosingRoom]        = useState(false)
  const [navBlocked,         setNavBlocked]         = useState(false)
  const [codeCopied,         setCodeCopied]         = useState(false)
  const [emojiPickerOpen,    setEmojiPickerOpen]    = useState(false)
  // Persist session start time across page refreshes via localStorage
  const startTimeRef = useRef<number>((() => {
    try {
      const key = `room-start-${room.id}`
      const stored = localStorage.getItem(key)
      if (stored) return parseInt(stored, 10)
      const now = Date.now()
      localStorage.setItem(key, String(now))
      return now
    } catch { return Date.now() }
  })())

  /** Returns the current Pusher socket ID (to exclude self from broadcasts). */
  const socketId = () => pusherRef.current?.connection.socket_id

  /** Scroll chat to bottom — works for both desktop sidebar and mobile sheet */
  function scrollChatToBottom() {
    // Mobile: scroll the messages container div directly (position:fixed parent breaks scrollIntoView)
    if (mobileMsgsRef.current) {
      mobileMsgsRef.current.scrollTop = mobileMsgsRef.current.scrollHeight
      return
    }
    // Desktop sidebar: scrollIntoView works normally
    scrollChatToBottom()
  }

  // Prefetch chat page so navigation is instant
  useEffect(() => { router.prefetch(`/room/${roomCode}/chat`) }, [roomCode, router])

  // Keep DND ref in sync so Soketi closure always reads the latest value
  useEffect(() => { doNotDisturbRef.current = doNotDisturb }, [doNotDisturb])

  // Keep sessionEndedRef in sync for use in cleanup callbacks
  useEffect(() => { sessionEndedRef.current = sessionEnded }, [sessionEnded])

  // Ghost rooms are handled server-side: the cron (every 2 min) detects stale heartbeats
  // (>90s), marks the host as left, then transfers host or closes the room automatically.
  // Do NOT use beforeunload or useEffect cleanup here — both fire on page REFRESH, which
  // would accidentally close the room when the host simply reloads the page.

  // ── Mobile detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Scroll to top when chat opens on mobile so empty-state card stays visible
  useEffect(() => {
    if (chatOpen && isMobile && !article.content) {
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 60)
    }
  }, [chatOpen, isMobile, article.content])

  // ── Related articles — re-fetch whenever article changes ──────────────────
  useEffect(() => {
    setRelated([])
    if (!article.slug) return
    const supabase = createClient()
    async function fetchRelated() {
      // Tag overlap first (topic-smart), category fallback
      if (article.tags && article.tags.length > 0) {
        const { data: tagMatches } = await supabase
          .from('articles')
          .select('slug, title, summary, category')
          .overlaps('tags', article.tags)
          .neq('slug', article.slug)
          .limit(4)
        if (tagMatches && tagMatches.length > 0) { setRelated(tagMatches); return }
      }
      const { data: catMatches } = await supabase
        .from('articles')
        .select('slug, title, summary, category')
        .eq('category', article.category)
        .neq('slug', article.slug)
        .limit(3)
      setRelated(catMatches ?? [])
    }
    fetchRelated()
  }, [article.slug, article.category]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session timer + room-level time limit ────────────────────────────────────
  // max_duration_seconds is set at room creation based on host's tier (tier1=7200, tier2=18000).
  // The limit is measured from room.created_at so client UI aligns with cron enforcement.
  const roomCreatedAt = room.created_at ? new Date(room.created_at).getTime() : startTimeRef.current
  const timeLimitSeconds = room.max_duration_seconds ?? null
  useEffect(() => {
    function formatDur(s: number) {
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
      if (h > 0) return `${h}h ${m}m`
      if (m > 0) return `${m}m ${sec}s`
      return `${sec}s`
    }
    const id = setInterval(() => {
      if (sessionEndedRef.current) return
      // Display: personal session duration (stable across refreshes via localStorage)
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      if (timerSpanRef.current) {
        timerSpanRef.current.textContent = formatDur(elapsed)
      }
      // Limit: room age from created_at (aligns with cron enforcement)
      if (!timeLimitSeconds) return
      const roomAge = Math.floor((Date.now() - roomCreatedAt) / 1000)
      const remaining = timeLimitSeconds - roomAge
      // 5-minute warning (fires once)
      if (remaining <= 300 && remaining > 0 && !timeWarnedRef.current) {
        timeWarnedRef.current = true
        setTimeWarning(true)
      }
      // Limit reached — host explicitly closes; members see upgrade modal
      if (remaining <= 0 && !timeLimitHitRef.current) {
        timeLimitHitRef.current = true
        setTimeLimitHit(true)
        if (currentUser.isHost) closeRoom()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [timeLimitSeconds, roomCreatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync tab scroll arrows whenever nav history or closed tabs change
  useEffect(() => { syncTabsScroll() }, [navHistory.length, closedTabSlugs.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch fresh state from DB on mount ─────────────────────────────────────
  // This handles Fast Refresh remounts in dev (and ensures explains loaded from DB
  // on any remount, since initialMessages is stale server-rendered data)
  useEffect(() => {
    fetch(`/api/rooms/${roomCode}/state`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { members?: Member[]; messages?: ChatMessage[] } | null) => {
        if (d?.messages?.length) setMessages(d.messages)
        if (d?.members?.length) setMembers(d.members)
      })
      .catch(() => null)
  }, [roomCode])

  // ── Soketi Realtime ────────────────────────────────────────────────────────
  useEffect(() => {
    const pusher = getPusher()
    pusherRef.current = pusher

    // Connection state → reconnecting banner + re-hydrate on reconnect
    let wasReconnecting = false
    pusher.connection.bind('state_change', ({ current }: { current: string }) => {
      const isReconnecting = current === 'connecting' || current === 'unavailable'
      setReconnecting(isReconnecting)

      // Came back online after a disconnect — re-sync members and messages
      if (wasReconnecting && current === 'connected') {
        fetch(`/api/rooms/${roomCode}/state`)
          .then(r => r.ok ? r.json() : null)
          .then((d: { members?: Member[]; messages?: ChatMessage[] } | null) => {
            if (!d) return
            if (d.members) setMembers(d.members)
            if (d.messages) setMessages(d.messages)
          })
          .catch(() => null)
      }
      wasReconnecting = isReconnecting
    })

    // Subscribe to all 5 room channels
    const chatCh      = pusher.subscribe(ch.chat(roomCode))
    const doubtsCh    = pusher.subscribe(ch.doubts(roomCode))
    const articleCh   = pusher.subscribe(ch.article(roomCode))
    const admissionCh = pusher.subscribe(ch.admission(roomCode))
    const presenceCh  = pusher.subscribe(ch.presence(roomCode))

    // ── Chat channel ─────────────────────────────────────────────────────────
    chatCh.bind('message', (payload: ChatMessage) => {
      setMessages(prev => [...prev, payload])
      setTimeout(() => scrollChatToBottom(), 50)
      if (!doNotDisturbRef.current) playSound('receive')
    })
    chatCh.bind('reaction', (payload: { emoji: string; x: number; y: number; displayName: string }) => {
      const id = `${Date.now()}-${Math.random()}`
      setReactions(prev => [...prev, { id, emoji: payload.emoji, x: payload.x, y: payload.y, label: payload.displayName }])
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000)
    })
    chatCh.bind('typing', (payload: { userId: string; displayName: string }) => {
      if (payload.userId === currentUser.id) return // don't show own typing indicator
      setTypingNames(prev => prev.includes(payload.displayName) ? prev : [...prev, payload.displayName])
      if (typingTimersRef.current[payload.userId]) clearTimeout(typingTimersRef.current[payload.userId])
      typingTimersRef.current[payload.userId] = setTimeout(() => {
        setTypingNames(prev => prev.filter(n => n !== payload.displayName))
      }, 3000)
    })
    chatCh.bind('pin_message', (payload: { pinned: boolean; message: ChatMessage | null }) => {
      setPinnedMessage(payload.pinned ? payload.message : null)
      if (payload.pinned && !doNotDisturb) playSound('receive')
    })
    chatCh.bind('delete_message', (payload: { messageId: string }) => {
      setMessages(prev => prev.map(m => m.id === payload.messageId ? { ...m, deleted_at: new Date().toISOString() } : m))
    })

    // ── Doubts channel ────────────────────────────────────────────────────────
    doubtsCh.bind('message', (payload: ChatMessage) => {
      setMessages(prev => [...prev, payload])
      setUnreadDoubts(prev => prev + 1)
      setTimeout(() => scrollChatToBottom(), 50)
      if (!doNotDisturbRef.current) playSound('chime')
    })
    doubtsCh.bind('explain_shared', (payload: { selectedText: string; explanation: string; triggeredBy: string; color: string; userId: string }) => {
      // Show the floating shared-explain panel only — do NOT add to messages list here.
      // When the sender clicks "Share with Chat" the explain arrives via chatCh 'message'
      // and is added there. Adding it here too causes duplicates AND the old slice(-19)
      // wiped the entire chat history whenever anyone generated an explain.
      setSharedExplain({ ...payload, explanation: payload.explanation, isLoading: false })
      if (!doNotDisturbRef.current) playSound('bell')
    })

    // ── Article channel ───────────────────────────────────────────────────────
    articleCh.bind('navigate', (payload: { slug: string; title: string }) => {
      fetchArticle(payload.slug)
      // navNotif popup removed — members navigate silently with the host
    })
    articleCh.bind('nav_request', (payload: NavRequest) => {
      if (currentUser.isHost) setNavRequest(payload)
    })
    // scroll sync removed — members can scroll independently

    // ── Admission channel ─────────────────────────────────────────────────────
    admissionCh.bind('highlight_request', (payload: PendingHighlight) => {
      if (!currentUser.isHost) return
      if (!doNotDisturbRef.current) playSound('alert')
      setPendingHighlights(prev => prev.some(h => h.id === payload.id) ? prev : [...prev, payload])
    })
    admissionCh.bind('join_request', (payload: PendingAdmission) => {
      if (!currentUser.isHost) return
      if (!doNotDisturbRef.current) playSound('alert')
      setPendingAdmissions(prev => prev.some(p => p.userId === payload.userId) ? prev : [...prev, payload])
    })
    admissionCh.bind('admit_approved', (payload: { userId: string }) => {
      if (payload.userId === currentUser.id) {
        // Reload the page so the server re-renders with join_status: 'approved'
        // This is the most reliable path — no race conditions or stale state.
        router.refresh()
        setIsPendingState(false)
        return
      }
      setMembers(prev => prev.map(m => m.user_id === payload.userId ? { ...m, join_status: 'approved' } : m))
    })
    admissionCh.bind('admit_rejected', (payload: { userId: string }) => {
      if (payload.userId === currentUser.id) setSessionEnded(true)
    })
    admissionCh.bind('member_kicked', (payload: { userId: string }) => {
      if (payload.userId === currentUser.id) { setSessionEnded(true); return }
      setMembers(prev => prev.filter(m => m.user_id !== payload.userId))
    })
    admissionCh.bind('room_closed', (payload: { summary?: SessionSummary }) => {
      if (payload?.summary) setSessionSummary(payload.summary)
      setSessionEnded(true)
    })
    admissionCh.bind('host_transferred', (payload: { newHostId: string; newHostName: string }) => {
      setMembers(prev => prev.map(m => ({ ...m, is_host: m.user_id === payload.newHostId })))
      if (payload.newHostId === currentUser.id) window.location.reload()
    })
    admissionCh.bind('member_joined', (payload: Member) => {
      setMembers(prev => prev.some(m => m.user_id === payload.user_id) ? prev : [...prev, payload])
    })
    admissionCh.bind('badge_changed', (payload: { userId: string; badge: string | null }) => {
      setMembers(prev => prev.map(m => m.user_id === payload.userId ? { ...m, badge: payload.badge } : m))
    })

    // ── Presence channel ──────────────────────────────────────────────────────
    presenceCh.bind('member_online', (payload: { userId: string }) => {
      setMembers(prev => prev.map(m => m.user_id === payload.userId ? { ...m, _online: true } as Member : m))
    })

    // ── Heartbeat every 20s ───────────────────────────────────────────────────
    const heartbeat = setInterval(() => {
      fetch(`/api/rooms/${roomCode}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socketId: pusher.connection.socket_id }),
      }).catch(() => null)
    }, 20_000)

    return () => {
      clearInterval(heartbeat)
      pusher.connection.unbind('state_change')
      pusher.unsubscribe(ch.chat(roomCode))
      pusher.unsubscribe(ch.doubts(roomCode))
      pusher.unsubscribe(ch.article(roomCode))
      pusher.unsubscribe(ch.admission(roomCode))
      pusher.unsubscribe(ch.presence(roomCode))
    }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Text selection handled by <SelectionToolbar> (separate component) ──────

  // ── NOTE: No auto-leave on unmount or beforeunload ────────────────────────
  // beforeunload and React cleanup both fire on page REFRESH, which would
  // accidentally close the room. Rooms close only via explicit Leave button.
  // Presence is detected via the 20s heartbeat (a stopped heartbeat = disconnected).

  // ── Back button trap (host only) ─────────────────────────────────────────
  useEffect(() => {
    if (!currentUser.isHost || sessionEnded) return
    // Push a dummy state so back has something to pop
    window.history.pushState({ studyRoom: roomCode }, '')

    function handlePopState() {
      // Show modal and push state again to prevent navigation
      setHostLeaveModal(true)
      window.history.pushState({ studyRoom: roomCode }, '')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentUser.isHost, sessionEnded, roomCode])

  // ── Scroll chat to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    scrollChatToBottom()
  }, [messages.length])

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function fetchArticle(slug: string) {
    // Instant switch if already cached
    const cached = articleCacheRef.current.get(slug)
    if (cached) {
      setArticle(cached)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setArticleLoading(true)
    try {
      const res = await fetch(`/api/article?slug=${encodeURIComponent(slug)}`)
      if (res.ok) {
        const data = await res.json()
        articleCacheRef.current.set(slug, data)
        setArticle(data)
        setNavHistory(prev => [...prev, { id: Date.now().toString(), article_slug: slug, article_title: data.title, navigated_at: new Date().toISOString() }])
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch { /* ignore */ } finally {
      setArticleLoading(false)
    }
  }

  // FIX 2: Instant tab switch — reads from cache, no await, broadcasts in background
  function switchToTab(slug: string, title: string) {
    if (slug === article.slug) return
    setArticleFading(true)
    setTimeout(() => {
      const cached = articleCacheRef.current.get(slug)
      if (cached) {
        setArticle(cached)
      } else {
        fetchArticle(slug)   // will show loading skeleton; caches on arrival
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setArticleFading(false)
      // Broadcast to other members — fire and forget, never block UI
      if (currentUser.isHost) {
        fetch(`/api/rooms/${roomCode}/navigate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleSlug: slug, articleTitle: title, socketId: socketId() }),
        }).catch(() => {})
      }
    }, 80)
  }

  // FIX 3: Close tab — if closing active tab, switch to adjacent one first
  function closeTab(slug: string, currentTabs: { article_slug: string; article_title: string }[], e: React.MouseEvent) {
    e.stopPropagation()
    if (slug === article.slug) {
      const others = currentTabs.filter(t => t.article_slug !== slug)
      if (others.length > 0) switchToTab(others[others.length - 1].article_slug, others[others.length - 1].article_title)
    }
    setClosedTabSlugs(prev => new Set([...prev, slug]))
    setHoveredTab(null)
  }

  // Core send — used by both the chat input and Share with Chat
  async function sendRawMessage(text: string, kind: string) {
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: ChatMessage = {
      id: tempId, user_id: currentUser.id,
      display_name: currentUser.name, avatar_color: currentUser.avatarColor,
      content: text, kind, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    if (!doNotDisturb) playSound('send')
    setTimeout(() => scrollChatToBottom(), 50)

    const res = await fetch(`/api/rooms/${roomCode}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, kind, socketId: socketId() }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => prev.map(m => m.id === tempId ? msg : m))
    } else {
      const d = await res.json().catch(() => ({}))
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setChatError(d.error ?? 'Failed to send message.')
    }
  }

  async function sendMessage() {
    if (!chatInput.trim() || currentUser.isObserver) return
    const isExplainMessage = chatInput.includes('**AI Answer:**')
    if (!isExplainMessage && containsBlocked(chatInput)) { setChatError('Links and phone numbers are not allowed.'); return }

    // Rate limit: 30 messages per 60s → 30s cooldown. Host is always exempt.
    if (!currentUser.isHost) {
      const now = Date.now()
      const recent = msgTsRef.current.filter(t => now - t < 60_000)
      if (now < cooldownUntil) {
        setChatError(`Slow down — ${Math.ceil((cooldownUntil - now) / 1000)}s cooldown.`)
        return
      }
      if (recent.length >= 30) {
        setCooldownUntil(now + 30_000)
        setChatError('Too many messages — 30s cooldown.')
        return
      }
      msgTsRef.current = [...recent, now]
    }
    setChatError('')

    const kind = activeTab === 'doubts' ? 'doubt' : 'text'
    const text = chatInput.trim()
    setChatInput('')
    await sendRawMessage(text, kind)
  }

  async function triggerSharedExplain(capturedText: string) {
    if (!capturedText || explainLoading) return
    const capturedColor = currentUser.avatarColor

    setExplainLoading(true)

    // ── Open panel IMMEDIATELY with loading skeleton — zero perceived delay ──
    setSharedExplain({
      selectedText: capturedText,
      explanation:  null,        // null = skeleton loading state
      isLoading:    true,
      triggeredBy:  currentUser.name,
      color:        capturedColor,
    })

    try {
      const res = await fetch(`/api/rooms/${roomCode}/highlight`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedText: capturedText, withExplain: true, socketId: socketId() }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        // Show server error inline (e.g. "Host's daily explain limit reached.")
        setSharedExplain(prev => prev ? {
          ...prev,
          explanation: body.error ?? 'Could not generate explanation. Please try again.',
          isLoading: false,
        } : null)
        return
      }

      const { explanation } = body
      setSharedExplain(prev => prev ? {
        ...prev,
        explanation: explanation ?? 'No explanation was generated.',
        isLoading: false,
      } : null)

    } catch {
      setSharedExplain(prev => prev ? {
        ...prev,
        explanation: 'Network error. Could not generate explanation.',
        isLoading: false,
      } : null)
    } finally {
      setExplainLoading(false)
    }
  }

  async function highlightOnly(capturedText: string) {
    if (!capturedText) return

    const isPaid = currentUser.tier === 'tier1' || currentUser.tier === 'tier2'

    if (isPaid) {
      // ── Paid users: instant broadcast to Doubts ──────────────────────────
      const tempId = `temp-hl-${Date.now()}`
      const hlMsg: ChatMessage = {
        id: tempId, user_id: currentUser.id,
        display_name: currentUser.name, avatar_color: currentUser.avatarColor,
        content: capturedText.slice(0, 500), kind: 'doubt',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, hlMsg])
      setActiveTab('doubts')
      setUnreadDoubts(0)
      if (!doNotDisturb) playSound('chime')

      const res = await fetch(`/api/rooms/${roomCode}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: capturedText.slice(0, 500), kind: 'doubt', socketId: socketId() }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages(prev => prev.map(m => m.id === tempId ? msg : m))
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }

      // Also store in room_highlights table
      fetch(`/api/rooms/${roomCode}/highlight`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedText: capturedText, withExplain: false }),
      }).catch(() => null)

    } else {
      // ── Free users: send to host for approval via admission channel ───────
      const hlId = `hl-${Date.now()}`
      const res = await fetch(`/api/rooms/${roomCode}/highlight`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: capturedText, withExplain: false,
          requiresApproval: true, highlightId: hlId,
        }),
      }).catch(() => null)

      // Show "Sent for host review" feedback to the user (brief, non-blocking)
      setSharedExplain({
        selectedText: capturedText,
        explanation: '📋 Sent to host for review. They will share it with the room if approved.',
        isLoading: false,
        triggeredBy: currentUser.name,
        color: currentUser.avatarColor,
      })
      // Auto-dismiss this confirmation (it's not an explain result, just a toast)
      setTimeout(() => setSharedExplain(null), 5000)
      void res
    }
  }

  async function sendDoubt(text: string) {
    if (!text) return
    const res = await fetch(`/api/rooms/${roomCode}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, kind: 'doubt', socketId: socketId() }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => [...prev, msg])
      setActiveTab('doubts')
      setUnreadDoubts(0)
    }
  }

  function sendReaction(emoji: string) {
    const x = 50 + Math.random() * 30
    const y = 50 + Math.random() * 30
    fetch(`/api/rooms/${roomCode}/reaction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, x, y, displayName: currentUser.name, socketId: socketId() }),
    })
    const id = `${Date.now()}-${Math.random()}`
    setReactions(prev => [...prev, { id, emoji, x, y, label: currentUser.name }])
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000)
  }

  async function searchArticles(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    const res = await fetch(`/api/rooms/search-articles?q=${encodeURIComponent(q)}`).catch(() => null)
    if (res?.ok) {
      const data = await res.json()
      setSearchResults(data.results ?? [])
    }
    setSearchLoading(false)
  }

  function fetchWikiSuggestions(q: string) {
    if (wikiDebounceRef.current) clearTimeout(wikiDebounceRef.current)
    if (!q.trim()) { setWikiSuggestions([]); setWikiLoading(false); return }
    setWikiLoading(true)
    wikiDebounceRef.current = setTimeout(async () => {
      try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search` +
          `&srsearch=${encodeURIComponent(q.trim())}&srlimit=10&format=json&origin=*`
        const res = await fetch(url)
        const data = await res.json()
        setWikiSuggestions(data?.query?.search ?? [])
      } catch { setWikiSuggestions([]) }
      finally  { setWikiLoading(false) }
    }, 300)
  }

  // Generate a brand-new article (via the same pipeline as the main search page)
  // then load it in the room and broadcast to all members.
  async function generateAndNavigate(query: string) {
    if (generating) return  // prevent double-click
    streamQueryRef.current = query  // placeholder title before meta arrives
    setGenerating(true)
    setGenerateError('')
    // Close search panel immediately so the streaming view in the article panel
    // is visible right away — no "generating box" intermediate state.
    setSearchOpen(false)
    setSearchQ('')
    setSearchResults([])
    setWikiSuggestions([])
    streamContentRef.current = ''
    setStreamMeta(null)
    setStreamContent('')
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setGenerateError(body.error ?? 'Failed to generate article.')
        return
      }
      const data = await res.json()
      const { slug } = data

      // Article already exists in DB — fetch full data, stop generating, then broadcast
      if (!data.streaming) {
        await fetchArticle(slug)
        setGenerating(false)   // stop generating as soon as article data is loaded
        const artTitle = articleCacheRef.current.get(slug)?.title ?? slug
        await fetch(`/api/rooms/${roomCode}/navigate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleSlug: slug, articleTitle: artTitle, socketId: socketId() }),
        })
        setSearchOpen(false)
        setSearchQ('')
        setSearchResults([])
        return
      }

      if (data.streaming) {

        const genRes = await fetch('/api/article/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: data.topic, slug }),
        })
        if (!genRes.ok) {
          const d = await genRes.json().catch(() => ({}))
          setGenerateError(d.error ?? 'Failed to generate article.')
          setStreamMeta(null); setStreamContent('')
          return
        }

        const reader = genRes.body!.getReader()
        const decoder = new TextDecoder()
        let lineBuffer = ''
        let generated = false
        outer: while (true) {
          let chunk: ReadableStreamReadResult<Uint8Array>
          try { chunk = await reader.read() } catch { break }
          if (chunk.done) break
          lineBuffer += decoder.decode(chunk.value, { stream: true })
          const lines = lineBuffer.split('\n')
          lineBuffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const ev = JSON.parse(line.slice(6))
              if (ev.type === 'meta') {
                const m = { title: ev.title ?? '', summary: ev.summary ?? '', category: ev.category ?? '', content_date: ev.content_date ?? '' }
                streamMetaRef.current = m
                setStreamMeta(m)
              } else if (ev.type === 'chunk') {
                streamContentRef.current += ev.html
                if (!streamFlushRef.current) {
                  streamFlushRef.current = setTimeout(() => {
                    setStreamContent(streamContentRef.current)
                    streamFlushRef.current = null
                  }, 50)
                }
              } else if (ev.type === 'done') {
                if (streamFlushRef.current) { clearTimeout(streamFlushRef.current); streamFlushRef.current = null }
                setStreamContent(streamContentRef.current)
                generated = true; break outer
              } else if (ev.type === 'error') {
                setGenerateError(ev.message ?? 'Generation failed.')
                setStreamMeta(null); setStreamContent('')
                return
              }
            } catch { /* malformed SSE line */ }
          }
        }
        if (!generated) {
          setGenerateError('Generation did not complete. Please try again.')
          setStreamMeta(null); setStreamContent('')
          return
        }
      }

      // Build article immediately from streamed content — avoids any blank flash.
      // The content HTML is IDENTICAL to what was streaming, so the visual switch
      // from streaming view → article view shows the same text with no blink.
      const now = new Date().toISOString()
      const streamedArticle: Article = {
        slug,
        title:       streamMetaRef.current?.title    ?? '',
        content:     streamContentRef.current,
        summary:     streamMetaRef.current?.summary  ?? '',
        category:    streamMetaRef.current?.category ?? '',
        wiki_url:    null,
        verified_at: now,
        event_date:  streamMetaRef.current?.content_date || null,
        tags:        [],
      }

      // Atomically: clear streaming states + set article + stop generating in one React render pass
      // This prevents the intermediate blank state (generating=true, streamMeta=null, streamContent='')
      setStreamMeta(null)
      setStreamContent('')
      setArticle(streamedArticle)
      setGenerating(false)
      setNavHistory(prev => [...prev, {
        id: Date.now().toString(),
        article_slug: slug,
        article_title: streamedArticle.title,
        navigated_at: now,
      }])
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Record + broadcast navigation (server triggers Soketi, excludes host via socketId)
      await fetch(`/api/rooms/${roomCode}/navigate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleSlug: slug, articleTitle: streamedArticle.title, socketId: socketId() }),
      })

      setSearchOpen(false)
      setSearchQ('')
      setSearchResults([])
    } catch {
      setGenerateError('Network error. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function hostNavigateTo(slug: string, title: string) {
    setSearchOpen(false)
    await fetch(`/api/rooms/${roomCode}/navigate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleSlug: slug, articleTitle: title, socketId: socketId() }),
    })
    fetchArticle(slug)
  }

  async function kickMember(targetUserId: string) {
    await fetch(`/api/rooms/${roomCode}/kick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    })
    setMembers(prev => prev.filter(m => m.user_id !== targetUserId))
  }

  async function closeRoom() {
    setClosingRoom(true)
    try {
      const res = await fetch(`/api/rooms/${roomCode}/close`, { method: 'POST' })
      const data = res.ok ? await res.json().catch(() => ({})) : {}
      const summary = data.summary ?? null
      if (summary) setSessionSummary(summary)
      setSessionEnded(true)
    } finally {
      setClosingRoom(false)
    }
  }

  async function admitMember(userId: string, approved: boolean) {
    setPendingAdmissions(prev => prev.filter(p => p.userId !== userId))
    await fetch(`/api/rooms/${roomCode}/admit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, approved }),
    })
    if (approved) {
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, join_status: 'approved' } : m))
    }
  }

  async function pinMessage(msg: ChatMessage, pinned: boolean) {
    await fetch(`/api/rooms/${roomCode}/pin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id, pinned, message: pinned ? msg : null, socketId: socketId() }),
    })
    setPinnedMessage(pinned ? msg : null)
    setMessages(prev => prev.map(m => ({ ...m, pinned: m.id === msg.id ? pinned : false })))
  }

  async function deleteMessage(messageId: string) {
    await fetch(`/api/rooms/${roomCode}/delete-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, socketId: socketId() }),
    })
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m))
  }

  async function submitPassword() {
    if (!passwordInput.trim()) return
    setPasswordLoading(true)
    setPasswordError('')
    try {
      const res = await fetch(`/api/rooms/${roomCode}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      })
      if (res.ok) {
        window.location.reload()
      } else {
        const d = await res.json()
        setPasswordError(d.error === 'WRONG_PASSWORD' ? 'Incorrect password.' : d.error ?? 'Failed to join.')
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  function formatDuration(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
  }

  async function transferHost(newHostId: string) {
    const res = await fetch(`/api/rooms/${roomCode}/transfer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newHostId }),
    })
    if (res.ok) {
      setHostLeaveModal(false)
      await fetch(`/api/rooms/${roomCode}/leave`, { method: 'POST' })
      router.push('/study')
    }
  }

  function approveNavRequest() {
    if (!navRequest) return
    hostNavigateTo(navRequest.targetSlug, navRequest.targetTitle)
    setNavRequest(null)
  }

  // ── PASSWORD GATE ─────────────────────────────────────────────────────────
  if (needsPassword && !isPendingState) {
    return (
      <div style={{ minHeight: 'var(--app-h)', background: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: 'min(380px,100%)', background: 'rgba(30,28,26,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '2rem' }}>
          <p style={{ fontFamily: 'Georgia,serif', fontSize: '1.5rem', fontWeight: 300, color: '#F0EDE8', marginBottom: '0.4rem' }}>Password required</p>
          <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.4)', marginBottom: '1.25rem' }}>This room is password-protected.</p>
          <input
            type="password" value={passwordInput} onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
            onKeyDown={e => { if (e.key === 'Enter') submitPassword() }}
            placeholder="Enter room password…" autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: passwordError ? '1px solid rgba(244,124,124,0.5)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#F0EDE8', fontSize: '14px', padding: '0.6rem 0.8rem', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem' }}
          />
          {passwordError && <p style={{ fontSize: '12px', color: '#F47C7C', marginBottom: '0.75rem' }}>{passwordError}</p>}
          <button onClick={submitPassword} disabled={passwordLoading} style={{ width: '100%', padding: '0.7rem', background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', color: '#C9A96E', fontSize: '14px', cursor: 'pointer' }}>
            {passwordLoading ? 'Joining…' : 'Join Room →'}
          </button>
        </div>
      </div>
    )
  }

  // ── PENDING APPROVAL SCREEN ───────────────────────────────────────────────
  if (isPendingState) {
    return (
      <div style={{ minHeight: 'var(--app-h)', background: '#191919', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F7C97E', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <p style={{ fontFamily: 'Georgia,serif', fontSize: '1.75rem', fontWeight: 300, color: '#F0EDE8' }}>Waiting for approval</p>
        <p style={{ fontSize: '14px', color: 'rgba(240,237,232,0.45)', textAlign: 'center', maxWidth: 320 }}>
          The host will admit you shortly. Please stay on this page.
        </p>
        <style>{`@keyframes pulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.4)} }`}</style>
      </div>
    )
  }

  // ── SESSION ENDED SCREEN ──────────────────────────────────────────────────
  if (sessionEnded) {
    return (
      <div style={{ minHeight: 'var(--app-h)', background: '#191919', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem' }}>
        {sessionSummary ? (
          <div style={{ width: 'min(480px,100%)', background: 'rgba(30,28,26,0.98)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: '20px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontFamily: 'Georgia,serif', fontSize: '1.5rem', fontWeight: 300, color: '#F0EDE8', marginBottom: '0.25rem' }}>Session complete</p>
            <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#C9A96E', letterSpacing: '0.08em' }}>{sessionSummary.roomName}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { label: 'Duration',      value: formatDuration(sessionSummary.durationSeconds) },
                { label: 'Members',       value: String(sessionSummary.memberCount) },
                { label: 'Messages',      value: String(sessionSummary.messageCount) },
                { label: 'AI Explains',   value: String(sessionSummary.doubtsResolved) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem' }}>
                  <p style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(240,237,232,0.4)', marginBottom: '0.25rem' }}>{label}</p>
                  <p style={{ fontSize: '20px', fontWeight: 600, color: '#F0EDE8' }}>{value}</p>
                </div>
              ))}
            </div>
            {sessionSummary.articleTitles?.length > 0 && (
              <div>
                <p style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(240,237,232,0.4)', marginBottom: '0.4rem' }}>ARTICLES COVERED</p>
                {sessionSummary.articleTitles.map((t, i) => (
                  <p key={i} style={{ fontSize: '12px', color: 'rgba(240,237,232,0.65)', padding: '2px 0' }}>• {t}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontFamily: 'Georgia,serif', fontSize: '2rem', fontWeight: 300, color: '#F0EDE8' }}>Session ended</p>
        )}
        <Link href="/" style={{ marginTop: '0.5rem', padding: '0.6rem 1.5rem', background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', color: '#C9A96E', textDecoration: 'none', fontSize: '14px' }}>
          Start a new session →
        </Link>
      </div>
    )
  }

  // ── ACTIVE members (excluding those who left without kicking) ─────────────
  const activeMembers = members.filter(m => !m.kicked_at && !m.left_at)

  // ── TABS — derived from navHistory, deduped, excluding closed ones ─────────
  const tabs = (() => {
    const seen = new Set<string>()
    return navHistory
      .filter(e => !closedTabSlugs.has(e.article_slug))
      .filter(e => { if (seen.has(e.article_slug)) return false; seen.add(e.article_slug); return true })
  })()
  const hasTabs = tabs.length >= 1

  // FIX 4: Convert vertical wheel to horizontal scroll on tab bar
  function handleTabsWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!tabsContainerRef.current) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault()
      tabsContainerRef.current.scrollLeft += e.deltaY
    }
    syncTabsScroll()
  }

  function syncTabsScroll() {
    const el = tabsContainerRef.current
    if (!el) return
    setCanScrollTabsLeft(el.scrollLeft > 4)
    setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  function scrollTabsBy(px: number) {
    const el = tabsContainerRef.current
    if (!el) return
    el.scrollBy({ left: px, behavior: 'smooth' })
    // sync after animation
    setTimeout(syncTabsScroll, 320)
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: 'var(--app-h)', background: '#191919' }}>

      {/* ── TIME WARNING BANNER ───────────────────────────────────────────── */}
      {timeWarning && !timeLimitHit && !sessionEnded && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
          background: 'rgba(244,124,124,0.12)', borderBottom: '1px solid rgba(244,124,124,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
          padding: '6px 1rem', backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#F47C7C', letterSpacing: '0.06em' }}>
            5 minutes remaining in your session
          </span>
          {currentUser.tier !== 'tier2' && (
            <a href="/pricing" target="_blank" rel="noopener" style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#C9A96E',
              letterSpacing: '0.08em', textDecoration: 'none',
              background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)',
              borderRadius: '100px', padding: '2px 10px',
            }}>Upgrade →</a>
          )}
          <button onClick={() => setTimeWarning(false)} style={{
            background: 'none', border: 'none', color: 'rgba(244,124,124,0.5)',
            cursor: 'pointer', padding: '0 2px', fontSize: '12px',
          }}>✕</button>
        </div>
      )}

      {/* ── TIME LIMIT UPGRADE MODAL ──────────────────────────────────────── */}
      {timeLimitHit && !sessionEnded && !currentUser.isHost && !upgradePopupDismissed && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: 'rgba(22,20,18,0.99)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '2rem', maxWidth: 360, width: '100%',
            display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center',
            position: 'relative',
          }}>
            {/* X dismiss button */}
            <button
              onClick={() => setUpgradePopupDismissed(true)}
              style={{
                position: 'absolute', top: '0.75rem', right: '0.75rem',
                background: 'none', border: 'none',
                color: 'rgba(240,237,232,0.3)', cursor: 'pointer',
                fontSize: '16px', lineHeight: 1, padding: '4px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.7)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.3)' }}
              title="Dismiss"
            >✕</button>
            <p style={{ fontFamily: 'Georgia,serif', fontSize: '1.5rem', fontWeight: 300, color: '#F0EDE8' }}>
              Session time limit reached
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.5)', lineHeight: 1.6 }}>
              Your {!timeLimitSeconds ? '' : timeLimitSeconds >= 18000 ? '5-hour' : timeLimitSeconds >= 7200 ? '2-hour' : '25-minute'} session has ended.
              Upgrade to study longer without interruption.
            </p>
            <a href="/pricing" style={{
              display: 'block', padding: '0.75rem', textAlign: 'center',
              background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.3)',
              borderRadius: '10px', color: '#C9A96E', textDecoration: 'none', fontSize: '14px',
            }}>
              View Plans →
            </a>
            <button onClick={() => setUpgradePopupDismissed(true)} style={{
              background: 'none', border: 'none', color: 'rgba(240,237,232,0.3)',
              fontSize: '12px', cursor: 'pointer', padding: '0',
            }}>
              Maybe Later
            </button>
          </div>
        </div>
      )}

      {/* ── RECONNECTING BANNER ───────────────────────────────────────────── */}
      {reconnecting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(201,169,110,0.15)', borderBottom: '1px solid rgba(201,169,110,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          padding: '6px 1rem', backdropFilter: 'blur(8px)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A96E', display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#C9A96E', letterSpacing: '0.06em' }}>Reconnecting…</span>
        </div>
      )}

      {/* ── ROOM BAR ──────────────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 52, background: 'rgba(22,20,18,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.75rem',
        padding: isMobile ? '0 0.75rem' : '0 1rem', zIndex: 100,
        userSelect: 'none', overflow: 'hidden',
      }}>
        {/* Green dot + room name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6FCF97', display: 'block', flexShrink: 0 }} />
          <span style={{
            fontFamily: 'Georgia,serif', fontSize: isMobile ? '12px' : '14px',
            color: '#F0EDE8', fontWeight: 300,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: isMobile ? 'clamp(60px, 28vw, 110px)' : 'none',
          }}>
            {room.room_name ?? (activeMembers.find(m => m.is_host)?.display_name ?? 'Study') + "'s Room"}
          </span>
          {!isMobile && <>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`)
                setCodeCopied(true)
                setTimeout(() => setCodeCopied(false), 1500)
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 8px', borderRadius: '20px',
                background: codeCopied ? 'rgba(201,169,110,0.15)' : 'transparent',
                border: `1px solid ${codeCopied ? 'rgba(201,169,110,0.35)' : 'rgba(201,169,110,0.2)'}`,
                fontFamily: 'monospace', fontSize: '10px',
                color: codeCopied ? '#C9A96E' : 'rgba(201,169,110,0.6)',
                letterSpacing: '0.1em', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!codeCopied) { e.currentTarget.style.background = 'rgba(201,169,110,0.1)'; e.currentTarget.style.color = '#C9A96E' } }}
              onMouseLeave={e => { if (!codeCopied) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(201,169,110,0.6)' } }}
              title="Copy room link"
            >
              {codeCopied ? 'Copied ✓' : roomCode}
              {!codeCopied && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(240,237,232,0.3)' }}>
              {activeMembers.filter(m => !m.kicked_at && !m.left_at && m.join_status !== 'pending').length}/{room.max_members}
            </span>
            <span ref={timerSpanRef} style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(240,237,232,0.25)' }}>
              0s
            </span>
          </>}
        </div>

        {/* Mobile share button — native share sheet with clipboard fallback */}
        {isMobile && (
          <button
            onClick={async () => {
              const url = `${window.location.origin}/room/${roomCode}`
              const title = article?.title ?? room.room_name ?? 'Study Room'
              if (navigator.share) {
                try {
                  await navigator.share({ title, url })
                  return
                } catch {
                  // user cancelled — fall through to clipboard
                }
              }
              await navigator.clipboard.writeText(url).catch(() => null)
              setCodeCopied(true)
              setTimeout(() => setCodeCopied(false), 1500)
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: codeCopied ? 'rgba(201,169,110,0.15)' : 'transparent',
              border: `1px solid ${codeCopied ? 'rgba(201,169,110,0.35)' : 'rgba(255,255,255,0.1)'}`,
              color: codeCopied ? '#C9A96E' : 'rgba(240,237,232,0.45)',
              cursor: 'pointer', transition: 'all 0.2s ease', padding: 0,
            }}
            title="Share room"
          >
            {codeCopied ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
          </button>
        )}

        {/* Search bar — full text on desktop, icon-only circle on mobile */}
        {currentUser.isHost && (
          isMobile ? (
            <button
              onClick={() => { setSearchOpen(true); setSearchQ(''); setSearchResults([]); setGenerateError('') }}
              style={{
                width: 32, height: 32, flexShrink: 0,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)', borderRadius: '50%',
                color: 'rgba(240,237,232,0.5)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s, background 0.15s',
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          ) : (
            <button
              onClick={() => { setSearchOpen(true); setSearchQ(''); setSearchResults([]); setGenerateError('') }}
              style={{
                flexGrow: 1, flexShrink: 0, flexBasis: 0, maxWidth: 280, height: 28,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px',
                color: 'rgba(240,237,232,0.4)', fontSize: '12px', cursor: 'text',
                textAlign: 'left', padding: '0 0.65rem',
                fontFamily: 'var(--font-sans, system-ui)',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                transition: 'border-color 0.15s, background 0.15s',
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>Search any topic…</span>
            </button>
          )
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Member avatars */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {activeMembers.slice(0, isMobile ? 2 : 5).map(m => (
            <div key={m.user_id} style={{ position: 'relative', marginLeft: -5 }}>
              <AvatarWithBadge name={m.display_name} color={m.avatar_color} size={22} badge={m.badge} />
              {m.is_host && (
                <span style={{
                  position: 'absolute', bottom: -2, right: -2,
                  background: '#C9A96E', borderRadius: '50%',
                  width: 7, height: 7, border: '1px solid #191919',
                }} />
              )}
            </div>
          ))}
          {activeMembers.length > (isMobile ? 2 : 5) && (
            <span style={{ marginLeft: 5, fontSize: '10px', color: 'rgba(240,237,232,0.4)', fontFamily: 'monospace' }}>
              +{activeMembers.length - (isMobile ? 2 : 5)}
            </span>
          )}
        </div>

        {/* Observer badge — desktop only (too cramped on mobile) */}
        {currentUser.isObserver && !isMobile && (
          <span style={{
            fontSize: '10px', letterSpacing: '0.08em',
            fontFamily: 'monospace', color: 'rgba(240,237,232,0.35)',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '4px', padding: '2px 6px', flexShrink: 0,
          }}>
            OBSERVER
          </span>
        )}

        {/* Reactions bar — desktop only */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
            {REACTIONS.map(e => (
              <button key={e} onClick={() => !currentUser.isObserver && sendReaction(e)} style={{
                background: 'none', border: 'none', cursor: currentUser.isObserver ? 'default' : 'pointer',
                fontSize: '14px', padding: '2px 4px', opacity: currentUser.isObserver ? 0.3 : 1,
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e_ => { if (!currentUser.isObserver) e_.currentTarget.style.transform = 'scale(1.3)' }}
              onMouseLeave={e_ => { e_.currentTarget.style.transform = 'scale(1)' }}>
                {e}
              </button>
            ))}
          </div>
        )}

        {/* DND toggle — desktop only (mobile bottom bar has it) */}
        {!isMobile && (
          <button
            onClick={() => setDoNotDisturb(d => !d)}
            title={doNotDisturb ? 'Notifications muted' : 'Mute notifications'}
            style={{ background: doNotDisturb ? 'rgba(255,255,255,0.05)' : 'none', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: doNotDisturb ? 'rgba(240,237,232,0.3)' : 'rgba(240,237,232,0.5)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
            <IconBell size={13} muted={doNotDisturb} />
          </button>
        )}

        {/* Chat toggle — desktop only (mobile uses bottom bar) */}
        {!isMobile && (
          <button onClick={() => setChatOpen(o => !o)} style={{
            background: chatOpen ? 'rgba(201,169,110,0.1)' : 'none',
            border: '1px solid', borderColor: chatOpen ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.06)',
            borderRadius: '6px', color: chatOpen ? '#C9A96E' : 'rgba(240,237,232,0.4)',
            fontSize: '11px', padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            <IconChat size={12} />{chatOpen ? 'Hide' : 'Chat'}
          </button>
        )}

        {/* Leave button */}
        <button
          onClick={() => currentUser.isHost ? setHostLeaveModal(true) : (fetch(`/api/rooms/${roomCode}/leave`, { method: 'POST' }).then(() => router.push('/study')))}
          style={{
            background: 'rgba(244,124,124,0.08)', border: '1px solid rgba(244,124,124,0.2)',
            borderRadius: '6px', color: '#F47C7C', fontSize: '11px',
            padding: isMobile ? '4px 8px' : '3px 10px', cursor: 'pointer', flexShrink: 0,
          }}>
          {isMobile ? '✕' : 'Leave'}
        </button>
      </header>


      {/* ── TOPIC STRIP ───────────────────────────────────────────────────── */}
      {room.topic && (
        <div style={{ background: 'rgba(201,169,110,0.05)', borderBottom: '1px solid rgba(201,169,110,0.1)', padding: '0.3rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', color: 'rgba(201,169,110,0.5)', fontFamily: 'monospace', flexShrink: 0 }}>TOPIC</span>
          <span style={{ fontSize: '12px', color: 'rgba(240,237,232,0.6)', lineHeight: 1.4 }}>{room.topic}</span>
        </div>
      )}

      {/* ── PINNED MESSAGE ────────────────────────────────────────────────── */}
      {pinnedMessage && !pinnedMessage.deleted_at && (
        <div style={{ background: 'rgba(201,169,110,0.07)', borderBottom: '1px solid rgba(201,169,110,0.15)', padding: '0.35rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ color: '#C9A96E', fontFamily: 'monospace', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '10px' }}><IconPin size={11} /> PINNED</span>
          <span style={{ fontSize: '12px', color: 'rgba(240,237,232,0.7)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pinnedMessage.content}</span>
          {currentUser.isHost && (
            <button onClick={() => pinMessage(pinnedMessage, false)} style={{ background: 'none', border: 'none', color: 'rgba(240,237,232,0.3)', cursor: 'pointer', padding: 0, display: 'flex' }}><IconClose size={12} /></button>
          )}
        </div>
      )}

      {/* ── PENDING ADMISSIONS QUEUE ──────────────────────────────────────── */}
      {currentUser.isHost && pendingAdmissions.length > 0 && (
        <div style={{ position: 'fixed', top: 60, left: 16, right: isMobile ? 16 : 'auto', zIndex: 300, display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: isMobile ? 'calc(100vw - 32px)' : 340 }}>
          {pendingAdmissions.map(p => (
            <div key={p.userId} style={{ background: 'rgba(22,20,18,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              <Avatar name={p.displayName} color={p.avatarColor} size={22} />
              <span style={{ fontSize: '12px', color: '#F0EDE8', flex: 1 }}>{p.displayName}</span>
              <button onClick={() => admitMember(p.userId, true)} style={{ background: 'rgba(111,207,151,0.12)', border: '1px solid rgba(111,207,151,0.25)', borderRadius: '6px', color: '#6FCF97', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }}>Admit</button>
              <button onClick={() => admitMember(p.userId, false)} style={{ background: 'rgba(244,124,124,0.08)', border: '1px solid rgba(244,124,124,0.2)', borderRadius: '6px', color: '#F47C7C', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }}>Decline</button>
            </div>
          ))}
        </div>
      )}

      {/* ── PENDING HIGHLIGHT APPROVALS (host only) ───────────────────────── */}
      {currentUser.isHost && pendingHighlights.length > 0 && (
        <div style={{ position: 'fixed', top: 60, right: 16, zIndex: 300, display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: 300 }}>
          {pendingHighlights.map(h => (
            <div key={h.id} style={{ background: 'rgba(22,20,18,0.97)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: '10px', padding: '0.65rem 0.75rem', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <Avatar name={h.displayName} color={h.avatarColor} size={18} />
                <span style={{ fontSize: '10px', color: '#C9A96E', fontFamily: 'monospace' }}>🔖 Highlight request</span>
                <span style={{ fontSize: '10px', color: 'rgba(240,237,232,0.4)' }}>{h.displayName}</span>
              </div>
              <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.65)', fontStyle: 'italic', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                &ldquo;{h.text.slice(0, 120)}{h.text.length > 120 ? '…' : ''}&rdquo;
              </p>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  onClick={async () => {
                    setPendingHighlights(prev => prev.filter(p => p.id !== h.id))
                    // Host approves → send as doubt message so everyone sees it
                    const res = await fetch(`/api/rooms/${roomCode}/message`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content: h.text.slice(0, 500), kind: 'doubt', socketId: socketId() }),
                    })
                    if (res.ok) {
                      const msg = await res.json()
                      setMessages(prev => [...prev, msg])
                      setActiveTab('doubts')
                      if (!doNotDisturb) playSound('chime')
                    }
                  }}
                  style={{ flex: 1, background: 'rgba(111,207,151,0.1)', border: '1px solid rgba(111,207,151,0.2)', borderRadius: '6px', color: '#6FCF97', fontSize: '11px', padding: '3px', cursor: 'pointer' }}>
                  ✓ Share
                </button>
                <button
                  onClick={() => setPendingHighlights(prev => prev.filter(p => p.id !== h.id))}
                  style={{ flex: 1, background: 'rgba(244,124,124,0.07)', border: '1px solid rgba(244,124,124,0.15)', borderRadius: '6px', color: '#F47C7C', fontSize: '11px', padding: '3px', cursor: 'pointer' }}>
                  ✕ Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── HEADER SPACER — body scroll, header is position:fixed ──────────── */}
      <div style={{ height: 52 }} />

      {/* ── ARTICLE TABS — always shown once an article is open ── */}
      {hasTabs && (
        <div style={{
          position: 'sticky', top: 52, zIndex: 90,
          background: 'rgba(16,14,12,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'stretch',
        }}>

          {/* Left scroll arrow */}
          <button
            onClick={() => scrollTabsBy(-160)}
            style={{
              flexShrink: 0, width: 28, border: 'none',
              background: canScrollTabsLeft ? 'rgba(16,14,12,0.97)' : 'transparent',
              borderRight: canScrollTabsLeft ? '1px solid rgba(255,255,255,0.07)' : 'none',
              color: 'rgba(240,237,232,0.4)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: canScrollTabsLeft ? 1 : 0, pointerEvents: canScrollTabsLeft ? 'auto' : 'none',
              transition: 'opacity 0.15s',
              fontSize: '10px',
            }}
          >‹</button>

          {/* Scrollable tabs */}
          <div
            ref={tabsContainerRef}
            onWheel={handleTabsWheel}
            onScroll={syncTabsScroll}
            style={{
              flex: 1, display: 'flex', alignItems: 'flex-end',
              overflowX: 'auto', overflowY: 'hidden',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            } as React.CSSProperties}
          >
            {tabs.map(tab => {
              const isActive = tab.article_slug === article.slug
              const isHovered = hoveredTab === tab.article_slug
              return (
                <button
                  key={tab.article_slug}
                  onClick={() => switchToTab(tab.article_slug, tab.article_title)}
                  onMouseEnter={() => { setHoveredTab(tab.article_slug); syncTabsScroll() }}
                  onMouseLeave={() => setHoveredTab(null)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '7px 10px 6px 14px',
                    background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: 'none',
                    borderTop: isActive ? '2px solid #C9A96E' : '2px solid transparent',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    color: isActive ? '#F0EDE8' : isHovered ? 'rgba(240,237,232,0.7)' : 'rgba(240,237,232,0.35)',
                    fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
                    cursor: isActive ? 'default' : 'pointer',
                    whiteSpace: 'nowrap', maxWidth: 200, flexShrink: 0,
                    transition: 'color 0.15s, background 0.15s',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.article_title}</span>
                  {/* Close button — fades in on hover */}
                  <span
                    onClick={e => closeTab(tab.article_slug, tabs, e)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      fontSize: '9px', lineHeight: 1,
                      color: isActive ? 'rgba(240,237,232,0.5)' : 'rgba(240,237,232,0.3)',
                      background: isHovered ? 'rgba(255,255,255,0.1)' : 'transparent',
                      transition: 'background 0.12s, opacity 0.12s',
                      opacity: isHovered ? 1 : 0,
                      pointerEvents: isHovered ? 'auto' : 'none',
                    }}
                  >✕</span>
                </button>
              )
            })}
          </div>

          {/* Right scroll arrow */}
          <button
            onClick={() => scrollTabsBy(160)}
            style={{
              flexShrink: 0, width: 28, border: 'none',
              background: canScrollTabsRight ? 'rgba(16,14,12,0.97)' : 'transparent',
              borderLeft: canScrollTabsRight ? '1px solid rgba(255,255,255,0.07)' : 'none',
              color: 'rgba(240,237,232,0.4)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: canScrollTabsRight ? 1 : 0, pointerEvents: canScrollTabsRight ? 'auto' : 'none',
              transition: 'opacity 0.15s',
              fontSize: '10px',
            }}
          >›</button>
        </div>
      )}

      {/* ── ARTICLE AREA — body scrolls, no overflow:auto container ─────────── */}
        <div
          ref={articleContainerRef}
          style={{
            paddingTop: hasTabs ? '0' : isMobile ? '1.25rem' : '2rem',
            paddingLeft: isMobile ? '1rem' : '1.5rem',
            paddingRight: chatOpen && !isMobile ? '336px' : isMobile ? '1rem' : '1.5rem',
            paddingBottom: isMobile ? (chatOpen ? 'calc(360px + env(safe-area-inset-bottom, 0px))' : 'calc(80px + env(safe-area-inset-bottom, 0px))') : '3rem',
            transition: 'padding-right 0.28s cubic-bezier(0.4,0,0.2,1), padding-bottom 0.32s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto', opacity: articleFading ? 0 : 1, transition: 'opacity 0.15s ease' }}>

            {/* Generation error banner — visible in article panel when search is closed */}
            {!generating && generateError && !searchOpen && (
              <div style={{
                marginBottom: '1.25rem', padding: '0.75rem 1rem',
                background: 'rgba(244,124,124,0.08)', border: '1px solid rgba(244,124,124,0.2)',
                borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
              }}>
                <p style={{ fontSize: '12px', color: '#F47C7C', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{generateError}</p>
                <button
                  onClick={() => { setGenerateError(''); setSearchOpen(true) }}
                  style={{ background: 'none', border: '1px solid rgba(244,124,124,0.3)', borderRadius: '6px', color: '#F47C7C', fontSize: '11px', padding: '3px 10px', cursor: 'pointer', flexShrink: 0 }}>
                  Retry
                </button>
              </div>
            )}

            {/* ── EMPTY STATE — rotating topic card when no article content ── */}
            {!articleLoading && !generating && !article.content && !searchOpen && (
              <MobileEmptyState onSearch={() => {
                setSearchOpen(true)
                setSearchQ('')
                setSearchResults([])
                setGenerateError('')
              }} />
            )}

            {articleLoading ? (
              /* ── Article loading skeleton — fade in/out smoothly ── */
              <div style={{ opacity: 0.7, animation: 'pulse 1.5s ease-in-out infinite' }}>
                <div style={{ height: 10, width: '30%', background: 'rgba(201,169,110,0.2)', borderRadius: 4, marginBottom: 12 }} />
                <div style={{ height: 32, width: '80%', background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8 }} />
                <div style={{ height: 32, width: '55%', background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 20 }} />
                <div style={{ height: 12, width: '25%', background: 'rgba(111,207,151,0.1)', borderRadius: 100, marginBottom: 16 }} />
                {[92, 85, 78, 90, 72, 88, 65, 80, 76, 84].map((w, i) => (
                  <div key={i} style={{ height: 13, width: `${w}%`, background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 10 }} />
                ))}
              </div>
            ) : (
              /* ── Unified article view — same DOM tree during streaming and after.
                 During streaming: derives display values from streamMeta/streamContent.
                 After streaming:  derives from article state. Same JSX shape = no remount, no blink. ── */
              <div ref={articleViewRef} className="study-room-article">

                {/* Category + writing indicator — only render if there's something to show */}
                {(generating || article.category) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.65rem', marginBottom: '0.5rem' }}>
                    {(generating ? streamMeta?.category : article.category) ? (
                      <p style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9A96E', margin: 0 }}>
                        {generating ? streamMeta!.category : article.category}
                      </p>
                    ) : generating ? (
                      <div style={{ height: 10, width: '25%', background: 'rgba(201,169,110,0.2)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ) : null}
                    {generating && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'monospace', fontSize: '10px', color: 'rgba(240,237,232,0.35)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'blink 1s step-start infinite' }} />
                        Writing…
                      </span>
                    )}
                  </div>
                )}

                {/* Title — placeholder query until real title arrives */}
                {(generating && !streamMeta) ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ height: 32, width: '80%', background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ height: 32, width: '55%', background: 'rgba(255,255,255,0.06)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                  </div>
                ) : (
                  <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(1.6rem,4vw,2.6rem)', fontWeight: 300, color: '#F0EDE8', lineHeight: 1.2, marginTop: 0, paddingTop: (!generating && !article.category) ? '0.65rem' : 0, marginBottom: '1rem' }}>
                    {generating ? (streamMeta?.title || streamQueryRef.current) : article.title}
                  </h1>
                )}

                {/* Verified pill — skeleton during streaming, real when done */}
                {generating ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'inline-block', height: 24, width: 140, borderRadius: 100, background: 'rgba(201,169,110,0.12)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  </div>
                ) : (article.verified_at || article.created_at) ? (() => {
                  const badgeDate = article.event_date
                    ?? (() => { const d = new Date(article.verified_at ?? article.created_at ?? ''); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) })()
                  return (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        padding: '4px 14px 4px 10px', borderRadius: '100px',
                        background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                        fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: 'var(--gold)',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.4" />
                          <path d="M3.5 6l1.8 1.8L8.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Verified&nbsp;·&nbsp;{badgeDate}
                      </div>
                    </div>
                  )
                })() : null}

                {/* Summary */}
                {(generating && !streamMeta?.summary) ? (
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {[92, 80, 65].map((w, i) => (
                      <div key={i} style={{ height: 13, width: `${w}%`, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                  </div>
                ) : (generating ? streamMeta!.summary : article.summary) ? (
                  <p style={{ fontSize: generating ? '15px' : '16px', color: 'rgba(240,237,232,0.5)', lineHeight: 1.7, marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {generating ? streamMeta!.summary : article.summary}
                  </p>
                ) : null}

                {/* Wikipedia info box — CSS class handles layout (mobile: full-width, desktop: float right) */}
                {!generating && (
                  <WikiInfoBox key={article.slug} wikiUrl={article.wiki_url} articleTitle={article.title} />
                )}

                {/* Article body — streams in live, no remount when done */}
                {(generating && !streamContent) ? (
                  <div>
                    {[90, 82, 87, 78, 92, 70, 85, 88, 74, 80].map((w, i) => (
                      <div key={i} style={{ height: 13, width: `${w}%`, background: 'rgba(255,255,255,0.04)', borderRadius: 4, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                  </div>
                ) : (
                  <div
                    ref={articleRef}
                    className="article-prose"
                    onDragStart={e => e.preventDefault()}
                    dangerouslySetInnerHTML={{ __html: generating
                      ? streamContent + '<span class="stream-cursor"></span>'
                      : article.content
                    }}
                  />
                )}

                {/* Clearfix — ensures the float (infobox) doesn't bleed into sections below */}
                <div style={{ clear: 'both' }} />

                {/* Observer upgrade nudge — hidden during streaming */}
                {!generating && currentUser.isObserver && (
                  <div style={{
                    marginTop: '2rem', padding: '1rem 1.25rem',
                    background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.15)',
                    borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem',
                  }}>
                    <span style={{ fontSize: '16px' }}>✨</span>
                    <div>
                      <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.7)', marginBottom: '0.25rem' }}>
                        You&apos;re viewing as an observer.
                      </p>
                      <Link href="/pricing" style={{ fontSize: '12px', color: '#C9A96E' }}>
                        Upgrade to participate — chat, highlight &amp; explain →
                      </Link>
                    </div>
                  </div>
                )}

                {/* ── BOTTOM SECTION — Sources · Helpful · Related (hidden during streaming) ── */}
                {!generating && article.slug && (
                  <>
                    {/* Sources */}
                    {(article.sources?.length ?? 0) > 0 && (
                      <div style={{
                        marginTop: '3rem',
                        padding: '1.25rem 1.5rem',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '16px',
                      }}>
                        <p style={{
                          fontFamily: 'monospace', fontSize: '10px',
                          letterSpacing: '0.12em', textTransform: 'uppercase',
                          color: '#C9A96E', marginBottom: '0.875rem',
                        }}>
                          Sources
                        </p>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {article.sources!.map((s, i) => {
                            const match = s.match(/^(.*?)\s*\((https?:\/\/[^)]+)\)\s*$/)
                            const name = match ? match[1].trim() : s
                            const url  = match ? match[2] : null
                            return (
                              <li key={i} style={{ fontSize: '12px', color: 'rgba(240,237,232,0.4)', fontFamily: 'monospace' }}>
                                [{i + 1}]{' '}
                                {url ? (
                                  <a
                                    href={url} target="_blank" rel="noopener noreferrer"
                                    style={{ color: '#C9A96E', textDecoration: 'none', borderBottom: '1px solid rgba(201,169,110,0.25)', transition: 'border-color 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderBottomColor = '#C9A96E' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'rgba(201,169,110,0.25)' }}
                                  >
                                    {name}
                                  </a>
                                ) : name}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Helpful vote */}
                    <HelpfulButton articleSlug={article.slug} />

                    {/* Related articles — clicking navigates in-room (host syncs all members) */}
                    {related.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <p style={{
                          fontFamily: 'monospace', fontSize: '10px',
                          letterSpacing: '0.12em', textTransform: 'uppercase',
                          color: '#C9A96E', marginBottom: '1rem',
                        }}>
                          Related Articles
                        </p>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                          gap: '0.65rem',
                        }}>
                          {related.slice(0, 4).map(rel => (
                            <button
                              key={rel.slug}
                              onClick={() => currentUser.isHost ? hostNavigateTo(rel.slug, rel.title) : fetchArticle(rel.slug)}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '0.875rem 1rem',
                                background: 'rgba(255,255,255,0.025)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '12px', cursor: 'pointer',
                                transition: 'border-color 0.18s, background 0.18s',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'rgba(201,169,110,0.35)'
                                e.currentTarget.style.background  = 'rgba(201,169,110,0.05)'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                                e.currentTarget.style.background  = 'rgba(255,255,255,0.025)'
                              }}
                            >
                              <p style={{
                                fontFamily: 'monospace', fontSize: '9px',
                                letterSpacing: '0.1em', textTransform: 'uppercase',
                                color: '#C9A96E', marginBottom: '0.35rem',
                              }}>
                                {rel.category}
                              </p>
                              <p style={{
                                fontSize: '13px', fontWeight: 400,
                                color: 'rgba(240,237,232,0.85)', lineHeight: 1.35,
                                marginBottom: '0.35rem',
                              }}>
                                {rel.title}
                              </p>
                              <p style={{
                                fontSize: '11px', color: 'rgba(240,237,232,0.35)',
                                lineHeight: 1.4,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                                overflow: 'hidden',
                              }}>
                                {rel.summary}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── CHAT SIDEBAR (desktop) — always in DOM, slides in/out smoothly ── */}
        <aside ref={chatSidebarRef} style={{
            position: 'fixed', top: 52, right: 0, bottom: 0,
            width: 320,
            display: isMobile ? 'none' : 'flex', flexDirection: 'column',
            background: 'rgba(22,20,18,0.98)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            zIndex: 90,
            userSelect: 'none',
            transform: chatOpen ? 'translateX(0)' : 'translateX(320px)',
            transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            {/* Members list header — current user is clickable for badge selection */}
            <div style={{
              padding: '0.6rem 0.75rem',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center',
            }}>
              {activeMembers.map(m => {
                const isMe = m.user_id === currentUser.id
                return (
                  <div key={m.user_id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }} title={m.display_name}>
                    <AvatarWithBadge name={m.display_name} color={m.avatar_color} size={20} badge={m.badge} />
                    <span style={{ fontSize: '11px', color: isMe ? 'rgba(240,237,232,0.75)' : 'rgba(240,237,232,0.5)' }}>
                      {m.display_name.split(' ')[0]}
                    </span>
                    {m.is_host && <span style={{ fontSize: '8px', color: '#C9A96E' }}>★</span>}
                    {currentUser.isHost && !isMe && (
                      <button onClick={() => kickMember(m.user_id)} title="Remove" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(244,124,124,0.4)', padding: 0, lineHeight: 1, display: 'flex',
                      }}><IconClose size={11} /></button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Reactions row — mobile only */}
            {isMobile && !currentUser.isObserver && (
              <div style={{
                padding: '0.35rem 0.75rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', gap: '4px', justifyContent: 'center',
              }}>
                {REACTIONS.map(e => (
                  <button key={e} onClick={() => sendReaction(e)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '18px', padding: '4px 10px',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e_ => { e_.currentTarget.style.transform = 'scale(1.3)' }}
                  onMouseLeave={e_ => { e_.currentTarget.style.transform = 'scale(1)' }}>
                    {e}
                  </button>
                ))}
              </div>
            )}

            {/* Chat / Doubts tabs + close button */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, alignItems: 'stretch' }}>
              {(['chat', 'doubts'] as const).map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'doubts') setUnreadDoubts(0) }} style={{
                  flex: 1, padding: '0.4rem', background: 'none', border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #C9A96E' : '2px solid transparent',
                  color: activeTab === tab ? '#C9A96E' : 'rgba(240,237,232,0.4)',
                  fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.06em', cursor: 'pointer',
                  textTransform: 'uppercase', position: 'relative',
                }}>
                  {tab === 'chat' ? 'Chat' : `Doubts${unreadDoubts > 0 ? ` (${unreadDoubts})` : ''}`}
                </button>
              ))}
              {/* Close sidebar button */}
              <button
                onClick={() => setChatOpen(false)}
                title="Hide chat"
                style={{
                  background: 'none', border: 'none', borderBottom: '2px solid transparent',
                  color: 'rgba(240,237,232,0.25)', cursor: 'pointer',
                  padding: '0 10px', display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.6)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.25)' }}
              >
                <IconClose size={12} />
              </button>
            </div>

            {/* Messages */}
            <div ref={mobileMsgsRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages
                .filter(msg => activeTab === 'doubts' ? msg.kind === 'doubt' : msg.kind !== 'doubt')
                .map(msg => <ChatBubble key={msg.id} msg={msg} currentUserId={currentUser.id} isHost={currentUser.isHost} roomCode={roomCode} onPin={pinMessage} onDelete={deleteMessage} />)}
              <div ref={chatBottomRef} />
            </div>

            {/* Typing indicator */}
            {typingNames.length > 0 && (
              <div style={{ padding: '0 0.75rem 0.25rem', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', color: 'rgba(240,237,232,0.35)', fontFamily: 'var(--font-mono, monospace)', fontStyle: 'italic' }}>
                  {typingNames.length === 1
                    ? `${typingNames[0]} is typing…`
                    : typingNames.length === 2
                      ? `${typingNames[0]} and ${typingNames[1]} are typing…`
                      : 'Several people are typing…'}
                </span>
              </div>
            )}

            {/* Input */}
            {!currentUser.isObserver ? (
              <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {chatError && <p style={{ fontSize: '10px', color: '#F47C7C', marginBottom: '0.3rem' }}>{chatError}</p>}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={e => {
                      setChatInput(e.target.value); setChatError('')
                      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
                      typingDebounceRef.current = setTimeout(() => {
                        fetch(`/api/rooms/${roomCode}/typing`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ displayName: currentUser.name, socketId: socketId() }),
                        }).catch(() => null)
                      }, 300)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Type a message…"
                    maxLength={3000}
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px', color: '#F0EDE8', fontSize: '13px', padding: '0.4rem 0.6rem',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <button onClick={sendMessage} style={{
                    background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.25)',
                    borderRadius: '6px', color: '#C9A96E', fontSize: '12px', padding: '0 0.6rem', cursor: 'pointer',
                  }}>
                    →
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                <Link href="/pricing" style={{ fontSize: '11px', color: '#C9A96E' }}>Upgrade to chat →</Link>
              </div>
            )}
          </aside>

        {/* ── MOBILE BOTTOM SHEET ──────────────────────────────────────────── */}
        {isMobile && (
          <div style={{
            position: 'fixed', left: 0, right: 0,
            bottom: 'calc(54px + env(safe-area-inset-bottom, 0px))',
            zIndex: 90,
            height: chatOpen ? (chatExpanded ? 'calc(var(--app-sh) - 54px - env(safe-area-inset-bottom, 0px) - 52px)' : 280) : 0,
            transition: 'height 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            background: 'rgba(18,16,14,0.99)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px 16px 0 0',
            boxShadow: chatOpen ? '0 -8px 40px rgba(0,0,0,0.6)' : 'none',
          }}>
            {/* Sheet header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.4rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
              flexShrink: 0,
            }}>
              {/* Drag handle */}
              <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto', position: 'absolute', left: '50%', transform: 'translateX(-50%) translateY(-4px)', top: 8 }} />
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '2px' }}>
                {(['chat', 'doubts'] as const).map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'doubts') setUnreadDoubts(0) }} style={{
                    padding: '3px 10px', borderRadius: '100px', border: 'none',
                    background: activeTab === tab ? 'rgba(201,169,110,0.15)' : 'none',
                    color: activeTab === tab ? '#C9A96E' : 'rgba(240,237,232,0.35)',
                    fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.06em',
                    cursor: 'pointer', textTransform: 'uppercase',
                  }}>
                    {tab === 'chat' ? 'Chat' : `Doubts${unreadDoubts > 0 ? ` (${unreadDoubts})` : ''}`}
                  </button>
                ))}
              </div>
              {/* Controls — 3 buttons: scroll to bottom, full-page, close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <button
                  onClick={() => scrollChatToBottom()}
                  title="Scroll to bottom"
                  style={{ background: 'none', border: 'none', color: 'rgba(240,237,232,0.4)', cursor: 'pointer', padding: '6px', display: 'flex', transition: 'color 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.8)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.4)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                  </svg>
                </button>
                <Link href={`/room/${roomCode}/chat`} title="Open full chat page" style={{ color: 'rgba(240,237,232,0.4)', display: 'flex', padding: '6px', transition: 'color 0.2s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,237,232,0.8)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,237,232,0.4)' }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2h4v4M14 2L9 7M6 14H2v-4M2 14l5-5"/>
                  </svg>
                </Link>
                <button
                  onClick={() => { setChatOpen(false); setChatExpanded(false) }}
                  title="Close chat"
                  style={{ background: 'none', border: 'none', color: 'rgba(240,237,232,0.3)', cursor: 'pointer', padding: '6px', display: 'flex', transition: 'color 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.7)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(240,237,232,0.3)' }}
                >
                  <IconClose size={12} />
                </button>
              </div>
            </div>

            {/* Members strip */}
            <div style={{ padding: '0.35rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flexShrink: 0 }}>
              {activeMembers.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Avatar name={m.display_name} color={m.avatar_color} size={18} />
                  <span style={{ fontSize: '10px', color: 'rgba(240,237,232,0.4)' }}>{m.display_name.split(' ')[0]}</span>
                </div>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {messages
                .filter(msg => activeTab === 'doubts' ? msg.kind === 'doubt' : msg.kind !== 'doubt')
                .map(msg => <ChatBubble key={msg.id} msg={msg} currentUserId={currentUser.id} isHost={currentUser.isHost} roomCode={roomCode} onPin={pinMessage} onDelete={deleteMessage} />)}
              <div ref={chatBottomRef} />
            </div>

            {/* Typing indicator */}
            {typingNames.length > 0 && (
              <div style={{ padding: '0 0.75rem 0.2rem', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', color: 'rgba(240,237,232,0.35)', fontFamily: 'var(--font-mono, monospace)', fontStyle: 'italic' }}>
                  {typingNames.length === 1
                    ? `${typingNames[0]} is typing…`
                    : typingNames.length === 2
                      ? `${typingNames[0]} and ${typingNames[1]} are typing…`
                      : 'Several people are typing…'}
                </span>
              </div>
            )}

            {/* Input */}
            {!currentUser.isObserver ? (
              <div style={{ padding: '0.4rem 0.6rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                {chatError && <p style={{ fontSize: '10px', color: '#F47C7C', marginBottom: '0.25rem' }}>{chatError}</p>}
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input
                    value={chatInput}
                    onChange={e => {
                      setChatInput(e.target.value); setChatError('')
                      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current)
                      typingDebounceRef.current = setTimeout(() => {
                        fetch(`/api/rooms/${roomCode}/typing`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ displayName: currentUser.name, socketId: socketId() }),
                        }).catch(() => null)
                      }, 300)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Type a message…"
                    maxLength={3000}
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px', color: '#F0EDE8', fontSize: '14px', padding: '0.45rem 0.6rem',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <button onClick={sendMessage} style={{
                    background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.25)',
                    borderRadius: '8px', color: '#C9A96E', padding: '0.45rem 0.75rem', cursor: 'pointer', flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '0.5rem', textAlign: 'center', flexShrink: 0 }}>
                <Link href="/pricing" style={{ fontSize: '11px', color: '#C9A96E' }}>Upgrade to chat →</Link>
              </div>
            )}
          </div>
        )}

        {/* ── MOBILE BOTTOM ACTION BAR ─────────────────────────────────────── */}
        {isMobile && (
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
            height: 'calc(54px + env(safe-area-inset-bottom, 0px))',
            background: 'rgba(16,14,12,0.98)', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center',
            padding: '0 0.75rem',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            gap: '0.35rem',
            backdropFilter: 'blur(16px)', userSelect: 'none',
          }}>
            {/* Chat / Doubts toggle */}
            <button
              onClick={() => { setChatOpen(o => !o); if (!chatOpen) setChatExpanded(false); setEmojiPickerOpen(false) }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                background: chatOpen ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${chatOpen ? 'rgba(201,169,110,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px', color: chatOpen ? '#C9A96E' : 'rgba(240,237,232,0.5)',
                fontSize: '11px', fontFamily: 'monospace', padding: '0.35rem 0', cursor: 'pointer',
                position: 'relative',
              }}>
              <IconChat size={13} />
              {unreadDoubts > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: '#C9A96E', color: '#191919',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
                }}>{unreadDoubts > 9 ? '9+' : unreadDoubts}</span>
              )}
            </button>

            {/* Emoji picker button */}
            {!currentUser.isObserver && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setEmojiPickerOpen(o => !o)}
                  style={{
                    background: emojiPickerOpen ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${emojiPickerOpen ? 'rgba(201,169,110,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: '8px', cursor: 'pointer',
                    padding: '0.35rem 0.5rem',
                    transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={emojiPickerOpen ? 'var(--gold)' : 'rgba(240,237,232,0.5)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                </button>
                {/* Glassmorphism emoji popup — anchored right to avoid left-side clip on mobile */}
                {emojiPickerOpen && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
                    background: 'rgba(22,20,18,0.95)',
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '14px', padding: '8px 10px',
                    display: 'flex', gap: '4px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    zIndex: 500,
                    animation: 'fadeInUp 0.18s ease',
                    whiteSpace: 'nowrap',
                  }}>
                    {['🔥', '💯', '🤔', '❓', '😂', '👍'].map(e => (
                      <button key={e}
                        onClick={() => { sendReaction(e); setEmojiPickerOpen(false) }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '22px', padding: '4px 6px', borderRadius: '8px',
                          transition: 'transform 0.15s ease, background 0.15s ease',
                        }}
                        onMouseEnter={ev => { ev.currentTarget.style.transform = 'scale(1.3)'; ev.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                        onMouseLeave={ev => { ev.currentTarget.style.transform = 'scale(1)'; ev.currentTarget.style.background = 'none' }}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mute */}
            <button
              onClick={() => setDoNotDisturb(d => !d)}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                color: doNotDisturb ? 'rgba(240,237,232,0.25)' : 'rgba(240,237,232,0.5)',
                padding: '0.35rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}>
              <IconBell size={14} muted={doNotDisturb} />
            </button>

            {/* Leave */}
            <button
              onClick={() => currentUser.isHost
                ? setHostLeaveModal(true)
                : (fetch(`/api/rooms/${roomCode}/leave`, { method: 'POST' }).then(() => router.push('/study')))}
              style={{
                background: 'rgba(244,124,124,0.08)', border: '1px solid rgba(244,124,124,0.15)',
                borderRadius: '8px', color: '#F47C7C', fontSize: '11px',
                padding: '0.35rem 0.6rem', cursor: 'pointer', fontFamily: 'monospace',
              }}>
              Leave
            </button>
          </div>
        )}

      {/* ── FLOATING REACTIONS ────────────────────────────────────────────── */}
      {reactions.map(r => (
        <div key={r.id} style={{
          position: 'fixed', left: `${r.x}%`, top: `${r.y}%`,
          pointerEvents: 'none', zIndex: 200,
          animation: 'floatReaction 3s ease-out forwards',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
        }}>
          <span style={{ fontSize: '28px' }}>{r.emoji}</span>
          <span style={{ fontSize: '10px', color: 'rgba(240,237,232,0.5)', whiteSpace: 'nowrap' }}>{r.label}</span>
        </div>
      ))}

      {/* ── TEXT SELECTION TOOLBAR (separate component = no parent re-render) ── */}
      <SelectionToolbar
        chatSidebarRef={chatSidebarRef}
        isHost={currentUser.isHost}
        isObserver={currentUser.isObserver}
        explainLoading={explainLoading}
        onExplain={text => triggerSharedExplain(text)}
        onHighlight={text => highlightOnly(text)}
        onAsk={text => sendDoubt(text)}
      />

      {/* ── SHARED EXPLAIN PANEL — slides in from right ────────────────────── */}
      {sharedExplain && (
        <div style={{
          position: 'fixed',
          top: 52,    // below room bar
          right: 0,
          bottom: isMobile ? 54 : 0,  // above mobile action bar
          width: isMobile ? '100%' : 'min(400px, 40vw)',
          zIndex: 200,
          background: 'rgba(16,14,12,0.99)',
          borderLeft: isMobile ? 'none' : '1px solid rgba(201,169,110,0.15)',
          borderTop: isMobile ? '1px solid rgba(201,169,110,0.15)' : 'none',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-16px 0 64px rgba(0,0,0,0.7)',
          animation: 'explainSlideIn 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          overflow: 'hidden',
        }}>
          {/* Panel header — just the title and close button, no extra badges */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconSparkle size={13} />
              <span style={{ fontSize: '11px', color: '#C9A96E', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                {sharedExplain.triggeredBy} explained this
              </span>
            </div>
            <button onClick={() => setSharedExplain(null)} style={{ background: 'none', border: 'none', color: 'rgba(240,237,232,0.3)', cursor: 'pointer', display: 'flex', padding: 4 }}>
              <IconClose size={13} />
            </button>
          </div>

          {/* Share with Chat — top action, sends message immediately */}
          {!sharedExplain.isLoading && (
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              <button
                onClick={() => {
                  const smartText = `**${currentUser.name}** asked:\n> ${sharedExplain.selectedText}\n\n**AI Answer:**\n${sharedExplain.explanation ?? ''}`
                  setSharedExplain(null)
                  setChatOpen(true)
                  setActiveTab('chat')
                  setChatInput(smartText)
                  setTimeout(() => chatInputRef.current?.focus(), 50)
                }}
                style={{
                  width: '100%',
                  background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)',
                  borderRadius: '8px', color: '#C9A96E',
                  fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.06em',
                  padding: '8px 14px', cursor: 'pointer', textAlign: 'center',
                }}
              >
                Share with Chat →
              </button>
            </div>
          )}

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {/* Selected text quote */}
            <blockquote style={{
              borderLeft: `2px solid ${sharedExplain.color}`,
              paddingLeft: '0.75rem',
              color: 'rgba(240,237,232,0.45)',
              fontSize: '13px', fontStyle: 'italic',
              marginBottom: '1rem', lineHeight: 1.6,
            }}>
              &ldquo;{sharedExplain.selectedText.slice(0, 300)}{sharedExplain.selectedText.length > 300 ? '…' : ''}&rdquo;
            </blockquote>

            {/* Skeleton shimmer while AI is loading */}
            {sharedExplain.isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[100, 92, 96, 78, 88].map((w, i) => (
                  <div key={i} style={{
                    height: 13, borderRadius: 6,
                    width: `${w}%`,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'skeletonShimmer 1.4s ease-in-out infinite',
                  }} />
                ))}
                <div style={{ height: 13, borderRadius: 6, width: '60%', background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)', backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.4s ease-in-out 0.2s infinite' }} />
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: 'rgba(240,237,232,0.85)', lineHeight: 1.75, letterSpacing: '0.01em' }}>
                {sharedExplain.explanation}
              </p>
            )}
          </div>

          {/* Footer hint */}
          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <p style={{ fontSize: '10px', color: 'rgba(240,237,232,0.2)', fontFamily: 'monospace', letterSpacing: '0.05em', margin: 0 }}>
              {sharedExplain.isLoading ? 'AI is thinking…' : 'Also visible in Doubts tab · Select any text to explain'}
            </p>
          </div>
        </div>
      )}

      {/* Follow Admin popup removed — members follow host navigation silently (BUG 2) */}

      {/* ── NAV REQUEST (host sees) ───────────────────────────────────────── */}
      {navRequest && currentUser.isHost && (
        <div style={{
          position: 'fixed', top: 64, right: 16, zIndex: 120,
          background: 'rgba(22,20,18,0.95)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px', padding: '0.75rem 1rem', maxWidth: 280,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.6)', marginBottom: '0.5rem' }}>
            <strong style={{ color: '#F0EDE8' }}>{navRequest.displayName}</strong> wants to go back to
            <strong style={{ color: '#C9A96E' }}> {navRequest.targetTitle}</strong>
          </p>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={approveNavRequest} style={{
              flex: 1, background: 'rgba(111,207,151,0.1)', border: '1px solid rgba(111,207,151,0.2)',
              borderRadius: '6px', color: '#6FCF97', fontSize: '12px', padding: '4px', cursor: 'pointer',
            }}>
              ✓ Follow
            </button>
            <button onClick={() => setNavRequest(null)} style={{
              flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px', color: 'rgba(240,237,232,0.4)', fontSize: '12px', padding: '4px', cursor: 'pointer',
            }}>
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* ── HOST SEARCH MODAL ────────────────────────────────────────────── */}
      {searchOpen && currentUser.isHost && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,8,6,0.97)', zIndex: 400,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh',
        }} onClick={e => { if (e.target === e.currentTarget && !generating) { setSearchOpen(false); setSearchQ(''); setWikiSuggestions([]) } }}>
          <div style={{ width: 'min(580px, 92vw)', display: 'flex', flexDirection: 'column', gap: '6px' }}>

            {/* ── Search bar — identical to main search page ── */}
            <div style={{
              display: 'flex', alignItems: 'center', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(22,20,18,0.95)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            }}>
              <div style={{ padding: '0 0.9rem 0 1.25rem', color: 'rgba(240,237,232,0.35)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <input
                autoFocus
                value={searchQ}
                onChange={e => {
                  setSearchQ(e.target.value)
                  setGenerateError('')
                  fetchWikiSuggestions(e.target.value)
                  searchArticles(e.target.value)
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setSearchOpen(false); setSearchQ(''); setWikiSuggestions([]) }
                  if (e.key === 'Enter' && searchQ.trim() && !generating) generateAndNavigate(searchQ)
                }}
                disabled={generating}
                placeholder="Search anything…"
                autoComplete="off" autoCorrect="off" spellCheck={false}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  padding: '1rem 0', fontSize: '15px',
                  color: '#F0EDE8', fontFamily: 'inherit', fontWeight: 300,
                  caretColor: '#C9A96E', minWidth: 0,
                  opacity: generating ? 0.4 : 1,
                }}
              />
              <button
                onClick={() => { if (!generating && searchQ.trim()) generateAndNavigate(searchQ) }}
                disabled={!searchQ.trim() || generating}
                style={{
                  margin: '0.375rem', width: '36px', height: '36px', borderRadius: '10px',
                  border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: searchQ.trim() && !generating ? '#C9A96E' : 'rgba(255,255,255,0.06)',
                  color:      searchQ.trim() && !generating ? '#191919' : 'rgba(240,237,232,0.25)',
                  cursor:     searchQ.trim() && !generating ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>

            {/* ── Results dropdown ── */}
            {(wikiLoading || wikiSuggestions.length > 0 || generating || (searchQ && !wikiLoading && wikiSuggestions.length === 0)) && (
              <div style={{
                background: 'rgba(22,20,18,0.97)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', overflow: 'hidden',
                boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                maxHeight: '60vh', overflowY: 'auto',
              }}>

                {/* Error — shown at top regardless of whether suggestions are visible */}
                {!generating && generateError && (
                  <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(244,124,124,0.08)', borderBottom: '1px solid rgba(244,124,124,0.15)' }}>
                    <p style={{ fontSize: '12px', color: '#F47C7C', letterSpacing: '0.02em' }}>{generateError}</p>
                  </div>
                )}

                {/* Generating state */}
                {generating && (
                  <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div className="fp-dots" style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
                      <span className="fp-dot" /><span className="fp-dot" /><span className="fp-dot" />
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.5)' }}>
                      Generating article about <strong style={{ color: '#C9A96E' }}>{searchQ}</strong>…
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(240,237,232,0.25)', marginTop: '0.35rem' }}>This may take 10–30 seconds</p>
                  </div>
                )}

                {/* Shimmer skeleton while loading */}
                {!generating && wikiLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} style={{
                        height: '62px', borderRadius: '10px',
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)',
                        backgroundSize: '200% 100%',
                        border: '1px solid rgba(255,255,255,0.04)',
                        opacity: 1 - i * 0.12,
                        animation: 'shimmer 1.8s linear infinite',
                        animationDelay: `${i * 80}ms`,
                      }} />
                    ))}
                  </div>
                )}

                {/* Wiki suggestions */}
                {!generating && !wikiLoading && wikiSuggestions.map((r, i) => {
                  const cached = searchResults.find(s => s.title.toLowerCase() === r.title.toLowerCase())
                  return (
                    <button
                      key={r.pageid}
                      onClick={() => {
                        if (cached) hostNavigateTo(cached.slug, cached.title)
                        else generateAndNavigate(r.title)
                      }}
                      style={{
                        width: '100%', textAlign: 'left', background: 'none',
                        border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        padding: '0.75rem 1.25rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                        opacity: 0, animation: `fadeIn 0.25s ${i * 30}ms ease forwards`,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,169,110,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: '14px', color: '#F0EDE8', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(240,237,232,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.snippet.replace(/<[^>]*>/g, '')}</p>
                      </div>
                      {cached
                        ? <span style={{ fontSize: '9px', color: '#6FCF97', fontFamily: 'monospace', letterSpacing: '0.08em', flexShrink: 0 }}>CACHED</span>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(240,237,232,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                      }
                    </button>
                  )
                })}

                {/* No results → generate */}
                {!generating && !wikiLoading && searchQ.trim() && wikiSuggestions.length === 0 && (
                  <div style={{ padding: '1.25rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.3)', marginBottom: '0.75rem' }}>No results found</p>
                    {generateError && <p style={{ fontSize: '12px', color: '#F47C7C', marginBottom: '0.6rem' }}>{generateError}</p>}
                    <button
                      onClick={() => generateAndNavigate(searchQ)}
                      style={{
                        background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.3)',
                        borderRadius: '10px', color: '#C9A96E', fontSize: '13px',
                        padding: '0.6rem 1.25rem', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,169,110,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,169,110,0.12)' }}
                    >
                      <IconSparkle size={12} /> Generate &ldquo;{searchQ}&rdquo;
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HOST LEAVE MODAL ─────────────────────────────────────────────── */}
      {hostLeaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1E1C1A', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '1.5rem', width: 'min(400px, 90vw)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          }}>
            <p style={{ fontFamily: 'Georgia,serif', fontSize: '1.3rem', fontWeight: 300, color: '#F0EDE8', marginBottom: '0.5rem' }}>
              You&apos;re the host
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.5)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              What would you like to do?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Transfer host */}
              {activeMembers.filter(m => !m.is_host && !m.is_observer).length > 0 && (
                <button onClick={() => { setHostLeaveModal(false); setTransferModal(true) }} style={{
                  padding: '0.6rem', background: 'rgba(111,207,151,0.1)', border: '1px solid rgba(111,207,151,0.2)',
                  borderRadius: '8px', color: '#6FCF97', fontSize: '13px', cursor: 'pointer',
                }}>
                  Transfer host &amp; leave
                </button>
              )}
              <button onClick={closeRoom} disabled={closingRoom} style={{
                padding: '0.6rem', background: 'rgba(244,124,124,0.1)', border: '1px solid rgba(244,124,124,0.2)',
                borderRadius: '8px', color: '#F47C7C', fontSize: '13px', cursor: closingRoom ? 'not-allowed' : 'pointer',
                opacity: closingRoom ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}>
                {closingRoom && (
                  <span style={{
                    width: 14, height: 14, border: '2px solid rgba(244,124,124,0.3)',
                    borderTopColor: '#F47C7C', borderRadius: '50%',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                )}
                {closingRoom ? 'Closing…' : 'Close room for everyone'}
              </button>
              <button onClick={() => setHostLeaveModal(false)} style={{
                padding: '0.5rem', background: 'none', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px', color: 'rgba(240,237,232,0.4)', fontSize: '13px', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSFER HOST MODAL ──────────────────────────────────────────── */}
      {transferModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1E1C1A', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '1.5rem', width: 'min(360px, 90vw)',
          }}>
            <p style={{ color: '#F0EDE8', marginBottom: '1rem', fontSize: '14px' }}>Choose new host:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {activeMembers.filter(m => !m.is_host && !m.is_observer).map(m => (
                <button key={m.user_id} onClick={() => transferHost(m.user_id)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px', padding: '0.6rem 0.75rem', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}>
                  <Avatar name={m.display_name} color={m.avatar_color} size={24} />
                  <span style={{ fontSize: '13px', color: '#F0EDE8' }}>{m.display_name}</span>
                </button>
              ))}
              <button onClick={() => setTransferModal(false)} style={{
                marginTop: '0.25rem', padding: '0.5rem', background: 'none',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px',
                color: 'rgba(240,237,232,0.4)', fontSize: '13px', cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Nav-blocked modal (host tries to leave without closing room) ─── */}
      {navBlocked && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1a1a1a', border: '1px solid rgba(244,124,124,0.3)', borderRadius: '16px', padding: '1.5rem', width: 'min(340px,90vw)', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', color: '#F0EDE8', marginBottom: '0.5rem', fontWeight: 600 }}>Close the room first</p>
            <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.5)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Please close the room before leaving this page so all members are properly disconnected.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { setNavBlocked(false); setHostLeaveModal(true) }} style={{
                flex: 1, padding: '0.6rem', background: 'rgba(244,124,124,0.12)', border: '1px solid rgba(244,124,124,0.25)',
                borderRadius: '8px', color: '#F47C7C', fontSize: '13px', cursor: 'pointer',
              }}>Close Room</button>
              <button onClick={() => setNavBlocked(false)} style={{
                flex: 1, padding: '0.6rem', background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', color: 'rgba(240,237,232,0.4)', fontSize: '13px', cursor: 'pointer',
              }}>Stay</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSS KEYFRAMES ────────────────────────────────────────────────── */}
      <style>{`
        @keyframes floatReaction {
          0%   { opacity: 1;   transform: translateY(0) scale(1); }
          70%  { opacity: 0.8; transform: translateY(-60px) scale(1.1); }
          100% { opacity: 0;   transform: translateY(-100px) scale(0.8); }
        }
        @keyframes explainSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes skeletonShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        .stream-cursor {
          display: inline-block; width: 2px; height: 1em;
          background: #f5c842; margin-left: 2px;
          vertical-align: text-bottom; animation: blink 0.8s step-start infinite;
        }
      `}</style>
    </div>
  )
}

// ── Chat Bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg, currentUserId, isHost, roomCode, onPin, onDelete }: {
  msg: ChatMessage; currentUserId: string; isHost: boolean; roomCode: string
  onPin: (msg: ChatMessage, pinned: boolean) => void
  onDelete: (id: string) => void
}) {
  const [reported, setReported] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  if (msg.kind === 'system') {
    return (
      <div style={{ textAlign: 'center', padding: '0.15rem 0' }}>
        <span style={{ fontSize: '11px', color: 'rgba(240,237,232,0.25)', fontFamily: 'monospace' }}>{msg.content}</span>
      </div>
    )
  }

  if (msg.kind === 'doubt') {
    return (
      <div style={{ background: 'rgba(127,183,247,0.07)', border: '1px solid rgba(127,183,247,0.15)', borderRadius: '8px', padding: '0.5rem 0.6rem' }}>
        <p style={{ fontSize: '10px', color: '#7EB8F7', fontFamily: 'monospace', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><IconQuestion size={10} /> {msg.display_name} asks</p>
        <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.75)', lineHeight: 1.5, fontStyle: 'italic' }}>"{msg.content}"</p>
      </div>
    )
  }

  // Detect explain: realtime arrives as kind='explain', DB reconnect arrives as kind='text' with explain JSON
  const isExplain = msg.kind === 'explain' || (() => {
    if (msg.kind !== 'text') return false
    try { const p = JSON.parse(msg.content); return !!(p?.selectedText && p?.explanation) } catch { return false }
  })()

  if (isExplain) {
    const SEP = '|||'
    let selectedText = ''
    let explanation = ''

    if (msg.content.includes(SEP)) {
      const idx = msg.content.indexOf(SEP)
      selectedText = msg.content.slice(0, idx)
      explanation  = msg.content.slice(idx + SEP.length)
    } else {
      // Old JSON format (backward compat)
      try {
        const p = JSON.parse(msg.content)
        selectedText = p?.selectedText ?? ''
        explanation  = p?.explanation  ?? ''
      } catch {
        explanation = msg.content
      }
    }

    return (
      <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(201,169,110,0.15)' }}>
        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(201,169,110,0.08)', borderBottom: '1px solid rgba(201,169,110,0.1)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <IconSparkle size={10} />
          <span style={{ fontSize: '10px', color: '#C9A96E', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            {msg.display_name} shared
          </span>
        </div>
        {selectedText && (
          <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.55)', fontStyle: 'italic', lineHeight: 1.55, margin: 0, borderLeft: '2px solid rgba(201,169,110,0.35)', paddingLeft: '0.5rem' }}>
              &ldquo;{selectedText}&rdquo;
            </p>
          </div>
        )}
        {explanation && (
          <div style={{ padding: '0.65rem 0.75rem' }}>
            <p style={{ fontSize: '9px', color: 'rgba(240,237,232,0.25)', fontFamily: 'monospace', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>AI Explanation</p>
            <p style={{ fontSize: '12.5px', color: 'rgba(240,237,232,0.82)', lineHeight: 1.7, letterSpacing: '0.01em', margin: 0 }}>
              {explanation}
            </p>
          </div>
        )}
      </div>
    )
  }

  if (msg.deleted_at) {
    return (
      <div style={{ padding: '0.25rem 0' }}>
        <span style={{ fontSize: '11px', color: 'rgba(240,237,232,0.2)', fontStyle: 'italic' }}>Message deleted</span>
      </div>
    )
  }

  const isMe = msg.user_id === currentUserId
  const badge = getBadgeEmoji(msg.badge)
  return (
    <div
      style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row', position: 'relative' }}
      onContextMenu={e => { if (isHost) { e.preventDefault(); setMenuOpen(true) } }}
    >
      <AvatarWithBadge name={msg.display_name} color={msg.avatar_color} size={22} badge={msg.badge} />
      <div style={{ maxWidth: '80%' }}>
        {!isMe && (
          <p style={{ fontSize: '10px', color: 'rgba(240,237,232,0.4)', marginBottom: '2px', fontFamily: 'monospace' }}>
            {badge && <span style={{ marginRight: '3px' }}>{badge}</span>}{msg.display_name}
            {msg.pinned && <span style={{ marginLeft: '4px', color: '#C9A96E', display: 'inline-flex', verticalAlign: 'middle' }}><IconPin size={10} /></span>}
          </p>
        )}
        <div style={{
          background: isMe ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isMe ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
          padding: '0.4rem 0.6rem',
        }}>
          <div style={{ fontSize: '13px', color: '#F0EDE8', lineHeight: 1.55, wordBreak: 'break-word' }} className="chat-md">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p:          ({ children }) => <p style={{ margin: '0 0 0.35rem', lineHeight: 1.55 }}>{children}</p>,
                strong:     ({ children }) => <strong style={{ fontWeight: 600, color: '#F0EDE8' }}>{children}</strong>,
                em:         ({ children }) => <em style={{ fontStyle: 'italic', color: 'rgba(240,237,232,0.8)' }}>{children}</em>,
                blockquote: ({ children }) => <blockquote style={{ borderLeft: '2px solid rgba(255,255,255,0.2)', paddingLeft: '0.6rem', margin: '0.3rem 0', color: 'rgba(240,237,232,0.6)', fontStyle: 'italic' }}>{children}</blockquote>,
                code:       ({ children }) => <code style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '0.1em 0.35em', fontFamily: 'monospace', fontSize: '12px' }}>{children}</code>,
                pre:        ({ children }) => <pre style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0.5rem 0.65rem', overflowX: 'auto', margin: '0.35rem 0', fontFamily: 'monospace', fontSize: '12px' }}>{children}</pre>,
                ul:         ({ children }) => <ul style={{ paddingLeft: '1.2rem', margin: '0.3rem 0' }}>{children}</ul>,
                ol:         ({ children }) => <ol style={{ paddingLeft: '1.2rem', margin: '0.3rem 0' }}>{children}</ol>,
                li:         ({ children }) => <li style={{ marginBottom: '0.15rem' }}>{children}</li>,
                hr:         () => <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.4rem 0' }} />,
                h1:         ({ children }) => <p style={{ fontWeight: 700, fontSize: '14px', margin: '0.3rem 0' }}>{children}</p>,
                h2:         ({ children }) => <p style={{ fontWeight: 600, fontSize: '13.5px', margin: '0.3rem 0' }}>{children}</p>,
                h3:         ({ children }) => <p style={{ fontWeight: 600, fontSize: '13px', margin: '0.25rem 0' }}>{children}</p>,
                a:          ({ children }) => <span style={{ color: '#C9A96E', textDecoration: 'underline' }}>{children}</span>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
        {!isMe && !reported && !isHost && (
          <button onClick={async () => {
            await fetch(`/api/rooms/${roomCode}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportedUserId: msg.user_id, messageId: msg.id }) })
            setReported(true)
          }} style={{ background: 'none', border: 'none', color: 'rgba(240,237,232,0.15)', fontSize: '9px', cursor: 'pointer', padding: 0, marginTop: '2px' }}>
            report
          </button>
        )}
        {reported && <span style={{ fontSize: '9px', color: 'rgba(240,237,232,0.2)' }}>reported</span>}
      </div>
      {/* Host context menu */}
      {menuOpen && isHost && (
        <div style={{ position: 'absolute', top: 0, left: isMe ? 'auto' : '100%', right: isMe ? '100%' : 'auto', zIndex: 200, background: 'rgba(22,20,18,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', minWidth: 120 }}
          onMouseLeave={() => setMenuOpen(false)}>
          <button onClick={() => { onPin(msg, !msg.pinned); setMenuOpen(false) }} style={{ display: 'block', width: '100%', padding: '0.4rem 0.75rem', background: 'none', border: 'none', color: '#F0EDE8', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}>
            {msg.pinned ? 'Unpin' : <><IconPin size={11} /> Pin</>}
          </button>
          <button onClick={() => { onDelete(msg.id); setMenuOpen(false) }} style={{ display: 'block', width: '100%', padding: '0.4rem 0.75rem', background: 'none', border: 'none', color: '#F47C7C', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}>
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  )
}
