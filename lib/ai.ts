// ══════════════════════════════════════════════════════════════
//  lib/ai.ts — Unified AI Service
//
//  Two entry points:
//
//  generateArticle(topic, wiki?) — non-streaming, returns complete article.
//    Used as DeepSeek last resort inside streamArticle.
//
//  streamArticle(topic, wiki?, callbacks, signal?) — streaming with sequential
//    fallback. Provider chain:
//      Stage 1: Vertex AI → Groq → Gemini (each tried in order; next only on failure).
//      Stage 2: DeepSeek non-streaming fallback if all Stage 1 fail.
//    Emits: onMeta → onChunk × N → returns GeneratedArticle.
//
//  Dynamic length: AI auto-classifies topic into SIMPLE / MEDIUM / COMPLEX /
//  BIOGRAPHICAL / SCIENTIFIC and targets the right word count.
//
//  Output format: custom text (TITLE: / SUMMARY: / … / ---\n<html>)
//  so HTML content streams without JSON-encoding overhead.
//
//  SERVER-SIDE ONLY. Never import in client components.
// ══════════════════════════════════════════════════════════════

import { getVertexToken, getVertexEndpoint, isVertexConfigured, VERTEX_MODEL } from './vertexai'

export interface GeneratedArticle {
  title: string
  summary: string
  content: string      // HTML: h2, h3, p, ul, li, strong, code only
  category: string
  tags: string[]
  sources: string[]
  content_date?: string
}

// ─── Tuning constants ──────────────────────────────────────────
// Abort a provider if no first chunk within this long.
const FIRST_CHUNK_MS = 10_000
// Start backup provider if primary hasn't committed (sent onMeta) within this long.
// Vertex normally commits in 4–6 s; 8 s hedge gives it room while protecting UX.
const HEDGE_AFTER_MS = 8_000
// Cap Wikipedia grounding text.
const WIKI_MAX_CHARS = 2_500

// ─── Provider registry ─────────────────────────────────────────
interface ProviderConfig {
  name: string
  apiKeyEnv: string                          // primary env var; used for isConfigured check
  getToken?: () => Promise<string>           // if set, use instead of process.env[apiKeyEnv]
  endpoint: string | (() => string)          // string or dynamic function
  model: string
  timeoutMs: number
  jsonMode: boolean
  maxTokens?: number                         // override default 10_000 (e.g. Vertex caps at 8192)
}

function isProviderReady(p: ProviderConfig): boolean {
  if (p.name === 'vertex') return isVertexConfigured()
  return !!process.env[p.apiKeyEnv]
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'vertex',
    apiKeyEnv: 'VERTEX_PROJECT_ID',
    getToken: getVertexToken,
    endpoint: getVertexEndpoint,
    model: VERTEX_MODEL,
    timeoutMs: 45_000,
    jsonMode: false,
    maxTokens: 8_000,   // gemini-2.0-flash-001 supports max 8192
  },
  {
    name: 'groq',
    apiKeyEnv: 'GROQ_API_KEY',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    timeoutMs: 45_000,
    jsonMode: true,
  },
  {
    name: 'gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-1.5-flash',
    timeoutMs: 30_000,
    jsonMode: false,
  },
  {
    name: 'deepseek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    timeoutMs: 90_000,
    jsonMode: true,
  },
]

// ─── Dynamic system prompt (streaming mode, custom text format) ─
//
// The AI classifies the topic and targets the right depth automatically.
// Output is plain text (not JSON) so HTML streams without encoding overhead.
// ──────────────────────────────────────────────────────────────────
const STREAM_SYSTEM_PROMPT = `You are Forcapedia's knowledge engine. Write for students of all ages — clear, direct, friendly, like a knowledgeable friend explaining well. No jargon walls. No padding. Factual and satisfying to read.

STEP 1 — CLASSIFY the topic into exactly one type:

TYPE: SIMPLE
When: Basic concept, definition, or simple term.
Examples: "What is a variable", "Definition of GDP", "What is osmosis"
Target: 600–900 words, 3–4 sections

TYPE: MEDIUM
When: Standard educational topic needing context and depth.
Examples: Bitcoin, Newton's Laws, French Revolution, World War 1
Target: 2000–2500 words, 5 sections:
  1. What is it? (overview, 4–5 paragraphs)
  2. Key Facts (8–12 bullet points, <ul><li> tags)
  3. Full Explanation (most detailed; 2–3 <h3> sub-sections)
  4. History (origin to present)
  5. Why it matters

TYPE: COMPLEX
When: Major civilization, empire, long historical era, large-scale ideology, massive war.
Examples: Roman Empire, World War 2, History of Islam, Cold War, Ottoman Empire, Mughal Empire, Renaissance, Industrial Revolution
Target: 4500–5500 words, 6–8 sections. MUST cover ALL major periods. Nothing important skipped.
Suggested sections (adapt as needed):
  1. Overview / What Was It?
  2. Origins and Foundation
  3. Rise to Power / Golden Age
  4. Major Events and Turning Points
  5. Decline and Fall (if applicable)
  6. Key Figures
  7. Legacy and Global Impact
  8. Why It Matters Today

TYPE: BIOGRAPHICAL
When: Article is about a specific named person.
Examples: Einstein, Prophet Muhammad, Elon Musk, APJ Abdul Kalam, Cleopatra, Napoleon
Target: 3000–3500 words, 6 sections in this order:
  1. Who Was [Name]?
  2. Early Life and Background
  3. Education and Formative Years
  4. Career and Major Works
  5. Key Achievements and Contributions
  6. Personal Life and Legacy

TYPE: SCIENTIFIC
When: Science concept, natural phenomenon, biology, physics, chemistry, space, math.
Examples: Black Holes, DNA, Photosynthesis, Evolution, Quantum Physics, Relativity
Target: 3000–4000 words, 6 sections:
  1. What Is It? (accessible to a 14-year-old)
  2. How It Works (step-by-step mechanism)
  3. Key Concepts and Properties (include formulas if relevant)
  4. Discovery and History
  5. Real-World Applications
  6. Current Research and Future

STEP 2 — Write the article. Output in this EXACT format — no deviations, no preamble:

TITLE: [Full article title]
SUMMARY: [2–3 sentence plain-English overview]
CATEGORY: [History | Science | Technology | Finance | Geopolitics | Culture | Sport | Other]
TAGS: [tag1, tag2, tag3, tag4, tag5]
DATE: [see rules below]
SOURCES: [Source Name (https://homepage.com), Another (https://url.com)]
---
[Full HTML content. Start IMMEDIATELY with the first <h2> heading. No intro sentence before it.]

DATE RULES:
- Ancient: "Ancient era (c. 300 BCE)"
- Century: "19th century (c. 1840s)"
- Decade: "1990s"
- Specific: "February 2026"
- Range: "2020–2023"
- Timeless: "Timeless"

HTML CONTENT RULES:
- Allowed tags ONLY: h2, h3, p, ul, li, strong, code
- Each <p>: 4–5 sentences. No single-sentence paragraphs. No walls of text.
- Use <strong> on key terms (first use only)
- Formulas: <p class="formula-block"><code>E = mc²</code></p>
- Unicode directly: ² ³ √ ∑ ∫ π α β Δ ∞ ≈ ≠ × → ± μ σ λ θ
- SOURCES: 3–5 real authoritative sources. Format: "Name (https://homepage.com)"
- Match target word count for the classified type exactly.
- Return ONLY the formatted output above. Nothing else.`

// ─── Legacy JSON system prompt (non-streaming / DeepSeek fallback) ─
const SYSTEM_PROMPT = `You are Forcapedia's knowledge engine. Write for students of all ages.

Language: Clear, direct, friendly. No unnecessary jargon. No walls of text. Substantive and satisfying to read.

Return ONLY valid JSON — no markdown, no explanation, no code blocks. Just raw JSON:
{
  "title": "Full article title",
  "summary": "2-3 sentence plain-English overview anyone can understand",
  "category": "One of: History, Science, Technology, Finance, Geopolitics, Culture, Sport, Other",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "content_date": "See format rules below.",
  "sources": ["Source Name (https://homepage-url.com)", "Another Source (https://url.com)"],
  "content": "<h2>What is it?</h2><p>...</p><h2>Key Facts</h2><ul><li>...</li></ul><h2>Full Explanation</h2><p>...</p><h2>History</h2><p>...</p><h2>Why it matters</h2><p>...</p>"
}

The content MUST follow this section structure:
1. <h2>What is it?</h2> — 4–5 paragraphs
2. <h2>Key Facts</h2> — 8–12 bullet points
3. <h2>Full Explanation</h2> — 7–9 paragraphs with 2–3 h3 sub-headings
4. <h2>History</h2> — 4–5 paragraphs
5. <h2>Why it matters</h2> — 3–4 paragraphs
Total: 2000–2500 words.

content_date FORMAT: Ancient era (c. 300 BCE) | 19th century (c. 1840s) | 1990s | February 2026 | 2020–2023 | Timeless

HTML tags allowed: h2, h3, p, ul, li, strong, code
Sources: 3–5 real authoritative sources. Format: "Name (https://homepage.com)"
Return ONLY the JSON object. Nothing else.`

// ─── Shared user message builder ───────────────────────────────
function buildUserMessage(topic: string, wikiContent?: string): string {
  return wikiContent
    ? `Write a verified knowledge article about: ${topic}\n\n` +
      `Use the following Wikipedia content as your factual foundation. Keep all facts accurate.\n\n` +
      `--- WIKIPEDIA SOURCE ---\n${wikiContent}\n--- END SOURCE ---`
    : `Write a verified knowledge article about: ${topic}`
}

// ══════════════════════════════════════════════════════════════
//  STREAMING IMPLEMENTATION
// ══════════════════════════════════════════════════════════════

export interface StreamCallbacks {
  /** Called once, as soon as the header (title/summary/etc.) is parsed. */
  onMeta: (meta: Omit<GeneratedArticle, 'content'>) => void
  /** Called repeatedly with raw HTML chunks as the content streams in. */
  onChunk: (html: string) => void
}

// ─── Raw token generator: yields tokens from one provider's SSE stream ─
async function* streamProviderRaw(
  config: ProviderConfig,
  topic: string,
  wikiContent: string | undefined,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const apiKey = config.getToken ? await config.getToken() : process.env[config.apiKeyEnv]
  if (!apiKey) throw new Error(`${config.name}: ${config.apiKeyEnv} not configured`)

  const endpoint = typeof config.endpoint === 'function' ? config.endpoint() : config.endpoint

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  // Merge caller's signal with internal timeout
  const onAbort = () => controller.abort()
  signal.addEventListener('abort', onAbort, { once: true })

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: STREAM_SYSTEM_PROMPT },
          { role: 'user',   content: buildUserMessage(topic, wikiContent) },
        ],
        max_tokens: config.maxTokens ?? 10_000,
        temperature: 0.2,
        stream: true,
        // No response_format — custom text format, not JSON
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`${config.name} HTTP ${response.status}: ${body.slice(0, 200)}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let lineBuffer = ''

  try {
    while (true) {
      if (controller.signal.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      lineBuffer += decoder.decode(value, { stream: true })
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const token: string = parsed?.choices?.[0]?.delta?.content ?? ''
          if (token) yield token
        } catch {
          // Skip malformed SSE line
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ─── Parse custom-format header text into metadata ─────────────
function parseStreamHeader(header: string): Omit<GeneratedArticle, 'content'> {
  const lines = header.split('\n')
  const get = (key: string): string => {
    const line = lines.find(l => l.startsWith(`${key}: `))
    return line ? line.slice(key.length + 2).trim() : ''
  }

  const tagsRaw    = get('TAGS')
  const sourcesRaw = get('SOURCES')

  // Sources: extract all "Name (url)" or "Name" entries
  const sourceEntries: string[] = []
  const srcRegex = /[^,]+(?:\([^)]*\))?/g
  for (const match of sourcesRaw.matchAll(srcRegex)) {
    const s = match[0].trim()
    if (s) sourceEntries.push(s)
  }

  return {
    title:        get('TITLE')    || '',
    summary:      get('SUMMARY')  || '',
    category:     get('CATEGORY') || 'Other',
    tags:         tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
    sources:      sourceEntries,
    content_date: get('DATE') || '',
  }
}

// ─── Stream from one provider, dispatch meta + chunks ──────────
// Returns the complete GeneratedArticle when done.
// Throws if:
//   - provider fails (HTTP error, timeout, API error)
//   - no first chunk within FIRST_CHUNK_MS
async function streamProvider(
  config: ProviderConfig,
  topic: string,
  wikiContent: string | undefined,
  callbacks: StreamCallbacks,
  signal: AbortSignal,
): Promise<GeneratedArticle> {
  const abort = new AbortController()
  const merged = () => {
    if (signal.aborted) abort.abort()
    signal.addEventListener('abort', () => abort.abort(), { once: true })
    return abort.signal
  }

  let headerBuffer  = ''
  let contentBuffer = ''
  let headerDone    = false
  let meta: Omit<GeneratedArticle, 'content'> | null = null
  let firstChunkTimer: ReturnType<typeof setTimeout> | null = null

  // First-chunk timeout: abort if no token arrives within FIRST_CHUNK_MS
  const firstChunkPromise = new Promise<never>((_, reject) => {
    firstChunkTimer = setTimeout(() => {
      abort.abort()
      reject(new Error(`${config.name}: first-chunk timeout`))
    }, FIRST_CHUNK_MS)
  })

  const genPromise = (async () => {
    for await (const token of streamProviderRaw(config, topic, wikiContent, merged())) {
      // Cancel the first-chunk timer the moment the first token arrives
      if (firstChunkTimer !== null) {
        clearTimeout(firstChunkTimer)
        firstChunkTimer = null
      }

      if (!headerDone) {
        headerBuffer += token
        // Detect separator: "---" on its own line (allow leading/trailing whitespace)
        const sepMatch = headerBuffer.match(/\n[ \t]*-{3,}[ \t]*(?:\n|$)/)
        if (sepMatch && sepMatch.index !== undefined) {
          const sepIdx       = sepMatch.index
          const sepEnd       = sepIdx + sepMatch[0].length
          const headerPart   = headerBuffer.slice(0, sepIdx)
          const contentStart = headerBuffer.slice(sepEnd)
          meta = parseStreamHeader(headerPart)
          headerDone = true
          if (meta.title && meta.summary) {
            callbacks.onMeta(meta)
          }
          if (contentStart) {
            contentBuffer += contentStart
            callbacks.onChunk(contentStart)
          }
        }
      } else {
        contentBuffer += token
        callbacks.onChunk(token)
      }
    }
  })()

  await Promise.race([genPromise, firstChunkPromise])
  // If firstChunkPromise threw, genPromise was aborted — the race re-throws

  return {
    ...(meta ?? {
      title:        topic,
      summary:      '',
      category:     'Other',
      tags:         [],
      sources:      [],
      content_date: '',
    }),
    content: contentBuffer.trimEnd(),
  }
}

// ─── Hedged race: primary starts immediately, backup joins after HEDGE_AFTER_MS ─
//
// Whoever fires onMeta first WINS — the other is aborted instantly.
// If primary errors before the hedge timer fires, backup starts immediately.
// If only one provider is available, falls back to a simple sequential attempt.
//
async function runHedged(
  primary: ProviderConfig | undefined,
  backup: ProviderConfig | undefined,
  topic: string,
  grounding: string | undefined,
  callbacks: StreamCallbacks,
  callerSignal: AbortSignal,
): Promise<{ winner: string; article: GeneratedArticle } | null> {
  if (!primary && !backup) return null

  // Only one provider available — simple attempt, no hedge needed
  if (!primary || !backup) {
    const p = (primary ?? backup)!
    let committed = false
    const wrapped: StreamCallbacks = {
      onMeta: (m) => { committed = true; callbacks.onMeta(m) },
      onChunk: callbacks.onChunk,
    }
    try {
      const article = await streamProvider(p, topic, grounding, wrapped, callerSignal)
      return committed ? { winner: p.name, article } : null
    } catch (e) {
      if (committed) throw e
      console.warn(`[ai] ✗ ${p.name}: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }
  }

  // Both available — run hedged race
  // Capture as non-undefined locals so TypeScript can narrow inside async callbacks
  const primaryP: ProviderConfig = primary
  const backupP: ProviderConfig  = backup

  return new Promise<{ winner: string; article: GeneratedArticle } | null>((resolve, reject) => {
    let winnerName: string | null = null
    let resolved      = false
    let primaryDone   = false
    let backupStarted = false
    let backupDone    = false
    let hedgeTimer: ReturnType<typeof setTimeout> | null = null

    const primaryAbort = new AbortController()
    const backupAbort  = new AbortController()

    const onCallerAbort = () => { primaryAbort.abort(); backupAbort.abort() }
    callerSignal.addEventListener('abort', onCallerAbort, { once: true })

    function settle(value: { winner: string; article: GeneratedArticle } | null, err?: unknown) {
      if (resolved) return
      resolved = true
      if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null }
      callerSignal.removeEventListener('abort', onCallerAbort)
      if (err !== undefined) reject(err)
      else resolve(value)
    }

    function makeCallbacks(name: string, otherAbort: AbortController): StreamCallbacks {
      return {
        onMeta: (meta) => {
          if (winnerName !== null) return               // other already committed
          winnerName = name
          otherAbort.abort()                            // cancel the loser
          if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null }
          callbacks.onMeta(meta)
        },
        onChunk: (html) => {
          if (winnerName === name) callbacks.onChunk(html)
        },
      }
    }

    function startBackup() {
      if (backupStarted || resolved) return
      backupStarted = true
      console.log(`[ai] hedge: ${backupP.name} starting concurrently`)
      streamProvider(backupP, topic, grounding, makeCallbacks(backupP.name, primaryAbort), backupAbort.signal)
        .then(article => {
          backupDone = true
          if (winnerName === backupP.name) settle({ winner: backupP.name, article })
          else if (!resolved && primaryDone) settle(null)
        })
        .catch(e => {
          backupDone = true
          if (winnerName === backupP.name) { settle(null, e); return }  // mid-stream failure
          console.warn(`[ai] ✗ ${backupP.name} (hedge): ${e instanceof Error ? e.message : String(e)}`)
          if (primaryDone && !resolved) settle(null)
        })
    }

    // Start primary immediately
    streamProvider(primaryP, topic, grounding, makeCallbacks(primaryP.name, backupAbort), primaryAbort.signal)
      .then(article => {
        primaryDone = true
        if (winnerName === primaryP.name) settle({ winner: primaryP.name, article })
        else if (!resolved && (!backupStarted || backupDone)) settle(null)
      })
      .catch(e => {
        primaryDone = true
        if (winnerName === primaryP.name) { settle(null, e); return }   // mid-stream failure
        console.warn(`[ai] ✗ ${primaryP.name}: ${e instanceof Error ? e.message : String(e)} — starting ${backupP.name} immediately`)
        if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null }
        startBackup()
        if (backupDone && !resolved) settle(null)
      })

    // Hedge: if primary hasn't committed in HEDGE_AFTER_MS, start backup concurrently
    hedgeTimer = setTimeout(() => {
      hedgeTimer = null
      if (winnerName === null && !resolved) startBackup()
    }, HEDGE_AFTER_MS)
  })
}

// ─── Public streaming API ──────────────────────────────────────
/**
 * Stream article generation with hedged race + sequential fallback.
 *
 * Strategy:
 *   Stage 1 — Hedged race (Vertex + Groq):
 *     Vertex starts at t=0. If it hasn't committed (fired onMeta) within
 *     HEDGE_AFTER_MS (8 s), Groq starts concurrently. Whoever commits first
 *     wins; the other is aborted. If Vertex errors before the hedge fires,
 *     Groq starts immediately. On normal days Vertex commits in 4–6 s so
 *     Groq is never called — credits are always used first.
 *   Stage 2 — Gemini sequential fallback (if both Stage 1 providers fail).
 *   Stage 3 — DeepSeek non-streaming last resort (if all streaming fail).
 */
export async function streamArticle(
  topic: string,
  wikiContent: string | undefined,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<GeneratedArticle> {
  const grounding    = wikiContent?.slice(0, WIKI_MAX_CHARS)
  const mode         = grounding ? 'wiki' : 'ai'
  const callerSignal = signal ?? new AbortController().signal
  const t0           = Date.now()

  const vertex   = PROVIDERS.find(p => p.name === 'vertex'   && isProviderReady(p))
  const groq     = PROVIDERS.find(p => p.name === 'groq'     && isProviderReady(p))
  const gemini   = PROVIDERS.find(p => p.name === 'gemini'   && isProviderReady(p))
  const deepseek = PROVIDERS.find(p => p.name === 'deepseek' && isProviderReady(p))

  // ── Stage 1: Vertex + Groq hedged race ────────────────────────
  const hedgeResult = await runHedged(vertex, groq, topic, grounding, callbacks, callerSignal)
  if (hedgeResult) {
    console.log(`[ai] ✓ streaming ${hedgeResult.winner} (${mode}) — ${Date.now() - t0}ms`)
    return hedgeResult.article
  }

  // ── Stage 2: Gemini sequential fallback ───────────────────────
  if (gemini && !callerSignal.aborted) {
    let committed = false
    const wrapped: StreamCallbacks = {
      onMeta: (m) => { committed = true; callbacks.onMeta(m) },
      onChunk: callbacks.onChunk,
    }
    try {
      const article = await streamProvider(gemini, topic, grounding, wrapped, callerSignal)
      if (committed) {
        console.log(`[ai] ✓ streaming gemini (${mode}) — ${Date.now() - t0}ms`)
        return article
      }
      console.warn('[ai] ✗ gemini: no content committed')
    } catch (e) {
      if (committed) throw e
      console.warn(`[ai] ✗ gemini: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Stage 3: DeepSeek non-streaming last resort ───────────────
  if (deepseek && !callerSignal.aborted) {
    const td = Date.now()
    console.log(`[ai] → falling back to deepseek non-streaming (${mode})`)
    try {
      const article = await callProvider(deepseek, topic, grounding)
      const { content, ...meta } = article
      callbacks.onMeta(meta)
      callbacks.onChunk(content)
      console.log(`[ai] ✓ deepseek fallback (${mode}) — ${Date.now() - td}ms`)
      return article
    } catch (err) {
      console.error(`[ai] ✗ deepseek failed: ${err}`)
    }
  }

  throw new Error('[ai] All providers failed — check API keys and provider status')
}

// ══════════════════════════════════════════════════════════════
//  NON-STREAMING (used by DeepSeek fallback inside streamArticle)
// ══════════════════════════════════════════════════════════════

async function callProvider(
  config: ProviderConfig,
  topic: string,
  wikiContent?: string,
): Promise<GeneratedArticle> {
  const apiKey = config.getToken ? await config.getToken() : process.env[config.apiKeyEnv]
  if (!apiKey) throw new Error(`${config.name}: ${config.apiKeyEnv} not configured`)

  const endpoint = typeof config.endpoint === 'function' ? config.endpoint() : config.endpoint

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: buildUserMessage(topic, wikiContent) },
        ],
        max_tokens: 8_000,
        temperature: 0.2,
        ...(config.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`${config.name} HTTP ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json()
  const raw: string | undefined = data?.choices?.[0]?.message?.content
  if (!raw?.trim()) throw new Error(`${config.name}: empty response content`)
  return parseArticleJson(raw, config.name)
}

function parseArticleJson(raw: string, providerName: string): GeneratedArticle {
  let text = raw.trim()

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) text = fenceMatch[1].trim()

  const objStart = text.indexOf('{')
  const objEnd   = text.lastIndexOf('}')
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    text = text.slice(objStart, objEnd + 1)
  }

  let parsed: Partial<GeneratedArticle>
  try {
    parsed = JSON.parse(text)
  } catch {
    try {
      parsed = JSON.parse(text + '}')
    } catch {
      throw new Error(`${providerName}: JSON parse failed — ${text.slice(0, 100)}`)
    }
  }

  if (!parsed.title && !parsed.content) {
    const values = Object.values(parsed)
    const nested = values.find(
      v => v && typeof v === 'object' && !Array.isArray(v) && 'title' in (v as object),
    )
    if (nested) parsed = nested as Partial<GeneratedArticle>
  }

  if (!parsed.title || !parsed.content || !parsed.summary) {
    throw new Error(`${providerName}: missing required fields (title/summary/content)`)
  }

  return {
    title:        String(parsed.title),
    summary:      String(parsed.summary),
    content:      String(parsed.content),
    category:     String(parsed.category ?? 'Other'),
    tags:         Array.isArray(parsed.tags)    ? parsed.tags.map(String)    : [],
    sources:      Array.isArray(parsed.sources) ? parsed.sources.map(String) : [],
    content_date: parsed.content_date ? String(parsed.content_date) : '',
  }
}

// ─── Legacy non-streaming public API (kept for compatibility) ──
// Prefer streamArticle() for new article generation.
export async function generateArticle(
  topic: string,
  wikiContent?: string,
): Promise<GeneratedArticle> {
  const grounding = wikiContent?.slice(0, WIKI_MAX_CHARS)
  const deepseek  = PROVIDERS.find(p => p.name === 'deepseek' && process.env[p.apiKeyEnv])

  if (!deepseek) throw new Error('[ai] No provider configured for generateArticle')

  return callProvider(deepseek, topic, grounding)
}
