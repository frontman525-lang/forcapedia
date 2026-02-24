// ── Google News RSS feed for a topic ──────────────────────────────
// 100% free. No API key. No rate limit for normal usage.
// Returns last 8 news items for any topic.

import { NextResponse } from 'next/server'

export interface NewsItem {
  title:       string
  url:         string
  source:      string
  publishedAt: string   // ISO string
}

// ── Parse RSS XML without a library ──────────────────────────────
function parseRssItems(xml: string): NewsItem[] {
  const items: NewsItem[] = []

  // Extract all <item> blocks
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemMatches) {
    const block = match[1]

    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      ?? block.match(/<title>(.*?)<\/title>/)?.[1]
      ?? ''

    const link = block.match(/<link>(.*?)<\/link>/)?.[1]
      ?? block.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]
      ?? ''

    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ''

    // Google News RSS wraps source in <source url="...">Name</source>
    const source = block.match(/<source[^>]*>(.*?)<\/source>/)?.[1]
      ?? new URL(link || 'https://news.google.com').hostname.replace(/^www\./, '')

    if (!title || !link) continue

    items.push({
      title:       title.trim(),
      url:         link.trim(),
      source:      source.trim(),
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    })
  }

  return items
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const topic = searchParams.get('topic')?.trim()

  if (!topic || topic.length < 2) {
    return NextResponse.json({ error: 'topic param required' }, { status: 400 })
  }

  if (topic.length > 200) {
    return NextResponse.json({ error: 'topic too long' }, { status: 400 })
  }

  const encodedTopic = encodeURIComponent(topic)
  const rssUrl = `https://news.google.com/rss/search?q=${encodedTopic}&hl=en-US&gl=US&ceid=US:en`

  try {
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Forcapedia/1.0 (news aggregator; educational)' },
      signal:  AbortSignal.timeout(6_000),
      next:    { revalidate: 1800 },   // Next.js: cache 30 minutes
    })

    if (!res.ok) {
      throw new Error(`Google News RSS returned HTTP ${res.status}`)
    }

    const xml   = await res.text()
    const items = parseRssItems(xml).slice(0, 8)   // max 8 news items

    return NextResponse.json(
      { items },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[news] ✗ RSS fetch failed for "${topic}":`, msg)
    // Return empty — never fail the page over news
    return NextResponse.json({ items: [] })
  }
}
