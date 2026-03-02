'use client'

import { useEffect, useState } from 'react'

interface WikiSummary {
  title: string
  description?: string
  extract?: string
  thumbnail?: { source: string; width: number; height: number }
  originalimage?: { source: string; width: number; height: number }
  type?: string
}

interface WikiInfoBoxProps {
  wikiUrl?: string | null
  articleTitle: string
}

interface MetaRow { label: string; value: string }

function parseMetaRows(extract: string): MetaRow[] {
  const rows: MetaRow[] = []

  const bornMatch = extract.match(/born\s+(?:on\s+)?([A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]+ \d{4})/i)
  if (bornMatch) rows.push({ label: 'Born', value: bornMatch[1] })

  const diedMatch = extract.match(/died\s+(?:on\s+)?([A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]+ \d{4})/i)
  if (diedMatch) rows.push({ label: 'Died', value: diedMatch[1] })

  const natMatch = extract.match(/\b(American|British|French|German|Iranian|Chinese|Indian|Russian|Japanese|Italian|Spanish|Australian|Brazilian|Canadian|Pakistani|Egyptian|Saudi|Turkish|Korean|Nigerian|South African|Dutch|Swedish|Norwegian|Danish|Finnish|Swiss|Austrian|Polish|Czech|Hungarian|Romanian|Greek|Portuguese|Belgian|Israeli|Singaporean|Thai|Vietnamese|Indonesian|Bangladeshi|Sri Lankan)\b/)
  if (natMatch) rows.push({ label: 'Nationality', value: natMatch[1] })

  return rows.slice(0, 3)
}

export default function WikiInfoBox({ wikiUrl, articleTitle }: WikiInfoBoxProps) {
  const [data, setData] = useState<WikiSummary | null>(null)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    let wikiTitle = articleTitle
    if (wikiUrl) {
      const match = wikiUrl.match(/\/wiki\/([^#?]+)/)
      if (match) wikiTitle = decodeURIComponent(match[1].replace(/_/g, ' '))
    }

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`, {
      headers: { Accept: 'application/json' },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((d: WikiSummary | null) => {
        if (d && d.thumbnail && d.type !== 'disambiguation') setData(d)
      })
      .catch(() => null)
  }, [wikiUrl, articleTitle])

  if (!data || !data.thumbnail || imgError) return null

  const metaRows = data.extract ? parseMetaRows(data.extract) : []
  const imgSrc = data.originalimage?.source ?? data.thumbnail.source

  // First sentence as short summary fallback
  const firstSentence = data.extract?.match(/[^.!?]+[.!?]+/)?.[0]?.trim() ?? ''

  return (
    <div className="wiki-info-box">
      {/* ── Portrait ── */}
      <div className="wiki-portrait">
        <img
          src={imgSrc}
          alt={data.title}
          onError={() => setImgError(true)}
        />
      </div>

      {/* ── Info panel ── */}
      <div className="wiki-info-panel">
        {/* Name */}
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.1rem',
          fontWeight: 400,
          color: 'var(--text-primary)',
          lineHeight: 1.25,
          marginBottom: '0.2rem',
        }}>
          {data.title}
        </p>

        {/* Role / description */}
        {data.description && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            marginBottom: '0.75rem',
            lineHeight: 1.4,
          }}>
            {data.description}
          </p>
        )}

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', marginBottom: '0.625rem' }} />

        {/* Metadata rows */}
        {metaRows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
            {metaRows.map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--text-tertiary)',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.03em',
                  textAlign: 'right',
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : firstSentence ? (
          <p style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            fontWeight: 300,
            marginBottom: '0.75rem',
          }}>
            {firstSentence}
          </p>
        ) : null}

        {/* Wikipedia link */}
        <a
          href={`https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
            textDecoration: 'none',
          }}
        >
          Wikipedia →
        </a>
      </div>
    </div>
  )
}
