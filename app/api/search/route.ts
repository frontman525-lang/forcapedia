import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateArticle } from '@/lib/ai'
import { normalizeQuery } from '@/lib/normalizeQuery'
import { getWikiArticle } from '@/lib/wikipedia'

// ── Slug helper ────────────────────────────────────────────────────
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

// ── Single slug lookup ─────────────────────────────────────────────
async function findCachedSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('articles')
    .select('slug')
    .eq('slug', slug)
    .single()
  return data?.slug ?? null
}

export async function POST(request: Request) {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // ── 2. Parse & validate input ──────────────────────────────────
  let rawQuery: string
  try {
    const body = await request.json()
    rawQuery = body?.query?.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!rawQuery || rawQuery.length < 2) {
    return NextResponse.json({ error: 'Query too short.' }, { status: 400 })
  }

  if (rawQuery.length > 500) {
    return NextResponse.json({ error: 'Query too long.' }, { status: 400 })
  }

  // ── 3. Fast path — exact slug match ───────────────────────────
  const rawSlug  = toSlug(rawQuery)
  const exactHit = await findCachedSlug(supabase, rawSlug)
  if (exactHit) {
    console.log(`[search] ✓ CACHE HIT (exact)      "${rawQuery}" → /${exactHit}  — 0 tokens`)
    return NextResponse.json({ slug: exactHit })
  }

  // ── 4. Normalize query (typo correction) ──────────────────────
  const t0 = Date.now()
  const normalizedQuery = await normalizeQuery(rawQuery)
  const normalizedSlug  = toSlug(normalizedQuery)

  if (normalizedQuery !== rawQuery) {
    console.log(`[search] ✎ NORMALIZED (${Date.now() - t0}ms)  "${rawQuery}" → "${normalizedQuery}"`)
  }

  // ── 5. Normalized slug cache check ────────────────────────────
  if (normalizedSlug !== rawSlug) {
    const normalizedHit = await findCachedSlug(supabase, normalizedSlug)
    if (normalizedHit) {
      console.log(`[search] ✓ CACHE HIT (normalized) "${rawQuery}" → /${normalizedHit}  — 0 tokens`)
      return NextResponse.json({ slug: normalizedHit })
    }
  }

  // ── 6. Token budget check ──────────────────────────────────────
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: usage } = await supabase
    .from('user_usage')
    .select('tokens_used, tier')
    .eq('user_id', user.id)
    .gte('period_start', monthStart)
    .single()

  const tier       = usage?.tier ?? 'free'
  const tokensUsed = usage?.tokens_used ?? 0
  const tokenLimit = tier === 'free' ? 40_000 : tier === 'tier1' ? 2_000_000 : 4_000_000

  console.log(`[search] 💰 TOKEN BUDGET  used: ${tokensUsed} / ${tokenLimit}  (tier: ${tier})`)

  if (tokensUsed >= tokenLimit) {
    console.log(`[search] ✗ BUDGET EXCEEDED  user: ${user.id}`)
    return NextResponse.json(
      { error: 'Monthly token limit reached. Upgrade to continue.' },
      { status: 429 },
    )
  }

  // ── 7. Wikipedia lookup (FREE — zero tokens) ──────────────────
  const topicForGeneration = normalizedQuery || rawQuery
  const finalSlug          = normalizedSlug || rawSlug

  console.log(`[search] 🌐 WIKIPEDIA LOOKUP  "${topicForGeneration}"`)
  const t1   = Date.now()
  const wiki = await getWikiArticle(topicForGeneration)

  if (wiki) {
    console.log(`[search] ✓ WIKIPEDIA FOUND  "${wiki.title}"  (${Date.now() - t1}ms)  revid: ${wiki.revid}`)
  } else {
    console.log(`[search] ✗ WIKIPEDIA MISS   "${topicForGeneration}"  (${Date.now() - t1}ms) — using pure AI`)
  }

  // ── 8. Generate article (grounded on Wikipedia if found) ──────
  console.log(`[search] ⏳ GENERATING  "${topicForGeneration}"  mode: ${wiki ? 'wiki-grounded' : 'pure-ai'}`)

  const t2 = Date.now()
  let article
  try {
    article = await generateArticle(topicForGeneration, wiki?.extract)
    console.log(`[search] ✓ GENERATED  "${article.title}"  in ${Date.now() - t2}ms`)
  } catch (err) {
    console.error(`[search] ✗ GENERATION FAILED  "${topicForGeneration}"  ${Date.now() - t2}ms`, err)
    return NextResponse.json(
      { error: 'Failed to generate article. Please try again.' },
      { status: 500 },
    )
  }

  // ── 9. Save to Supabase (with Wikipedia metadata if available) ─
  const { error: insertError } = await supabase.from('articles').insert({
    slug:             finalSlug,
    title:            article.title,
    summary:          article.summary,
    content:          article.content,
    category:         article.category,
    tags:             article.tags,
    sources:          article.sources,
    verified_at:      new Date().toISOString(),
    created_by:       user.id,
    wiki_revid:       wiki?.revid ?? null,
    wiki_url:         wiki?.url   ?? null,
    wiki_checked_at:  wiki ? new Date().toISOString() : null,
  })

  if (insertError) {
    console.error('[search] ✗ SUPABASE INSERT ERROR:', insertError.message)
    if (insertError.code === '23505') {
      return NextResponse.json({ slug: finalSlug })
    }
    return NextResponse.json({ error: 'Failed to save article.' }, { status: 500 })
  }

  const wikiTag = wiki ? `  wiki: ${wiki.url}` : '  wiki: none (pure-ai)'
  console.log(`[search] ✓ SAVED  /${finalSlug}${wikiTag}`)

  // ── 10. Update token usage ─────────────────────────────────────
  // Wiki-grounded = AI just reformats → fewer tokens. Pure-AI = more.
  const tokensCharged = wiki ? 800 : 1500

  await supabase.rpc('increment_token_usage', {
    p_user_id:      user.id,
    p_tokens:       tokensCharged,
    p_period_start: monthStart,
  })

  console.log(`[search] ✓ DONE  /${finalSlug}  tokens charged: ${tokensCharged}  new total: ~${tokensUsed + tokensCharged}`)

  return NextResponse.json({ slug: finalSlug })
}
