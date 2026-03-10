import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudyLobby from '@/components/StudyLobby'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title:       'Study Together',
  description: 'Create or join a live study room and learn together.',
  robots:      { index: false, follow: false },
}

interface RecentRoom {
  code: string
  room_name: string | null
  article_title: string | null
  status: string
  created_at: string
  joined_at: string
}

export default async function StudyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/study')

  const admin = createAdminClient()

  const [usageRes, membershipsRes] = await Promise.all([
    admin.from('user_usage').select('tier, preferred_badge').eq('user_id', user.id).order('period_start', { ascending: false }).limit(1).single(),
    admin
      .from('room_members')
      .select('joined_at, study_rooms(code, room_name, article_title, status, created_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(20),
  ])

  const userTier      = usageRes.data?.tier ?? 'free'
  const userBadge     = (usageRes.data?.preferred_badge as string | null | undefined) ?? null
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | null | undefined) ?? null
  const userName      = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'Friend'
  const userEmail     = user.email ?? ''

  // Flatten the join result to a clean array
  const allRoomsFlat: RecentRoom[] = (membershipsRes.data ?? [])
    .map((m) => {
      const room = Array.isArray(m.study_rooms) ? m.study_rooms[0] : m.study_rooms
      if (!room) return null
      return {
        code:          room.code,
        room_name:     room.room_name ?? null,
        article_title: room.article_title || null,
        status:        room.status,
        created_at:    room.created_at,
        joined_at:     m.joined_at as string,
      }
    })
    .filter(Boolean) as RecentRoom[]

  const recentRooms = allRoomsFlat.slice(0, 3)
  const allRooms    = allRoomsFlat

  return (
    <StudyLobby
      userName={userName}
      userEmail={userEmail}
      userTier={userTier}
      userAvatarUrl={userAvatarUrl}
      userBadge={userBadge}
      recentRooms={recentRooms}
      allRooms={allRooms}
    />
  )
}
