import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { CSSProperties as ReactCSS } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudyRoom from '@/components/StudyRoom'

interface Props { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  return { title: `Study Room ${code.toUpperCase()} — Forcapedia` }
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params
  const upperCode = code.toUpperCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/room/${upperCode}`)

  const admin = createAdminClient()

  // ── Load room ──────────────────────────────────────────────────────────────
  const { data: room } = await admin
    .from('study_rooms')
    .select('*')
    .eq('code', upperCode)
    .single()

  if (!room) {
    return <RoomNotFound code={upperCode} />
  }

  if (room.status !== 'active') {
    return <RoomEnded code={upperCode} />
  }

  // ── Check / auto-join membership ───────────────────────────────────────────
  let { data: member } = await admin
    .from('room_members')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (member?.kicked_at) {
    return <RoomKicked />
  }

  if (!member) {
    // Auto-join via API logic (inline here for SSR)
    const { data: usage } = await supabase.from('user_usage').select('tier').eq('user_id', user.id).single()
    const tier = usage?.tier ?? 'free'

    const { count: activeCount } = await admin
      .from('room_members')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .is('kicked_at', null)
      .is('left_at', null)

    if ((activeCount ?? 0) >= room.max_members) {
      return <RoomFull />
    }

    const { MEMBER_COLORS, isObserverTier } = await import('@/lib/rooms')
    const colorIndex  = Math.min((activeCount ?? 0), MEMBER_COLORS.length - 1)
    const displayName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
      ?? user.email?.split('@')[0] ?? 'Guest'

    const { data: newMember } = await admin.from('room_members').insert({
      room_id:      room.id,
      user_id:      user.id,
      display_name: displayName,
      avatar_color: MEMBER_COLORS[colorIndex],
      is_host:      false,
      is_observer:  isObserverTier(tier),
    }).select().single()

    if (newMember) {
      member = newMember
      await admin.from('room_messages').insert({
        room_id: room.id, user_id: user.id,
        display_name: displayName, avatar_color: MEMBER_COLORS[colorIndex],
        content: `${displayName} joined the room`, kind: 'system',
      })
    }
  }

  if (!member) return <RoomFull />

  // ── Load initial data ──────────────────────────────────────────────────────
  const [membersRes, messagesRes, highlightsRes, navRes, articleRes] = await Promise.all([
    admin.from('room_members').select('*').eq('room_id', room.id).is('kicked_at', null).order('joined_at'),
    admin.from('room_messages').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(20),
    admin.from('room_highlights').select('*').eq('room_id', room.id).eq('article_slug', room.article_slug).order('created_at', { ascending: false }).limit(50),
    admin.from('room_navigation_history').select('*').eq('room_id', room.id).order('navigated_at').limit(20),
    admin.from('articles').select('slug, title, content, summary, category').eq('slug', room.article_slug).single(),
  ])

  const { data: usageForUser } = await supabase.from('user_usage').select('tier').eq('user_id', user.id).single()

  const currentUser = {
    id:          user.id,
    name:        member.display_name,
    avatarColor: member.avatar_color,
    isHost:      member.is_host,
    isObserver:  member.is_observer,
    tier:        usageForUser?.tier ?? 'free',
  }

  return (
    <StudyRoom
      roomCode={upperCode}
      room={room}
      initialMembers={membersRes.data ?? []}
      initialMessages={(messagesRes.data ?? []).reverse()}
      initialHighlights={highlightsRes.data ?? []}
      initialNavHistory={navRes.data ?? []}
      initialArticle={articleRes.data ?? { slug: room.article_slug, title: room.article_title, content: '', summary: '', category: '' }}
      currentUser={currentUser}
    />
  )
}

// ── Error screens ──────────────────────────────────────────────────────────────
function RoomNotFound({ code }: { code: string }) {
  return (
    <div style={centreStyle}>
      <p style={titleStyle}>Room not found</p>
      <p style={subStyle}>No active room with code <strong>{code}</strong>.</p>
      <a href="/" style={linkStyle}>← Back to Forcapedia</a>
    </div>
  )
}

function RoomEnded({ code }: { code: string }) {
  return (
    <div style={centreStyle}>
      <p style={titleStyle}>Session ended</p>
      <p style={subStyle}>Room <strong>{code}</strong> has already closed.</p>
      <a href="/" style={linkStyle}>← Start a new session</a>
    </div>
  )
}

function RoomKicked() {
  return (
    <div style={centreStyle}>
      <p style={titleStyle}>You were removed</p>
      <p style={subStyle}>The host has removed you from this room.</p>
      <a href="/" style={linkStyle}>← Back to Forcapedia</a>
    </div>
  )
}

function RoomFull() {
  return (
    <div style={centreStyle}>
      <p style={titleStyle}>Room is full</p>
      <p style={subStyle}>This room has reached its member limit.</p>
      <a href="/" style={linkStyle}>← Back to Forcapedia</a>
    </div>
  )
}

const centreStyle: ReactCSS = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
  background: '#191919', padding: '2rem',
}
const titleStyle: ReactCSS = {
  fontFamily: 'Georgia, serif', fontSize: '1.75rem', fontWeight: 300, color: '#F0EDE8',
}
const subStyle: ReactCSS = { fontSize: '14px', color: 'rgba(240,237,232,0.5)' }
const linkStyle: ReactCSS = {
  marginTop: '0.5rem', fontSize: '13px', color: '#C9A96E', textDecoration: 'none',
}
