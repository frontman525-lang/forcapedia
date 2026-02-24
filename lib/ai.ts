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
const SYSTEM_PROMPT = `You are Forcapedia's verified knowledge engine.

Generate a deep, comprehensive, encyclopedic article — Wikipedia-level depth and quality.
Write for an educated general audience: precise, authoritative, and clear.

Return ONLY valid JSON — no markdown, no explanation, no code blocks. Just raw JSON:
{
  "title": "Full article title",
  "summary": "2-3 sentence overview of the topic",
  "category": "One of: History, Science, Technology, Finance, Geopolitics, Culture, Sport, Other",
  "tags": ["tag1", "tag2", "tag3"],
  "sources": ["Source Name (https://homepage-url.com)", "Another Source (https://url.com)"],
  "content": "<h2>Section Title</h2><p>Paragraph one.</p><p>Paragraph two.</p><h2>Another Section</h2><p>Content...</p>"
}

Content rules:
- Use ONLY these HTML tags: h2, h3, p, ul, li, strong
- Minimum 6 distinct h2 sections (aim for 7-8)
- Each section: 2-4 short paragraphs of 3-5 sentences each
- Short paragraphs — never one long wall of text
- Use h3 sub-sections where the topic has meaningful sub-categories
- Total article length: 1200-2000 words minimum

Sources rules:
- 3 to 5 authoritative sources
- Format EXACTLY as: "Full Source Name (https://official-homepage.com)"
- Use real, well-known institution homepages only (e.g. NASA, Wikipedia, BBC, Nature, WHO)
- Never invent or guess specific article URLs — homepage URLs only
- If you are not certain of a homepage URL, omit the URL: "Source Name"

General rules:
- Be factual. Never speculate or hallucinate dates, statistics, or names.
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
        max_tokens: 5000,
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
    title:    String(parsed.title),
    summary:  String(parsed.summary),
    content:  String(parsed.content),
    category: String(parsed.category ?? 'Other'),
    tags:     Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    sources:  Array.isArray(parsed.sources) ? parsed.sources.map(String) : [],
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
