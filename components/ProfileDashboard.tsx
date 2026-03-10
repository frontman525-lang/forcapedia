'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { BadgeSVG, AvatarWithBadge } from '@/components/BadgeMarker'
import { TIER1_BADGES, TIER2_BADGES } from '@/lib/rooms'

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

interface SubRecord {
  id: string
  tier: string
  billing_cycle: string
  status: string
  amount: number
  currency: string
  current_period_end: string | null
  cancel_at_period_end: boolean
}

const TIER_LIMITS: Record<string, number> = {
  free:  50_000,
  tier1: 2_000_000,
  tier2: 4_000_000,
}
const TIER_NAMES: Record<string, string> = {
  free:  'Free',
  tier1: 'Scholar',
  tier2: 'Researcher',
}

type Tab = 'account' | 'plan' | 'sessions' | 'data'

interface Props {
  user: User
  usage: { tier: string; tokens_used: number; period_start: string; preferred_badge?: string | null } | null
}

export default function ProfileDashboard({ user, usage }: Props) {
  const fullName  = user.user_metadata?.full_name as string | undefined
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const nickname  = user.user_metadata?.nickname  as string | undefined

  const [tab, setTab] = useState<Tab>('account')

  // Account editing
  const [imgError,          setImgError]          = useState(false)
  const [editingName,       setEditingName]        = useState(false)
  const [displayName,       setDisplayName]        = useState(fullName ?? '')
  const [nameInput,         setNameInput]          = useState(fullName ?? '')
  const [savingName,        setSavingName]         = useState(false)
  const [editingNickname,   setEditingNickname]    = useState(false)
  const [displayNickname,   setDisplayNickname]    = useState(nickname ?? '')
  const [nicknameInput,     setNicknameInput]      = useState(nickname ?? '')
  const [savingNickname,    setSavingNickname]     = useState(false)

  // Sessions
  const [sessions,          setSessions]           = useState<SessionRecord[]>([])
  const [sessionsLoading,   setSessionsLoading]    = useState(false)
  const [currentSessionKey, setCurrentSessionKey]  = useState<string | null>(null)
  const [deletingSession,   setDeletingSession]    = useState<string | null>(null)

  // Subscription
  const [sub,         setSub]         = useState<SubRecord | null>(null)
  const [subLoading,  setSubLoading]  = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling,  setCancelling]  = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelledNow, setCancelledNow] = useState(false)

  // Change plan
  const [changePlanOpen,    setChangePlanOpen]    = useState(false)
  const [changePlanTier,    setChangePlanTier]    = useState<'tier1' | 'tier2'>('tier1')
  const [changePlanCycle,   setChangePlanCycle]   = useState<'monthly' | 'yearly'>('monthly')
  const [changePlanLoading, setChangePlanLoading] = useState(false)
  const [changePlanError,   setChangePlanError]   = useState<string | null>(null)
  const [changePlanMsg,     setChangePlanMsg]     = useState<string | null>(null)

  // Billing history
  type BillingEvent = {
    id: string; event_type: string; provider: string
    amount: number | null; currency: string | null
    tier: string | null; billing_cycle: string | null; created_at: string
  }
  const [billingHistory,        setBillingHistory]        = useState<BillingEvent[]>([])
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(false)

  // Data tab
  const [deleteConfirm,  setDeleteConfirm]  = useState(false)
  const [downloading,    setDownloading]    = useState(false)
  const [downloadError,  setDownloadError]  = useState<string | null>(null)

  // Live usage — overrides server-rendered prop with fresh data on mount
  const [liveUsage, setLiveUsage] = useState<{ tier: string; tokens_used: number; period_start: string } | null>(null)

  // Badge selection
  const [selectedBadge, setSelectedBadge] = useState<string | null>(usage?.preferred_badge ?? null)
  const [savingBadge,   setSavingBadge]   = useState(false)
  const [badgeSaved,    setBadgeSaved]    = useState(false)

  // Responsive
  const [isMobile, setIsMobile] = useState(false)

  const router   = useRouter()
  const supabase = createClient()

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Session tracking on mount
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

  // Load sessions when sessions tab opens
  useEffect(() => {
    if (tab !== 'sessions') return
    setSessionsLoading(true)
    fetch('/api/session/list')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSessions(data); setSessionsLoading(false) })
      .catch(() => setSessionsLoading(false))
  }, [tab])

  // Fetch fresh usage data on mount so tier display is never stale
  useEffect(() => {
    fetch('/api/payments/status')
      .then(r => r.json())
      .then(data => { if (data?.usage) setLiveUsage(data.usage) })
      .catch(() => {})
  }, [])

  // Load subscription + billing history when plan tab opens
  useEffect(() => {
    if (tab !== 'plan') return
    setSubLoading(true)
    fetch('/api/payments/status')
      .then(r => r.json())
      .then(data => {
        setSub(data?.subscription ?? null)
        if (data?.usage) setLiveUsage(data.usage)
        setSubLoading(false)
      })
      .catch(() => setSubLoading(false))

    setBillingHistoryLoading(true)
    fetch('/api/payments/history')
      .then(r => r.json())
      .then(data => { setBillingHistory(data?.events ?? []); setBillingHistoryLoading(false) })
      .catch(() => setBillingHistoryLoading(false))
  }, [tab])

  // Derived values — liveUsage (from mount fetch) wins over server-rendered prop
  const effectiveUsage = liveUsage ?? usage
  const initials   = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase()
  const tier       = effectiveUsage?.tier ?? 'free'
  const tokensUsed = effectiveUsage?.tokens_used ?? 0
  const tokenLimit = TIER_LIMITS[tier] ?? 50_000
  const usagePct   = Math.min(100, (tokensUsed / tokenLimit) * 100)
  const periodStart = effectiveUsage?.period_start ? new Date(effectiveUsage.period_start) : null
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
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
    if (!error) { setDisplayName(trimmed); setEditingName(false) }
  }

  async function handleSaveNickname() {
    const trimmed = nicknameInput.trim()
    if (trimmed === displayNickname) { setEditingNickname(false); return }
    setSavingNickname(true)
    const { error } = await supabase.auth.updateUser({ data: { nickname: trimmed || null } })
    setSavingNickname(false)
    if (!error) { setDisplayNickname(trimmed); setEditingNickname(false) }
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

  function loadRazorpaySDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).Razorpay) { resolve(); return }
      const existing = document.getElementById('razorpay-sdk')
      if (existing) { existing.addEventListener('load', () => resolve()); return }
      const script = document.createElement('script')
      script.id      = 'razorpay-sdk'
      script.src     = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload  = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'))
      document.head.appendChild(script)
    })
  }

  async function handleChangePlan() {
    if (!sub) return
    setChangePlanLoading(true)
    setChangePlanError(null)
    setChangePlanMsg(null)
    try {
      const res = await fetch('/api/payments/change-plan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier: changePlanTier, billingCycle: changePlanCycle, paymentProvider: 'razorpay' }),
      })
      const data = await res.json()
      if (!res.ok) { setChangePlanError(data.error ?? 'Failed to change plan'); return }

      if (data.type === 'downgrade_scheduled') {
        const name = changePlanTier === 'tier1' ? 'Scholar' : 'Researcher'
        setChangePlanMsg(`Downgrade scheduled. Your current plan remains active until the period ends, then switches to ${name} ${changePlanCycle}.`)
        setChangePlanOpen(false)
        return
      }

      if (data.checkoutMode === 'razorpay_popup' && data.subscriptionId && data.keyId) {
        const planKey  = `${changePlanTier}_${changePlanCycle}`
        const planName = `Forcapedia ${changePlanTier === 'tier1' ? 'Scholar' : 'Researcher'} – ${changePlanCycle === 'yearly' ? 'Yearly' : 'Monthly'}`
        try { await loadRazorpaySDK() } catch { setChangePlanError('Failed to load payment SDK.'); return }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const RzpClass = (window as any).Razorpay as new (o: unknown) => { open(): void; on(e: string, cb: (r: { error?: { description?: string } }) => void): void }
        const rzp = new RzpClass({
          key: data.keyId, subscription_id: data.subscriptionId,
          name: 'Forcapedia', description: planName, theme: { color: '#C9A96E' },
          modal: { ondismiss: () => setChangePlanLoading(false) },
          handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
            const vRes = await fetch('/api/payments/verify/razorpay', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ razorpay_payment_id: r.razorpay_payment_id, razorpay_subscription_id: r.razorpay_subscription_id, razorpay_signature: r.razorpay_signature }),
            })
            if (vRes.ok) { window.location.href = `/payment/success?plan=${planKey}` }
            else {
              const e = await vRes.json().catch(() => ({})) as { error?: string }
              setChangePlanError(e.error ?? 'Payment verification failed.'); setChangePlanLoading(false)
            }
          },
        })
        rzp.on('payment.failed', (r) => { setChangePlanError(r.error?.description ?? 'Payment failed.'); setChangePlanLoading(false) })
        rzp.open()
        return
      }

      if (data.checkoutMode === 'redirect' && data.approvalUrl) {
        window.location.href = data.approvalUrl; return
      }

      setChangePlanError('Unexpected response. Please try again.')
    } catch { setChangePlanError('Network error. Please try again.') }
    finally { setChangePlanLoading(false) }
  }

  async function handleCancel() {
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch('/api/payments/cancel', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to cancel')
      }
      setCancelledNow(true)
      setSub(prev => prev ? { ...prev, cancel_at_period_end: true } : prev)
      setCancelConfirm(false)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setCancelling(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    try {
      const res = await fetch('/api/data/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const cd   = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      a.href     = url
      a.download = match?.[1] ?? `forcapedia-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Download failed. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  async function handleSaveBadge() {
    setSavingBadge(true)
    setBadgeSaved(false)
    try {
      const { error } = await supabase
        .from('user_usage')
        .update({ preferred_badge: selectedBadge })
        .eq('user_id', user.id)
      if (!error) setBadgeSaved(true)
    } finally {
      setSavingBadge(false)
    }
  }

  function formatAmount(amount: number, currency: string): string {
    const upper = currency.toUpperCase()
    if (upper === 'INR') return `₹${amount.toLocaleString('en-IN')}`
    if (upper === 'USD') return `$${amount.toFixed(2)}`
    return `${currency} ${amount}`
  }

  const navItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'account',  label: 'Account',    icon: <IconPerson /> },
    { key: 'plan',     label: 'Plan & Usage', icon: <IconPlan /> },
    { key: 'sessions', label: 'Sessions',   icon: <IconGlobe /> },
    { key: 'data',     label: 'Data',       icon: <IconData /> },
  ]

  return (
    <main className="starfield-content" style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '4rem', position: 'relative', zIndex: 10 }}>
      <div style={{
        maxWidth: '1020px',
        margin: '0 auto',
        padding: isMobile ? '1.25rem 1rem' : '2.5rem 1.5rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '0' : '4rem',
        alignItems: 'flex-start',
      }}>

        {/* ── Sidebar (desktop) / Top nav (mobile) ── */}
        {isMobile ? (
          <div style={{ width: '100%', marginBottom: '1.5rem' }}>
            {/* Avatar + welcome row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.125rem' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                border: '2px solid var(--border-gold)', overflow: 'hidden',
                background: '#2A2D36', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {avatarUrl && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName || 'Profile'}
                    onError={() => setImgError(true)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--gold)' }}>
                    {initials}
                  </span>
                )}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  Welcome, {displayName.split(' ')[0] || 'there'}.
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 300 }}>
                  Manage your account.
                </p>
              </div>
            </div>
            {/* Horizontal scrollable pill nav */}
            <nav style={{
              display: 'flex', gap: '6px', overflowX: 'auto',
              paddingBottom: '4px', scrollbarWidth: 'none',
            } as React.CSSProperties}>
              {navItems.map(({ key, label, icon }) => {
                const active = tab === key
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 0.875rem', borderRadius: '100px', border: 'none',
                      background: active ? 'var(--gold-dim)' : 'var(--ink-3)',
                      color: active ? 'var(--gold)' : 'var(--text-secondary)',
                      outline: active ? '1px solid var(--border-gold)' : '1px solid transparent',
                      fontFamily: 'var(--font-sans)', fontSize: '12.5px',
                      fontWeight: active ? 500 : 400,
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {icon}
                    {label}
                  </button>
                )
              })}
            </nav>
          </div>
        ) : (
          <aside style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '88px' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                border: '2px solid var(--border-gold)', overflow: 'hidden',
                background: '#2A2D36', marginBottom: '0.75rem',
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {avatarUrl && !imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName || 'Profile'}
                    onError={() => setImgError(true)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--gold)' }}>
                    {initials}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Welcome, {displayName.split(' ')[0] || 'there'}.
              </p>
              <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', fontWeight: 300 }}>
                Manage your Forcapedia account.
              </p>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {navItems.map(({ key, label, icon }) => {
                const active = tab === key
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.6rem 0.875rem', borderRadius: '10px', border: 'none',
                      borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                      background: active ? 'var(--gold-dim)' : 'transparent',
                      color: active ? 'var(--gold)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-sans)', fontSize: '13.5px',
                      fontWeight: active ? 500 : 400,
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
                  >
                    {icon}
                    {label}
                  </button>
                )
              })}
            </nav>
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <Link
                href="/"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: 'var(--text-tertiary)', textDecoration: 'none', transition: 'color 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--gold)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)' }}
              >
                ← Home
              </Link>
            </div>
          </aside>
        )}

        {/* ── Right Content ── */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>

          {/* ACCOUNT TAB */}
          {tab === 'account' && (
            <section>
              <ContentHeader title="Your account" subtitle="Manage your account information." />

              <Card>
                {/* Full name field */}
                {editingName ? (
                  <div style={{ padding: '0.875rem 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Full name</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(displayName) } }}
                        autoFocus maxLength={60}
                        style={{
                          background: 'var(--ink-3)', border: '1px solid var(--border-gold)',
                          borderRadius: '8px', padding: '5px 12px',
                          fontSize: '13.5px', color: 'var(--text-primary)',
                          fontFamily: 'var(--font-sans)', outline: 'none',
                          width: isMobile ? '100%' : '180px', boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <SmBtn variant="gold" onClick={handleSaveName} disabled={savingName}>{savingName ? '…' : 'Save'}</SmBtn>
                        <SmBtn onClick={() => { setEditingName(false); setNameInput(displayName) }}>Cancel</SmBtn>
                      </div>
                    </div>
                  </div>
                ) : (
                  <FieldRow label="Full name" value={displayName || '—'}>
                    <EditBtn onClick={() => { setNameInput(displayName); setEditingName(true) }}>Edit</EditBtn>
                  </FieldRow>
                )}

                {/* Nickname field */}
                {editingNickname ? (
                  <div style={{ padding: '0.875rem 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>What should Forcapedia call you?</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        value={nicknameInput}
                        onChange={e => setNicknameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(); if (e.key === 'Escape') { setEditingNickname(false); setNicknameInput(displayNickname) } }}
                        autoFocus maxLength={30} placeholder="e.g. Alex, Prof, Doc…"
                        style={{
                          background: 'var(--ink-3)', border: '1px solid var(--border-gold)',
                          borderRadius: '8px', padding: '5px 12px',
                          fontSize: '13.5px', color: 'var(--text-primary)',
                          fontFamily: 'var(--font-sans)', outline: 'none',
                          width: isMobile ? '100%' : '180px', boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <SmBtn variant="gold" onClick={handleSaveNickname} disabled={savingNickname}>{savingNickname ? '…' : 'Save'}</SmBtn>
                        <SmBtn onClick={() => { setEditingNickname(false); setNicknameInput(displayNickname) }}>Cancel</SmBtn>
                      </div>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 300 }}>
                      This is how Forcapedia addresses you in search placeholders.
                    </p>
                  </div>
                ) : (
                  <FieldRow label="What should Forcapedia call you?" value={displayNickname || '—'}>
                    <EditBtn onClick={() => { setNicknameInput(displayNickname); setEditingNickname(true) }}>
                      {displayNickname ? 'Edit' : 'Set'}
                    </EditBtn>
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
                  }}>
                    {TIER_NAMES[tier]}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                    </svg>
                  </Link>
                </FieldRow>
                <FieldRow label="Account created" value={memberSince} last />
              </Card>

              {/* Sign-in methods */}
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                Sign-in methods
              </p>
              <Card>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <GoogleIcon />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>Google</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--green)',
                    background: 'rgba(111,207,151,0.1)', border: '1px solid rgba(111,207,151,0.25)',
                    padding: '2px 8px', borderRadius: '100px', flexShrink: 0,
                  }}>
                    Active
                  </span>
                </div>
              </Card>

              {/* Badge selection — tier1 / tier2 only */}
              {(tier === 'tier1' || tier === 'tier2') && (
                <div style={{ marginTop: '2rem' }}>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem',
                  }}>
                    Study Badge
                  </p>
                  <Card>
                    <div style={{ marginBottom: '0.875rem' }}>
                      <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '3px' }}>
                        Choose your badge
                      </p>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Displayed next to your avatar in study rooms. Set in your profile, applied everywhere.
                      </p>
                    </div>

                    {/* Badge grid */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                      {Object.entries(tier === 'tier2' ? { ...TIER1_BADGES, ...TIER2_BADGES } : TIER1_BADGES).map(([key]) => {
                        const isActive = selectedBadge === key
                        const isTier2Badge = key in TIER2_BADGES
                        return (
                          <button
                            key={key}
                            onClick={() => { setSelectedBadge(isActive ? null : key); setBadgeSaved(false) }}
                            title={key}
                            style={{
                              width: '56px', height: '64px', borderRadius: '12px',
                              border: isActive ? '2px solid var(--gold)' : '1px solid var(--border)',
                              background: isActive ? 'var(--gold-dim)' : 'var(--ink-3)',
                              cursor: 'pointer', display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center', gap: '5px',
                              transition: 'all 0.15s', flexShrink: 0, position: 'relative',
                            }}
                            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.background = 'rgba(201,169,110,0.05)' } }}
                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--ink-3)' } }}
                          >
                            <BadgeSVG badge={key} size={30} />
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.05em',
                              color: isActive ? 'var(--gold)' : isTier2Badge ? 'rgba(201,169,110,0.7)' : 'var(--text-tertiary)',
                              textTransform: 'capitalize',
                            }}>
                              {key}
                            </span>
                            {isTier2Badge && (
                              <span style={{
                                position: 'absolute', top: 3, right: 4,
                                fontFamily: 'var(--font-mono)', fontSize: '6px',
                                color: 'var(--gold)', letterSpacing: '0.04em',
                              }}>★</span>
                            )}
                          </button>
                        )
                      })}
                      {/* None option */}
                      <button
                        onClick={() => { setSelectedBadge(null); setBadgeSaved(false) }}
                        style={{
                          width: '56px', height: '64px', borderRadius: '12px',
                          border: selectedBadge === null ? '2px solid var(--gold)' : '1px solid var(--border)',
                          background: selectedBadge === null ? 'var(--gold-dim)' : 'var(--ink-3)',
                          cursor: 'pointer', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: '5px',
                          transition: 'all 0.15s', flexShrink: 0,
                        }}
                        onMouseEnter={e => { if (selectedBadge !== null) { e.currentTarget.style.borderColor = 'var(--border-gold)' } }}
                        onMouseLeave={e => { if (selectedBadge !== null) { e.currentTarget.style.borderColor = 'var(--border)' } }}
                      >
                        <span style={{ fontSize: '20px', opacity: 0.3, lineHeight: 1 }}>—</span>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.05em',
                          color: selectedBadge === null ? 'var(--gold)' : 'var(--text-tertiary)',
                        }}>none</span>
                      </button>
                    </div>

                    {/* Preview + Save */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      paddingTop: '0.875rem', borderTop: '1px solid var(--border)',
                      flexWrap: 'wrap',
                    }}>
                      <div>
                        <p style={{
                          fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.06em',
                          textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '6px',
                        }}>Preview</p>
                        <AvatarWithBadge
                          name={displayName || user.email || 'U'}
                          color="#C9A96E"
                          size={38}
                          badge={selectedBadge}
                        />
                      </div>
                      <div style={{ flex: 1 }} />
                      {badgeSaved && (
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '11px',
                          color: 'var(--green)', letterSpacing: '0.03em',
                        }}>
                          ✓ Saved
                        </span>
                      )}
                      <button
                        onClick={handleSaveBadge}
                        disabled={savingBadge}
                        style={{
                          padding: '0.5rem 1.125rem', borderRadius: '10px',
                          border: '1px solid var(--border-gold)',
                          background: savingBadge ? 'var(--ink-3)' : 'var(--gold-dim)',
                          color: savingBadge ? 'var(--text-tertiary)' : 'var(--gold)',
                          fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
                          cursor: savingBadge ? 'default' : 'pointer',
                          flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 0.2s',
                        }}
                      >
                        {savingBadge ? 'Saving…' : 'Save badge'}
                      </button>
                    </div>
                  </Card>
                </div>
              )}

              <div style={{ marginTop: '0.25rem' }}>
                <button
                  onClick={handleSignOut}
                  style={{
                    padding: '0.5rem 1.125rem', borderRadius: '10px',
                    border: '1px solid rgba(244,124,124,0.3)',
                    background: 'rgba(244,124,124,0.06)',
                    color: 'var(--red)', fontFamily: 'var(--font-sans)',
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.12)'; e.currentTarget.style.borderColor = 'rgba(244,124,124,0.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.06)'; e.currentTarget.style.borderColor = 'rgba(244,124,124,0.3)' }}
                >
                  Sign out
                </button>
              </div>
            </section>
          )}

          {/* PLAN TAB */}
          {tab === 'plan' && (
            <section>
              <ContentHeader title="Plan & Usage" subtitle="Your current plan and token usage this period." />

              {/* Payment failed warning banner */}
              {sub?.status === 'past_due' && (
                <div style={{
                  marginBottom: '1rem', padding: '0.75rem 1rem',
                  background: 'rgba(244,124,124,0.08)', border: '1px solid rgba(244,124,124,0.3)',
                  borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.625rem',
                }}>
                  <span style={{ color: '#f47c7c', fontSize: '15px' }}>⚠</span>
                  <p style={{ fontSize: '13px', color: '#f47c7c', margin: 0 }}>
                    Your last payment failed. Cancel your plan and re-subscribe to continue.
                    You currently have access but it will be removed after the retry period.
                  </p>
                </div>
              )}

              <Card>
                {/* Plan header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', padding: '0.5rem 0', marginBottom: '1rem' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '0.35rem' }}>Current plan</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)' }}>
                        {TIER_NAMES[tier]}
                      </span>
                      {subLoading ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>…</span>
                      ) : sub ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                          {formatAmount(sub.amount, sub.currency)} / {sub.billing_cycle}
                        </span>
                      ) : tier === 'free' ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>Free</span>
                      ) : null}
                    </div>
                    {sub?.current_period_end && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                        {(sub.cancel_at_period_end || cancelledNow)
                          ? `Access until ${new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : `Renews ${new Date(sub.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        }
                      </p>
                    )}
                  </div>

                  {/* Status pill + Cancel button */}
                  <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {tier !== 'free' ? (
                      <>
                        {sub?.status === 'past_due' ? (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                            textTransform: 'uppercase', color: '#f47c7c',
                            background: 'rgba(244,124,124,0.1)', border: '1px solid rgba(244,124,124,0.35)',
                            padding: '3px 10px', borderRadius: '100px',
                          }}>
                            Payment failed
                          </span>
                        ) : (sub?.cancel_at_period_end || cancelledNow) ? (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                            textTransform: 'uppercase', color: 'var(--text-tertiary)',
                            background: 'var(--ink-3)', border: '1px solid var(--border)',
                            padding: '3px 10px', borderRadius: '100px',
                          }}>
                            Cancels at period end
                          </span>
                        ) : (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                            textTransform: 'uppercase', color: 'var(--gold)',
                            background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                            padding: '3px 10px', borderRadius: '100px',
                          }}>
                            Active
                          </span>
                        )}
                        {!sub?.cancel_at_period_end && !cancelledNow && !subLoading && (
                          <>
                            <button
                              onClick={() => {
                                const t = (sub?.tier ?? 'tier1') as 'tier1' | 'tier2'
                                const c = (sub?.billing_cycle ?? 'monthly') as 'monthly' | 'yearly'
                                // Pre-select the next logical plan
                                if (t === 'tier1' && c === 'monthly') { setChangePlanTier('tier1'); setChangePlanCycle('yearly') }
                                else if (t === 'tier1' && c === 'yearly') { setChangePlanTier('tier2'); setChangePlanCycle('monthly') }
                                else { setChangePlanTier('tier1'); setChangePlanCycle('monthly') }
                                setChangePlanError(null)
                                setChangePlanOpen(o => !o)
                              }}
                              style={{
                                padding: '3px 10px', borderRadius: '100px',
                                border: '1px solid var(--border-gold)',
                                background: 'var(--gold-dim)',
                                color: 'var(--gold)', fontFamily: 'var(--font-mono)',
                                fontSize: '10px', letterSpacing: '0.06em',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}
                            >
                              Change Plan
                            </button>
                            <button
                              onClick={() => setCancelConfirm(true)}
                              style={{
                                padding: '3px 10px', borderRadius: '100px',
                                border: '1px solid rgba(244,124,124,0.3)',
                                background: 'rgba(244,124,124,0.06)',
                                color: 'var(--red)', fontFamily: 'var(--font-mono)',
                                fontSize: '10px', letterSpacing: '0.06em',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.12)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.06)' }}
                            >
                              Cancel plan
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <Link href="/pricing" style={{
                        fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em',
                        textTransform: 'uppercase', color: 'var(--gold)',
                        background: 'var(--gold-dim)', border: '1px solid var(--border-gold)',
                        padding: '6px 14px', borderRadius: '10px',
                        textDecoration: 'none',
                      }}>
                        Upgrade →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Cancel confirmation inline */}
                {cancelConfirm && (
                  <div style={{
                    padding: '1rem', borderRadius: '10px', marginBottom: '1rem',
                    background: 'rgba(244,124,124,0.05)', border: '1px solid rgba(244,124,124,0.2)',
                  }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                      Cancel subscription? You&apos;ll keep access until the end of your current billing period.
                    </p>
                    {cancelError && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', marginBottom: '0.5rem' }}>
                        {cancelError}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        style={{
                          padding: '0.4rem 1rem', borderRadius: '8px',
                          border: '1px solid rgba(244,124,124,0.5)',
                          background: 'rgba(244,124,124,0.15)',
                          color: 'var(--red)', fontFamily: 'var(--font-sans)',
                          fontSize: '12px', fontWeight: 500,
                          cursor: cancelling ? 'default' : 'pointer', opacity: cancelling ? 0.6 : 1,
                        }}
                      >
                        {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                      </button>
                      <button
                        onClick={() => { setCancelConfirm(false); setCancelError(null) }}
                        disabled={cancelling}
                        style={{
                          padding: '0.4rem 1rem', borderRadius: '8px',
                          border: '1px solid var(--border)', background: 'none',
                          color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                          fontSize: '12px', cursor: 'pointer',
                        }}
                      >
                        Keep plan
                      </button>
                    </div>
                  </div>
                )}

                {/* Change plan inline panel */}
                {changePlanOpen && sub && (
                  <div style={{
                    marginBottom: '1rem', padding: '1rem', borderRadius: '10px',
                    background: 'var(--ink-2)', border: '1px solid var(--border-gold)',
                  }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                      Select a new plan
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                      {([
                        { tier: 'tier1' as const, cycle: 'monthly' as const, name: 'Scholar',    price: '₹499/mo',    desc: '2M tokens / month' },
                        { tier: 'tier1' as const, cycle: 'yearly'  as const, name: 'Scholar',    price: '₹4,999/yr',  desc: 'Save ~16%' },
                        { tier: 'tier2' as const, cycle: 'monthly' as const, name: 'Researcher', price: '₹1,099/mo',  desc: '4M tokens / month' },
                        { tier: 'tier2' as const, cycle: 'yearly'  as const, name: 'Researcher', price: '₹9,999/yr',  desc: 'Save ~24%' },
                      ]).map(opt => {
                        const isCurrent  = sub.tier === opt.tier && sub.billing_cycle === opt.cycle
                        const isSelected = changePlanTier === opt.tier && changePlanCycle === opt.cycle
                        return (
                          <button
                            key={`${opt.tier}_${opt.cycle}`}
                            disabled={isCurrent}
                            onClick={() => { setChangePlanTier(opt.tier); setChangePlanCycle(opt.cycle) }}
                            style={{
                              padding: '0.625rem 0.75rem', borderRadius: '8px', textAlign: 'left',
                              border: isCurrent
                                ? '1px solid var(--border)'
                                : isSelected
                                  ? '1px solid var(--border-gold)'
                                  : '1px solid var(--border)',
                              background: isCurrent
                                ? 'var(--ink-3)'
                                : isSelected
                                  ? 'var(--gold-dim)'
                                  : 'var(--ink-3)',
                              cursor: isCurrent ? 'default' : 'pointer',
                              opacity: isCurrent ? 0.5 : 1,
                              transition: 'all 0.15s',
                            }}
                          >
                            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, color: isSelected && !isCurrent ? 'var(--gold)' : 'var(--text-primary)', marginBottom: '2px' }}>
                              {opt.name} {opt.cycle === 'yearly' ? 'Yearly' : 'Monthly'}
                              {isCurrent && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>current</span>}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: isSelected && !isCurrent ? 'var(--gold)' : 'var(--text-tertiary)' }}>
                              {opt.price} · {opt.desc}
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {(() => {
                      const TIER_LVL: Record<string, number> = { free: 0, tier1: 1, tier2: 2 }
                      const CYCLE_LVL: Record<string, number> = { monthly: 0, yearly: 1 }
                      const isSamePlan = changePlanTier === sub.tier && changePlanCycle === sub.billing_cycle
                      const isUpgrade  = !isSamePlan && (
                        TIER_LVL[changePlanTier] > TIER_LVL[sub.tier] ||
                        (changePlanTier === sub.tier && CYCLE_LVL[changePlanCycle] > CYCLE_LVL[sub.billing_cycle as string])
                      )
                      return !isSamePlan ? (
                        <div style={{
                          marginBottom: '0.875rem', padding: '0.625rem 0.75rem', borderRadius: '8px',
                          background: isUpgrade ? 'rgba(244,124,124,0.04)' : 'rgba(201,169,110,0.04)',
                          border: `1px solid ${isUpgrade ? 'rgba(244,124,124,0.18)' : 'rgba(201,169,110,0.18)'}`,
                        }}>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: isUpgrade ? 'rgba(244,124,124,0.85)' : 'var(--text-tertiary)', lineHeight: 1.6, margin: 0 }}>
                            {isUpgrade
                              ? 'Your current plan will be cancelled immediately. You\'ll be taken to checkout — if you close it without paying, contact support to restore access.'
                              : 'Your current plan stays active until the end of the billing period, then switches to the new plan.'}
                          </p>
                        </div>
                      ) : null
                    })()}

                    {changePlanError && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', marginBottom: '0.75rem' }}>
                        {changePlanError}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleChangePlan}
                        disabled={changePlanLoading || (changePlanTier === sub.tier && changePlanCycle === sub.billing_cycle)}
                        style={{
                          padding: '0.4rem 1rem', borderRadius: '8px',
                          border: '1px solid var(--border-gold)', background: 'var(--gold-dim)',
                          color: 'var(--gold)', fontFamily: 'var(--font-sans)',
                          fontSize: '12px', fontWeight: 500,
                          cursor: (changePlanLoading || (changePlanTier === sub.tier && changePlanCycle === sub.billing_cycle)) ? 'default' : 'pointer',
                          opacity: (changePlanLoading || (changePlanTier === sub.tier && changePlanCycle === sub.billing_cycle)) ? 0.5 : 1,
                        }}
                      >
                        {changePlanLoading ? 'Processing…' : 'Confirm change'}
                      </button>
                      <button
                        onClick={() => { setChangePlanOpen(false); setChangePlanError(null) }}
                        disabled={changePlanLoading}
                        style={{
                          padding: '0.4rem 1rem', borderRadius: '8px',
                          border: '1px solid var(--border)', background: 'none',
                          color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)',
                          fontSize: '12px', cursor: changePlanLoading ? 'default' : 'pointer',
                          opacity: changePlanLoading ? 0.5 : 1,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Downgrade / change-plan confirmation message */}
                {changePlanMsg && (
                  <div style={{
                    marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '10px',
                    background: 'rgba(201,169,110,0.06)', border: '1px solid var(--border-gold)',
                  }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--gold)', margin: 0 }}>
                      {changePlanMsg}
                    </p>
                  </div>
                )}

                {/* Token usage bar */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                      Token usage
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: usagePct > 80 ? 'var(--red)' : 'var(--text-tertiary)' }}>
                      {tokensUsed.toLocaleString()} / {tokenLimit.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: '5px', background: 'var(--border)', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${usagePct}%`,
                      background: usagePct > 80 ? 'var(--red)' : usagePct > 50 ? 'var(--amber)' : 'var(--gold)',
                      borderRadius: '100px', transition: 'width 0.6s ease',
                    }} />
                  </div>
                  {periodStart && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                      Resets {new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </Card>

              {/* Plan features comparison */}
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                What&apos;s included
              </p>
              <Card>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: '340px' }}>
                    {[
                      { label: 'Monthly tokens',        free: '50,000',   tier1: '2,000,000', tier2: '4,000,000' },
                      { label: 'Follow-ups per article', free: '1',        tier1: 'Unlimited', tier2: 'Unlimited' },
                      { label: 'Search history',        free: '—',        tier1: '✓',         tier2: '✓' },
                      { label: 'Priority processing',   free: '—',        tier1: '—',         tier2: '✓' },
                    ].map((row, i) => (
                      <div key={row.label} style={{
                        display: 'grid', gridTemplateColumns: '1fr repeat(3, 80px)',
                        alignItems: 'center', gap: '1rem', padding: '0.75rem 0',
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
                  </div>
                </div>
              </Card>

              {/* Billing history */}
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
                Billing history
              </p>
              <Card>
                {billingHistoryLoading ? (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '1.25rem 0' }}>
                    Loading…
                  </p>
                ) : billingHistory.length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '1.25rem 0' }}>
                    No billing events yet.
                  </p>
                ) : (
                  billingHistory.map((ev, i) => {
                    const TIER_NAME: Record<string, string> = { tier1: 'Scholar', tier2: 'Researcher', free: 'Free' }
                    const planLabel = ev.tier ? `${TIER_NAME[ev.tier] ?? ev.tier} — ${ev.billing_cycle ?? ''}` : '—'
                    const isActivation = ev.event_type === 'subscription.activated'
                    const amountStr = ev.amount != null && ev.currency
                      ? (ev.currency === 'INR' ? `₹${ev.amount.toLocaleString('en-IN')}` : `$${ev.amount.toFixed(2)}`)
                      : isActivation ? 'Subscription started' : '—'
                    const dateStr = new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    const providerLabel = ev.provider === 'paypal' ? 'PayPal' : ev.provider === 'cashfree' ? 'Card / UPI' : ev.provider

                    return (
                      <div key={ev.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: '0.5rem',
                        padding: '0.75rem 0',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                            {isActivation ? 'Subscription activated' : 'Payment'}
                          </p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            {planLabel} · {providerLabel}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold)', fontWeight: 500 }}>
                            {amountStr}
                          </p>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>
                            {dateStr}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </Card>
            </section>
          )}

          {/* SESSIONS TAB */}
          {tab === 'sessions' && (
            <section>
              <ContentHeader title="Your sessions" subtitle="Devices and browsers currently signed in to your account." />

              {sessionsLoading ? (
                <Card>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '1.5rem 0' }}>
                    Loading sessions…
                  </p>
                </Card>
              ) : sessions.length === 0 ? (
                <Card>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '1.5rem 0' }}>
                    No sessions recorded yet.
                  </p>
                </Card>
              ) : (
                sessions.map(session => {
                  const isCurrent = session.session_key === currentSessionKey
                  return (
                    <Card key={session.id} style={isCurrent ? { borderColor: 'rgba(212,175,55,0.35)' } : {}}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', minWidth: 0 }}>
                          <DeviceIcon type={session.device_type ?? 'desktop'} />
                          <div style={{ minWidth: 0 }}>
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
                            <p style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                              {session.browser ?? 'Unknown browser'} on {session.os ?? 'Unknown OS'}
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                              {session.city && session.country
                                ? `${session.city}, ${session.country}`
                                : session.country ?? 'Location unavailable'}
                              {session.timezone ? ` · ${session.timezone}` : ''}
                            </p>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
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
                              flexShrink: 0, padding: '0.35rem 0.75rem', borderRadius: '8px',
                              border: '1px solid var(--border)', background: 'none',
                              color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
                              fontSize: '10px', letterSpacing: '0.05em', cursor: 'pointer',
                              opacity: deletingSession === session.id ? 0.5 : 1, transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(244,124,124,0.4)'; e.currentTarget.style.color = 'var(--red)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
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
                      padding: '0.5rem 1.125rem', borderRadius: '10px',
                      border: '1px solid rgba(244,124,124,0.3)',
                      background: 'rgba(244,124,124,0.06)',
                      color: 'var(--red)', fontFamily: 'var(--font-sans)',
                      fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.12)'; e.currentTarget.style.borderColor = 'rgba(244,124,124,0.5)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.06)'; e.currentTarget.style.borderColor = 'rgba(244,124,124,0.3)' }}
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
              <ContentHeader title="Your data" subtitle="Manage your personal data stored with Forcapedia." />

              {/* Download */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      Download account data
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Export your account information, usage stats, and session history as a JSON file.
                    </p>
                    {downloadError && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', marginTop: '0.5rem' }}>
                        {downloadError}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    style={{
                      padding: '0.5rem 1.125rem', borderRadius: '10px',
                      border: '1px solid var(--border-gold)',
                      background: downloading ? 'var(--ink-3)' : 'var(--gold-dim)',
                      color: downloading ? 'var(--text-tertiary)' : 'var(--gold)',
                      fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 500,
                      cursor: downloading ? 'default' : 'pointer',
                      flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 0.2s',
                    }}
                  >
                    {downloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>
              </Card>

              {/* Delete */}
              <Card style={{ borderColor: 'rgba(244,124,124,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <div style={{ minWidth: 0 }}>
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
                        padding: '0.5rem 1.125rem', borderRadius: '10px',
                        border: '1px solid rgba(244,124,124,0.4)',
                        background: 'rgba(244,124,124,0.08)',
                        color: 'var(--red)', fontFamily: 'var(--font-sans)',
                        fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        flexShrink: 0, whiteSpace: 'nowrap', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,124,124,0.08)' }}
                    >
                      Delete
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        To delete, email support:
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                        <a
                          href="mailto:hello@forcapedia.com?subject=Account%20Deletion%20Request"
                          style={{
                            display: 'inline-block',
                            padding: '0.4rem 0.875rem', borderRadius: '8px',
                            border: '1px solid rgba(244,124,124,0.5)',
                            background: 'rgba(244,124,124,0.15)',
                            color: 'var(--red)', fontFamily: 'var(--font-sans)',
                            fontSize: '12px', fontWeight: 500, textDecoration: 'none',
                          }}
                        >
                          Email support
                        </a>
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

function SmBtn({
  children, onClick, disabled, variant,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'gold'
}) {
  const isGold = variant === 'gold'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 14px', borderRadius: '8px',
        border: isGold ? '1px solid var(--border-gold)' : '1px solid var(--border)',
        background: isGold ? 'var(--gold-dim)' : 'none',
        color: isGold ? 'var(--gold)' : 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

function EditBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px', borderRadius: '100px', flexShrink: 0,
        border: '1px solid var(--border)', background: 'none',
        color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '10px',
        letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.color = 'var(--gold)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
    >
      {children}
    </button>
  )
}

function ContentHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 300, color: 'var(--text-primary)', marginBottom: '0.35rem', lineHeight: 1.2 }}>
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
    <div
      className="glass-card"
      style={{ borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem', ...style }}
    >
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
      padding: '0.875rem 0', gap: '1rem',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px',
        }}>
          {label}
        </p>
        {value && (
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
