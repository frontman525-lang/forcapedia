// POST /api/rooms/[code]/nav-request
// Member asks the host to navigate to a specific article.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { broadcast, ch } from '@/lib/soketi/server'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetSlug, targetTitle, socketId } = await req.json().catch(() => ({}))
  if (!targetSlug || !targetTitle) {
    return NextResponse.json({ error: 'targetSlug and targetTitle required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single()

  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (room.host_id === user.id) return NextResponse.json({ error: 'Host navigates directly.' }, { status: 400 })

  const { data: member } = await admin
    .from('room_members')
    .select('display_name, kicked_at')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .single()

  if (!member || member.kicked_at) return NextResponse.json({ error: 'Not in room.' }, { status: 403 })

  await broadcast(ch.article(code), 'nav_request', {
    requestId:   Date.now().toString(),
    userId:      user.id,
    displayName: member.display_name,
    targetSlug,
    targetTitle,
  }, socketId)

  return NextResponse.json({ ok: true })
}
