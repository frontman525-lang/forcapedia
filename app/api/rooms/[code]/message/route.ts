// POST /api/rooms/[code]/message
// Validates and stores a chat message. Observers cannot send.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { containsBlockedContent } from '@/lib/rooms'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await req.json().catch(() => ({}))
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const trimmed = content.trim().slice(0, 500)
  if (trimmed.length === 0) return NextResponse.json({ error: 'Empty message.' }, { status: 400 })

  const blocked = containsBlockedContent(trimmed)
  if (blocked) return NextResponse.json({ error: blocked }, { status: 422 })

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })

  const { data: member } = await admin
    .from('room_members')
    .select('display_name, avatar_color, is_observer, kicked_at')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .single()

  if (!member || member.kicked_at) return NextResponse.json({ error: 'Not in room.' }, { status: 403 })
  if (member.is_observer) return NextResponse.json({ error: 'Observers cannot send messages.' }, { status: 403 })

  const { data: msg, error } = await admin.from('room_messages').insert({
    room_id:      room.id,
    user_id:      user.id,
    display_name: member.display_name,
    avatar_color: member.avatar_color,
    content:      trimmed,
    kind:         'text',
  }).select().single()

  if (error) return NextResponse.json({ error: 'Failed to save message.' }, { status: 500 })

  return NextResponse.json(msg)
}
