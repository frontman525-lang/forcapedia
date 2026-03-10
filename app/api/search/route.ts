import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeQuery } from '@/lib/normalizeQuery'

// ── Slug helper ─────────────────────────────────────────────────
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

// ── Single slug lookup ──────────────────────────────────────────
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
  // ── 1. Auth check ─────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // ── 2. Parse & validate input ─────────────────────────────────
  let rawQuery: string
  try {
    const body = await request.json()
    rawQuery = body?.query?.trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!rawQuery || rawQuery.length < 1) {
    return NextResponse.json({ error: 'Query too short.' }, { status: 400 })
  }

  if (rawQuery.length > 500) {
    return NextResponse.json({ error: 'Query too long.' }, { status: 400 })
  }

  // ── 3. Fast path — exact slug match ──────────────────────────
  const rawSlug  = toSlug(rawQuery)
  const exactHit = await findCachedSlug(supabase, rawSlug)
  if (exactHit) {
    console.log(`[search] ✓ CACHE HIT (exact)      "${rawQuery}" → /${exactHit}`)
    return NextResponse.json({ slug: exactHit })
  }

  // ── 4. Normalize query (typo correction) ─────────────────────
  const t0 = Date.now()
  const normalizedQuery = await normalizeQuery(rawQuery)
  const normalizedSlug  = toSlug(normalizedQuery)

  if (normalizedQuery !== rawQuery) {
    console.log(`[search] ✎ NORMALIZED (${Date.now() - t0}ms)  "${rawQuery}" → "${normalizedQuery}"`)
  }

  // ── 5. Normalized slug cache check ───────────────────────────
  if (normalizedSlug !== rawSlug) {
    const normalizedHit = await findCachedSlug(supabase, normalizedSlug)
    if (normalizedHit) {
      console.log(`[search] ✓ CACHE HIT (normalized) "${rawQuery}" → /${normalizedHit}`)
      return NextResponse.json({ slug: normalizedHit })
    }
  }

  // ── 6. Token budget check ─────────────────────────────────────
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Read tier without period filter (tier persists across billing periods)
  const { data: tierRow } = await supabase
    .from('user_usage')
    .select('tier')
    .eq('user_id', user.id)
    .order('period_start', { ascending: false })
    .limit(1)
    .single()

  // Read tokens_used for current period only
  const { data: usageRow } = await supabase
    .from('user_usage')
    .select('tokens_used')
    .eq('user_id', user.id)
    .gte('period_start', monthStart)
    .single()

  const tier       = tierRow?.tier          ?? 'free'
  const tokensUsed = usageRow?.tokens_used  ?? 0
  const tokenLimit = tier === 'free' ? 50_000 : tier === 'tier1' ? 2_000_000 : 4_000_000

  console.log(`[search] 💰 TOKEN BUDGET  used: ${tokensUsed} / ${tokenLimit}  (tier: ${tier})`)

  if (tokensUsed >= tokenLimit) {
    console.log(`[search] ✗ BUDGET EXCEEDED  user: ${user.id}`)
    return NextResponse.json(
      { error: 'Monthly token limit reached. Upgrade to continue.' },
      { status: 429 },
    )
  }

  // ── 7. Cache miss — return streaming info immediately ─────────
  // Article generation (Wikipedia lookup + AI) happens in /api/article/generate
  // which streams the result directly to the article page.
  const finalSlug  = normalizedSlug || rawSlug
  const finalTopic = normalizedQuery || rawQuery

  console.log(`[search] → STREAMING  "${finalTopic}"  slug: /${finalSlug}`)

  return NextResponse.json({ slug: finalSlug, topic: finalTopic, streaming: true })
}
