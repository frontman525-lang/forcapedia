// ── Wikipedia API client ──────────────────────────────────────────
// All endpoints are free with no API key required.
// Rate limit: 200 req/s (anonymous). We never come close to that.

const WIKI_REST  = 'https://en.wikipedia.org/api/rest_v1'
const WIKI_API   = 'https://en.wikipedia.org/w/api.php'
const USER_AGENT = 'Forcapedia/1.0 (educational; contact@forcapedia.com)'

export interface WikiArticle {
  title:   string   // canonical Wikipedia title
  extract: string   // full plain-text content (up to ~8 000 tokens)
  revid:   number   // revision ID — changes whenever the article is edited
  url:     string   // canonical Wikipedia URL
}

// ── 1. Search Wikipedia for a topic ───────────────────────────────
// Returns the best-matching Wikipedia title or null if not found.
async function searchWiki(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action:   'opensearch',
    search:   query,
    limit:    '1',
    format:   'json',
    redirects:'resolve',
  })

  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal:  AbortSignal.timeout(5_000),
  })

  if (!res.ok) return null

  const data = await res.json() as [string, string[], string[], string[]]
  return data[1]?.[0] ?? null
}

// ── 2. Fetch full plain-text content + revid for a title ──────────
async function fetchWikiContent(title: string): Promise<WikiArticle | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))

  // Get revid + canonical url from REST summary (fast, ~200ms)
  const summaryRes = await fetch(`${WIKI_REST}/page/summary/${encoded}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal:  AbortSignal.timeout(5_000),
  })

  if (!summaryRes.ok) return null
  const summary = await summaryRes.json()
  const revid: number = summary.revision ?? summary.revid ?? 0
  const url: string   = summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`

  // Get full plain-text extract via MediaWiki API
  const params = new URLSearchParams({
    action:          'query',
    prop:            'extracts',
    explaintext:     'true',
    exsectionformat: 'plain',
    titles:          title,
    format:          'json',
  })

  const contentRes = await fetch(`${WIKI_API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal:  AbortSignal.timeout(8_000),
  })

  if (!contentRes.ok) return null
  const contentData = await contentRes.json()
  const pages       = contentData?.query?.pages ?? {}
  const page        = Object.values(pages)[0] as { extract?: string } | undefined
  const extract     = page?.extract?.trim() ?? ''

  if (!extract || extract.length < 100) return null

  // Trim to ~6 000 chars to keep AI input tokens reasonable
  const trimmed = extract.length > 6_000
    ? extract.slice(0, 6_000) + '\n\n[Content trimmed — see full article on Wikipedia]'
    : extract

  return { title: summary.title ?? title, extract: trimmed, revid, url }
}

// ── Public: fetch Wikipedia article for a topic ───────────────────
// Returns null if no article found. Never throws.
export async function getWikiArticle(topic: string): Promise<WikiArticle | null> {
  try {
    const wikiTitle = await searchWiki(topic)
    if (!wikiTitle) return null
    return await fetchWikiContent(wikiTitle)
  } catch {
    return null
  }
}

// ── Public: check current revid for a stored wiki_url ─────────────
// Used by the daily cron. Returns null on any error (safe to skip).
export async function getWikiRevid(wikiUrl: string): Promise<number | null> {
  try {
    // Extract title from URL: https://en.wikipedia.org/wiki/Quantum_computing → Quantum_computing
    const match = wikiUrl.match(/\/wiki\/(.+)$/)
    if (!match) return null
    const encoded = match[1]

    const res = await fetch(`${WIKI_REST}/page/summary/${encoded}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal:  AbortSignal.timeout(5_000),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.revision ?? data.revid ?? null
  } catch {
    return null
  }
}
