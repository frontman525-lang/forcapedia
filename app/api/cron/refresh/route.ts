// ── Daily Wikipedia freshness cron ────────────────────────────────
// Called once per day by Vercel Cron (vercel.json).
// Checks 100 wiki-sourced articles for revision changes.
// Only regenerates if Wikipedia actually changed → near-zero cost.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getWikiRevid } from '@/lib/wikipedia'
import { generateArticle } from '@/lib/ai'

// ── Supabase admin client (bypasses RLS) ──────────────────────────
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

// ── Slug from string ──────────────────────────────────────────────
function toSlug(str: string): string {
  return str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

const BATCH_SIZE = 100   // articles checked per cron run
const STALE_DAYS = 30    // re-check interval

export async function GET(request: Request) {
  // ── Auth: only Vercel Cron or requests with CRON_SECRET ─────────
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const staleDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // ── Fetch articles due for a freshness check ───────────────────
  // Prioritises never-checked (null) then oldest-checked first.
  const { data: articles, error } = await supabase
    .from('articles')
    .select('slug, title, wiki_url, wiki_revid')
    .not('wiki_url', 'is', null)
    .or(`wiki_checked_at.is.null,wiki_checked_at.lt.${staleDate}`)
    .order('wiki_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('[cron/refresh] ✗ fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!articles || articles.length === 0) {
    console.log('[cron/refresh] ✓ nothing to refresh')
    return NextResponse.json({ checked: 0, regenerated: 0, unchanged: 0 })
  }

  console.log(`[cron/refresh] 🔄 Checking ${articles.length} articles for Wikipedia changes...`)

  let regenerated = 0
  let unchanged   = 0
  let failed      = 0

  for (const article of articles) {
    const now = new Date().toISOString()

    // ── Check current Wikipedia revid (FREE API call) ─────────────
    const currentRevid = await getWikiRevid(article.wiki_url)

    if (currentRevid === null) {
      // Wikipedia returned an error — skip, update checked_at to avoid retrying constantly
      await supabase.from('articles')
        .update({ wiki_checked_at: now })
        .eq('slug', article.slug)
      console.log(`[cron/refresh] ⚠ revid fetch failed  /${article.slug}`)
      continue
    }

    if (currentRevid === article.wiki_revid) {
      // No change — just update the checked timestamp
      await supabase.from('articles')
        .update({ wiki_checked_at: now })
        .eq('slug', article.slug)
      unchanged++
      console.log(`[cron/refresh] ✓ unchanged  /${article.slug}  (revid: ${currentRevid})`)
      continue
    }

    // ── Wikipedia changed — regenerate ────────────────────────────
    console.log(`[cron/refresh] ♻ revid changed  /${article.slug}  ${article.wiki_revid} → ${currentRevid}  — regenerating`)

    try {
      // Re-fetch Wikipedia content with updated revid
      const { getWikiArticle } = await import('@/lib/wikipedia')
      const wiki = await getWikiArticle(article.title)

      if (!wiki) throw new Error('Wikipedia re-fetch returned null')

      const freshArticle = await generateArticle(article.title, wiki.extract)

      await supabase.from('articles').update({
        title:           freshArticle.title,
        summary:         freshArticle.summary,
        content:         freshArticle.content,
        category:        freshArticle.category,
        tags:            freshArticle.tags,
        sources:         freshArticle.sources,
        verified_at:     now,
        wiki_revid:      wiki.revid,
        wiki_checked_at: now,
      }).eq('slug', article.slug)

      regenerated++
      console.log(`[cron/refresh] ✓ regenerated  /${article.slug}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[cron/refresh] ✗ regeneration failed  /${article.slug}:`, msg)

      // Still update checked_at so we don't retry this in tomorrow's run
      await supabase.from('articles')
        .update({ wiki_checked_at: now })
        .eq('slug', article.slug)
      failed++
    }

    // Brief pause between regenerations to respect AI rate limits
    await new Promise(r => setTimeout(r, 2000))
  }

  const summary = {
    checked:     articles.length,
    regenerated,
    unchanged,
    failed,
  }

  console.log(`[cron/refresh] ✅ Done:`, summary)
  return NextResponse.json(summary)
}
