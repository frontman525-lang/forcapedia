'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HistoryItem {
  article_slug: string
  article_title: string
  article_category: string
}

export default function ContinueLearning() {
  const [pills, setPills] = useState<HistoryItem[]>([])

  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(d => {
        const all: HistoryItem[] = d.items ?? []
        if (all.length === 0) return

        const last = all[0]
        // Related: same category first, else next most recent
        const related =
          all.slice(1).find(i => i.article_category === last.article_category) ??
          all[1] ??
          null

        setPills(related ? [last, related] : [last])
      })
      .catch(() => {})
  }, [])

  if (pills.length === 0) return null

  return (
    <div
      style={{
        width: '100%',
        marginTop: '1.25rem',
        // Pure opacity fade only — no Y movement — layout above never shifts
        opacity: 0,
        animation: 'fadeIn 0.45s 0.1s ease both',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginBottom: '0.55rem',
          paddingLeft: '2px',
        }}
      >
        ↩ Continue learning
      </p>

      {/* Two round pills side by side — original style */}
      <div
        style={{
          display: 'flex',
          gap: '0.45rem',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: '2px',
        }}
      >
        {pills.map(item => (
          <Pill key={item.article_slug} item={item} />
        ))}
      </div>
    </div>
  )
}

function Pill({ item }: { item: HistoryItem }) {
  return (
    <Link
      href={`/article/${item.article_slug}`}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: '100px',
        textDecoration: 'none',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        maxWidth: '220px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        transition: 'border-color 0.18s, color 0.18s, background 0.18s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-gold)'
        e.currentTarget.style.color       = 'var(--gold)'
        e.currentTarget.style.background  = 'var(--gold-glow)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color       = 'var(--text-secondary)'
        e.currentTarget.style.background  = 'rgba(255,255,255,0.03)'
      }}
    >
      {item.article_title}
    </Link>
  )
}
