// ══════════════════════════════════════════════════════════════
//  GET /api/test-ai
//  Dev-only route — tests every AI provider + Serper individually.
//  Open in browser: http://localhost:3001/api/test-ai
//  Blocked in production automatically.
// ══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Minimal ping prompt — tests connection without burning tokens
const PING_MESSAGES = [
  { role: 'system', content: 'You are a test assistant. Reply with only the word: ONLINE' },
  { role: 'user', content: 'Status check.' },
]

interface TestResult {
  status: 'ok' | 'fail' | 'no_key'
  provider: string
  model?: string
  responseMs?: number
  reply?: string
  error?: string
}

// ─── Individual provider tests ────────────────────────────────

async function testProvider(
  name: string,
  apiKeyEnv: string,
  endpoint: string,
  model: string,
): Promise<TestResult> {
  const apiKey = process.env[apiKeyEnv]

  if (!apiKey) {
    return { status: 'no_key', provider: name, error: `${apiKeyEnv} is not set in .env.local` }
  }

  const t0 = Date.now()
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: PING_MESSAGES,
        max_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return {
        status: 'fail',
        provider: name,
        model,
        responseMs: Date.now() - t0,
        error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      }
    }

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content?.trim() ?? '(empty)'

    return {
      status: 'ok',
      provider: name,
      model,
      responseMs: Date.now() - t0,
      reply,
    }
  } catch (err) {
    return {
      status: 'fail',
      provider: name,
      model,
      responseMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function testSerper(): Promise<TestResult> {
  const apiKey = process.env.SERPER_API_KEY

  if (!apiKey) {
    return { status: 'no_key', provider: 'serper', error: 'SERPER_API_KEY is not set in .env.local' }
  }

  const t0 = Date.now()
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: 'Forcapedia test', num: 1 }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return {
        status: 'fail',
        provider: 'serper',
        responseMs: Date.now() - t0,
        error: `HTTP ${res.status}`,
      }
    }

    const data = await res.json()
    const firstResult = data?.organic?.[0]?.title ?? '(no results)'

    return {
      status: 'ok',
      provider: 'serper',
      responseMs: Date.now() - t0,
      reply: `Got result: "${firstResult}"`,
    }
  } catch (err) {
    return {
      status: 'fail',
      provider: 'serper',
      responseMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Route handler ────────────────────────────────────────────

export async function GET() {
  // ── Guard 1: production block ──────────────────────────────
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  // ── Guard 2: must be authenticated ────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required. Sign in first.' },
      { status: 401 }
    )
  }

  // ── Guard 3: email whitelist ───────────────────────────────
  // Set ADMIN_EMAILS=you@gmail.com in .env.local (comma-separated for multiple)
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length > 0 && !adminEmails.includes(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  // Run all tests in parallel
  const [groq, gemini, deepseek, serper] = await Promise.all([
    testProvider(
      'groq',
      'GROQ_API_KEY',
      'https://api.groq.com/openai/v1/chat/completions',
      'llama-3.1-8b-instant',
    ),
    testProvider(
      'gemini',
      'GEMINI_API_KEY',
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      'gemini-2.0-flash-lite',
    ),
    testProvider(
      'deepseek',
      'DEEPSEEK_API_KEY',
      'https://api.deepseek.com/v1/chat/completions',
      'deepseek-chat',
    ),
    testSerper(),
  ])

  const allResults = { groq, gemini, deepseek, serper }

  // Summary
  const passed  = Object.values(allResults).filter(r => r.status === 'ok').length
  const failed  = Object.values(allResults).filter(r => r.status === 'fail').length
  const missing = Object.values(allResults).filter(r => r.status === 'no_key').length

  return NextResponse.json({
    summary: {
      passed,
      failed,
      missing_keys: missing,
      total: 4,
    },
    results: allResults,
  }, { status: 200 })
}
