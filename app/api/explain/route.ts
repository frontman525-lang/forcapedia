import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveTier } from '@/lib/getEffectiveTier'
import { getVertexToken, getVertexEndpoint, isVertexConfigured, VERTEX_MODEL } from '@/lib/vertexai'

const DAILY_LIMITS = { free: 1, tier1: 40, tier2: 80 } as const

const SYSTEM_PROMPTS = {
  simple: `Explain this in plain language. The person didn't understand it. Give the clearest explanation that makes it click — often one sentence is enough, never more than three. You can use up to 400 characters if needed, but be as concise as possible. Plain text only — no markdown, no bullet points, no headers.`,
  eli10: `Explain this to a curious 10-year-old. Use simple words and, if it helps, one quick analogy. Give the clearest explanation that makes it click — often one sentence is enough, never more than three. You can use up to 400 characters if needed, but be as concise as possible. Plain text only — no markdown, no bullet points, no headers.`,
}

function getMaxTokens(textLen: number): number {
  if (textLen <=  50) return 160   // single word/phrase — one or two clear sentences
  if (textLen <= 150) return 200   // a sentence — one to two sentences
  return 250                       // longer — up to three sentences max
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
  const admin = createAdminClient()
  const [effectiveTier, usageRes] = await Promise.all([
    getEffectiveTier(user.id, admin),
    supabase.from('user_usage').select('explain_count, explain_period_start').eq('user_id', user.id).single(),
  ])
  const usage = usageRes.data
  const tier = (effectiveTier as keyof typeof DAILY_LIMITS) in DAILY_LIMITS
    ? (effectiveTier as keyof typeof DAILY_LIMITS)
    : 'free'
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

  // ── Try providers in order: Vertex → Groq → Gemini (streaming) ──────────
  interface ExplainProvider { name: string; token: string; endpoint: string; model: string }
  const explainProviders: ExplainProvider[] = []

  if (isVertexConfigured()) {
    try {
      explainProviders.push({ name: 'vertex', token: await getVertexToken(), endpoint: getVertexEndpoint(), model: VERTEX_MODEL })
    } catch { /* misconfigured — skip */ }
  }
  if (process.env.GROQ_API_KEY) {
    explainProviders.push({ name: 'groq', token: process.env.GROQ_API_KEY, endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-8b-instant' })
  }
  if (process.env.GEMINI_API_KEY) {
    explainProviders.push({ name: 'gemini', token: process.env.GEMINI_API_KEY, endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.0-flash-lite' })
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS[mode as 'simple' | 'eli10'] },
    { role: 'user', content: `Explain this: "${text.trim()}"` },
  ]
  const maxTok = getMaxTokens(text.trim().length)

  let aiRes: Response | null = null
  for (const p of explainProviders) {
    const r = await fetch(p.endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${p.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: p.model, messages, temperature: 0.6, max_tokens: maxTok, stream: true }),
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null)
    if (r?.ok) { aiRes = r; break }
  }

  if (!aiRes) {
    return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 503 })
  }

  // ── Increment usage (AI confirmed OK) ────────────────────────────────────
  const now = new Date().toISOString()
  await supabase
    .from('user_usage')
    .update({
      explain_count: currentCount + 1,
      explain_period_start: today,
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

      const reader = aiRes!.body!.getReader()
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
        try { controller.close() } catch { /* already closed on [DONE] */ }
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
