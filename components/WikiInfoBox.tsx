'use client'

import { useEffect, useState } from 'react'

interface WikiSummary {
  title: string
  description?: string
  extract?: string
  thumbnail?: { source: string; width: number; height: number }
  type?: string // 'standard' | 'disambiguation' | 'no-extract'
}

interface WikiInfoBoxProps {
  wikiUrl?: string | null
  articleTitle: string
}

export default function WikiInfoBox({ wikiUrl, articleTitle }: WikiInfoBoxProps) {
  const [data, setData] = useState<WikiSummary | null>(null)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    // Extract title from wiki URL or fall back to article title
    let wikiTitle = articleTitle
    if (wikiUrl) {
      const match = wikiUrl.match(/\/wiki\/([^#?]+)/)
      if (match) wikiTitle = decodeURIComponent(match[1].replace(/_/g, ' '))
    }

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`, {
      headers: { 'Accept': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then((d: WikiSummary | null) => {
        // Only show box if there's a thumbnail (persons, species, notable entities)
        if (d && d.thumbnail && d.type !== 'disambiguation') {
          setData(d)
        }
      })
      .catch(() => null)
  }, [wikiUrl, articleTitle])

  if (!data || !data.thumbnail || imgError) return null

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const extract = data.extract
    ? data.extract.replace(/^[^.]+\.\s*/, '').slice(0, 220).trimEnd() + '…'
    : null

  return (
    <div
      style={{
        display: 'flex',
        gap: '1.25rem',
        alignItems: 'flex-start',
        padding: '1.25rem',
        marginBottom: '2rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        flexDirection: isMobile ? 'column' : 'row',
      }}
    >
      {/* Image */}
      <img
        src={data.thumbnail.source}
        alt={data.title}
        onError={() => setImgError(true)}
        style={{
          width: isMobile ? '100%' : 112,
          height: isMobile ? 'auto' : 140,
          objectFit: 'cover',
          borderRadius: '10px',
          flexShrink: 0,
          display: 'block',
          maxWidth: isMobile ? 200 : undefined,
        }}
      />

      {/* Info */}
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.05rem',
            fontWeight: 400,
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
            lineHeight: 1.3,
          }}
        >
          {data.title}
        </p>

        {data.description && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: '0.6rem',
            }}
          >
            {data.description}
          </p>
        )}

        {extract && (
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              fontWeight: 300,
            }}
          >
            {extract}
          </p>
        )}

        <a
          href={`https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: '0.6rem',
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
