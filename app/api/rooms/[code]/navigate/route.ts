// POST /api/rooms/[code]/navigate
// Host changes the article for the room. Records nav history.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { articleSlug, articleTitle } = await req.json().catch(() => ({}))
  if (!articleSlug || !articleTitle) {
    return NextResponse.json({ error: 'articleSlug and articleTitle required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room)               return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.host_id !== user.id) return NextResponse.json({ error: 'Only the host can navigate.' }, { status: 403 })

  await Promise.all([
    admin.from('study_rooms').update({
      article_slug:  articleSlug,
      article_title: articleTitle,
    }).eq('id', room.id),

    admin.from('room_navigation_history').insert({
      room_id:       room.id,
      article_slug:  articleSlug,
      article_title: articleTitle,
      navigated_by:  user.id,
    }),

    admin.from('room_messages').insert({
      room_id:      room.id,
      user_id:      user.id,
      display_name: 'Host',
      avatar_color: '#C9A96E',
      content:      `Moved to "${articleTitle}"`,
      kind:         'system',
    }),
  ])

  return NextResponse.json({ ok: true })
}
