// POST /api/rooms/[code]/highlight
// Member highlights text and optionally triggers shared AI explain.
// The explain uses the HOST's token allowance.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props { params: Promise<{ code: string }> }

const SYSTEM_PROMPT = `You are a clear, thoughtful writer explaining a concept to a smart teenager.
Rules:
- Use plain language. No jargon. Short sentences.
- Include exactly ONE powerful analogy (introduce it with "Think of it like..." or "Imagine...").
- Include exactly ONE real-world example (introduce it with "For example..." or "In practice...").
- Write in flowing paragraphs. HARD CAP: maximum 300 words. Never exceed this.
- Plain text only — no markdown, no HTML, no bullet points, no headers.`

export async function POST(req: Request, { params }: Props) {
  const { code } = await params
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { selectedText, withExplain = false } = await req.json().catch(() => ({}))
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

    const apiKey = process.env.GROQ_API_KEY
    if (apiKey) {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Explain this: "${selectedText.trim().slice(0, 600)}"` },
          ],
          temperature: 0.6,
          max_tokens: 500,
          stream: false,
        }),
      }).catch(() => null)

      if (groqRes?.ok) {
        const groqData = await groqRes.json().catch(() => null)
        explanation = groqData?.choices?.[0]?.message?.content ?? null

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

  // Also post as a room message so everyone sees it in chat
  if (explanation) {
    await admin.from('room_messages').insert({
      room_id:      room.id,
      user_id:      user.id,
      display_name: member.display_name,
      avatar_color: member.avatar_color,
      content:      JSON.stringify({ selectedText: selectedText.slice(0, 300), explanation }),
      kind:         'explain',
    })
  }

  return NextResponse.json({ highlight, explanation })
}
