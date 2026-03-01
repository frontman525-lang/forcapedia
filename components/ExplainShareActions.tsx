'use client'

import { useState } from 'react'

interface ExplainShareActionsProps {
  url: string
  explanation: string
}

export default function ExplainShareActions({ url, explanation }: ExplainShareActionsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = () => {
    const shareText = `Check out this AI explanation on Forcapedia: ${url}`
    if (navigator.share) {
      navigator.share({ title: 'Forcapedia Explanation', text: shareText, url }).catch(() => null)
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
    }
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <button
        onClick={handleCopy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.55rem 1.1rem',
          background: copied ? 'rgba(34,197,94,0.08)' : 'transparent',
          border: copied ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border)',
          borderRadius: '100px',
          color: copied ? '#22c55e' : 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
        {copied ? 'Link copied!' : 'Copy link'}
      </button>

      <button
        onClick={handleShare}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.55rem 1.1rem',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '100px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
        </svg>
        Share
      </button>
    </div>
  )
}
