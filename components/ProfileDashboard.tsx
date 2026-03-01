'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface SessionRecord {
  id: string
  session_key: string
  country: string | null
  city: string | null
  timezone: string | null
  browser: string | null
  os: string | null
  device_type: string | null
  last_active: string
  created_at: string
}

const TIER_LIMITS: Record<string, number> = {
  free: 50_000,
  tier1: 2_000_000,
  tier2: 4_000_000,
}
const TIER_NAMES: Record<string, string> = {
  free: 'Free',
  tier1: 'Scholar',
  tier2: 'Researcher',
}
const TIER_PRICES: Record<string, string> = {
  free: '$0 / month',
  tier1: '$7.99 / month',
  tier2: '$17.99 / month',
}

type Tab = 'account' | 'plan' | 'sessions' | 'data'

interface Props {
  user: User
  usage: { tier: string; tokens_used: number; period_start: string } | null
}

export default function ProfileDashboard({ user, usage }: Props) {
  // Derive from props before hooks (needed for useState initializers)
  const fullName = user.user_metadata?.full_name as string | undefined
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined

  const nickname = user.user_metadata?.nickname as string | undefined

  const [tab, setTab] = useState<Tab>('account')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(fullName ?? '')
  const [nameInput, setNameInput] = useState(fullName ?? '')
  const [savingName, setSavingName] = useState(false)
  const [editingNickname, setEditingNickname] = useState(false)
  const [displayNickname, setDisplayNickname] = useState(nickname ?? '')
  const [nicknameInput, setNicknameInput] = useState(nickname ?? '')
  const [savingNickname, setSavingNickname] = useState(false)
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [currentSessionKey, setCurrentSessionKey] = useState<string | null>(null)
  const [deletingSession, setDeletingSession] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Track this session on mount (fire-and-forget)
  useEffect(() => {
    let key = localStorage.getItem('fp-sk')
    if (!key) {
      key = crypto.randomUUID()
      localStorage.setItem('fp-sk', key)
    }
    setCurrentSessionKey(key)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    fetch('/api/session/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_key: key, timezone: tz }),
      keepalive: true,
    }).catch(() => {})
  }, [])

  // Load sessions when the sessions tab is opened
  useEffect(() => {
    if (tab !== 'sessions') return
    setSessionsLoading(true)
    fetch('/api/session/list')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSessions(data)
        setSessionsLoading(false)
      })
      .catch(() => setSessionsLoading(false))
  }, [tab])

  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase()

  const tier = usage?.tier ?? 'free'
  const tokensUsed = usage?.tokens_used ?? 0
  const tokenLimit = TIER_LIMITS[tier] ?? 50_000
  const usagePct = Math.min(100, (tokensUsed / tokenLimit) * 100)
  const periodStart = usage?.period_start ? new Date(usage.period_start) : null

  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
  const lastSignIn = new Date(user.last_sign_in_at ?? user.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === displayName) { setEditingName(false); return }
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } })
    setSavingName(false)
    if (!error) {
      setDisplayName(trimmed)
      setEditingName(false)
    }
  }

  async function handleSaveNickname() {
    const trimmed = nicknameInput.trim()
    if (trimmed === displayNickname) { setEditingNickname(false); return }
    setSavingNickname(true)
    const { error } = await supabase.auth.updateUser({ data: { nickname: trimmed || null } })
    setSavingNickname(false)
    if (!error) {
      setDisplayNickname(trimmed)
      setEditingNickname(false)
    }
  }

  async function handleDeleteSession(id: string) {
    setDeletingSession(id)
    try {
      await fetch(`/api/session/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
    } finally {
      setDeletingSession(null)
    }
  }

  const navItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'account', label: 'Account', icon: <IconPerson /> },
    { key: 'plan', label: 'Plan & Usage', icon: <IconPlan /> },
    { key: 'sessions', label: 'Sessions', icon: <IconGlobe /> },
    { key: 'data', label: 'Data', icon: <IconData /> },
  ]

  return (
    <main style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '4rem' }}>
      <div style={{
        maxWidth: '1020px',
        margin: '0 auto',
        padding: '2.5rem 1.5rem',
        display: 'flex',
        gap: '4rem',
        alignItems: 'flex-start',
      }}>

        {/* ── Left Sidebar ── */}
        <aside style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '88px' }}>
          {/* Avatar + welcome */}
          <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: '2px solid var(--border-gold)', overflow: 'hidden',
              background: '#2A2D36', marginBottom: '0.75rem',
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatarUrl && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={displayName || 'Profile'}
                  onError={() => setImgError(true)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--gold)' }}>
                  {initials}
                </span>
              )}
            </div>
            <p style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.35rem',
              fontWeight: 300,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}>
              Welcome, {displayName.split(' ')[0] || 'there'}.
            </p>
            <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', fontWeight: 300 }}>
              Manage your Forcapedia account.
            </p>
          </div>

          {/* Nav items */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {navItems.map(({ key, label, icon }) => {
              const active = tab === key
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    padding: '0.6rem 0.875rem',
                    borderRadius: '10px',
                    border: 'none',
                    borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                    background: active ? 'var(--gold-dim)' : 'transparent',
                    color: active ? 'var(--gold)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13.5px',
                    fontWeight: active ? 500 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active) e.currentTarget.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={e => {
                    if (!active) e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  {icon}
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Back to home */}
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <Link href="/" style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              letterSpacing: '0.05em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)', textDecoration: 'none',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--gold)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)' }}
            >
              ← Home
            </Link>
          </div>
        </aside>

        {/* ── Right Content ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ACCOUNT TAB */}
          {tab === 'account' && (
            <section>
              <ContentHeader
                title="Your account"
                subtitle="Manage your account information."
              />

              {/* Account card */}
              <Card>
                {editingName ? (
                <div style={{
                  padding: '0.875rem 0', borderBottom: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: '0.625rem',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-tertiary)',
                  }}>Full name</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(displayName) } }}
                      autoFocus
                      maxLength={60}
                      style={{
                        background: 'var(--ink-3)', border: '1px solid var(--border-gold)',
                        borderRadius: '8px', padding: '5px 12px',
                        fontSize: '13.5px', color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)', outline: 'none', width: '180px',
                      }}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      style={{
                        padding: '5px 14px', borderRadius: '8px',
                        border: '1px solid var(--border-gold)', background: 'var(--gold-dim)',
                        color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '10px',
                        letterSpacing: '0.06em', cursor: savingName ? 'default' : 'pointer',
                        opacity: savingName ? 0.5 : 1,
                      }}
                    >
                      {savingName ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameInput(displayName) }}
                      style={{
                        padding: '5px 12px', borderRadius: '8px',
                        border: '1px solid var(--border)', background: 'none',
                        color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '10px',
                        letterSpacing: '0.06em', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <FieldRow label="Full name" value={displayName || '—'}>
                  <button
                    onClick={() => { setNameInput(displayName); setEditingName(true) }}
                    style={{
                      padding: '3px 10px', borderRadius: '100px', flexShrink: 0,
                      border: '1px solid var(--border)', background: 'none',
                      color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '10px',
                      letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                  >
                    Edit
                  </button>
                </FieldRow>
              )}

              {/* Nickname field */}
              {editingNickname ? (
                <div style={{
                  padding: '0.875rem 0', borderBottom: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: '0.625rem',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-tertiary)',
                  }}>What should Forcapedia call you?</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      value={nicknameInput}
                      onChange={e => setNicknameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(); if (e.key === 'Escape') { setEditingNickname(false); setNicknameInput(displayNickname) } }}
                      autoFocus
                      maxLength={30}
                      placeholder="e.g. Alex, Prof, Doc…"
                      style={{
                        background: 'var(--ink-3)', border: '1px solid var(--border-gold)',
                        borderRadius: '8px', padding: '5px 12px',
                        fontSize: '13.5px', color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)', outline: 'none', width: '180px',
                      }}
                    />
                    <button
                      onClick={handleSaveNickname}
                      disabled={savingNickname}
                      style={{
                        padding: '5px 14px', borderRadius: '8px',
                        border: '1px solid var(--border-gold)', background: 'var(--gold-dim)',
                        color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: '10px',
                        letterSpacing: '0.06em', cursor: savingNickname ? 'default' : 'pointer',
                        opacity: savingNickname ? 0.5 : 1,
                      }}
                    >
                      {savingNickname ? '…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingNickname(false); setNicknameInput(displayNickname) }}
                      style={{
                        padding: '5px 12px', borderRadius: '8px',
                        border: '1px solid var(--border)', background: 'none',
                        color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '10px',
                        letterSpacing: '0.06em', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 300 }}>
                    This is how Forcapedia addresses you in search placeholders.
                  </p>
                </div>
              ) : (
                <FieldRow label="What should Forcapedia call you?" value={displayNickname || '—'}>
                  <button
                    onClick={() => { setNicknameInput(displayNickname); setEditingNickname(true) }}
                    style={{
                      padding: '3px 10px', borderRadius: '100px', flexShrink: 0,
                      border: '1px solid var(--border)', background: 'none',
                      color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '10px',
                      letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.color = 'var(--gold)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
                  >
                    {displayNickname ? 'Edit' : 'Set'}
                  </button>
                </FieldRow>
              )}

                <FieldRow label="Email" value={user.email ?? '—'} />
                <FieldRow label="Subscription">
                  <Link href="/pricing" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    fontFamily: 'var(--font-mono)', fontSize: '12px',
                    color: 'var(--gold)', textDecoration: 'none',
                    padding: '3px 10px', borderRadius: '100px',
                    background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                    transition: 'background 0.2s',
                  }}>
                    {TIER_NAMES[tier]} — {TIER_PRICES[tier]}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                    </svg>
                  </Link>
                </FieldRow>
                <FieldRow label="Account created" value={memberSince} last />
              </Card>

              {/* Sign-in methods */}
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem',
              }}>
                Sign-in methods
              </p>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <GoogleIcon />
                    <div>
                      <p style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        Google
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--green)',
                    background: 'rgba(111,207,151,0.1)', border: '1px solid rgba(111,207,151,0.25)',
                    padding: '2px 8px', borderRadius: '100px',
                  }}>
                    Active
                  </span>
                </div>
              </Card>
            </section>
          )}

          {/* PLAN TAB */}
          {tab === 'plan' && (
            <section>
              <ContentHeader
                title="Plan & Usage"
                subtitle="Your current plan and token usage this period."
              />

              {/* Current plan card */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', marginBottom: '1rem' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '0.35rem' }}>Current plan</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem' }}>
                      <span style={{
                        fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 400,
                        color: 'var(--text-primary)',
                      }}>
                        {TIER_NAMES[tier]}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)',
                      }}>
                        {TIER_PRICES[tier]}
                      </span>
                    </div>
                  </div>
                  {tier !== 'free' ? (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--gold)',
                      background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                      padding: '3px 10px', borderRadius: '100px',
                    }}>
                      Active
                    </span>
                  ) : (
                    <Link href="/pricing" style={{
                      fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em',
                      textTransform: 'uppercase', color: 'var(--gold)',
                      background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                      padding: '6px 14px', borderRadius: '10px',
                      textDecoration: 'none', transition: 'background 0.2s',
                    }}>
                      Upgrade →
                    </Link>
                  )}
                </div>

                {/* Usage bar */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.05em',
                      textTransform: 'uppercase', color: 'var(--text-tertiary)',
                    }}>
                      Token usage
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '11px',
                      color: usagePct > 80 ? 'var(--red)' : 'var(--text-tertiary)',
                    }}>
                      {tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()}
                    </span>
                  </div>
                  <div style={{
                    height: '5px', background: 'var(--border)',
                    borderRadius: '100px', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${usagePct}%`,
                      background: usagePct > 80 ? 'var(--red)' : usagePct > 50 ? 'var(--amber)' : 'var(--gold)',
                      borderRadius: '100px',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  {periodStart && (
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px',
                      color: 'var(--text-tertiary)', marginTop: '0.5rem',
                    }}>
                      Resets {new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </Card>

              {/* Plan features comparison */}
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem',
              }}>
                What's included
              </p>
              <Card>
                {[
                  { label: 'Monthly tokens', free: '50,000', tier1: '2,000,000', tier2: '4,000,000' },
                  { label: 'Follow-ups per article', free: '1', tier1: 'Unlimited', tier2: 'Unlimited' },
                  { label: 'Search history', free: '—', tier1: '✓', tier2: '✓' },
                  { label: 'Priority processing', free: '—', tier1: '—', tier2: '✓' },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{
                    display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)',
                    alignItems: 'center', gap: '1rem',
                    padding: '0.75rem 0',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.label}</span>
                    {(['free', 'tier1', 'tier2'] as const).map(t => (
                      <span key={t} style={{
                        fontFamily: 'var(--font-mono)', fontSize: '11.5px', textAlign: 'center',
                        color: tier === t ? 'var(--gold)' : 'var(--text-tertiary)',
                        fontWeight: tier === t ? 600 : 400,
                      }}>
                        {t === 'free' ? row.free : t === 'tier1' ? row.tier1 : row.tier2}
                      </span>
                    ))}
                  </div>
                ))}
                {/* Column headers */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)',
                  gap: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)',
                  marginTop: '-0.25rem',
                }}>
                  <span />
                  {(['Free', 'Scholar', 'Researcher'] as const).map((n, i) => {
                    const t = ['free', 'tier1', 'tier2'][i]
                    return (
                      <span key={n} style={{
                        fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em',
                        textTransform: 'uppercase', textAlign: 'center',
                        color: tier === t ? 'var(--gold)' : 'var(--text-tertiary)',
                      }}>
                        {n}{tier === t ? ' ✓' : ''}
                      </span>
                    )
                  })}
                </div>
              </Card>
            </section>
          )}

          {/* SESSIONS TAB */}
          {tab === 'sessions' && (
            <section>
              <ContentHeader
                title="Your sessions"
                subtitle="Devices and browsers currently signed in to your account."
              />

              {sessionsLoading ? (
                <Card>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '12px',
                    color: 'var(--text-tertiary)', textAlign: 'center', padding: '1.5rem 0',
                  }}>
                    Loading sessions…
                  </p>
                </Card>
              ) : sessions.length === 0 ? (
                <Card>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '12px',
                    color: 'var(--text-tertiary)', textAlign: 'center', padding: '1.5rem 0',
                  }}>
                    No sessions recorded yet.
                  </p>
                </Card>
              ) : (
                sessions.map(session => {
                  const isCurrent = session.session_key === currentSessionKey
                  return (
                    <Card
                      key={session.id}
                      style={isCurrent ? { borderColor: 'rgba(212,175,55,0.35)' } : {}}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                          <DeviceIcon type={session.device_type ?? 'desktop'} />
                          <div>
                            {isCurrent && (
                              <span style={{
                                display: 'inline-block', marginBottom: '0.4rem',
                                fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.08em',
                                textTransform: 'uppercase', color: 'var(--gold)',
                                background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                                padding: '2px 8px', borderRadius: '100px',
                              }}>
                                Current session
                              </span>
                            )}
                            <p style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                              {session.browser ?? 'Unknown browser'} on {session.os ?? 'Unknown OS'}
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                              {session.city && session.country
                                ? `${session.city}, ${session.country}`
                                : session.country ?? 'Location unavailable'}
                              {session.timezone ? ` · ${session.timezone}` : ''}
                            </p>
                            <p style={{
                              fontFamily: 'var(--font-mono)', fontSize: '11px',
                              color: 'var(--text-tertiary)', marginTop: '0.25rem',
                            }}>
                              Last active {formatRelativeTime(new Date(session.last_active))}
                            </p>
                          </div>
                        </div>

                        {!isCurrent && (
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            disabled={deletingSession === session.id}
                            title="Remove this session"
                            style={{
                              flexShrink: 0,
                              padding: '0.35rem 0.75rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: 'none',
                              color: 'var(--text-tertiary)',
                              fontFamily: 'var(--font-mono)', fontSize: '10px',
                              letterSpacing: '0.05em', cursor: 'pointer',
                              opacity: deletingSession === session.id ? 0.5 : 1,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'rgba(244,124,124,0.4)'
                              e.currentTarget.style.color = 'var(--red)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--border)'
                              e.currentTarget.style.color = 'var(--text-tertiary)'
                            }}
                          >
                            {deletingSession === session.id ? '…' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </Card>
                  )
                })
              )}

              <Card>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSignOut}
                    style={{
                      padding: '0.5rem 1.125rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(244,124,124,0.3)',
                      background: 'rgba(244,124,124,0.06)',
                      color: 'var(--red)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px', fontWeight: 500,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(244,124,124,0.12)'
                      e.currentTarget.style.borderColor = 'rgba(244,124,124,0.5)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(244,124,124,0.06)'
                      e.currentTarget.style.borderColor = 'rgba(244,124,124,0.3)'
                    }}
                  >
                    Sign out of all devices
                  </button>
                </div>
              </Card>
            </section>
          )}

          {/* DATA TAB */}
          {tab === 'data' && (
            <section>
              <ContentHeader
                title="Your data"
                subtitle="Manage your personal data stored with Forcapedia."
              />

              {/* Download */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      Download account data
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Export all your searches, saved articles, and account information.
                    </p>
                  </div>
                  <button
                    disabled
                    style={{
                      padding: '0.5rem 1.125rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      background: 'var(--ink-3)',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-sans)', fontSize: '13px',
                      fontWeight: 500, cursor: 'not-allowed',
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                    title="Coming soon"
                  >
                    Coming soon
                  </button>
                </div>
              </Card>

              {/* Delete */}
              <Card style={{ borderColor: 'rgba(244,124,124,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--red)', marginBottom: '0.35rem' }}>
                      Delete account
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  {!deleteConfirm ? (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      style={{
                        padding: '0.5rem 1.125rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(244,124,124,0.4)',
                        background: 'rgba(244,124,124,0.08)',
                        color: 'var(--red)',
                        fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer', flexShrink: 0,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.08)' }}
                    >
                      Delete
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', textAlign: 'right' }}>
                        Are you sure?
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          style={{
                            padding: '0.4rem 0.875rem', borderRadius: '8px',
                            border: '1px solid var(--border)', background: 'none',
                            color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                            fontSize: '12px', cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          style={{
                            padding: '0.4rem 0.875rem', borderRadius: '8px',
                            border: '1px solid rgba(244,124,124,0.5)',
                            background: 'rgba(244,124,124,0.15)',
                            color: 'var(--red)', fontFamily: 'var(--font-sans)',
                            fontSize: '12px', fontWeight: 500, cursor: 'not-allowed',
                          }}
                          title="Contact support to delete your account"
                        >
                          Contact support
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </section>
          )}

        </div>
      </div>
    </main>
  )
}

// ── Small reusable pieces ──────────────────────────────────────────────────────

function ContentHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <h1 style={{
        fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 300,
        color: 'var(--text-primary)', marginBottom: '0.35rem', lineHeight: 1.2,
      }}>
        {title}
      </h1>
      <p style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', fontWeight: 300 }}>
        {subtitle}
      </p>
      <div style={{ marginTop: '1.25rem', height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '1.25rem 1.5rem',
      marginBottom: '1.25rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

function FieldRow({ label, value, last, children }: {
  label: string; value?: string; last?: boolean; children?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.875rem 0',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px',
        }}>
          {label}
        </p>
        {value && (
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 400 }}>
            {value}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function DeviceIcon({ type }: { type: string }) {
  const stroke = 'var(--text-tertiary)'
  const sw = '1.8'
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '10px',
      border: '1px solid var(--border)', background: 'var(--ink-3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {type === 'mobile' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
      ) : type === 'tablet' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      )}
    </div>
  )
}

function SessionRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: mono ? '11px' : '13px',
        color: 'var(--text-primary)',
      }}>
        {value}
      </span>
    </div>
  )
}

function GoogleIcon() {
  return (
    <div style={{
      width: '32px', height: '32px', borderRadius: '8px',
      border: '1px solid var(--border)', background: 'var(--ink-3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 48 48" fill="none">
        <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
        <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2c-7.7 0-14.4 4.4-17.7 10.7z" fill="#FF3D00"/>
        <path d="M24 46c5.5 0 10.5-2 14.3-5.4l-6.6-5.6C29.7 36.8 27 38 24 38c-6 0-11.1-4-13-9.5L4 34.1C7.3 41.4 15 46 24 46z" fill="#4CAF50"/>
        <path d="M44.5 20H24v8.5h11.8c-.9 2.9-2.8 5.4-5.3 7.1l6.6 5.6C41.1 38 45 32 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
      </svg>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconPerson() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function IconPlan() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function IconData() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  )
}
