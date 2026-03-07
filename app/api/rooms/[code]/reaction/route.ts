// POST /api/rooms/[code]/reaction
// Broadcasts a floating emoji reaction to all other members.
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

  const { emoji, x, y, socketId } = await req.json().catch(() => ({}))
  if (!emoji) return NextResponse.json({ error: 'emoji required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('room_members')
    .select('display_name, kicked_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.kicked_at) return NextResponse.json({ error: 'Not in room.' }, { status: 403 })

  await broadcast(ch.chat(code), 'reaction', {
    emoji,
    x:           x ?? 50,
    y:           y ?? 50,
    displayName: member.display_name,
  }, socketId)

  return NextResponse.json({ ok: true })
}
