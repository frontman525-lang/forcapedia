import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DAILY_LIMITS = { free: 1, tier1: 40, tier2: 80 } as const

const SYSTEM_PROMPTS = {
  simple: `You are a clear, thoughtful writer explaining a concept to a smart teenager.
Rules:
- Use plain language. No jargon. Short sentences.
- Include exactly ONE powerful analogy (introduce it with "Think of it like..." or "Imagine...").
- Include exactly ONE real-world example (introduce it with "For example..." or "In practice...").
- Write in flowing paragraphs. HARD CAP: maximum 400 words. Never exceed this.
- Plain text only — no markdown, no HTML, no bullet points, no headers.`,
  eli10: `You are a friendly, enthusiastic teacher explaining something to a curious 10-year-old.
Rules:
- Use only words a 10-year-old knows. Keep sentences short and punchy.
- Include exactly ONE fun analogy using something familiar (video games, food, school, sports, animals).
- Include exactly ONE example they can picture in their head.
- Be warm and encouraging. HARD CAP: maximum 400 words. Never exceed this.
- Plain text only — no markdown, no HTML, no bullet points, no headers.`,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to use Explain.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const { text, mode } = body

  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return NextResponse.json({ error: 'Highlight at least a few words to explain.' }, { status: 400 })
  }
  if (mode !== 'simple' && mode !== 'eli10') {
    return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 })
  }

  // ── Rate limit check ──────────────────────────────────────────────────────
  const { data: usage } = await supabase
    .from('user_usage')
    .select('tier, explain_count, explain_period_start, last_explain_at')
    .eq('user_id', user.id)
    .single()

  const tier = ((usage?.tier) ?? 'free') as keyof typeof DAILY_LIMITS
  const limit = DAILY_LIMITS[tier] ?? 1

  const today = new Date().toISOString().split('T')[0]
  const isNewDay = !usage?.explain_period_start || usage.explain_period_start < today
  const currentCount = isNewDay ? 0 : (usage?.explain_count ?? 0)

  if (currentCount >= limit) {
    return NextResponse.json({
      error: 'Daily limit reached.',
      used: currentCount,
      limit,
      tier,
    }, { status: 429 })
  }

  // ── 10-second cooldown check ───────────────────────────────────────────────
  if (usage?.last_explain_at) {
    const elapsed = Date.now() - new Date(usage.last_explain_at).getTime()
    if (elapsed < 10_000) {
      const remaining = Math.ceil((10_000 - elapsed) / 1000)
      return NextResponse.json(
        { error: `Wait ${remaining}s before explaining again.` },
        { status: 429 },
      )
    }
  }

  // ── Call Groq (streaming) ─────────────────────────────────────────────────
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI unavailable.' }, { status: 503 })

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[mode as 'simple' | 'eli10'] },
        { role: 'user', content: `Explain this: "${text.trim()}"` },
      ],
      temperature: 0.6,
      max_tokens: 650,
      stream: true,
    }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null)

  if (!groqRes?.ok) {
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 503 })
  }

  // ── Increment usage (AI confirmed OK) ────────────────────────────────────
  const now = new Date().toISOString()
  await supabase
    .from('user_usage')
    .update({
      explain_count: currentCount + 1,
      explain_period_start: today,
      last_explain_at: now,
      updated_at: now,
    })
    .eq('user_id', user.id)

  const newCount = currentCount + 1

  // ── Pipe AI stream back to client ─────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // First event: usage info so client can display the counter
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'usage', used: newCount, limit })}\n\n`)
      )

      const reader = groqRes.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }
            try {
              const json = JSON.parse(data)
              const token = json.choices?.[0]?.delta?.content
              if (token) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'token', token })}\n\n`)
                )
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      } catch {
        // Stream ended or connection dropped
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
