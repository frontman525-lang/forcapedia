// POST /api/rooms/[code]/scroll
// Host broadcasts their scroll position to following members. Fire-and-forget.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { broadcast, ch } from '@/lib/soketi/server'

interface Props { params: Promise<{ code: string }> }

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true }) // silent — don't block host

  const { pct, socketId } = await req.json().catch(() => ({}))
  if (typeof pct === 'number') {
    await broadcast(ch.article(code), 'scroll', { pct }, socketId)
  }

  return NextResponse.json({ ok: true })
}
