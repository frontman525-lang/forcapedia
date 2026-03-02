// GET /api/data/export
// Returns a ZIP archive containing:
//   - data.json        (machine-readable, all raw data)
//   - report.html      (human-readable, open in any browser, print to PDF)
//   - README.txt       (explains each file)
// This matches the format used by OpenAI, Anthropic, and Google Takeout.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

export const dynamic = 'force-dynamic'

// ── tiny helpers ───────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtAmount(amount: number, currency: string): string {
  const c = (currency ?? '').toUpperCase()
  if (c === 'INR') return `INR ${amount.toLocaleString('en-IN')}`
  if (c === 'USD') return `USD ${amount.toFixed(2)}`
  return `${currency} ${amount}`
}

function tierLabel(tier: string): string {
  return ({ free: 'Free', tier1: 'Scholar', tier2: 'Researcher' } as Record<string, string>)[tier] ?? tier
}

// ── HTML builder helpers ───────────────────────────────────────────────────────

function section(title: string, body: string): string {
  return `
  <section>
    <h2>${esc(title)}</h2>
    ${body}
  </section>`
}

function kvTable(pairs: [string, string][]): string {
  const rows = pairs.map(([k, v]) =>
    `<tr><th>${esc(k)}</th><td>${v}</td></tr>`
  ).join('')
  return `<table class="kv">${rows}</table>`
}

function dataTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '<p class="empty">No records found.</p>'
  const head = headers.map(h => `<th>${esc(h)}</th>`).join('')
  const body = rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

// ── route ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch everything in parallel
  const [
    { data: usage },
    { data: subscriptions },
    { data: sessions },
    { data: articlesRead },
    { data: questionsAsked },
    { data: articlesVoted },
    { data: explanationsShared },
  ] = await Promise.all([
    supabase.from('user_usage').select('tier, tokens_used, period_start').eq('user_id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('tier, billing_cycle, status, amount, currency, created_at, cancel_at_period_end').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('user_sessions').select('browser, os, device_type, country, city, last_active, created_at').eq('user_id', user.id).order('last_active', { ascending: false }),
    supabase.from('reading_history').select('article_slug, article_title, article_category, read_at').eq('user_id', user.id).order('read_at', { ascending: false }),
    supabase.from('follow_ups').select('article_slug, question, answer, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('article_votes').select('article_slug, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('explain_shares').select('highlighted_text, explanation, mode, article_slug, created_at').eq('created_by', user.id).order('created_at', { ascending: false }),
  ])

  const exportedAt  = new Date().toISOString()
  const dateSlug    = exportedAt.split('T')[0]
  const exportedAtH = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  // ── 1. data.json ────────────────────────────────────────────────────────────

  const jsonData = {
    _note: 'This file contains all data Forcapedia holds about your account.',
    exported_at: exportedAt,
    account: {
      id:           user.id,
      email:        user.email,
      full_name:    user.user_metadata?.full_name  ?? null,
      nickname:     user.user_metadata?.nickname   ?? null,
      created_at:   user.created_at,
      last_sign_in: user.last_sign_in_at           ?? null,
    },
    usage:         usage ?? null,
    subscriptions: subscriptions ?? [],
    sessions:      sessions      ?? [],
    activity: {
      articles_read:          articlesRead       ?? [],
      questions_asked:        questionsAsked     ?? [],
      articles_voted:         articlesVoted      ?? [],
      ai_explanations_shared: explanationsShared ?? [],
    },
  }

  // ── 2. report.html ──────────────────────────────────────────────────────────

  const TIER_LIMITS: Record<string, string> = {
    free: '50,000', tier1: '2,000,000', tier2: '4,000,000',
  }

  const accountSection = section('Account Information', kvTable([
    ['Full name',      esc(user.user_metadata?.full_name  ?? 'Not set')],
    ['Email address',  esc(user.email ?? 'N/A')],
    ['Nickname',       esc(user.user_metadata?.nickname   ?? 'Not set')],
    ['Account created', fmtDate(user.created_at)],
    ['Last sign-in',   fmtDate(user.last_sign_in_at)],
    ['Current plan',   tierLabel(usage?.tier ?? 'free')],
  ]))

  const usageSection = usage
    ? section('Plan & Token Usage', kvTable([
        ['Plan',          tierLabel(usage.tier)],
        ['Tokens used',   `${(usage.tokens_used ?? 0).toLocaleString()} of ${TIER_LIMITS[usage.tier] ?? 'N/A'}`],
        ['Period start',  fmtDate(usage.period_start)],
      ]))
    : ''

  const subsSection = section('Billing History',
    dataTable(
      ['Plan', 'Billing cycle', 'Status', 'Amount', 'Date'],
      (subscriptions ?? []).map(s => [
        tierLabel(s.tier),
        esc(s.billing_cycle),
        esc(s.status),
        esc(fmtAmount(s.amount, s.currency)),
        fmtDate(s.created_at),
      ]),
    )
  )

  const sessionsSection = section('Login Sessions',
    dataTable(
      ['Browser', 'Operating system', 'Device', 'Location', 'Last active', 'First seen'],
      (sessions ?? []).map(s => [
        esc(s.browser ?? 'Unknown'),
        esc(s.os ?? 'Unknown'),
        esc(s.device_type ?? 'Unknown'),
        esc(s.city && s.country ? `${s.city}, ${s.country}` : s.country ?? 'Unavailable'),
        fmtDate(s.last_active),
        fmtDate(s.created_at),
      ]),
    )
  )

  const readingSection = section('Articles Read',
    dataTable(
      ['Article title', 'Category', 'Read on'],
      (articlesRead ?? []).map(r => [
        `<a href="https://forcapedia.com/article/${esc(r.article_slug)}">${esc(r.article_title)}</a>`,
        esc(r.article_category ?? 'General'),
        fmtDate(r.read_at),
      ]),
    )
  )

  const questionsSection = section('Follow-up Questions Asked',
    (questionsAsked ?? []).length === 0
      ? '<p class="empty">No questions recorded.</p>'
      : (questionsAsked ?? []).map(q => `
        <div class="qa">
          <div class="qa-meta">
            <span class="qa-slug">${esc(q.article_slug)}</span>
            <span class="qa-date">${fmtDate(q.created_at)}</span>
          </div>
          <p class="qa-q"><strong>Question:</strong> ${esc(q.question)}</p>
          <p class="qa-a"><strong>Answer:</strong> ${esc(q.answer)}</p>
        </div>`).join('')
  )

  const votesSection = section('Articles Voted Helpful',
    dataTable(
      ['Article', 'Voted on'],
      (articlesVoted ?? []).map(v => [
        `<a href="https://forcapedia.com/article/${esc(v.article_slug)}">${esc(v.article_slug)}</a>`,
        fmtDate(v.created_at),
      ]),
    )
  )

  const sharesSection = section('AI Explanations Shared',
    (explanationsShared ?? []).length === 0
      ? '<p class="empty">No explanations shared.</p>'
      : (explanationsShared ?? []).map(e => `
        <div class="qa">
          <div class="qa-meta">
            <span class="qa-slug">${esc(e.mode)} mode${e.article_slug ? ` &middot; ${esc(e.article_slug)}` : ''}</span>
            <span class="qa-date">${fmtDate(e.created_at)}</span>
          </div>
          <p class="qa-q"><strong>Highlighted text:</strong> &ldquo;${esc(e.highlighted_text)}&rdquo;</p>
          <p class="qa-a"><strong>Explanation:</strong> ${esc(e.explanation)}</p>
        </div>`).join('')
  )

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Forcapedia — Data Export</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 14px; color: #1a1a1a; background: #f5f5f3; line-height: 1.6; padding: 2rem 1rem; }
  .page { max-width: 820px; margin: 0 auto; }

  header { margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #ddd; }
  .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #999; margin-bottom: 0.5rem; }
  header h1 { font-size: 26px; font-weight: 300; color: #111; margin-bottom: 4px; }
  header p { font-size: 12px; color: #999; }

  .notice { background: #fff; border: 1px solid #e0e0e0; border-left: 3px solid #111; border-radius: 6px; padding: 10px 14px; margin-bottom: 1.75rem; font-size: 12px; color: #555; }
  .notice strong { color: #111; }
  @media print { .notice { display: none; } }

  section { background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.25rem; break-inside: avoid; }
  section h2 { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 1rem; padding-bottom: 0.625rem; border-bottom: 1px solid #f0f0f0; }

  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #999; text-align: left; padding: 0 10px 8px; border-bottom: 1px solid #eee; }
  td { font-size: 13px; color: #333; padding: 9px 10px; border-bottom: 1px solid #f5f5f5; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  a { color: #1a1a1a; }

  table.kv { width: auto; }
  table.kv th { width: 160px; font-size: 10px; color: #aaa; font-weight: 600; padding: 6px 12px 6px 0; border: none; vertical-align: top; }
  table.kv td { font-size: 13px; color: #222; padding: 6px 0; border: none; }

  .qa { border: 1px solid #f0f0f0; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; background: #fafafa; }
  .qa:last-child { margin-bottom: 0; }
  .qa-meta { display: flex; gap: 1rem; margin-bottom: 8px; font-size: 11px; }
  .qa-slug { color: #999; font-style: italic; }
  .qa-date { color: #bbb; margin-left: auto; }
  .qa-q { font-size: 13px; color: #222; margin-bottom: 6px; }
  .qa-a { font-size: 13px; color: #555; line-height: 1.7; }

  .empty { font-size: 13px; color: #bbb; font-style: italic; }

  footer { margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid #e8e8e8; font-size: 11px; color: #bbb; text-align: center; }
  footer a { color: #999; }

  @media print {
    body { background: #fff; padding: 0; font-size: 12px; }
    section { box-shadow: none; border: 1px solid #ddd; margin-bottom: 1rem; }
  }
</style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand">Forcapedia</div>
    <h1>Your personal data export</h1>
    <p>Generated on ${esc(exportedAtH)} &nbsp;&middot;&nbsp; ${esc(user.email ?? '')}</p>
  </header>

  <div class="notice">
    <strong>To save as PDF:</strong> Press Ctrl + P &nbsp;&rarr;&nbsp; select &ldquo;Save as PDF&rdquo; as the destination.
    &nbsp;&nbsp;|&nbsp;&nbsp; The raw machine-readable data is in <code>data.json</code> inside the same ZIP file.
  </div>

  ${accountSection}
  ${usageSection}
  ${subsSection}
  ${sessionsSection}
  ${readingSection}
  ${questionsSection}
  ${votesSection}
  ${sharesSection}

  <footer>
    This export contains all personal data held by Forcapedia about your account as of ${esc(exportedAtH)}.<br>
    Questions? Contact <a href="mailto:hello@forcapedia.com">hello@forcapedia.com</a>
  </footer>
</div>
</body>
</html>`

  // ── 3. README.txt ────────────────────────────────────────────────────────────

  const readme = `FORCAPEDIA DATA EXPORT
======================
Generated: ${exportedAtH}
Account:   ${user.email ?? ''}

FILES IN THIS ARCHIVE
---------------------
report.html   Open in any web browser for a human-readable view of your data.
              To save as PDF: Ctrl+P → Save as PDF.

data.json     Machine-readable file containing all your raw data.
              Can be opened in any text editor or imported into other tools.

README.txt    This file.

WHAT IS INCLUDED
----------------
- Account information (name, email, nickname)
- Plan and token usage
- Billing history
- Login sessions (device, browser, location)
- Articles you have read
- Follow-up questions you asked and the AI answers given
- Articles you marked as helpful
- AI explanations you highlighted and shared

QUESTIONS?
----------
Email: hello@forcapedia.com
`

  // ── 4. Build ZIP ─────────────────────────────────────────────────────────────

  const zip = new JSZip()
  zip.file('report.html', html)
  zip.file('data.json',   JSON.stringify(jsonData, null, 2))
  zip.file('README.txt',  readme)

  const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  // Slice creates a true ArrayBuffer (not SharedArrayBuffer) — required by BlobPart typing
  const blob = new Blob(
    [zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength)],
    { type: 'application/zip' },
  )

  const filename = `forcapedia-data-${dateSlug}.zip`
  return new NextResponse(blob, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
