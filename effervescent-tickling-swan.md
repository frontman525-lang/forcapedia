# Forcapedia — Complete AI & External API Audit

> Read-only reference. User wants to review this tree before deciding what to change.

---

## THE COMPLETE TREE

```
Forcapedia
├── AI LLM Calls
│   ├── 1. /api/explain                      ← highlight text → explain (article page)
│   ├── 2. /api/followup                     ← follow-up Q&A on article (API only, no UI yet) -  No need this folloup just remove
│   ├── 3. /api/article/generate             ← generate full article (streaming) 
│   └── 4. /api/rooms/[code]/highlight       ← study room text highlight explain
│
└── External REST APIs (no LLM)
    ├── 5. Wikipedia REST + MediaWiki API    ← AI grounding (server) + WikiInfoBox (client)
    ├── 6. Google News RSS                   ← news section on article page
    ├── 7. Wikimedia Pageviews API           ← trending topics on home page
    ├── 8. Google Indexing API               ← SEO ping after article saved
    └── 9. IndexNow API (Bing/DDG/Yandex)   ← SEO ping after article saved
```

---

## 1. /api/explain

**File:** `app/api/explain/route.ts`
**Triggered by:** `components/ExplainPanel.tsx`
User selects text (10–500 words) in article → clicks "Simple" or "For Kids"

### Provider
```
Groq only — llama-3.1-8b-instant
NO fallback provider. If Groq is down → 503 error, feature is broken.
```

### System Prompts (exact)
```
Mode "simple":
  "Explain this in plain language. The person didn't understand it.
   Give the clearest explanation that makes it click — often one sentence
   is enough, never more than three. You can use up to 400 characters if
   needed, but be as concise as possible. Plain text only — no markdown,
   no bullet points, no headers."

Mode "eli10" (For Kids):
  Same system prompt, but user message adds:
  "Explain this to a curious 10-year-old. Use simple words and,
   if it helps, one quick analogy."
```

### User Prompt
```
Mode simple:  Explain this: "{selectedText}"
Mode eli10:   Explain this to a curious 10-year-old... : "{selectedText}"
```

### Parameters
| Field | Value |
|-------|-------|
| max_tokens | Dynamic: text ≤50 chars→160 / ≤150→200 / >150→250 |
| temperature | 0.6 |
| stream | true (SSE) |

### SSE Event Format (what client receives)
```
data: {"type":"usage","used":1,"limit":40}
data: {"type":"token","token":"The "}
data: {"type":"token","token":"concept..."}
data: [DONE]
```

### Fallback
```
Groq fails → 503 ("AI generation failed. Please try again.")
Single point of failure — no fallback.
```

### Rate Limits (daily, resets UTC midnight)
```
free:  1 /day
tier1: 40 /day
tier2: 80 /day
Token charge: NONE (daily counter only, no monthly token deduction)
```

---

## 2. /api/followup

**File:** `app/api/followup/route.ts`
**⚠ NOT WIRED TO UI** — API exists, but no frontend component calls it yet.

### Provider Chain (tries in order)
```
1st: Groq       — llama-3.1-8b-instant — 20s timeout
2nd: Gemini     — gemini-2.0-flash-lite — 20s timeout  (if Groq fails)
3rd: DeepSeek   — deepseek-chat         — 25s timeout  (if Gemini fails)
ALL fail → 500 error
```

### System Prompt (dynamic, assembled per-request)
```
"You are Forcapedia's verified knowledge assistant.
 Answer follow-up questions about the article titled '{article.title}'
 factually and concisely. Keep answers under 200 words. Be direct.
 Never hallucinate. If the question goes beyond available knowledge,
 say so plainly."

[appended if article has summary]:
  Article summary text

[appended if Wikipedia article found]:
  Wikipedia extract (up to 3,000 chars)
```

### User Prompt
```
{question}   ← user's question, validated 3–500 chars
```

### Parameters
| Field | Value |
|-------|-------|
| max_tokens | 600 |
| temperature | 0.2 (low — factual) |
| stream | false |

### Fallback
```
Groq → Gemini → DeepSeek → 500 error
Answer is saved to follow_ups table regardless of which provider answered.
```

### Rate Limits
```
free:  1 follow-up per article (lifetime, not per day)
tier1: unlimited
tier2: unlimited
Token charge: 200 tokens per follow-up (deducted from monthly budget)
```

---

## 3. /api/article/generate  ← MOST COMPLEX

**Files:** `app/api/article/generate/route.ts` + `lib/ai.ts`
**Triggered by:**
- `components/ArticleGenerator.tsx` — main article page (when search returns streaming:true)
- `components/StudyRoom.tsx` — inside study room after user searches a topic

### Provider Chain — HEDGED RACE + FALLBACK
```
Stage 1 — HEDGED RACE (both try, winner cancels loser):
  t=0ms    → Groq starts   (llama-3.1-8b-instant or llama-3.3-70b)
  t=5000ms → Gemini starts (gemini-2.0-flash-lite) — ONLY if Groq hasn't sent first chunk yet

  → Whichever sends first streaming chunk WINS → other is aborted immediately.
  → If both succeed simultaneously, Groq takes priority.

Stage 2 — DEEPSEEK FALLBACK (only if BOTH Stage 1 providers fail):
  DeepSeek — deepseek-chat — NON-streaming (returns entire article at once)
  → User sees blank → full article appears suddenly (no streaming UX)

Stage 3 — ALL FAIL:
  throw new Error('[ai] All providers failed')
  → SSE event: {"type":"error","message":"..."}
  → UI shows error alert
```

### System Prompt — STREAM_SYSTEM_PROMPT (~900 words, in lib/ai.ts)
```
STEP 1 — CLASSIFY topic into one type:

  TYPE: SIMPLE       → 600–900 words, 3–4 sections
    When: Basic concept, definition, simple term
    Examples: "What is a variable", "Definition of GDP"

  TYPE: MEDIUM       → 2,000–2,500 words, 5 sections
    Sections: What is it? / Key Facts (bullets) / Full Explanation / History / Why it matters
    Examples: Bitcoin, Newton's Laws, French Revolution

  TYPE: COMPLEX      → 4,500–5,500 words, 6–8 sections
    When: Major civilization, empire, long era, massive war
    Examples: Roman Empire, WW2, Cold War, Ottoman Empire

  TYPE: BIOGRAPHICAL → 3,000–3,500 words, 6 sections
    Sections: Who / Early Life / Education / Career / Achievements / Legacy
    Examples: Einstein, Elon Musk, APJ Abdul Kalam

  TYPE: SCIENTIFIC   → 3,000–4,000 words, 6 sections
    Sections: What Is It / How It Works / Key Concepts / Discovery / Applications / Research
    Examples: Black Holes, DNA, Quantum Physics

STEP 2 — Write in EXACT format:
  TITLE: ...
  SUMMARY: ...
  CATEGORY: [History|Science|Technology|Finance|Geopolitics|Culture|Sport|Other]
  TAGS: tag1, tag2, tag3, tag4, tag5
  DATE: [Ancient era (c. 300 BCE) | 19th century | 1990s | February 2026 | 2020–2023 | Timeless]
  SOURCES: Source Name (https://homepage.com), ...
  ---
  [HTML content — starts IMMEDIATELY with first <h2>]

HTML rules:
  Allowed: h2, h3, p, ul, li, strong, code ONLY
  Each <p>: 4–5 sentences
  Formulas: <p class="formula-block"><code>E = mc²</code></p>
  3–5 real authoritative sources
```

### User Prompt
```
"Write a verified knowledge article about: {topic}"

+ If Wikipedia found (2,500 chars max):
  "\n\nUse the following Wikipedia content as your factual foundation.
   Keep all facts accurate.\n\n--- WIKIPEDIA SOURCE ---\n{wikiContent}\n--- END SOURCE ---"
```

### Parameters
| Field | Value |
|-------|-------|
| max_tokens | 10,000 |
| temperature | 0.2 (factual) |
| stream | true (SSE, custom text format) |

### SSE Event Format (what client receives)
```
data: {"type":"meta","title":"...","summary":"...","category":"...","tags":[...],"sources":[...],"content_date":"..."}
data: {"type":"chunk","html":"<h2>Introduction</h2>"}
data: {"type":"chunk","html":"<p>The Roman Empire..."}
...
data: {"type":"done","slug":"roman-empire"}
data: {"type":"error","message":"..."}   ← only on failure
```

### Rate Limits
```
Monthly token budgets:
  free:  50,000 tokens/month
  tier1: 2,000,000 tokens/month
  tier2: 4,000,000 tokens/month

Token charge per article:
  With Wikipedia grounding: 800 tokens
  Without Wikipedia:         1,500 tokens

Per-user cooldown: 3 seconds between requests
In-flight lock:    1 generation per user at a time (prevents double-submit)

⚠ Tokens charged BEFORE AI call — NOT refunded if AI fails.
```

### Post-save side effects (fire-and-forget)
```
→ articles table (Supabase) — full article stored
→ user_history table — records what user generated
→ Google Indexing API — pings Google to crawl new URL
→ IndexNow API — pings Bing/DuckDuckGo/Yandex
```

---

## 4. /api/rooms/[code]/highlight

**File:** `app/api/rooms/[code]/highlight/route.ts`
**Triggered by:** `components/StudyRoom.tsx` — user selects text in study room article

### Provider
```
Groq only — llama-3.1-8b-instant
NO fallback provider.
```

### System Prompt (exact)
```
"Explain this clearly and concisely. The student didn't understand it.
 Be direct. No filler. No lectures."
```

### User Prompt
```
`Explain this: "{selectedText.trim().slice(0, 600)}"`
  ↑ capped at 600 chars input
```

### Parameters
| Field | Value |
|-------|-------|
| max_tokens | ≤50 chars→80 / ≤150→150 / ≤400→280 / >400→400 |
| temperature | 0.6 |
| stream | false |

### Fallback
```
Groq fails → explanation stored as null in DB → not shown to room members
No error thrown, no retry.
```

### Rate Limits
```
Uses HOST's explain daily limits:
  free:  0 (disabled)
  tier1: 40 /day
  tier2: 80 /day
Token charge: NONE
```

Stored to: `room_highlights` table
Broadcast to room via: Soketi `explain_shared` event

---

## 5. Wikipedia API

**File (server):** `lib/wikipedia.ts` — called by `/api/article/generate`
**File (client):** `components/WikiInfoBox.tsx` — renders infobox on article page + study room

### Server-side calls (in lib/wikipedia.ts)
```
1. Search:
   GET https://en.wikipedia.org/w/api.php
       ?action=opensearch&search={topic}&limit=1&format=json&redirects=resolve
   Timeout: 5s | Returns: best-matching Wikipedia title

2. Summary (revid + canonical URL):
   GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}
   Timeout: 5s | Returns: revision ID, canonical URL, thumbnail

3. Full content:
   GET https://en.wikipedia.org/w/api.php
       ?action=query&prop=extracts&explaintext=true&exsectionformat=plain
       &titles={title}&format=json
   Timeout: 8s | Returns: plain-text extract (trimmed to 6,000 chars)
```

### Client-side calls (in WikiInfoBox.tsx)
```
1. Summary (for image + description):
   GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}
   ⚠ Requires non-empty title — guard added (fixed CORS bug)

2. Infobox rows:
   GET https://en.wikipedia.org/w/api.php?action=parse&...&origin=*
   origin=* param enables CORS from browser
```

### Copyright Status
```
✓ CC BY-SA 4.0 license — free for educational use
✓ Attribution required — Wikipedia listed in article SOURCES field
✓ Derivative works allowed under same license
```

### Error Handling
```
Server: any failure → returns null → article generates without grounding
  (costs 1,500 tokens instead of 800, never blocks generation)
Client: any failure → WikiInfoBox renders nothing (returns null silently)
```

---

## 6. Google News RSS

**File:** `app/api/news/route.ts`
**Triggered by:** `components/ArticleView.tsx` — news section below article

### Endpoint
```
GET https://news.google.com/rss/search?q={topic}&hl=en-US&gl=US&ceid=US:en
Timeout: 6s
Cache: 30 min (Next.js revalidate=1800 + Cache-Control header)
Returns: max 8 news items (title, link, source, pubDate, description)
```

### Copyright Status
```
⚠ GREY AREA:
  - Google News RSS is a public feed designed for consumption by feed readers
  - Google's ToS technically prohibits automated scraping of Google properties
  - However, RSS feeds are specifically designed for programmatic access
  - Most educational/non-commercial aggregators are tolerated
  - Risk: LOW for educational sites; Google rarely enforces against small apps

Safer alternatives if needed:
  - NewsAPI.org (free tier: 100 req/day)
  - Bing News Search API (free tier available)
  - GNews API (free tier available)
```

### Error Handling
```
Fetch fails → returns { items: [] } — article page still loads normally
```

---

## 7. Wikimedia Pageviews API (Trending)

**File:** `app/api/trending/route.ts`
**Triggered by:** Home page trending topics section

### Endpoint
```
GET https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/{YYYY}/{MM}/{DD}
Uses yesterday's date (today's data is often incomplete)
Timeout: 6s
Module-level cache: 1 hour TTL
```

### Filtering
```
Excludes: system pages (Wikipedia:, Help:, etc.)
Excludes: low-quality categories (cricket seasons, soap opera episodes, etc.)
Returns: exactly 5 filtered topics
```

### Copyright Status
```
✓ Fully free — Wikimedia Foundation public API
✓ CC0 / public domain (pageview statistics, not content)
✓ No ToS restrictions on automated use
```

### Error Handling
```
Fetch fails → serve stale module cache → return []
```

---

## 8. Google Indexing API

**File:** `lib/google-indexing.ts`
**Called by:** `/api/article/generate` after new article saved

### Endpoint
```
POST https://indexing.googleapis.com/v3/urlNotifications:publish
Auth: Service account JWT → OAuth2 Bearer token (RS256 signed)
Body: { url: "https://forcapedia.com/article/{slug}", type: "URL_UPDATED" }
Env: GOOGLE_INDEXING_SA_KEY (full JSON key file)
```

### Copyright Status
```
✓ Google's official SEO API — designed for this exact use case
✓ Free, no content licensing concerns
```

### Error Handling
```
Fire-and-forget. console.warn on failure, never blocks article generation.
```

---

## 9. IndexNow API

**File:** `app/api/article/generate/route.ts` (inline)
**Called by:** Same as above, alongside Google Indexing

### Endpoint
```
POST https://api.indexnow.org/indexnow
Body: { host, key, keyLocation, urlList: ["https://forcapedia.com/article/{slug}"] }
Coverage: Bing, DuckDuckGo, Yandex (all support IndexNow protocol)
Env: INDEXNOW_API_KEY
```

### Copyright Status
```
✓ Free open protocol by Microsoft — designed for this use case
```

### Error Handling
```
.catch(() => {}) — completely silent, never blocks anything
```

---

## PROVIDER SUMMARY TABLE

| Provider | Model | Used For | Has Fallback? |
|----------|-------|----------|---------------|
| Groq | llama-3.1-8b-instant | Explain, Highlight, Article (primary) | ❌ for explain/highlight; Stage 1 for article |
| Gemini | gemini-2.0-flash-lite | Article (hedged at 5s), Follow-up (2nd) | Stage 1 hedge |
| DeepSeek | deepseek-chat | Article (last resort), Follow-up (3rd) | Stage 2 non-streaming |

---

## KNOWN GAPS & ISSUES

| # | Issue | Impact |
|---|-------|--------|
| 1 | Explain has NO fallback — Groq down = feature broken | High |
| 2 | Room highlight has NO fallback — same | Medium |
| 3 | Follow-up API not wired to any UI | Feature invisible to users |
| 4 | Google News RSS is grey-area ToS | Legal risk (low) |
| 5 | DeepSeek fallback is non-streaming — user sees blank then sudden content | UX regression |
| 6 | Tokens charged before AI call — not refunded on failure | User trust |
| 7 | /api/search route not in this audit — needs separate check | — |


Okay, you can read everything in the current, you know, in the current full, the complete tree, okay, in the current for Kapedia complete AI and external API audit, whatever the known gaps and issues are there, okay, whatever the known gaps and issues and everything which needs a fix, you can fix it. And I want to let you know that you can read this once, okay, you can read this once cause I have even made some changes, just a bit changes as well as I'm thinking to, I mean, you know, add another AI as primary, okay? It's like, listen, what do we exactly have is for everything, for article generation, we have, we use fallback, right? Firstly, right now we are using Grok API and then Gemini 2.0, Flashlight, and then we are using DeepSeeker. So for everything, okay, let's say for article generation, steaming, or in the main article page, we have simple and for kits for both of this, as well as in the study room, inside the study room, for the both article as well as explained and everything, you can read the whole thing, okay? You can just read the whole, you know, the page I have just opened, ticklingsvan.md, okay? We have to add vertex AI as primary and then remaining these three. as i just got 300$ free credits so i wanna use them so even if let's say credits over then no prob i'lll just remove it and us ethe same flow groq-gemni-deepseek     firstly see, then confirm no code
