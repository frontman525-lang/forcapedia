'use client'

import { useEffect, useState } from 'react'

interface WikiSummary {
  title: string
  description?: string
  extract?: string
  thumbnail?: { source: string; width: number; height: number }
  type?: string
}

interface WikiInfoBoxProps {
  wikiUrl?: string | null
  articleTitle: string
}

/** Parse up to 3 key/value lines from a Wikipedia extract. */
function parseMetaRows(extract: string): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []

  // Born: look for "born [date]" or "born on [date]"
  const bornMatch = extract.match(/born\s+(?:on\s+)?([A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]+ \d{4})/i)
  if (bornMatch) rows.push({ label: 'Born', value: bornMatch[1] })

  // Died
  const diedMatch = extract.match(/died\s+(?:on\s+)?([A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]+ \d{4})/i)
  if (diedMatch) rows.push({ label: 'Died', value: diedMatch[1] })

  // Nationality: look for "X–nationality–" patterns
  const natMatch = extract.match(/\b(American|British|French|German|Iranian|Chinese|Indian|Russian|Japanese|Italian|Spanish|Australian|Brazilian|Canadian)\b/)
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

  // First two sentences from extract as short descriptor
  const sentences = data.extract?.match(/[^.!?]+[.!?]+/g) ?? []
  const shortExtract = sentences.slice(0, 2).join(' ').trim()

  const metaRows = data.extract ? parseMetaRows(data.extract) : []

  return (
    <div
      className="wiki-info-box"
      style={{
        display: 'flex',
        gap: '1.25rem',
        alignItems: 'flex-start',
        padding: '1.25rem',
        marginBottom: '2rem',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        flexWrap: 'wrap',
      }}
    >
      {/* Image */}
      <img
        src={data.thumbnail.source}
        alt={data.title}
        onError={() => setImgError(true)}
        style={{
          width: 100,
          height: 120,
          objectFit: 'cover',
          objectPosition: 'top',
          borderRadius: '10px',
          flexShrink: 0,
          display: 'block',
        }}
      />

      {/* Info */}
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        {/* Name */}
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.1rem',
          fontWeight: 400,
          color: 'var(--text-primary)',
          marginBottom: '0.2rem',
          lineHeight: 1.25,
        }}>
          {data.title}
        </p>

        {/* Profession/role */}
        {data.description && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            marginBottom: '0.625rem',
          }}>
            {data.description}
          </p>
        )}

        {/* Metadata rows */}
        {metaRows.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: '0.75rem',
            rowGap: '0.2rem',
            marginBottom: '0.625rem',
          }}>
            {metaRows.map(row => (
              <>
                <span key={`l-${row.label}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                  {row.label}
                </span>
                <span key={`v-${row.label}`} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                  {row.value}
                </span>
              </>
            ))}
          </div>
        )}

        {/* Short extract */}
        {shortExtract && metaRows.length === 0 && (
          <p style={{
            fontSize: '12.5px',
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
            fontWeight: 300,
            marginBottom: '0.5rem',
          }}>
            {shortExtract}
          </p>
        )}

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
