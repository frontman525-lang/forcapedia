'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Room {
  id: string; code: string; host_id: string
  article_slug: string; article_title: string; max_members: number
}
interface Member {
  id: string; user_id: string; display_name: string
  avatar_color: string; is_host: boolean; is_observer: boolean
  left_at: string | null; kicked_at: string | null
}
interface ChatMessage {
  id: string; user_id: string; display_name: string
  avatar_color: string; content: string; kind: string; created_at: string
}
interface NavEntry {
  id: string; article_slug: string; article_title: string; navigated_at: string
}
interface Article {
  slug: string; title: string; content: string; summary: string; category: string
}
interface FloatingReaction { id: string; emoji: string; x: number; y: number; label: string }
interface SharedExplain  { selectedText: string; explanation: string; triggeredBy: string; color: string }
interface NavNotification { slug: string; title: string }
interface NavRequest      { requestId: string; userId: string; displayName: string; targetSlug: string; targetTitle: string }
interface CurrentUser     { id: string; name: string; avatarColor: string; isHost: boolean; isObserver: boolean; tier: string }
interface SearchResult    { slug: string; title: string; category: string }

interface StudyRoomProps {
  roomCode: string; room: Room
  initialMembers: Member[]; initialMessages: ChatMessage[]
  initialNavHistory: NavEntry[]; initialArticle: Article
  currentUser: CurrentUser; initialHighlights: unknown[]
}

const REACTIONS = ['🔥', '💯', '🤔', '❓']

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

// ═════════════════════════════════════════════════════════════════════════════
export default function StudyRoom({
  roomCode, room, initialMembers, initialMessages,
  initialNavHistory, initialArticle, currentUser,
}: StudyRoomProps) {
  const router  = useRouter()
  const supabase = createClient()
  const chRef   = useRef<RealtimeChannel | null>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const lastScrollBcast = useRef(0)
  const msgTsRef = useRef<number[]>([])

  const [members,         setMembers]         = useState<Member[]>(initialMembers)
  const [messages,        setMessages]        = useState<ChatMessage[]>(initialMessages)
  const [navHistory,      setNavHistory]      = useState<NavEntry[]>(initialNavHistory)
  const [article,         setArticle]         = useState<Article>(initialArticle)
  const [reactions,       setReactions]       = useState<FloatingReaction[]>([])
  const [chatOpen,        setChatOpen]        = useState(true)
  const [chatInput,       setChatInput]       = useState('')
  const [mutedUntil,      setMutedUntil]      = useState(0)
  const [isFollowing,     setIsFollowing]     = useState(true)
  const [sharedExplain,   setSharedExplain]   = useState<SharedExplain | null>(null)
  const [navNotif,        setNavNotif]        = useState<NavNotification | null>(null)
  const [navRequest,      setNavRequest]      = useState<NavRequest | null>(null)
  const [sessionEnded,    setSessionEnded]    = useState(false)
  const [hostLeaveModal,  setHostLeaveModal]  = useState(false)
  const [searchOpen,      setSearchOpen]      = useState(false)
  const [searchQ,         setSearchQ]         = useState('')
  const [searchResults,   setSearchResults]   = useState<SearchResult[]>([])
  const [searchLoading,   setSearchLoading]   = useState(false)
  const [isMobile,        setIsMobile]        = useState(false)
  const [selection,       setSelection]       = useState<{ text: string; x: number; y: number } | null>(null)
  const [explainLoading,  setExplainLoading]  = useState(false)
  const [chatError,       setChatError]       = useState('')
  const [transferModal,   setTransferModal]   = useState(false)

  // ── Mobile detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: currentUser.id }, broadcast: { self: false } },
    })
    chRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; displayName: string; avatarColor: string; isHost: boolean; isObserver: boolean }>()
        const online = new Set(Object.keys(state))
        setMembers(prev => prev.map(m => ({ ...m, _online: online.has(m.user_id) } as Member)))
      })
      .on('broadcast', { event: 'scroll' }, ({ payload }) => {
        if (!isFollowing || currentUser.isHost) return
        const { scrollHeight, clientHeight } = document.documentElement
        window.scrollTo({ top: payload.pct * (scrollHeight - clientHeight), behavior: 'smooth' })
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        setMessages(prev => [...prev.slice(-19), payload as ChatMessage])
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const id = `${Date.now()}-${Math.random()}`
        setReactions(prev => [...prev, { id, emoji: payload.emoji, x: payload.x, y: payload.y, label: payload.displayName }])
        setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000)
      })
      .on('broadcast', { event: 'explain_shared' }, ({ payload }) => {
        setSharedExplain(payload as SharedExplain)
        setMessages(prev => [...prev.slice(-19), {
          id: `explain-${Date.now()}`, user_id: payload.userId,
          display_name: payload.triggeredBy, avatar_color: payload.color,
          content: JSON.stringify({ selectedText: payload.selectedText, explanation: payload.explanation }),
          kind: 'explain', created_at: new Date().toISOString(),
        }])
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .on('broadcast', { event: 'navigate' }, ({ payload }) => {
        fetchArticle(payload.slug)
        setNavNotif({ slug: payload.slug, title: payload.title })
        setTimeout(() => setNavNotif(null), 8000)
      })
      .on('broadcast', { event: 'member_kicked' }, ({ payload }) => {
        if (payload.userId === currentUser.id) { setSessionEnded(true); return }
        setMembers(prev => prev.filter(m => m.user_id !== payload.userId))
      })
      .on('broadcast', { event: 'room_closed' }, () => setSessionEnded(true))
      .on('broadcast', { event: 'nav_request' }, ({ payload }) => {
        if (currentUser.isHost) setNavRequest(payload as NavRequest)
      })
      .on('broadcast', { event: 'nav_approved' }, ({ payload }) => {
        fetchArticle(payload.slug)
      })
      .on('broadcast', { event: 'host_transferred' }, ({ payload }) => {
        setMembers(prev => prev.map(m => ({
          ...m,
          is_host: m.user_id === payload.newHostId,
        })))
        if (payload.newHostId === currentUser.id) window.location.reload()
      })
      .on('broadcast', { event: 'member_joined' }, ({ payload }) => {
        setMembers(prev => {
          if (prev.some(m => m.user_id === payload.user_id)) return prev
          return [...prev, payload as Member]
        })
      })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId:      currentUser.id,
          displayName: currentUser.name,
          avatarColor: currentUser.avatarColor,
          isHost:      currentUser.isHost,
          isObserver:  currentUser.isObserver,
        })
      }
    })

    return () => { supabase.removeChannel(channel) }
  }, [roomCode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll sync (host → members) ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUser.isHost) return
    const onScroll = () => {
      const now = Date.now()
      if (now - lastScrollBcast.current < 200) return
      lastScrollBcast.current = now
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement
      chRef.current?.send({ type: 'broadcast', event: 'scroll',
        payload: { pct: scrollHeight <= clientHeight ? 0 : scrollTop / (scrollHeight - clientHeight) } })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [currentUser.isHost])

  // ── Member scroll → disable follow ────────────────────────────────────────
  useEffect(() => {
    if (currentUser.isHost) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      setIsFollowing(false)
      clearTimeout(timeout)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timeout) }
  }, [currentUser.isHost])

  // ── Text selection → highlight toolbar ────────────────────────────────────
  useEffect(() => {
    if (currentUser.isObserver) return
    const onMouseUp = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { setSelection(null); return }
      const r = sel.getRangeAt(0).getBoundingClientRect()
      setSelection({ text: sel.toString().trim(), x: r.left + r.width / 2, y: r.top - 8 })
    }
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchend', onMouseUp)
    return () => { document.removeEventListener('mouseup', onMouseUp); document.removeEventListener('touchend', onMouseUp) }
  }, [currentUser.isObserver])

  // ── Cleanup on leave/unmount ───────────────────────────────────────────────
  useEffect(() => {
    const beacon = () => navigator.sendBeacon(`/api/rooms/${roomCode}/leave`)
    window.addEventListener('beforeunload', beacon)
    return () => {
      window.removeEventListener('beforeunload', beacon)
      fetch(`/api/rooms/${roomCode}/leave`, { method: 'POST' }).catch(() => null)
    }
  }, [roomCode])

  // ── Scroll chat to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function fetchArticle(slug: string) {
    try {
      const res = await fetch(`/api/article?slug=${encodeURIComponent(slug)}`)
      if (res.ok) {
        const data = await res.json()
        setArticle(data)
        setNavHistory(prev => [...prev, { id: Date.now().toString(), article_slug: slug, article_title: data.title, navigated_at: new Date().toISOString() }])
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch { /* ignore */ }
  }

  async function sendMessage() {
    if (!chatInput.trim() || currentUser.isObserver) return
    if (containsBlocked(chatInput)) { setChatError('Links and phone numbers are not allowed.'); return }
    const now = Date.now()
    const recent = msgTsRef.current.filter(t => now - t < 30000)
    if (recent.length >= 5) {
      setMutedUntil(now + 300_000)
      setChatError('You sent too many messages. Muted for 5 minutes.')
      return
    }
    if (now < mutedUntil) { setChatError(`You are muted for ${Math.ceil((mutedUntil - now) / 60000)} more min.`); return }
    msgTsRef.current = [...recent, now]
    setChatError('')

    const res = await fetch(`/api/rooms/${roomCode}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: chatInput.trim() }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(prev => [...prev.slice(-19), msg])
      chRef.current?.send({ type: 'broadcast', event: 'message', payload: msg })
      setChatInput('')
    }
  }

  async function triggerSharedExplain() {
    if (!selection || explainLoading) return
    setExplainLoading(true)
    setSelection(null)
    const res = await fetch(`/api/rooms/${roomCode}/highlight`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedText: selection.text, withExplain: true }),
    })
    if (res.ok) {
      const { explanation } = await res.json()
      if (explanation) {
        const payload: SharedExplain = {
          selectedText: selection.text, explanation,
          triggeredBy: currentUser.name, color: currentUser.avatarColor,
        }
        chRef.current?.send({ type: 'broadcast', event: 'explain_shared',
          payload: { ...payload, userId: currentUser.id } })
        setSharedExplain(payload)
        setTimeout(() => setSharedExplain(null), 30000)
      }
    }
    setExplainLoading(false)
  }

  async function highlightOnly() {
    if (!selection) return
    setSelection(null)
    await fetch(`/api/rooms/${roomCode}/highlight`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedText: selection.text, withExplain: false }),
    })
  }

  function sendReaction(emoji: string) {
    const x = 50 + Math.random() * 30
    const y = 50 + Math.random() * 30
    chRef.current?.send({ type: 'broadcast', event: 'reaction',
      payload: { emoji, x, y, displayName: currentUser.name } })
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

  async function hostNavigateTo(slug: string, title: string) {
    setSearchOpen(false)
    await fetch(`/api/rooms/${roomCode}/navigate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleSlug: slug, articleTitle: title }),
    })
    fetchArticle(slug)
    chRef.current?.send({ type: 'broadcast', event: 'navigate', payload: { slug, title } })
  }

  async function kickMember(targetUserId: string) {
    await fetch(`/api/rooms/${roomCode}/kick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    })
    chRef.current?.send({ type: 'broadcast', event: 'member_kicked', payload: { userId: targetUserId } })
    setMembers(prev => prev.filter(m => m.user_id !== targetUserId))
  }

  async function closeRoom() {
    await fetch(`/api/rooms/${roomCode}/close`, { method: 'POST' })
    chRef.current?.send({ type: 'broadcast', event: 'room_closed', payload: {} })
    setSessionEnded(true)
  }

  async function transferHost(newHostId: string) {
    const res = await fetch(`/api/rooms/${roomCode}/transfer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newHostId }),
    })
    if (res.ok) {
      const { newHostName } = await res.json()
      chRef.current?.send({ type: 'broadcast', event: 'host_transferred',
        payload: { newHostId, newHostName } })
      setHostLeaveModal(false)
      await fetch(`/api/rooms/${roomCode}/leave`, { method: 'POST' })
      router.push('/')
    }
  }

  function approveNavRequest() {
    if (!navRequest) return
    chRef.current?.send({ type: 'broadcast', event: 'nav_approved',
      payload: { slug: navRequest.targetSlug, title: navRequest.targetTitle } })
    fetchArticle(navRequest.targetSlug)
    setNavRequest(null)
  }

  // ── SESSION ENDED SCREEN ──────────────────────────────────────────────────
  if (sessionEnded) {
    return (
      <div style={{
        minHeight: '100vh', background: '#191919',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '1rem', padding: '2rem',
      }}>
        <p style={{ fontFamily: 'Georgia,serif', fontSize: '2rem', fontWeight: 300, color: '#F0EDE8' }}>
          Session ended
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(240,237,232,0.45)' }}>
          This study room has closed.
        </p>
        <Link href="/" style={{
          marginTop: '0.5rem', padding: '0.6rem 1.5rem',
          background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.3)',
          borderRadius: '8px', color: '#C9A96E', textDecoration: 'none', fontSize: '14px',
        }}>
          Start a new session →
        </Link>
      </div>
    )
  }

  // ── ACTIVE members (excluding those who left without kicking) ─────────────
  const activeMembers = members.filter(m => !m.kicked_at && !m.left_at)

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#191919', overflow: 'hidden' }}>

      {/* ── ROOM BAR ──────────────────────────────────────────────────────── */}
      <header style={{
        height: 52, minHeight: 52, background: 'rgba(22,20,18,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0 1rem', zIndex: 100, flexShrink: 0,
      }}>
        {/* Green dot + room name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6FCF97', display: 'block' }} />
          <span style={{ fontFamily: 'Georgia,serif', fontSize: '14px', color: '#F0EDE8', fontWeight: 300, whiteSpace: 'nowrap' }}>
            {activeMembers.find(m => m.is_host)?.display_name ?? 'Study'}&apos;s Room
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(201,169,110,0.6)', letterSpacing: '0.1em' }}>
            {roomCode}
          </span>
        </div>

        {/* Host search bar */}
        {currentUser.isHost && (
          <button onClick={() => setSearchOpen(true)} style={{
            flex: 1, maxWidth: 280, height: 28, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
            color: 'rgba(240,237,232,0.35)', fontSize: '12px', cursor: 'text',
            textAlign: 'left', padding: '0 0.6rem', fontFamily: 'var(--font-mono, monospace)',
          }}>
            🔍 Search articles…
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Member avatars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: -4 }}>
          {activeMembers.slice(0, isMobile ? 3 : 6).map(m => (
            <div key={m.user_id} style={{ position: 'relative', marginLeft: -6 }}>
              <Avatar name={m.display_name} color={m.avatar_color} size={24} />
              {m.is_host && (
                <span style={{
                  position: 'absolute', bottom: -2, right: -2,
                  background: '#C9A96E', borderRadius: '50%',
                  width: 8, height: 8, border: '1px solid #191919',
                }} />
              )}
            </div>
          ))}
          {activeMembers.length > (isMobile ? 3 : 6) && (
            <span style={{ marginLeft: 4, fontSize: '10px', color: 'rgba(240,237,232,0.4)', fontFamily: 'monospace' }}>
              +{activeMembers.length - (isMobile ? 3 : 6)}
            </span>
          )}
        </div>

        {/* Observer badge */}
        {currentUser.isObserver && (
          <span style={{
            fontSize: '10px', letterSpacing: '0.08em',
            fontFamily: 'monospace', color: 'rgba(240,237,232,0.35)',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '4px', padding: '2px 6px', flexShrink: 0,
          }}>
            OBSERVER
          </span>
        )}

        {/* Reactions bar */}
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

        {/* Chat toggle */}
        <button onClick={() => setChatOpen(o => !o)} style={{
          background: chatOpen ? 'rgba(201,169,110,0.1)' : 'none',
          border: '1px solid', borderColor: chatOpen ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.06)',
          borderRadius: '6px', color: chatOpen ? '#C9A96E' : 'rgba(240,237,232,0.4)',
          fontSize: '11px', padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
        }}>
          {chatOpen ? '✕ Chat' : '💬 Chat'}
        </button>

        {/* Leave button */}
        <button
          onClick={() => currentUser.isHost ? setHostLeaveModal(true) : (fetch(`/api/rooms/${roomCode}/leave`, { method: 'POST' }).then(() => router.push('/')))}
          style={{
            background: 'rgba(244,124,124,0.08)', border: '1px solid rgba(244,124,124,0.2)',
            borderRadius: '6px', color: '#F47C7C', fontSize: '11px',
            padding: '3px 10px', cursor: 'pointer', flexShrink: 0,
          }}>
          Leave
        </button>
      </header>

      {/* ── NAV BREADCRUMB ────────────────────────────────────────────────── */}
      {navHistory.length > 1 && (
        <div style={{
          background: 'rgba(22,20,18,0.9)', borderBottom: '1px solid rgba(255,255,255,0.04)',
          padding: '0.35rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
          overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none',
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(201,169,110,0.5)', fontFamily: 'monospace', flexShrink: 0 }}>📚</span>
          {navHistory.map((entry, i) => (
            <span key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              {i > 0 && <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px' }}>→</span>}
              <button
                onClick={() => {
                  if (currentUser.isHost) {
                    hostNavigateTo(entry.article_slug, entry.article_title)
                  } else {
                    chRef.current?.send({ type: 'broadcast', event: 'nav_request', payload: {
                      requestId: Date.now().toString(), userId: currentUser.id,
                      displayName: currentUser.name,
                      targetSlug: entry.article_slug, targetTitle: entry.article_title,
                    }})
                  }
                }}
                style={{
                  background: article.slug === entry.article_slug ? 'rgba(201,169,110,0.12)' : 'none',
                  border: 'none', color: article.slug === entry.article_slug ? '#C9A96E' : 'rgba(240,237,232,0.4)',
                  fontSize: '10px', cursor: 'pointer', padding: '1px 6px', borderRadius: '4px',
                  fontFamily: 'monospace', whiteSpace: 'nowrap',
                }}>
                {entry.article_title}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── MAIN BODY ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Article area */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: isMobile ? '1.5rem 1rem' : '2rem 1.5rem',
          maxWidth: chatOpen && !isMobile ? 'calc(100% - 320px)' : '100%',
          transition: 'max-width 0.2s',
        }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* Article header */}
            <p style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: '0.5rem' }}>
              {article.category}
            </p>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(1.6rem,4vw,2.6rem)', fontWeight: 300, color: '#F0EDE8', lineHeight: 1.2, marginBottom: '1rem' }}>
              {article.title}
            </h1>
            {article.summary && (
              <p style={{ fontSize: '16px', color: 'rgba(240,237,232,0.5)', lineHeight: 1.7, marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {article.summary}
              </p>
            )}

            {/* Article body */}
            <div
              ref={articleRef}
              className="article-prose"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* Observer upgrade nudge */}
            {currentUser.isObserver && (
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

            {/* Follow host button */}
            {!currentUser.isHost && !isFollowing && (
              <button
                onClick={() => setIsFollowing(true)}
                style={{
                  position: 'fixed', bottom: isMobile ? 80 : 24, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(22,20,18,0.95)', border: '1px solid rgba(201,169,110,0.3)',
                  borderRadius: '999px', color: '#C9A96E', fontSize: '12px',
                  padding: '0.5rem 1.25rem', cursor: 'pointer', zIndex: 50,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                }}>
                ↑ Follow host
              </button>
            )}
          </div>
        </div>

        {/* ── CHAT SIDEBAR / BOTTOM SHEET ──────────────────────────────────── */}
        {chatOpen && (
          <aside style={{
            width: isMobile ? '100%' : 320,
            height: isMobile ? 300 : '100%',
            position: isMobile ? 'absolute' : 'relative',
            bottom: isMobile ? 0 : undefined,
            left: isMobile ? 0 : undefined,
            zIndex: isMobile ? 80 : undefined,
            display: 'flex', flexDirection: 'column',
            background: 'rgba(22,20,18,0.98)',
            borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
            borderTop:  isMobile ? '1px solid rgba(255,255,255,0.08)' : 'none',
            flexShrink: 0,
          }}>
            {/* Members list header */}
            <div style={{
              padding: '0.6rem 0.75rem',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center',
            }}>
              {activeMembers.map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title={m.display_name}>
                  <Avatar name={m.display_name} color={m.avatar_color} size={20} />
                  <span style={{ fontSize: '11px', color: 'rgba(240,237,232,0.5)' }}>{m.display_name.split(' ')[0]}</span>
                  {m.is_host && <span style={{ fontSize: '8px', color: '#C9A96E' }}>★</span>}
                  {currentUser.isHost && m.user_id !== currentUser.id && (
                    <button onClick={() => kickMember(m.user_id)} title="Remove" style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(244,124,124,0.4)', fontSize: '10px', padding: 0, lineHeight: 1,
                    }}>✕</button>
                  )}
                </div>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map(msg => <ChatBubble key={msg.id} msg={msg} currentUserId={currentUser.id} roomCode={roomCode} />)}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            {!currentUser.isObserver ? (
              <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {chatError && <p style={{ fontSize: '10px', color: '#F47C7C', marginBottom: '0.3rem' }}>{chatError}</p>}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    value={chatInput}
                    onChange={e => { setChatInput(e.target.value); setChatError('') }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Type a message…"
                    maxLength={500}
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
        )}
      </div>

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

      {/* ── TEXT SELECTION TOOLBAR ─────────────────────────────────────────── */}
      {selection && (
        <div style={{
          position: 'fixed', left: selection.x, top: selection.y,
          transform: 'translate(-50%, -100%)', zIndex: 300,
          background: 'rgba(22,20,18,0.96)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', padding: '0.3rem', display: 'flex', gap: '0.2rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <button
            onClick={triggerSharedExplain}
            disabled={explainLoading}
            style={{
              background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.2)',
              borderRadius: '6px', color: '#C9A96E', fontSize: '12px', padding: '0.3rem 0.7rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}>
            {explainLoading ? '…' : '✦ Explain to room'}
          </button>
          <button onClick={highlightOnly} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px', color: 'rgba(240,237,232,0.6)', fontSize: '12px',
            padding: '0.3rem 0.7rem', cursor: 'pointer',
          }}>
            🖊 Highlight
          </button>
          <button onClick={() => setSelection(null)} style={{
            background: 'none', border: 'none', color: 'rgba(240,237,232,0.3)',
            fontSize: '14px', cursor: 'pointer', padding: '0 0.3rem',
          }}>✕</button>
        </div>
      )}

      {/* ── SHARED EXPLAIN BANNER ─────────────────────────────────────────── */}
      {sharedExplain && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          width: 'min(520px, 90vw)', zIndex: 150,
          background: 'rgba(22,20,18,0.97)', border: '1px solid rgba(201,169,110,0.2)',
          borderRadius: '16px', padding: '1rem 1.25rem',
          boxShadow: '0 16px 64px rgba(0,0,0,0.7)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '11px', color: '#C9A96E', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
              ✦ {sharedExplain.triggeredBy} explained this
            </p>
            <button onClick={() => setSharedExplain(null)} style={{ background: 'none', border: 'none', color: 'rgba(240,237,232,0.3)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
          </div>
          <blockquote style={{
            borderLeft: `2px solid ${sharedExplain.color}`, paddingLeft: '0.75rem',
            color: 'rgba(240,237,232,0.5)', fontSize: '13px', fontStyle: 'italic',
            marginBottom: '0.75rem', lineHeight: 1.5,
          }}>
            "{sharedExplain.selectedText.slice(0, 200)}{sharedExplain.selectedText.length > 200 ? '…' : ''}"
          </blockquote>
          <p style={{ fontSize: '14px', color: 'rgba(240,237,232,0.8)', lineHeight: 1.7 }}>
            {sharedExplain.explanation}
          </p>
        </div>
      )}

      {/* ── NAV NOTIFICATION ─────────────────────────────────────────────── */}
      {navNotif && (
        <div style={{
          position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(22,20,18,0.95)', border: '1px solid rgba(201,169,110,0.2)',
          borderRadius: '10px', padding: '0.6rem 1rem', zIndex: 120,
          display: 'flex', gap: '0.75rem', alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <span style={{ fontSize: '13px', color: 'rgba(240,237,232,0.7)' }}>
            Host moved to <strong style={{ color: '#F0EDE8' }}>{navNotif.title}</strong>
          </span>
          <button onClick={() => { fetchArticle(navNotif.slug); setNavNotif(null) }} style={{
            background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.25)',
            borderRadius: '6px', color: '#C9A96E', fontSize: '12px', padding: '3px 10px', cursor: 'pointer',
          }}>Follow →</button>
          <button onClick={() => setNavNotif(null)} style={{ background: 'none', border: 'none', color: 'rgba(240,237,232,0.3)', cursor: 'pointer', fontSize: '13px' }}>Stay</button>
        </div>
      )}

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
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh',
        }} onClick={e => { if (e.target === e.currentTarget) setSearchOpen(false) }}>
          <div style={{
            background: '#1E1C1A', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', width: 'min(520px, 90vw)', overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                autoFocus
                value={searchQ}
                onChange={e => { setSearchQ(e.target.value); searchArticles(e.target.value) }}
                placeholder="Search for an article…"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', color: '#F0EDE8', fontSize: '14px', padding: '0.6rem 0.8rem',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {searchLoading && <p style={{ padding: '1rem', fontSize: '13px', color: 'rgba(240,237,232,0.4)', textAlign: 'center' }}>Searching…</p>}
              {searchResults.map(r => (
                <button key={r.slug} onClick={() => hostNavigateTo(r.slug, r.title)} style={{
                  width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  padding: '0.75rem 1rem', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                  <p style={{ fontSize: '9px', color: '#C9A96E', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{r.category}</p>
                  <p style={{ fontSize: '14px', color: '#F0EDE8' }}>{r.title}</p>
                </button>
              ))}
              {!searchLoading && searchQ && searchResults.length === 0 && (
                <p style={{ padding: '1rem', fontSize: '13px', color: 'rgba(240,237,232,0.35)', textAlign: 'center' }}>No results for "{searchQ}"</p>
              )}
            </div>
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
              <button onClick={closeRoom} style={{
                padding: '0.6rem', background: 'rgba(244,124,124,0.1)', border: '1px solid rgba(244,124,124,0.2)',
                borderRadius: '8px', color: '#F47C7C', fontSize: '13px', cursor: 'pointer',
              }}>
                Close room for everyone
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

      {/* ── CSS KEYFRAMES ────────────────────────────────────────────────── */}
      <style>{`
        @keyframes floatReaction {
          0%   { opacity: 1;   transform: translateY(0) scale(1); }
          70%  { opacity: 0.8; transform: translateY(-60px) scale(1.1); }
          100% { opacity: 0;   transform: translateY(-100px) scale(0.8); }
        }
      `}</style>
    </div>
  )
}

// ── Chat Bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg, currentUserId, roomCode }: { msg: ChatMessage; currentUserId: string; roomCode: string }) {
  const [reported, setReported] = useState(false)

  if (msg.kind === 'system') {
    return (
      <div style={{ textAlign: 'center', padding: '0.15rem 0' }}>
        <span style={{ fontSize: '11px', color: 'rgba(240,237,232,0.25)', fontFamily: 'monospace' }}>{msg.content}</span>
      </div>
    )
  }

  if (msg.kind === 'explain') {
    let parsed: { selectedText: string; explanation: string } | null = null
    try { parsed = JSON.parse(msg.content) } catch { /* ignore */ }
    return (
      <div style={{
        background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.12)',
        borderRadius: '8px', padding: '0.5rem 0.6rem',
      }}>
        <p style={{ fontSize: '10px', color: '#C9A96E', fontFamily: 'monospace', marginBottom: '0.3rem' }}>
          ✦ {msg.display_name} explained
        </p>
        {parsed && (
          <>
            <p style={{ fontSize: '11px', color: 'rgba(240,237,232,0.4)', fontStyle: 'italic', marginBottom: '0.4rem', lineHeight: 1.4 }}>
              "{parsed.selectedText.slice(0, 120)}{parsed.selectedText.length > 120 ? '…' : ''}"
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.75)', lineHeight: 1.6 }}>
              {parsed.explanation}
            </p>
          </>
        )}
      </div>
    )
  }

  const isMe = msg.user_id === currentUserId
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row' }}>
      <Avatar name={msg.display_name} color={msg.avatar_color} size={22} />
      <div style={{ maxWidth: '80%' }}>
        {!isMe && <p style={{ fontSize: '10px', color: 'rgba(240,237,232,0.4)', marginBottom: '2px', fontFamily: 'monospace' }}>{msg.display_name}</p>}
        <div style={{
          background: isMe ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isMe ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
          padding: '0.4rem 0.6rem',
        }}>
          <p style={{ fontSize: '13px', color: '#F0EDE8', lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</p>
        </div>
        {!isMe && !reported && (
          <button onClick={async () => {
            await fetch(`/api/rooms/${roomCode}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportedUserId: msg.user_id, messageId: msg.id }) })
            setReported(true)
          }} style={{ background: 'none', border: 'none', color: 'rgba(240,237,232,0.15)', fontSize: '9px', cursor: 'pointer', padding: 0, marginTop: '2px' }}>
            report
          </button>
        )}
        {reported && <span style={{ fontSize: '9px', color: 'rgba(240,237,232,0.2)' }}>reported</span>}
      </div>
    </div>
  )
}
