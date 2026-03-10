import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RoomChatPage from '@/components/RoomChatPage'

interface Props { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  return { title: `Chat — Room ${code.toUpperCase()} — Forcapedia` }
}

export default async function RoomChatRoute({ params }: Props) {
  const { code } = await params
  const upperCode = code.toUpperCase()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/room/${upperCode}/chat`)

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('id, code, room_name, status')
    .eq('code', upperCode)
    .single()

  if (!room || room.status !== 'active') redirect(`/room/${upperCode}`)

  // Verify membership
  const { data: member } = await admin
    .from('room_members')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.kicked_at || member.join_status === 'rejected') redirect(`/room/${upperCode}`)

  const [messagesRes, membersRes, usageRes] = await Promise.all([
    admin.from('room_messages').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(100),
    admin.from('room_members').select('*').eq('room_id', room.id).is('kicked_at', null).order('joined_at'),
    supabase.from('user_usage').select('tier').eq('user_id', user.id).single(),
  ])

  const currentUser = {
    id:          user.id,
    name:        member.display_name,
    avatarColor: member.avatar_color,
    isHost:      member.is_host,
    isObserver:  member.is_observer,
    tier:        usageRes.data?.tier ?? 'free',
    badge:       member.badge ?? null,
  }

  return (
    <RoomChatPage
      roomCode={upperCode}
      roomName={room.room_name ?? `Room ${upperCode}`}
      initialMessages={(messagesRes.data ?? []).reverse()}
      initialMembers={membersRes.data ?? []}
      currentUser={currentUser}
    />
  )
}
