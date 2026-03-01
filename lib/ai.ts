// ══════════════════════════════════════════════════════════════
//  lib/ai.ts — Unified AI Service
//  Architecture: Groq (primary) → Gemini (fallback 1) → DeepSeek (fallback 2)
//
//  All three providers expose OpenAI-compatible REST endpoints.
//  No extra packages needed — raw fetch only.
//  SERVER-SIDE ONLY. Never import in client components.
// ══════════════════════════════════════════════════════════════

export interface GeneratedArticle {
  title: string
  summary: string
  content: string      // HTML: h2, h3, p, ul, li, strong only
  category: string
  tags: string[]
  sources: string[]
  content_date?: string  // e.g. "April 2024", "2020–2023", "" for timeless
}

// ─── Provider registry ────────────────────────────────────────
interface ProviderConfig {
  name: string
  apiKeyEnv: string
  endpoint: string
  model: string
  timeoutMs: number
}

const PROVIDERS: ProviderConfig[] = [
  {
    // PRIMARY — Cheapest + fastest: $0.05/$0.08 per 1M tokens, LPU hardware
    // Normally responds in 1–3s. 45s timeout covers any Groq congestion.
    name: 'groq',
    apiKeyEnv: 'GROQ_API_KEY',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.1-8b-instant',
    timeoutMs: 45_000,
  },
  {
    // FALLBACK 1 — $0.075/$0.30 per 1M tokens
    // Flash Lite is fast. 60s covers deep research topics.
    name: 'gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash-lite',
    timeoutMs: 60_000,
  },
  {
    // FALLBACK 2 — $0.07/$1.10 per 1M tokens — last resort
    // DeepSeek can take 20–40s on complex topics. 90s is safe ceiling.
    name: 'deepseek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    timeoutMs: 90_000,
  },
]

// ─── System prompt (shared across all providers) ──────────────
const SYSTEM_PROMPT = `You are Forcapedia's knowledge engine. Write for students aged everyone especially for all students.

Language: Clear, direct, friendly — like a knowledgeable friend explaining it well. No unnecessary jargon. No walls of text. Not robotic. Substantive and satisfying to read.

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

content_date FORMAT RULES (always provide this — never leave it empty):
- Ancient or pre-modern topic: "Ancient era (c. [approx BCE/CE date])" e.g. "Ancient era (c. 300 BCE)"
- Historical century topic: "[Century] (c. [decade])" e.g. "19th century (c. 1840s)", "20th century (c. 1950)"
- Recent decade: "[Decade]s" e.g. "1990s", "2010s"
- Specific year/month (modern events): "Month Year" e.g. "February 2026", "April 2024"
- Year range: "Year–Year" e.g. "2020–2023"
- Truly timeless topic (e.g. pure math, grammar): "Timeless"

The content MUST follow this EXACT section structure — no skipping, no reordering:
1. <h2>What is it?</h2> — 4–5 paragraphs. Start simple, build understanding step by step. A 14-year-old must grasp this fully.
2. <h2>Key Facts</h2> — Bullet points ONLY. 8–12 specific, interesting, surprising facts. Use <ul><li> tags.
3. <h2>Full Explanation</h2> — 7–9 paragraphs. The main body — most detailed section. Use 2–3 h3 sub-headings to break into clear sub-topics.
4. <h2>History</h2> — 4–5 paragraphs. Origin, evolution, key turning points in timeline order. Give real depth here.
5. <h2>Why it matters</h2> — 3–4 paragraphs. Real-world impact, current relevance, what it means for students today.

Content rules:
- Allowed HTML tags: h2, h3, p, ul, li, strong, code
- Paragraphs: 4–5 sentences each. No one-sentence paragraphs. No walls of text.
- Use <strong> to highlight key terms on first use
- Use 2–3 h3 sub-headings inside "Full Explanation" to break complex topics into digestible parts
- Total article: 2000–2500 words — deep, satisfying, feels like a complete lesson not a summary.
- tags: provide 4–6 specific related topic tags (e.g. for "Energy": ["physics", "thermodynamics", "kinetic energy", "work", "power", "conservation"])

Formula rules (IMPORTANT — apply whenever the topic has mathematical, physical, chemical, or financial formulas):
- Standalone important formula: <p class="formula-block"><code>E = mc²</code></p>
- Inline formula inside a sentence: wrap in <code>F = ma</code> within the <p> tag
- Use unicode characters directly: ² ³ √ ∑ ∫ π α β Δ ∞ ≈ ≠ ≤ ≥ × ÷ → ± μ σ λ θ φ
- Always explain what each variable means immediately after the formula: "where E is energy, m is mass, and c is the speed of light"
- Include all standard formulas relevant to the topic — don't skip them to save space
- Examples: Physics (F=ma, E=mc², KE=½mv²), Chemistry (PV=nRT), Finance (compound interest), Math (quadratic formula), etc.
- For topics with NO formulas (pure history, culture, etc.) — skip this, do not force it

Sources rules:
- 3 to 5 real, authoritative sources (Wikipedia, BBC, Reuters, NASA, WHO, Nature, etc.)
- Format EXACTLY as: "Full Source Name (https://official-homepage.com)"
- Homepage URLs only — never invent specific article URLs
- If uncertain of the URL, omit it: "Source Name"

General rules:
- Be factual. Never hallucinate dates, statistics, or names.
- Return ONLY the JSON object. Nothing else.`

// ─── Core call function ───────────────────────────────────────
async function callProvider(
  config: ProviderConfig,
  topic: string,
  wikiContent?: string,       // optional Wikipedia plain-text to ground the article
): Promise<GeneratedArticle> {
  const apiKey = process.env[config.apiKeyEnv]
  if (!apiKey) throw new Error(`${config.name}: ${config.apiKeyEnv} not configured`)

  const userMessage = wikiContent
    ? `Write a verified knowledge article about: ${topic}\n\n` +
      `Use the following Wikipedia source content as your factual foundation. ` +
      `Reformat it into the required JSON structure with proper HTML sections. ` +
      `Keep all facts accurate — do not add information not present in the source.\n\n` +
      `--- WIKIPEDIA SOURCE ---\n${wikiContent}\n--- END SOURCE ---`
    : `Write a verified knowledge article about: ${topic}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  let response: Response
  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 7000,
        temperature: 0.2,
        response_format: { type: 'json_object' },
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

// ─── JSON parser with defensive extraction ───────────────────
// Some models occasionally wrap JSON in ```json ... ``` — handle it.
function parseArticleJson(raw: string, providerName: string): GeneratedArticle {
  let text = raw.trim()

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) text = fenceMatch[1].trim()

  // Extract JSON object if there's surrounding noise
  const objStart = text.indexOf('{')
  const objEnd = text.lastIndexOf('}')
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    text = text.slice(objStart, objEnd + 1)
  }

  let parsed: Partial<GeneratedArticle>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${providerName}: JSON parse failed — ${text.slice(0, 100)}`)
  }

  // Validate required fields
  if (!parsed.title || !parsed.content || !parsed.summary) {
    throw new Error(`${providerName}: missing required fields (title/summary/content)`)
  }

  return {
    title:        String(parsed.title),
    summary:      String(parsed.summary),
    content:      String(parsed.content),
    category:     String(parsed.category ?? 'Other'),
    tags:         Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    sources:      Array.isArray(parsed.sources) ? parsed.sources.map(String) : [],
    content_date: parsed.content_date ? String(parsed.content_date) : '',
  }
}

// ─── Public API ───────────────────────────────────────────────
/**
 * Generate a verified knowledge article about `topic`.
 * Pass `wikiContent` to ground the AI on real Wikipedia text (recommended).
 * Without it, falls back to pure AI generation.
 * Tries Groq → Gemini → DeepSeek in order.
 * Throws only if every configured provider fails.
 */
export async function generateArticle(
  topic: string,
  wikiContent?: string,
): Promise<GeneratedArticle> {
  const errors: string[] = []

  for (const provider of PROVIDERS) {
    if (!process.env[provider.apiKeyEnv]) continue

    const t0 = Date.now()
    const mode = wikiContent ? 'wiki-grounded' : 'pure-ai'
    try {
      const article = await callProvider(provider, topic, wikiContent)
      console.log(`[ai] ✓ ${provider.name} (${mode}) — ${Date.now() - t0}ms`)
      return article
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[ai] ✗ ${provider.name} failed (${Date.now() - t0}ms): ${msg}`)
      errors.push(`${provider.name}: ${msg}`)
    }
  }

  throw new Error(
    `[ai] All providers failed:\n${errors.map(e => `  • ${e}`).join('\n')}`
  )
}
