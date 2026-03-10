'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BadgeSVG } from '@/components/BadgeMarker'

interface RecentRoom {
  code: string
  room_name: string | null
  article_title: string | null
  status: string
  created_at: string
  joined_at: string
}

interface Props {
  userName: string
  userEmail: string
  userTier: string
  userAvatarUrl?: string | null
  userBadge?: string | null
  recentRooms: RecentRoom[]
  allRooms: RecentRoom[]
}

type Mode = 'home' | 'create' | 'join'
type Tab  = 'home' | 'history'

const canCreate = (tier: string) => tier === 'tier1' || tier === 'tier2'

function formatDate(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return `${diff}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getGreeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name}.`
  if (h < 17) return `Good afternoon, ${name}.`
  return `Good evening, ${name}.`
}

function tierLabel(tier: string) {
  if (tier === 'tier1') return 'Scholar'
  if (tier === 'tier2') return 'Researcher'
  return 'Free'
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function BookScrollIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="13" y2="11" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function JoinArrowIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
      <polyline points="10 17 15 12 10 7"/>
      <line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function SpinIcon() {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

// ── Shared input style ────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--ink-3)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '0.65rem 0.875rem',
  fontFamily: 'var(--font-sans)',
  fontSize: '13.5px',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color 0.15s',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.35rem' }}>
        <label style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          letterSpacing: '0.07em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}>
          {label}
        </label>
        {optional && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-tertiary)', opacity: 0.5 }}>
            optional
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function ActionTile({
  color, icon, label, sublabel, onClick, dim,
}: {
  color: 'gold' | 'blue'
  icon: React.ReactNode
  label: string
  sublabel?: string
  onClick: () => void
  dim?: boolean
}) {
  const colors = {
    gold: {
      bg:     dim ? 'var(--ink-3)' : 'var(--gold-dim)',
      border: dim ? 'var(--border)' : 'var(--border-gold)',
      icon:   dim ? 'var(--text-tertiary)' : 'var(--gold)',
      label:  dim ? 'var(--text-secondary)' : 'var(--text-primary)',
      hover:  dim ? 'rgba(255,255,255,0.05)' : 'rgba(201,169,110,0.18)',
      iconBg: dim ? 'rgba(255,255,255,0.04)' : 'rgba(201,169,110,0.15)',
    },
    blue: {
      bg:     'rgba(127,183,247,0.08)',
      border: 'rgba(127,183,247,0.22)',
      icon:   'rgba(127,183,247,0.9)',
      label:  'var(--text-primary)',
      hover:  'rgba(127,183,247,0.13)',
      iconBg: 'rgba(127,183,247,0.12)',
    },
  }[color]

  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 168, height: 168,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1rem',
        padding: '1.5rem 1rem',
        background: hovered ? colors.hover : colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '22px',
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? '0 10px 32px rgba(0,0,0,0.35)' : 'none',
        color: colors.icon,
        position: 'relative',
      }}
    >
      {dim && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          opacity: 0.5,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
      )}
      <div style={{
        width: 60, height: 60, borderRadius: '16px',
        background: colors.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.icon,
      }}>
        {icon}
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '14px', fontWeight: 500, color: colors.label, lineHeight: 1.2, fontFamily: 'var(--font-sans)' }}>
          {label}
        </p>
        {sublabel && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px', letterSpacing: '0.03em' }}>
            {sublabel}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Avatar initials circle ────────────────────────────────────────────────────

function AvatarCircle({ name, size, src }: { name: string; size: number; src?: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size} height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  const colors = ['#C9A96E','#7FB7F7','#6FCF97','#F47C7C','#A78BFA']
  const color  = colors[(name.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, color: '#191919', flexShrink: 0,
      fontFamily: 'var(--font-sans)',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── Profile Dropdown ──────────────────────────────────────────────────────────

function ProfileDropdown({
  userName, userEmail, userTier, userAvatarUrl, userBadge, onClose,
}: {
  userName: string; userEmail: string; userTier: string
  userAvatarUrl?: string | null; userBadge?: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const ref    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: 'calc(100% + 10px)', right: 0,
        width: 240,
        background: 'rgba(28,26,24,0.98)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        zIndex: 9999,
        animation: 'dropdownFadeIn 0.15s ease',
      }}
    >
      {/* User info */}
      <div style={{ padding: '1rem 1rem 0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AvatarCircle name={userName} size={40} src={userAvatarUrl} />
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-sans)',
            }}>
              {userName}
            </p>
            <p style={{
              fontSize: '11px', color: 'var(--text-tertiary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)', marginBottom: '4px',
            }}>
              {userEmail}
            </p>
            <div style={{ marginTop: '2px' }}>
              <span style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: '20px',
                background: userTier === 'tier2'
                  ? 'rgba(127,183,247,0.12)'
                  : userTier === 'tier1'
                    ? 'var(--gold-dim)'
                    : 'rgba(255,255,255,0.05)',
                border: userTier === 'tier2'
                  ? '1px solid rgba(127,183,247,0.25)'
                  : userTier === 'tier1'
                    ? '1px solid var(--border-gold)'
                    : '1px solid var(--border)',
                color: userTier === 'tier2'
                  ? 'rgba(127,183,247,0.9)'
                  : userTier === 'tier1'
                    ? 'var(--gold)'
                    : 'var(--text-tertiary)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.05em',
              }}>
                {tierLabel(userTier)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Badge preview */}
      {userBadge && (
        <>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 1rem' }} />
          <div style={{ padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BadgeSVG badge={userBadge} size={20} />
            <span style={{
              fontSize: '12px', color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)', textTransform: 'capitalize',
            }}>
              {userBadge}
            </span>
          </div>
        </>
      )}

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 1rem' }} />

      {/* Edit profile */}
      <Link
        href="/profile"
        onClick={onClose}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.625rem 1rem', textDecoration: 'none',
          color: 'var(--text-secondary)', fontSize: '13px',
          fontFamily: 'var(--font-sans)',
          transition: 'background 0.12s, color 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
      >
        Edit profile
        <ChevronRightIcon />
      </Link>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 1rem' }} />

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.625rem 1rem',
          background: 'none', border: 'none',
          color: 'rgba(244,124,124,0.7)', fontSize: '13px',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.12s, color 0.12s',
          borderRadius: '0 0 16px 16px',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(244,124,124,0.06)'
          e.currentTarget.style.color = '#F47C7C'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'rgba(244,124,124,0.7)'
        }}
      >
        <SignOutIcon />
        Sign out
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Main component ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function StudyLobby({
  userName, userEmail, userTier, userAvatarUrl, userBadge, recentRooms, allRooms,
}: Props) {
  const router = useRouter()

  const [tab,  setTab]  = useState<Tab>('home')
  const [mode, setMode] = useState<Mode>('home')

  // Greeting — computed client side
  const [greeting, setGreeting] = useState('')
  useEffect(() => {
    setGreeting(getGreeting(userName))
  }, [userName])

  // Create form
  const [roomName,    setRoomName]    = useState(`${userName}'s Study Room`)
  const [topic,       setTopic]       = useState('')
  const [password,    setPassword]    = useState('')
  const [creating,    setCreating]    = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Join form
  const [joinCode,          setJoinCode]          = useState('')
  const [joinPassword,      setJoinPassword]      = useState('')
  const [joinNeedsPassword, setJoinNeedsPassword] = useState(false)
  const [joining,           setJoining]           = useState(false)
  const [joinError,         setJoinError]         = useState<string | null>(null)

  // Profile dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false)

  async function createRoom() {
    if (!roomName.trim()) { setCreateError('Room name is required.'); return }
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomName.trim(),
          topic: topic.trim() || undefined,
          password: password.trim() || undefined,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push(`/room/${d.code}`)
      } else if (res.status === 409 && d.existingCode) {
        router.push(`/room/${d.existingCode}`)
      } else {
        setCreateError(d.error ?? 'Failed to create room.')
      }
    } finally {
      setCreating(false)
    }
  }

  async function joinRoom() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoining(true); setJoinError(null)
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: joinPassword || undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push(`/room/${code}`)
      } else if (d.error === 'PASSWORD_REQUIRED' || d.error === 'WRONG_PASSWORD') {
        setJoinNeedsPassword(true)
        if (d.error === 'WRONG_PASSWORD') setJoinError('Incorrect password.')
      } else {
        setJoinError(d.error ?? 'Could not join room.')
      }
    } finally {
      setJoining(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#161412',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── FIXED HEADER ──────────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 52,
        background: 'rgba(22,20,18,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem',
        zIndex: 1000,
        backdropFilter: 'blur(12px)',
      }}>

        {/* Left: Logo */}
        <Link href="/" style={{ color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <BookScrollIcon />
        </Link>

        {/* Center: Tabs */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '4px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '20px',
          padding: '3px',
        }}>
          {(['home', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '4px 16px',
                borderRadius: '16px',
                border: 'none',
                background: tab === t ? 'rgba(255,255,255,0.08)' : 'none',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: '12.5px',
                fontFamily: 'var(--font-sans)',
                fontWeight: tab === t ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {t === 'home' ? 'Home' : 'History'}
            </button>
          ))}
        </div>

        {/* Right: Avatar button */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              background: 'none', border: '1.5px solid rgba(255,255,255,0.10)',
              borderRadius: '50%', padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
          >
            <AvatarCircle name={userName} size={30} src={userAvatarUrl} />
          </button>

          {dropdownOpen && (
            <ProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userTier={userTier}
              userAvatarUrl={userAvatarUrl}
              userBadge={userBadge}
              onClose={() => setDropdownOpen(false)}
            />
          )}
        </div>
      </header>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <main style={{
        paddingTop: 52,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── HOME TAB ────────────────────────────────────────────────────── */}
        {tab === 'home' && (
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 'clamp(3rem,8vw,5rem) 1.5rem',
            minHeight: 'calc(100vh - 52px)',
          }}>

            {/* TILES MODE */}
            {mode === 'home' && (
              <div style={{ width: '100%', maxWidth: 520, animation: 'lobbyFadeIn 0.25s ease' }}>
                {/* Greeting */}
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                  {greeting && (
                    <h1 style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                      fontWeight: 300,
                      color: 'var(--text-primary)',
                      marginBottom: '0.5rem',
                      lineHeight: 1.2,
                    }}>
                      {greeting}
                    </h1>
                  )}
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.04em',
                  }}>
                    Ready to study together?
                  </p>
                </div>

                {/* Action tiles */}
                <div style={{
                  display: 'flex', gap: 'clamp(1rem, 3vw, 1.75rem)',
                  justifyContent: 'center', flexWrap: 'wrap',
                  marginBottom: '3rem',
                }}>
                  {canCreate(userTier) ? (
                    <ActionTile
                      color="gold"
                      icon={<PlusIcon />}
                      label="New Room"
                      sublabel="Start a session"
                      onClick={() => setMode('create')}
                    />
                  ) : (
                    <Link href="/pricing" style={{ textDecoration: 'none' }}>
                      <ActionTile
                        color="gold"
                        icon={<LockIcon />}
                        label="New Room"
                        sublabel="Upgrade to create"
                        onClick={() => {}}
                        dim
                      />
                    </Link>
                  )}

                  <ActionTile
                    color="blue"
                    icon={<JoinArrowIcon />}
                    label="Join"
                    sublabel="Enter code"
                    onClick={() => setMode('join')}
                  />
                </div>

                {/* Recent rooms */}
                {recentRooms.length > 0 && (
                  <div style={{ width: '100%' }}>
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.14em',
                      textTransform: 'uppercase', color: 'var(--text-tertiary)',
                      marginBottom: '0.75rem', textAlign: 'center',
                    }}>
                      Recent
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {recentRooms.slice(0, 3).map(room => (
                        <Link
                          key={room.code}
                          href={`/room/${room.code}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.6rem 0.875rem', borderRadius: '10px',
                            textDecoration: 'none', transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                        >
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: room.status === 'active' ? '#6FCF97' : 'rgba(255,255,255,0.15)',
                            boxShadow: room.status === 'active' ? '0 0 6px rgba(111,207,151,0.5)' : 'none',
                          }} />
                          <span style={{
                            flex: 1, fontSize: '13px', color: 'var(--text-secondary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-sans)',
                          }}>
                            {room.room_name ?? 'Unnamed Room'}
                          </span>
                          {room.article_title && (
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: '10px',
                              color: 'var(--text-tertiary)', flexShrink: 0,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: 120,
                            }}>
                              {room.article_title}
                            </span>
                          )}
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '10px',
                            color: 'var(--text-tertiary)', flexShrink: 0,
                          }}>
                            {formatDate(room.joined_at)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CREATE MODE */}
            {mode === 'create' && (
              <div style={{
                width: '100%', maxWidth: 400,
                animation: 'lobbySlideUp 0.2s ease',
              }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '18px', margin: '0 auto 1rem',
                    background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--gold)',
                  }}>
                    <PlusIcon />
                  </div>
                  <h2 style={{
                    fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 300,
                    color: 'var(--text-primary)', marginBottom: '0.25rem',
                  }}>
                    New Room
                  </h2>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                    Configure your study session
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <Field label="Room name">
                    <input
                      type="text" value={roomName} maxLength={60} autoFocus
                      onChange={e => { setRoomName(e.target.value); setCreateError(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') createRoom() }}
                      style={inp}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-gold)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    />
                  </Field>
                  <Field label="Topic" optional>
                    <input
                      type="text" value={topic} maxLength={120}
                      placeholder="e.g. Quantum mechanics, French Revolution…"
                      onChange={e => setTopic(e.target.value)}
                      style={inp}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-gold)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    />
                  </Field>
                  <Field label="Password" optional>
                    <input
                      type="password" value={password}
                      placeholder="Leave blank for open room"
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createRoom() }}
                      style={inp}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-gold)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    />
                  </Field>

                  {createError && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)' }}>
                      {createError}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => setMode('home')}
                      style={{
                        padding: '0.75rem 1rem', borderRadius: '12px',
                        border: '1px solid var(--border)', background: 'none',
                        color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)',
                        fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={createRoom}
                      disabled={creating}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        padding: '0.75rem', borderRadius: '12px',
                        background: creating ? 'var(--ink-3)' : 'var(--gold-dim)',
                        border: '1px solid var(--border-gold)',
                        color: creating ? 'var(--text-tertiary)' : 'var(--gold)',
                        fontFamily: 'var(--font-sans)', fontSize: '13.5px', fontWeight: 500,
                        cursor: creating ? 'default' : 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!creating) e.currentTarget.style.background = 'rgba(201,169,110,0.18)' }}
                      onMouseLeave={e => { if (!creating) e.currentTarget.style.background = 'var(--gold-dim)' }}
                    >
                      {creating ? <><SpinIcon /> Creating…</> : 'Create Room'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* JOIN MODE */}
            {mode === 'join' && (
              <div style={{
                width: '100%', maxWidth: 380,
                animation: 'lobbySlideUp 0.2s ease',
              }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '18px', margin: '0 auto 1rem',
                    background: 'rgba(127,183,247,0.1)', border: '1px solid rgba(127,183,247,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(127,183,247,0.9)',
                  }}>
                    <JoinArrowIcon />
                  </div>
                  <h2 style={{
                    fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 300,
                    color: 'var(--text-primary)', marginBottom: '0.25rem',
                  }}>
                    Join a Room
                  </h2>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                    Enter the 6-character code
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <input
                    type="text"
                    placeholder="A B 1 2 C D"
                    value={joinCode}
                    onChange={e => {
                      setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                      setJoinError(null); setJoinNeedsPassword(false); setJoinPassword('')
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && joinCode) joinRoom() }}
                    maxLength={6}
                    autoFocus
                    style={{
                      ...inp,
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '22px', letterSpacing: '0.3em',
                      fontWeight: 500, padding: '1rem',
                      borderColor: joinCode ? 'rgba(127,183,247,0.4)' : 'var(--border)',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(127,183,247,0.4)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = joinCode ? 'rgba(127,183,247,0.4)' : 'var(--border)' }}
                  />

                  {joinNeedsPassword && (
                    <div style={{ animation: 'lobbySlideUp 0.15s ease' }}>
                      <Field label="Password">
                        <input
                          type="password" value={joinPassword} autoFocus
                          placeholder="Room password…"
                          onChange={e => { setJoinPassword(e.target.value); setJoinError(null) }}
                          onKeyDown={e => { if (e.key === 'Enter') joinRoom() }}
                          style={{ ...inp, borderColor: 'var(--border-gold)' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-gold)' }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-gold)' }}
                        />
                      </Field>
                    </div>
                  )}

                  {joinError && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', textAlign: 'center' }}>
                      {joinError}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <button
                      onClick={() => setMode('home')}
                      style={{
                        padding: '0.75rem 1rem', borderRadius: '12px',
                        border: '1px solid var(--border)', background: 'none',
                        color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans)',
                        fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={joinRoom}
                      disabled={!joinCode || joining}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        padding: '0.75rem', borderRadius: '12px',
                        background: joinCode ? 'rgba(127,183,247,0.1)' : 'var(--ink-3)',
                        border: `1px solid ${joinCode ? 'rgba(127,183,247,0.35)' : 'var(--border)'}`,
                        color: joinCode ? 'rgba(127,183,247,0.9)' : 'var(--text-tertiary)',
                        fontFamily: 'var(--font-sans)', fontSize: '13.5px', fontWeight: 500,
                        cursor: joinCode && !joining ? 'pointer' : 'default', transition: 'all 0.15s',
                      }}
                    >
                      {joining ? <><SpinIcon /> Joining…</> : 'Join Room'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ─────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div style={{
            flex: 1,
            maxWidth: 680, width: '100%', margin: '0 auto',
            padding: '2.5rem 1.5rem',
            animation: 'lobbyFadeIn 0.2s ease',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontSize: '1.375rem', fontWeight: 300,
              color: 'var(--text-primary)', marginBottom: '0.375rem',
            }}>
              Session History
            </h2>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: 'var(--text-tertiary)', marginBottom: '2rem',
              letterSpacing: '0.03em',
            }}>
              Your last {allRooms.length} sessions
            </p>

            {allRooms.length === 0 ? (
              <div style={{
                padding: '3rem', textAlign: 'center',
                border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '16px',
              }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  No sessions yet. Start or join a room to begin.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {allRooms.map(room => (
                  <HistoryRow key={`${room.code}-${room.joined_at}`} room={room} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes lobbySlideUp {
          from { opacity: 0; transform: translateY(14px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes lobbyFadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(240,237,232,0.25); }
      `}</style>
    </div>
  )
}

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({ room }: { room: RecentRoom }) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => router.push(`/room/${room.code}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.75rem 1rem', borderRadius: '12px',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.12s',
        cursor: 'pointer',
      }}
    >
      {/* Status dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: room.status === 'active' ? '#6FCF97' : 'rgba(255,255,255,0.18)',
        boxShadow: room.status === 'active' ? '0 0 6px rgba(111,207,151,0.5)' : 'none',
      }} />

      {/* Room info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px', color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-sans)', marginBottom: '2px',
        }}>
          {room.room_name ?? 'Unnamed Room'}
        </p>
        {room.article_title && (
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px',
            color: 'var(--text-tertiary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {room.article_title}
          </p>
        )}
      </div>

      {/* Date */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        color: 'var(--text-tertiary)', flexShrink: 0,
      }}>
        {formatDate(room.joined_at)}
      </span>
    </div>
  )
}
