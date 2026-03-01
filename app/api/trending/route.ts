import { NextResponse } from 'next/server'

// ── Hard skip: Wikipedia system pages ────────────────────────────────────────
const SYSTEM = /^(Main_Page|Special:|Wikipedia:|Help:|Portal:|Talk:|File:|Category:|Template:|Draft:|MediaWiki:)/i

// ── Content skip: everything that isn't encyclopedic/educational ──────────────
// Designed to be aggressive — better to show fewer than to show garbage.
const JUNK = new RegExp([
  // Temporal / year-specific
  'Deaths_in_', '^\\d{4}_in_', '^\\d{4}$', '_in_\\d{4}$', '_\\d{4}_',
  // Lists
  '^List_of_',
  // Disambiguation by parenthetical (specific entertainment works)
  '\\(season_?\\d', '\\(TV_series\\)', '\\(film\\)', '\\(album\\)',
  '\\(song\\)', '\\(band\\)', '\\(singer\\)', '\\(rapper\\)', '\\(actor\\)',
  '\\(TV_show\\)', '\\(miniseries\\)', '\\(video_game\\)',
  // Adult / explicit
  'sex|porn|erotic|nude|naked|xxx|onlyfans|playboy|adult_film|sexual',
  // Reality TV / talent shows
  'Bigg_Boss|Big_Brother|Kaun_Banega|The_Voice|American_Idol|Dancing_with_the_Stars',
  // Cricket and IPL (heavy Indian Wikipedia traffic driver)
  '_vs_|_v\\._|\\bIPL\\b|\\bBCCI\\b|Indian_Premier_League|Test_match',
  // Specific sports seasons / tournaments (not the sport itself)
  '\\d{4}_season|\\d{4}[-_]\\d{2,4}_season|\\d{4}_World_Cup|\\d{4}_Championship',
  '\\d{4}_Grand_Prix|\\d{4}_FIFA|\\d{4}_UEFA|\\d{4}_Super_Bowl',
  // Hyper-local / national politics that aren't globally notable
  'Lok_Sabha|Rajya_Sabha|Vidhan_Sabha|BJP|Congress_party|AAP_\\(party\\)',
  '^President_of_India$|^Prime_Minister_of_India$',
  // Social-media / streaming platforms (not educational)
  '^YouTube$|^Instagram$|^Facebook$|^TikTok$|^Netflix$|^Amazon_Prime',
  // Very generic country/city overview pages that show up due to traffic volume
  '^India$|^Pakistan$|^Bangladesh$|^China$|^United_States$|^United_Kingdom$',
  '^Russia$|^Australia$|^Canada$|^Germany$|^France$|^Brazil$|^Mexico$',
  // Gossip / tabloid indicators
  'controversy|scandal|criminal_case|rape|murder|arrest',
].join('|'), 'i')

// ── Module-level cache (1 hour TTL) ──────────────────────────────────────────
let _cache: { topics: string[]; ts: number } | null = null
const TTL = 60 * 60 * 1000

export async function GET() {
  if (_cache && Date.now() - _cache.ts < TTL) {
    return NextResponse.json({ topics: _cache.topics })
  }

  try {
    // Yesterday — today's data is often still incomplete
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const y   = d.getFullYear()
    const m   = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')

    const res = await fetch(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${day}`,
      { headers: { 'User-Agent': 'Forcapedia/1.0' }, signal: AbortSignal.timeout(6000) },
    )
    if (!res.ok) throw new Error(`Wikimedia ${res.status}`)

    const data  = await res.json()
    const raw: Array<{ article: string }> = data?.items?.[0]?.articles ?? []

    const topics = raw
      .map(a => a.article)
      // Apply both filters
      .filter(a => !SYSTEM.test(a) && !JUNK.test(a))
      // Convert underscores to spaces
      .map(a => a.replace(/_/g, ' '))
      // Keep only reasonably-lengthed, meaningful titles
      .filter(t => t.length >= 4 && t.length <= 55)
      // Exactly 5 — no more, no less
      .slice(0, 5)

    _cache = { topics, ts: Date.now() }
    return NextResponse.json({ topics })
  } catch {
    // Serve stale cache if available, otherwise empty
    return NextResponse.json({ topics: _cache?.topics ?? [] })
  }
}
