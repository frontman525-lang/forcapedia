// POST /api/rooms/[code]/message
// Validates and stores a chat message. Observers cannot send.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { containsBlockedContent } from '@/lib/rooms'
import { broadcast, ch } from '@/lib/soketi/server'

interface Props { params: Promise<{ code: string }> }


export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, kind: rawKind, socketId } = await req.json().catch(() => ({}))
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }
  // Only allow valid kind values; default to 'text' (DB constraint: text|explain|highlight|system|doubt)
  const kind = rawKind === 'doubt' ? 'doubt' : rawKind === 'explain' ? 'explain' : 'text'

  // Explain messages carry full AI output — use a higher limit; skip blocked-content check
  // (AI output is trusted and may contain domain names that would trip the URL pattern)
  const isAiMessage = kind === 'explain' || content.includes('**AI Answer:**')
  const maxLen = isAiMessage ? 20000 : 5000
  const trimmed = content.slice(0, maxLen)
  if (trimmed.length === 0) return NextResponse.json({ error: 'Empty message.' }, { status: 400 })

  if (!isAiMessage) {
    const blocked = containsBlockedContent(trimmed)
    if (blocked) return NextResponse.json({ error: blocked }, { status: 422 })
  }

  const admin = createAdminClient()

  // Two-step lookup: check existence first, then status, so errors are accurate
  const { data: roomRaw } = await admin
    .from('study_rooms')
    .select('id, status')
    .eq('code', code.toUpperCase())
    .single()

  if (!roomRaw) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  if (roomRaw.status !== 'active') return NextResponse.json({ error: 'Session has ended.' }, { status: 410 })

  const room = roomRaw

  const { data: member } = await admin
    .from('room_members')
    .select('display_name, avatar_color, is_observer, is_host, join_status, kicked_at')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .single()

  if (!member || member.kicked_at) return NextResponse.json({ error: 'You are not in this room.' }, { status: 403 })
  if (member.join_status !== 'approved') return NextResponse.json({ error: 'Your join request is still pending host approval.' }, { status: 403 })
  if (member.is_observer) return NextResponse.json({ error: 'Observers cannot send messages. Join as a full participant to chat.' }, { status: 403 })

  // Server-side rate limiting: 30 text messages per 60s, then 10s cooldown. Host is exempt.
  if (!member.is_host && !isAiMessage && kind === 'text') {
    const windowStart = new Date(Date.now() - 60_000).toISOString()
    const { data: recentMsgs, count: recentCount } = await admin
      .from('room_messages')
      .select('created_at, content', { count: 'exact' })
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .eq('kind', 'text')
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(35)

    if ((recentCount ?? 0) >= 30) {
      const latestAt = recentMsgs?.[0]?.created_at
      if (latestAt) {
        const cooldownEnds = new Date(latestAt).getTime() + 10_000
        const secsLeft = Math.ceil((cooldownEnds - Date.now()) / 1000)
        if (secsLeft > 0) {
          return NextResponse.json({
            error: `Slow down — you've hit the limit of 30 messages per minute. Wait ${secsLeft}s.`,
            cooldownSecs: secsLeft,
          }, { status: 429 })
        }
      }
    }

    // Repeat-message detection: warn (don't block) if last 10 consecutive msgs
    // from this user are identical — uses a separate query with no time window.
    let repeatWarning = false
    const { data: last10Msgs } = await admin
      .from('room_messages')
      .select('content')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .eq('kind', 'text')
      .order('created_at', { ascending: false })
      .limit(10)
    if ((last10Msgs?.length ?? 0) >= 10 && last10Msgs!.every(m => m.content === trimmed)) {
      repeatWarning = true
    }

    if (repeatWarning) {
      // Insert message but return a warning flag so client can show a toast
      const { data: msg, error } = await admin.from('room_messages').insert({
        room_id:      room.id,
        user_id:      user.id,
        display_name: member.display_name,
        avatar_color: member.avatar_color,
        content:      trimmed,
        kind,
      }).select().single()
      if (error) return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 })
      await broadcast(ch.chat(code), 'message', msg, socketId)
      return NextResponse.json({ ...msg, warning: 'avoid_repeating_messages' })
    }
  }

  const { data: msg, error } = await admin.from('room_messages').insert({
    room_id:      room.id,
    user_id:      user.id,
    display_name: member.display_name,
    avatar_color: member.avatar_color,
    content:      trimmed,
    kind,
  }).select().single()

  if (error) return NextResponse.json({ error: 'Failed to save message.' }, { status: 500 })

  const channel = kind === 'doubt' ? ch.doubts(code) : ch.chat(code)
  await broadcast(channel, 'message', msg, socketId)

  return NextResponse.json(msg)
}
