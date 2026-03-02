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

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December'

function parseMetaRows(extract: string): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = []

  // Born: handles "born 19 April 1939", "born April 19, 1939", "born in 1939", "born 1939", "(born 1939)"
  const bornMatch = extract.match(
    new RegExp(
      `(?:born|b\\.)\\s*(?:on\\s+)?(?:in\\s+)?(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}|(?:${MONTHS})\\s+\\d{1,2},?\\s*\\d{4}|\\d{4})`,
      'i'
    )
  )
  if (bornMatch) rows.push({ label: 'Born', value: bornMatch[1] })

  // Died
  const diedMatch = extract.match(
    new RegExp(
      `(?:died|d\\.)\\s*(?:on\\s+)?(?:in\\s+)?(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}|(?:${MONTHS})\\s+\\d{1,2},?\\s*\\d{4}|\\d{4})`,
      'i'
    )
  )
  if (diedMatch) rows.push({ label: 'Died', value: diedMatch[1] })

  // Nationality
  const natMatch = extract.match(
    /\b(American|British|French|German|Iranian|Chinese|Indian|Russian|Japanese|Italian|Spanish|Australian|Brazilian|Canadian|Pakistani|Egyptian|Turkish|Korean|Dutch|Swedish|Norwegian|Swiss|Austrian|Polish|Israeli|Thai|Indonesian|Bangladeshi|Afghan|Iraqi|Syrian|Sudanese|Ethiopian|Kenyan|Ghanaian|South African|Argentinian|Chilean|Colombian|Mexican|Venezuelan|Algerian|Moroccan|Libyan|Tunisian|Saudi|Emirati|Qatari|Kuwaiti|Yemeni|Lebanese|Jordanian|Palestinian|Azerbaijani|Georgian|Armenian|Ukrainian|Romanian|Hungarian|Czech|Slovak|Croatian|Serbian|Greek|Portuguese|Belgian|Finnish|Danish|New Zealand)\b/
  )
  if (natMatch) rows.push({ label: 'Nationality', value: natMatch[1] })

  return rows
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

  return (
    <div className="wiki-info-box">

      {/* ── Image column ── */}
      <div className="wiki-img-col">
        <img
          src={imgSrc}
          alt={data.title}
          onError={() => setImgError(true)}
        />
      </div>

      {/* ── Info column ── */}
      <div className="wiki-info-col">

        {/* Name */}
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '15px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          marginBottom: '0.25rem',
        }}>
          {data.title}
        </p>

        {/* Role / Description */}
        {data.description && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            fontWeight: 500,
            marginBottom: '0.625rem',
            lineHeight: 1.4,
          }}>
            {data.description}
          </p>
        )}

        {/* Separator */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '0.5rem' }} />

        {/* Metadata rows */}
        {metaRows.length > 0 ? (
          <div>
            {metaRows.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                  padding: '0.4rem 0',
                  borderBottom: i < metaRows.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  textAlign: 'right',
                  fontWeight: 300,
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : data.extract ? (
          <p style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            fontWeight: 300,
          }}>
            {data.extract.match(/[^.!?]+[.!?]+/)?.[0]?.trim() ?? ''}
          </p>
        ) : null}

      </div>
    </div>
  )
}
