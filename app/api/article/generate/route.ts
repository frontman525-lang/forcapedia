// POST /api/article/generate
// Streams article generation via Server-Sent Events.
// Called by ArticleGenerator client component when a new article is needed.
//
// Request body: { topic: string, slug: string }
//
// SSE event types:
//   { type: 'meta',  title, summary, category, tags, sources, content_date }
//   { type: 'chunk', html: string }
//   { type: 'done',  slug: string }
//   { type: 'error', message: string }
import { createClient }        from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { getEffectiveTier }    from '@/lib/getEffectiveTier'
import { streamArticle }       from '@/lib/ai'
import { getWikiArticle }      from '@/lib/wikipedia'
import { pingGoogleIndexing }  from '@/lib/google-indexing'
import type { StreamCallbacks } from '@/lib/ai'

// ── Per-user in-flight lock + cooldown ──────────────────────────────────────
// Prevents concurrent generation and enforces 3s between requests.
const generatingUsers = new Set<string>()                     // in-flight
const lastGeneratedAt = new Map<string, number>()             // userId → timestamp
const GENERATION_COOLDOWN_MS = 3_000

// ── Slug helper (mirrors app/api/search/route.ts) ───────────────
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export async function POST(req: Request) {
  // ── 1. Auth (user client — reads cookies) ────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // ── 2. In-flight lock + 3s cooldown ─────────────────────────
  if (generatingUsers.has(user.id)) {
    return Response.json(
      { error: 'Already generating an article. Please wait for it to finish.' },
      { status: 429 },
    )
  }
  const lastAt = lastGeneratedAt.get(user.id) ?? 0
  const elapsed = Date.now() - lastAt
  if (elapsed < GENERATION_COOLDOWN_MS) {
    const secsLeft = Math.ceil((GENERATION_COOLDOWN_MS - elapsed) / 1000)
    return Response.json(
      { error: `Wait ${secsLeft}s before generating another article.` },
      { status: 429 },
    )
  }

  // ── 3. Parse body ───────────────────────────────────────────
  let topic: string, slug: string
  try {
    const body = await req.json()
    topic = String(body.topic ?? '').trim()
    slug  = String(body.slug  ?? '').trim()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!topic || topic.length < 1) {
    return Response.json({ error: 'Topic too short.' }, { status: 400 })
  }
  if (!slug) slug = toSlug(topic)

  // ── 3. Token budget check ────────────────────────────────────
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const admin = createAdminClient()   // bypass RLS for all DB writes below

  // Read tier authoritatively (subscriptions table, not stale user_usage.tier)
  const [tier, usageRow] = await Promise.all([
    getEffectiveTier(user.id, admin),
    supabase
      .from('user_usage')
      .select('tokens_used')
      .eq('user_id', user.id)
      .gte('period_start', monthStart)
      .single(),
  ])

  const tokensUsed = usageRow.data?.tokens_used ?? 0
  const tokenLimit = tier === 'free' ? 50_000 : tier === 'tier1' ? 2_000_000 : 4_000_000

  if (tokensUsed >= tokenLimit) {
    return Response.json(
      { error: 'Monthly token limit reached. Upgrade to continue.' },
      { status: 429 },
    )
  }

  // ── 4. Race condition guard — article already exists? ────────
  const { data: existing } = await admin
    .from('articles')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    const enc = new TextEncoder()
    return new Response(
      enc.encode(`data: ${JSON.stringify({ type: 'done', slug })}\n\n`),
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
    )
  }

  // ── 5. Wikipedia lookup (free, no tokens) ────────────────────
  const wiki = await getWikiArticle(topic).catch(() => null)
  console.log(wiki
    ? `[generate] ✓ wiki  "${wiki.title}"  revid:${wiki.revid}`
    : `[generate] ✗ wiki miss "${topic}" — pure-ai`)

  // ── 6. Build SSE stream ──────────────────────────────────────
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer  = writable.getWriter()

  const send = (event: object) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => { /* client disconnected */ })
  }

  // Generation runs in the background while the readable stream is consumed
  generatingUsers.add(user.id)
  ;(async () => {
    const t0 = Date.now()
    let article: Awaited<ReturnType<typeof streamArticle>> | null = null

    // ── a. Stream generation ─────────────────────────────────
    try {
      const callbacks: StreamCallbacks = {
        onMeta:  (meta) => send({ type: 'meta', ...meta }),
        onChunk: (html) => send({ type: 'chunk', html }),
      }
      article = await streamArticle(topic, wiki?.extract, callbacks, req.signal)
      console.log(`[generate] ✓ streamed "${article.title}" — ${Date.now() - t0}ms`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[generate] ✗ stream failed "${topic}" — ${Date.now() - t0}ms: ${msg}`)
      send({ type: 'error', message: 'Article generation failed. Please try again.' })
      generatingUsers.delete(user.id)
      lastGeneratedAt.set(user.id, Date.now())
      writer.close().catch(() => {})
      return
    }

    // ── b. Save to DB (admin client — no RLS issues) ─────────
    const { error: insertErr } = await admin.from('articles').insert({
      slug,
      title:           article.title,
      summary:         article.summary,
      content:         article.content,
      category:        article.category,
      tags:            article.tags,
      sources:         article.sources,
      event_date:      article.content_date || null,
      verified_at:     new Date().toISOString(),
      created_by:      user.id,
      wiki_revid:      wiki?.revid ?? null,
      wiki_url:        wiki?.url   ?? null,
      wiki_checked_at: wiki ? new Date().toISOString() : null,
    })

    if (insertErr && insertErr.code !== '23505') {
      console.error('[generate] ✗ insert error:', insertErr.message, insertErr.code)
      send({ type: 'error', message: 'Failed to save article. Please try again.' })
      generatingUsers.delete(user.id)
      lastGeneratedAt.set(user.id, Date.now())
      writer.close().catch(() => {})
      return
    }

    if (insertErr?.code === '23505') {
      console.log('[generate] duplicate slug — article already saved by concurrent request')
    } else {
      console.log(`[generate] ✓ saved /${slug}`)
      // IndexNow: notify Bing, DuckDuckGo, Yandex instantly — fire-and-forget
      void fetch('https://api.indexnow.org/indexnow', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host:    new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com').hostname,
          key:     process.env.INDEXNOW_API_KEY,
          keyLocation: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'}/${process.env.INDEXNOW_API_KEY}.txt`,
          urlList: [`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'}/article/${slug}`],
        }),
      }).catch(() => {}) // never block the stream — silently ignore network failures

      // Google Indexing API: notify Google for faster crawling — fire-and-forget
      void pingGoogleIndexing(
        `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'}/article/${slug}`
      )
    }

    // ── c. Charge tokens (non-blocking — never fail the done event) ──
    try {
      const tokensCharged = wiki ? 800 : 1_500
      await supabase.rpc('increment_token_usage', {
        p_user_id:      user.id,
        p_tokens:       tokensCharged,
        p_period_start: monthStart,
      })
    } catch (err) {
      console.error('[generate] ✗ token charge failed (non-fatal):', err)
    }

    // ── d. Signal completion to client ───────────────────────
    generatingUsers.delete(user.id)
    lastGeneratedAt.set(user.id, Date.now())
    send({ type: 'done', slug })
    writer.close().catch(() => {})
  })()

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
