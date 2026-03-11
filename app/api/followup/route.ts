import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveTier } from '@/lib/getEffectiveTier'
import { getWikiArticle } from '@/lib/wikipedia'

// ── Provider chain: Groq (cheapest) → Gemini → DeepSeek ──────────
const PROVIDERS = [
  {
    name:     'groq',
    envKey:   'GROQ_API_KEY',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model:    'llama-3.1-8b-instant',
    timeout:  20_000,
  },
  {
    name:     'gemini',
    envKey:   'GEMINI_API_KEY',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model:    'gemini-2.0-flash-lite',
    timeout:  20_000,
  },
  {
    name:     'deepseek',
    envKey:   'DEEPSEEK_API_KEY',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model:    'deepseek-chat',
    timeout:  25_000,
  },
]

async function askProvider(
  provider: (typeof PROVIDERS)[number],
  systemPrompt: string,
  question: string,
): Promise<string> {
  const apiKey = process.env[provider.envKey]
  if (!apiKey) throw new Error(`${provider.name}: key not configured`)

  const res = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: question },
      ],
      max_tokens:  600,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(provider.timeout),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data   = await res.json()
  const answer = data?.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new Error('Empty response')
  return answer
}

export async function POST(request: Request) {
  // ── 1. Auth ────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // ── 2. Parse & validate ────────────────────────────────────────
  let question: string, articleSlug: string
  try {
    const body = await request.json()
    question    = body?.question?.trim()
    articleSlug = body?.articleSlug?.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!question || question.length < 3) {
    return NextResponse.json({ error: 'Question too short.' }, { status: 400 })
  }

  if (question.length > 500) {
    return NextResponse.json({ error: 'Question too long.' }, { status: 400 })
  }

  // ── 3. Tier + rate limit (parallel DB calls) ───────────────────
  const admin = createAdminClient()
  const [existingRes, tier] = await Promise.all([
    supabase
      .from('follow_ups')
      .select('id')
      .eq('user_id', user.id)
      .eq('article_slug', articleSlug)
      .limit(1)
      .single(),
    getEffectiveTier(user.id, admin),
  ])

  if (tier === 'free' && existingRes.data) {
    return NextResponse.json(
      { error: 'Free plan allows 1 follow-up per article. Upgrade for unlimited.' },
      { status: 429 },
    )
  }

  // ── 4. Fetch article + Wikipedia context in parallel ───────────
  const { data: article } = await supabase
    .from('articles')
    .select('title, summary, wiki_url')
    .eq('slug', articleSlug)
    .single()

  // Wikipedia fetch (FREE) — gives AI real facts to answer from
  let wikiContext = ''
  if (article?.wiki_url) {
    const wiki = await getWikiArticle(article.title)
    if (wiki?.extract) {
      wikiContext = wiki.extract.slice(0, 3_000)   // ~750 tokens, enough context
    }
  }

  // ── 5. Build system prompt with Wikipedia context ──────────────
  const systemPrompt = [
    `You are Forcapedia's verified knowledge assistant.`,
    `Answer follow-up questions about the article titled "${article?.title ?? articleSlug}" factually and concisely.`,
    `Keep answers under 200 words. Be direct. Never hallucinate.`,
    `If the question goes beyond available knowledge, say so plainly.`,
    article?.summary ? `\nArticle summary: ${article.summary}` : '',
    wikiContext
      ? `\n\nWikipedia source (use as your factual basis — do not contradict it):\n${wikiContext}`
      : '',
  ].filter(Boolean).join('\n')

  // ── 6. Ask AI — Groq → Gemini → DeepSeek ──────────────────────
  const configured = PROVIDERS.filter(p => process.env[p.envKey])

  if (configured.length === 0) {
    return NextResponse.json({ error: 'AI service not configured.' }, { status: 500 })
  }

  let answer = ''
  for (const provider of configured) {
    try {
      answer = await askProvider(provider, systemPrompt, question)
      console.log(`[followup] ✓ ${provider.name}  /${articleSlug}  wiki: ${!!wikiContext}`)
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[followup] ✗ ${provider.name} failed: ${msg}`)
    }
  }

  if (!answer) {
    return NextResponse.json({ error: 'AI service error. Please try again.' }, { status: 500 })
  }

  // ── 7. Record usage + charge tokens ──────────────────────────
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  await Promise.all([
    supabase.from('follow_ups').insert({
      user_id:      user.id,
      article_slug: articleSlug,
      question,
      answer,
    }),
    // Charge 200 tokens per follow-up (short AI call)
    supabase.rpc('increment_token_usage', {
      p_user_id:      user.id,
      p_tokens:       200,
      p_period_start: monthStart,
    }),
  ])

  return NextResponse.json({ answer })
}
