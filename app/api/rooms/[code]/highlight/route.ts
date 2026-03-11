// POST /api/rooms/[code]/highlight
// Member highlights text and optionally triggers shared AI explain.
// The explain uses the HOST's token allowance.
import { broadcast, ch } from '@/lib/soketi/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVertexToken, getVertexEndpoint, isVertexConfigured, VERTEX_MODEL } from '@/lib/vertexai'

interface Props { params: Promise<{ code: string }> }

const SYSTEM_PROMPT = `Explain this clearly and concisely. The student didn't understand it. Be direct. No filler. No lectures.`

function getMaxTokens(textLen: number): number {
  if (textLen <=  50) return  80   // single word / short phrase
  if (textLen <= 150) return 150   // a sentence
  if (textLen <= 400) return 280   // a few sentences
  return 400                       // paragraph — hard cap: never exceed 450
}

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { selectedText, withExplain = false, socketId, requiresApproval = false, highlightId } = await req.json().catch(() => ({}))
  if (!selectedText || typeof selectedText !== 'string') {
    return NextResponse.json({ error: 'selectedText required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: room } = await admin
    .from('study_rooms')
    .select('id, host_id, article_slug')
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
  if (member.is_observer) return NextResponse.json({ error: 'Observers cannot highlight.' }, { status: 403 })

  // Free user highlight → send to host for approval instead of broadcasting immediately
  if (requiresApproval && !withExplain) {
    await broadcast(ch.admission(code), 'highlight_request', {
      id:           highlightId ?? `hl-${Date.now()}`,
      userId:       user.id,
      displayName:  member.display_name,
      avatarColor:  member.avatar_color,
      text:         selectedText.slice(0, 400),
    })
    return NextResponse.json({ ok: true, pending: true })
  }

  let explanation: string | null = null

  if (withExplain) {
    // Use HOST's token allowance
    const DAILY_LIMITS = { free: 0, tier1: 40, tier2: 80 } as const

    const { data: hostUsage } = await admin
      .from('user_usage')
      .select('tier, explain_count, explain_period_start, last_explain_at')
      .eq('user_id', room.host_id)
      .single()

    const tier  = (hostUsage?.tier ?? 'free') as keyof typeof DAILY_LIMITS
    const limit = DAILY_LIMITS[tier] ?? 0
    const today = new Date().toISOString().split('T')[0]
    const isNewDay = !hostUsage?.explain_period_start || hostUsage.explain_period_start < today
    const count = isNewDay ? 0 : (hostUsage?.explain_count ?? 0)

    if (count >= limit) {
      return NextResponse.json({ error: "Host's daily explain limit reached." }, { status: 429 })
    }

    const clipped   = selectedText.trim().slice(0, 600)
    const maxTokens = getMaxTokens(clipped.length)
    const messages  = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `Explain this: "${clipped}"` },
    ]
    // Try providers in order: Vertex → Groq → Gemini
    interface HProvider { endpoint: string; token: string; model: string }
    const hlProviders: HProvider[] = []
    if (isVertexConfigured()) {
      try { hlProviders.push({ endpoint: getVertexEndpoint(), token: await getVertexToken(), model: VERTEX_MODEL }) } catch { /* skip */ }
    }
    if (process.env.GROQ_API_KEY)   hlProviders.push({ endpoint: 'https://api.groq.com/openai/v1/chat/completions', token: process.env.GROQ_API_KEY, model: 'llama-3.1-8b-instant' })
    if (process.env.GEMINI_API_KEY) hlProviders.push({ endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', token: process.env.GEMINI_API_KEY, model: 'gemini-2.0-flash-lite' })

    for (const p of hlProviders) {
      const res = await fetch(p.endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${p.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: p.model, messages, temperature: 0.6, max_tokens: maxTokens, stream: false }),
      }).catch(() => null)
      if (res?.ok) {
        const data = await res.json().catch(() => null)
        explanation = data?.choices?.[0]?.message?.content ?? null
        if (explanation) break
      }
    }

    if (explanation) {
      // Deduct from host's usage
      const now = new Date().toISOString()
      await admin.from('user_usage').update({
        explain_count:        count + 1,
        explain_period_start: today,
        last_explain_at:      now,
        updated_at:           now,
      }).eq('id', room.host_id)
    }
  }

  // Store highlight
  const { data: highlight } = await admin.from('room_highlights').insert({
    room_id:         room.id,
    user_id:         user.id,
    display_name:    member.display_name,
    highlight_color: member.avatar_color,
    selected_text:   selectedText.slice(0, 1000),
    explanation,
    article_slug:    room.article_slug,
  }).select().single()

  // Broadcast explain_shared to doubts channel so all members see it
  // (no DB insert — the JSON content exceeds the room_messages 500-char constraint;
  //  explain messages are ephemeral in-room events, not persisted)
  if (explanation) {
    await broadcast(ch.doubts(code), 'explain_shared', {
      selectedText,
      explanation,
      userId:      user.id,
      triggeredBy: member.display_name,
      color:       member.avatar_color,
    }, socketId)
  }

  return NextResponse.json({ highlight, explanation })
}
