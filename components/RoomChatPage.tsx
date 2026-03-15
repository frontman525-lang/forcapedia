'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPusher, ch } from '@/lib/soketi/client'
import type { PusherClient } from '@/lib/soketi/client'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member {
  user_id: string; display_name: string; avatar_color: string
  is_host: boolean; is_observer: boolean; badge?: string | null
}

interface ChatMessage {
  id: string; user_id: string; display_name: string
  avatar_color: string; content: string; kind: string; created_at: string
  pinned?: boolean; deleted_at?: string | null; badge?: string | null
}

interface CurrentUser {
  id: string; name: string; avatarColor: string
  isHost: boolean; isObserver: boolean; tier: string; badge?: string | null
}

export interface RoomChatPageProps {
  roomCode: string
  roomName: string
  initialMessages: ChatMessage[]
  initialMembers: Member[]
  currentUser: CurrentUser
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, color: '#191919', flexShrink: 0,
      fontFamily: 'var(--font-sans, system-ui)',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function containsBlocked(t: string) {
  return /https?:\/\/\S+|www\.\S+|\b\S+\.(com|net|org|io|co|in|uk)\b/gi.test(t) ||
    /\b\d{10,}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\+\d[\s\d\-]{9,}/g.test(t)
}

function getBadgeLabel(badge: string | null | undefined) {
  if (!badge) return null
  const map: Record<string, string> = { scholar: '◆', researcher: '◈', admin: '✦' }
  return map[badge] ?? null
}

function IconQuestion({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5"/>
      <path d="M6 6.2c0-1.1.9-2 2-2s2 .9 2 2c0 1.3-2 2-2 2.8"/>
      <circle cx="8" cy="11.5" r=".6" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function IconSparkle({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l1.2 4.8L14 8l-4.8 1.2L8 15l-1.2-4.8L2 8l4.8-1.2z"/>
    </svg>
  )
}

function IconPin({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5l5 5-3 1-3.5 3.5-1 3-4-4 3-1z"/>
      <line x1="1.5" y1="14.5" x2="5.5" y2="10.5"/>
    </svg>
  )
}

function IconClose({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="3" x2="13" y2="13"/>
      <line x1="13" y1="3" x2="3" y2="13"/>
    </svg>
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
        <p style={{ fontSize: '10px', color: '#7EB8F7', fontFamily: 'monospace', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <IconQuestion size={10} /> {msg.display_name} asks
        </p>
        <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.75)', lineHeight: 1.5, fontStyle: 'italic' }}>"{msg.content}"</p>
      </div>
    )
  }

  if (msg.kind === 'explain') {
    let parsed: { selectedText: string; explanation: string } | null = null
    // Support both JSON format and ||| SEP format used by StudyRoom
    const SEP = '|||'
    try { parsed = JSON.parse(msg.content) } catch {
      if (msg.content.includes(SEP)) {
        const [sel, exp] = msg.content.split(SEP)
        if (sel && exp) parsed = { selectedText: sel, explanation: exp }
      }
    }
    return (
      <div style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.12)', borderRadius: '8px', padding: '0.5rem 0.6rem' }}>
        <p style={{ fontSize: '10px', color: '#C9A96E', fontFamily: 'monospace', marginBottom: '0.3rem' }}>
          <IconSparkle size={10} /> {msg.display_name} explained
        </p>
        {parsed && (
          <>
            <p style={{ fontSize: '11px', color: 'rgba(240,237,232,0.4)', fontStyle: 'italic', marginBottom: '0.4rem', lineHeight: 1.4 }}>
              &ldquo;{parsed.selectedText.slice(0, 120)}{parsed.selectedText.length > 120 ? '…' : ''}&rdquo;
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(240,237,232,0.75)', lineHeight: 1.6 }}>{parsed.explanation}</p>
          </>
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
  const badge = getBadgeLabel(msg.badge)

  return (
    <div
      style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row', position: 'relative' }}
      onContextMenu={e => { if (isHost) { e.preventDefault(); setMenuOpen(true) } }}
    >
      <Avatar name={msg.display_name} color={msg.avatar_color} size={24} />
      <div style={{ maxWidth: '78%' }}>
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
          padding: '0.45rem 0.7rem',
        }}>
          <div style={{ fontSize: '14px', color: '#F0EDE8', lineHeight: 1.55, wordBreak: 'break-word' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p style={{ margin: 0, lineHeight: 1.55 }}>{children}</p>,
                strong: ({ children }) => <strong style={{ color: '#F0EDE8', fontWeight: 600 }}>{children}</strong>,
                em: ({ children }) => <em style={{ color: 'rgba(240,237,232,0.75)' }}>{children}</em>,
                code: ({ children }) => <code style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '1px 4px', fontSize: '12px', fontFamily: 'monospace' }}>{children}</code>,
                ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: '1.2em' }}>{children}</ul>,
                ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: '1.2em' }}>{children}</ol>,
                li: ({ children }) => <li style={{ lineHeight: 1.5 }}>{children}</li>,
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
            <IconPin size={11} /> {msg.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button onClick={() => { onDelete(msg.id); setMenuOpen(false) }} style={{ display: 'block', width: '100%', padding: '0.4rem 0.75rem', background: 'none', border: 'none', color: '#F47C7C', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RoomChatPage({ roomCode, roomName, initialMessages, initialMembers, currentUser }: RoomChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [activeTab, setActiveTab] = useState<'chat' | 'doubts'>('chat')
  const [chatInput, setChatInput] = useState('')
  const [chatError, setChatError] = useState('')
  const [unreadDoubts, setUnreadDoubts] = useState(0)
  const [reconnecting, setReconnecting] = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const pusherRef = useRef<PusherClient | null>(null)

  const socketId = useCallback(() => {
    try { return pusherRef.current?.connection?.socket_id ?? undefined } catch { return undefined }
  }, [])

  // ── Soketi subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const pusher = getPusher()
    pusherRef.current = pusher

    pusher.connection.bind('connecting', () => setReconnecting(true))
    pusher.connection.bind('connected', () => setReconnecting(false))
    pusher.connection.bind('disconnected', () => setReconnecting(true))
    pusher.connection.bind('unavailable', () => setReconnecting(true))

    const chatCh = pusher.subscribe(ch.chat(roomCode))
    const admissionCh = pusher.subscribe(ch.admission(roomCode))

    chatCh.bind('new_message', (data: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev
        return [...prev, data]
      })
      if (data.kind === 'doubt') setUnreadDoubts(n => n + 1)
    })

    chatCh.bind('message_pinned', ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned } : m))
    })

    chatCh.bind('message_deleted', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m))
    })

    admissionCh.bind('member_joined', (data: Member & { user_id: string }) => {
      setMembers(prev => prev.find(m => m.user_id === data.user_id) ? prev : [...prev, data])
    })

    admissionCh.bind('member_left', ({ userId }: { userId: string }) => {
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    })

    return () => {
      chatCh.unbind_all(); pusher.unsubscribe(ch.chat(roomCode))
      admissionCh.unbind_all(); pusher.unsubscribe(ch.admission(roomCode))
      pusher.connection.unbind('connecting')
      pusher.connection.unbind('connected')
      pusher.connection.unbind('disconnected')
      pusher.connection.unbind('unavailable')
    }
  }, [roomCode])

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = chatInput.trim()
    if (!text) return
    if (containsBlocked(text)) { setChatError('Links and phone numbers are not allowed.'); return }
    setChatInput('')
    setChatError('')
    const res = await fetch(`/api/rooms/${roomCode}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, kind: activeTab === 'doubts' ? 'doubt' : 'chat', socketId: socketId() }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); setChatError(d.error ?? 'Failed to send'); return }
    const msg = await res.json()
    setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
  }

  async function pinMessage(msg: ChatMessage, pinned: boolean) {
    await fetch(`/api/rooms/${roomCode}/pin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id, pinned, socketId: socketId() }),
    })
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pinned } : m))
  }

  async function deleteMessage(id: string) {
    await fetch(`/api/rooms/${roomCode}/delete-message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: id, socketId: socketId() }),
    })
    setMessages(prev => prev.map(m => m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m))
  }

  const activeMembers = members.filter(m => !m.is_observer)
  const filteredMessages = messages.filter(msg =>
    activeTab === 'doubts' ? msg.kind === 'doubt' : msg.kind !== 'doubt'
  )

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0F0D0C', color: '#F0EDE8', fontFamily: 'var(--font-sans, system-ui)' }}>

      {/* ── Reconnecting banner ───────────────────────────────────────────── */}
      {reconnecting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999, background: 'rgba(201,169,110,0.12)', borderBottom: '1px solid rgba(201,169,110,0.2)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A96E', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' }} />
          <span style={{ fontSize: '11px', color: '#C9A96E', fontFamily: 'monospace', letterSpacing: '0.06em' }}>Reconnecting…</span>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0 1rem', height: 52, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(15,13,12,0.98)',
        paddingTop: reconnecting ? 28 : 0,
        transition: 'padding-top 0.2s',
      }}>
        <Link href={`/room/${roomCode}`} style={{ color: 'rgba(240,237,232,0.45)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', color: '#F0EDE8', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomName || `Room ${roomCode}`}</p>
          <p style={{ fontSize: '10px', color: 'rgba(240,237,232,0.35)', fontFamily: 'monospace' }}>{activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}</p>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.04)', borderRadius: '100px', padding: '2px' }}>
          {(['chat', 'doubts'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'doubts') setUnreadDoubts(0) }} style={{
              padding: '4px 12px', borderRadius: '100px', border: 'none',
              background: activeTab === tab ? 'rgba(201,169,110,0.18)' : 'none',
              color: activeTab === tab ? '#C9A96E' : 'rgba(240,237,232,0.35)',
              fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.05em',
              cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
            }}>
              {tab === 'chat' ? 'Chat' : `Doubts${unreadDoubts > 0 ? ` · ${unreadDoubts}` : ''}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Members strip ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0,
        padding: '0.4rem 1rem', overflowX: 'auto',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        {activeMembers.map(m => (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
            <Avatar name={m.display_name} color={m.avatar_color} size={20} />
            <span style={{ fontSize: '11px', color: 'rgba(240,237,232,0.45)', whiteSpace: 'nowrap' }}>{m.display_name.split(' ')[0]}</span>
            {m.is_host && <span style={{ fontSize: '8px', color: '#C9A96E', fontFamily: 'monospace' }}>host</span>}
          </div>
        ))}
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {filteredMessages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem', opacity: 0.4 }}>
            <IconQuestion size={28} />
            <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.5)', fontFamily: 'monospace' }}>
              {activeTab === 'doubts' ? 'No doubts raised yet' : 'No messages yet'}
            </p>
          </div>
        )}
        {filteredMessages.map(msg => (
          <ChatBubble
            key={msg.id} msg={msg}
            currentUserId={currentUser.id}
            isHost={currentUser.isHost}
            roomCode={roomCode}
            onPin={pinMessage}
            onDelete={deleteMessage}
          />
        ))}
        <div ref={chatBottomRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '0.6rem 1rem',
        paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(15,13,12,0.98)', flexShrink: 0,
      }}>
        {chatError && <p style={{ fontSize: '11px', color: '#F47C7C', marginBottom: '0.3rem' }}>{chatError}</p>}
        {currentUser.isObserver ? (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <Link href="/pricing" style={{ fontSize: '13px', color: '#C9A96E' }}>Upgrade to chat →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <textarea
              value={chatInput}
              onChange={e => { setChatInput(e.target.value); setChatError('') }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={activeTab === 'doubts' ? 'Ask a doubt…' : 'Type a message…'}
              rows={1}
              maxLength={500}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '10px', color: '#F0EDE8', fontSize: '15px', padding: '0.55rem 0.75rem',
                outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: 1.5,
                maxHeight: 100, overflowY: 'auto',
              }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 100) + 'px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!chatInput.trim()}
              style={{
                width: 40, height: 40, borderRadius: '10px', border: 'none', flexShrink: 0,
                background: chatInput.trim() ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.04)',
                color: chatInput.trim() ? '#C9A96E' : 'rgba(240,237,232,0.2)',
                cursor: chatInput.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}
