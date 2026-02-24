'use client'

import { useState, useEffect, useCallback } from 'react'

interface Topic {
  title: string
  category: string
}

const TOPICS: Topic[] = [
  { title: 'Quantum Computing', category: 'Technology' },
  { title: 'Ancient Rome', category: 'History' },
  { title: 'Space Exploration', category: 'Science' },
  { title: 'Neuroscience', category: 'Science' },
  { title: 'Artificial Intelligence', category: 'Technology' },
  { title: 'Philosophy of Mind', category: 'Philosophy' },
  { title: 'Climate Science', category: 'Environment' },
  { title: 'Geopolitics', category: 'Politics' },
  { title: 'Evolutionary Biology', category: 'Science' },
  { title: 'Macroeconomics', category: 'Finance' },
  { title: 'String Theory', category: 'Physics' },
  { title: 'Medieval History', category: 'History' },
  { title: 'Consciousness', category: 'Philosophy' },
  { title: 'Black Holes', category: 'Astronomy' },
  { title: 'Nuclear Fusion', category: 'Energy' },
  { title: 'Cryptography', category: 'Technology' },
  { title: 'CRISPR Gene Editing', category: 'Biology' },
  { title: 'Stoicism', category: 'Philosophy' },
  { title: 'Game Theory', category: 'Mathematics' },
  { title: 'Dark Matter', category: 'Physics' },
  { title: 'Ocean Ecosystems', category: 'Environment' },
  { title: 'Greek Mythology', category: 'History' },
  { title: 'Quantum Mechanics', category: 'Physics' },
  { title: 'The Renaissance', category: 'History' },
  { title: 'Machine Learning', category: 'Technology' },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CARD_HEIGHT = 62 // px — fixed height required for overflow clip
const ANIM_MS = 420   // must match CSS animation durations

export default function VerifiedCarousel() {
  // Start with the static order (SSR-safe), shuffle on the client after hydration
  const [topics, setTopics] = useState(TOPICS)
  const [active, setActive] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [animating, setAnimating] = useState(false)
  const [hovering, setHovering] = useState(false)
  const total = topics.length

  const advance = useCallback(() => {
    if (animating) return
    const next = (active + 1) % total
    setPrev(active)
    setActive(next)
    setAnimating(true)
    setTimeout(() => {
      setPrev(null)
      setAnimating(false)
    }, ANIM_MS)
  }, [animating, active, total])

  // Shuffle once on the client after hydration (avoids SSR mismatch)
  useEffect(() => {
    setTopics(shuffle(TOPICS))
  }, [])

  // Auto-advance every 4s, pauses on hover
  useEffect(() => {
    if (hovering) return
    const id = setInterval(advance, 4000)
    return () => clearInterval(id)
  }, [hovering, advance])

  const fireTopic = () => {
    window.dispatchEvent(
      new CustomEvent('forcapedia:topic', { detail: topics[active].title })
    )
  }

  const rowStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '0 1rem',
  }

  return (
    <div style={{ position: 'relative', width: 'min(440px, calc(100vw - 3rem))' }}>

      {/* Ghost cards — stacked depth */}
      <div style={{
        position: 'absolute',
        top: '10px', left: '6%', right: '6%',
        height: `${CARD_HEIGHT}px`,
        borderRadius: '14px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: 0.4, zIndex: 0,
      }} />
      <div style={{
        position: 'absolute',
        top: '5px', left: '3%', right: '3%',
        height: `${CARD_HEIGHT}px`,
        borderRadius: '14px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: 0.65, zIndex: 1,
      }} />

      {/* Main card */}
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={fireTopic}
        style={{
          position: 'relative',
          zIndex: 2,
          height: `${CARD_HEIGHT}px`,
          borderRadius: '14px',
          background: 'var(--glass-bg)',
          border: `1px solid ${hovering ? 'var(--border-gold)' : 'var(--border)'}`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: hovering
            ? '0 8px 32px rgba(0,0,0,0.35), 0 0 20px rgba(201,169,110,0.06)'
            : '0 4px 20px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          overflow: 'hidden', // clips the vertical animation
          transform: hovering ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        }}
      >
        {/* Exiting row — slides up and fades out */}
        {prev !== null && (
          <div
            style={{
              ...rowStyle,
              animation: `cardExitUp ${ANIM_MS}ms ease forwards`,
            }}
          >
            <CardInner topic={topics[prev]} hovering={false} />
          </div>
        )}

        {/* Entering row — rises from below */}
        <div
          style={{
            ...rowStyle,
            animation: animating
              ? `cardEnterFromBelow ${ANIM_MS}ms ease forwards`
              : 'none',
          }}
        >
          <CardInner topic={topics[active]} hovering={hovering} />
        </div>
      </div>
    </div>
  )
}

function CardInner({ topic, hovering }: { topic: Topic; hovering: boolean }) {
  return (
    <>
      {/* Gold accent dot */}
      <div style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: 'var(--gold)',
        flexShrink: 0,
        opacity: hovering ? 1 : 0.6,
        transition: 'opacity 0.2s',
      }} />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          display: 'block',
          marginBottom: '3px',
        }}>
          {topic.category}
        </span>
        <p style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          margin: 0,
          lineHeight: 1.4,
        }}>
          {topic.title}
        </p>
      </div>

      {/* Search icon */}
      <svg
        width="13" height="13" viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{
          flexShrink: 0,
          color: hovering ? 'var(--gold)' : 'var(--text-tertiary)',
          transition: 'color 0.2s',
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </>
  )
}
