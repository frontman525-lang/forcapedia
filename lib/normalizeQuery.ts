// ══════════════════════════════════════════════════════════════
//  lib/normalizeQuery.ts
//  Converts any raw search input into a canonical encyclopedia
//  topic name before slug lookup and article generation.
//
//  Provider chain (cheapest first):
//    Stage 1 → Strip fillers locally        FREE  — instant
//    Stage 2 → Wikipedia opensearch         FREE  — ~150ms, handles typos natively
//    Stage 3 → Groq (llama-3.1-8b-instant)  cheap — only when Wikipedia draws blank
//    Stage 4 → Gemini (flash-lite)          cheap — AI fallback
//    Stage 5 → raw query                    FREE  — NEVER blocks search
//
//  ~80% of queries resolved by stages 1-2 at $0.
//  AI only fires for truly unknown/niche topics.
//  SERVER-SIDE ONLY.
// ══════════════════════════════════════════════════════════════

const WIKI_API   = 'https://en.wikipedia.org/w/api.php'
const USER_AGENT = 'Forcapedia/1.0 (educational)'

// ── Stage 1: local filler-word stripping ─────────────────────────
// Handles: "what is quantum computing", "tell me about DNA", "the roman empire"
const FILLER_PATTERNS = [
  /^(what\s+is|what\s+are|what\s+was|what\s+were)\s+/i,
  /^(who\s+is|who\s+was|who\s+are|who\s+were)\s+/i,
  /^(how\s+(does|do|did|to))\s+/i,
  /^(tell\s+me\s+(about|regarding))\s+/i,
  /^(explain|define|describe|show\s+me)\s+/i,
  /^(information\s+(about|on))\s+/i,
  /^(facts\s+about)\s+/i,
  /^\b(the|a|an)\b\s+/i,
]

function stripFillers(raw: string): string {
  let s = raw.trim()
  // Apply each pattern once — loop to catch stacked patterns like "what is the ..."
  let prev = ''
  while (prev !== s) {
    prev = s
    for (const pat of FILLER_PATTERNS) {
      s = s.replace(pat, '').trim()
    }
  }
  return s || raw  // never return empty
}

// ── Stage 2: Wikipedia opensearch (free, typo-tolerant) ──────────
// Wikipedia's own search engine handles misspellings natively.
// "qunatuuum computning" → "Quantum computing" (returns canonical title)
async function wikiSearch(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action:    'opensearch',
    search:    query,
    limit:     '1',
    format:    'json',
    redirects: 'resolve',    // follow redirects → gets canonical title
  })

  try {
    const res = await fetch(`${WIKI_API}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal:  AbortSignal.timeout(3_000),  // fast — 3s max
    })

    if (!res.ok) return null

    // Response shape: [query, [titles], [descriptions], [urls]]
    const data = await res.json() as [string, string[], string[], string[]]
    const title = data[1]?.[0]

    if (!title) return null

    // Safety: reject if the returned title is too different (Wikipedia returned
    // something unrelated). Simple heuristic: at least one word must overlap.
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2))
    const titleWords = title.toLowerCase().split(/\s+/)
    const hasOverlap = titleWords.some(w => queryWords.has(w))

    // For very short queries (1 word) overlap check is too strict — skip it
    if (query.split(' ').length > 1 && !hasOverlap) return null

    return title
  } catch {
    return null
  }
}

// ── Stage 3+4: AI normalization (only for Wikipedia misses) ──────
const NORMALIZE_PROMPT = `You are a search query normalizer for Forcapedia, an encyclopedia.
Convert any user input into a clean, canonical encyclopedia topic title.

Rules:
- Fix ALL spelling mistakes and typos
- Remove filler words: the, a, an, about, what is, how does, tell me about, explain, etc.
- Expand common abbreviations: AI → Artificial Intelligence, WW2 → World War II, DNA → Deoxyribonucleic Acid, US → United States, UK → United Kingdom
- Use proper Title Case
- Return ONLY the topic name — no punctuation at end, no explanation, nothing else
- Maximum 6 words

Examples (input → output):
qunatuuum computning → Quantum Computing
the quantum computing → Quantum Computing
what is ai → Artificial Intelligence
WW2 → World War II
blak hols in space → Black Holes
how does dna work → DNA
rome history ancient → Ancient Rome
elon musk car company → Tesla
qundom computing → Quantum Computing
filosophy of mind → Philosophy of Mind
steem cells → Stem Cells`

const DANGEROUS_PATTERN = /[<>{}\[\]`\\;]|javascript:|data:|on\w+=/i

interface NormalizeProvider {
  name:      string
  apiKey:    string | undefined
  endpoint:  string
  model:     string
  timeoutMs: number
}

const AI_PROVIDERS: NormalizeProvider[] = [
  {
    name:      'Groq',
    apiKey:    process.env.GROQ_API_KEY,
    endpoint:  'https://api.groq.com/openai/v1/chat/completions',
    model:     'llama-3.1-8b-instant',
    timeoutMs: 4_000,
  },
  {
    name:      'Gemini',
    apiKey:    process.env.GEMINI_API_KEY,
    endpoint:  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model:     'gemini-2.0-flash-lite',
    timeoutMs: 5_000,
  },
]

function isSafeResult(result: string): boolean {
  if (!result)                          return false
  if (result.length > 100)              return false
  if (result.split('\n').length > 2)    return false
  if (DANGEROUS_PATTERN.test(result))   return false
  if (/^(i |the answer|sorry|note:|based on)/i.test(result)) return false
  return true
}

async function callAiProvider(provider: NormalizeProvider, raw: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs)

  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model:       provider.model,
        messages: [
          { role: 'system', content: NORMALIZE_PROMPT },
          { role: 'user',   content: raw },
        ],
        max_tokens:  30,
        temperature: 0,
      }),
      signal: controller.signal,
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data   = await response.json()
    const result = (data?.choices?.[0]?.message?.content ?? '').trim()

    if (!isSafeResult(result)) throw new Error('Unsafe or malformed response')

    return result
  } finally {
    clearTimeout(timer)
  }
}

// ── Public API ────────────────────────────────────────────────────
/**
 * Normalize a raw search query to a canonical encyclopedia topic name.
 *
 * Chain: strip fillers → Wikipedia search → Groq → Gemini → raw query
 * Never throws. Always returns a usable string.
 */
export async function normalizeQuery(raw: string): Promise<string> {
  // ── Stage 1: strip filler words locally (free, instant) ─────────
  const stripped = stripFillers(raw)

  // ── Stage 2: Wikipedia opensearch (free, typo-tolerant) ──────────
  // This handles ~80% of real-world typo cases at zero cost.
  const wikiResult = await wikiSearch(stripped)
  if (wikiResult) return wikiResult

  // ── Stage 3+4: AI normalization (only for Wikipedia misses) ──────
  const configured = AI_PROVIDERS.filter(p => p.apiKey)
  if (configured.length === 0) return stripped  // no keys → use stripped

  for (const provider of configured) {
    try {
      return await callAiProvider(provider, stripped)
    } catch {
      // Silent fallthrough to next provider
    }
  }

  // ── Stage 5: ultimate fallback — stripped query, never blocks ────
  return stripped
}
