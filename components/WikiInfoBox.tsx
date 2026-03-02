'use client'

import { useEffect, useState } from 'react'

interface WikiSummary {
  title: string
  description?: string
  thumbnail?: { source: string; width: number; height: number }
  originalimage?: { source: string; width: number; height: number }
  type?: string
}

interface InfoRow { label: string; value: string }

interface WikiInfoBoxProps {
  wikiUrl?: string | null
  articleTitle: string
}

async function fetchInfoboxRows(wikiTitle: string): Promise<InfoRow[]> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=parse&format=json&origin=*` +
      `&page=${encodeURIComponent(wikiTitle)}&prop=text&section=0`
    )
    if (!res.ok) return []
    const json = await res.json()
    const html: string = json?.parse?.text?.['*'] ?? ''
    if (!html) return []

    const doc = new DOMParser().parseFromString(html, 'text/html')
    const infobox = doc.querySelector('table.infobox')
    if (!infobox) return []

    const rows: InfoRow[] = []
    for (const tr of Array.from(infobox.querySelectorAll('tr'))) {
      const th = tr.querySelector('th')
      const td = tr.querySelector('td')
      if (!th || !td) continue
      const label = th.textContent?.trim() ?? ''
      const value = td.textContent
        ?.trim()
        .replace(/\[\d+\]/g, '')
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        ?? ''
      if (label && value && label.length < 50 && value.length < 150) {
        rows.push({ label, value })
      }
    }
    return rows.slice(0, 8)
  } catch {
    return []
  }
}

export default function WikiInfoBox({ wikiUrl, articleTitle }: WikiInfoBoxProps) {
  const [summary, setSummary] = useState<WikiSummary | null>(null)
  const [rows, setRows] = useState<InfoRow[]>([])
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
        if (d && d.thumbnail && d.type !== 'disambiguation') setSummary(d)
      })
      .catch(() => null)

    fetchInfoboxRows(wikiTitle).then(setRows)
  }, [wikiUrl, articleTitle])

  if (!summary || !summary.thumbnail || imgError) return null

  const imgSrc = summary.thumbnail.source

  return (
    <div className="wiki-info-box">

      {/* Full-width image — natural aspect ratio, no cropping */}
      <div className="wiki-img-col">
        <img
          src={imgSrc}
          alt={summary.title}
          onError={() => setImgError(true)}
        />
      </div>

      {/* Info panel */}
      <div className="wiki-info-col">

        {/* Caption */}
        <p style={{
          fontSize: '12px',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
          lineHeight: 1.4,
          marginBottom: '0.5rem',
          textAlign: 'center',
        }}>
          {summary.title}{summary.description ? `, ${summary.description}` : ''}
        </p>

        {/* Role header */}
        {summary.description && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            marginBottom: '0.625rem',
            lineHeight: 1.4,
          }}>
            {summary.description}
          </p>
        )}

        {/* Separator */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '0.5rem' }} />

        {/* Infobox rows from Wikipedia */}
        {rows.map((row, i) => (
          <div
            key={row.label + i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem',
              padding: '0.4rem 0',
              borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11.5px',
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
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
            }}>
              {row.value}
            </span>
          </div>
        ))}

      </div>
    </div>
  )
}
