'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface HelpfulButtonProps {
  articleSlug: string
}

export default function HelpfulButton({ articleSlug }: HelpfulButtonProps) {
  const [count, setCount] = useState(0)
  const [voted, setVoted] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [showSignInHint, setShowSignInHint] = useState(false)

  const fetchVotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/votes/${articleSlug}`)
      const data = await res.json()
      setCount(data.count ?? 0)
      setVoted(data.voted ?? false)
    } catch { /* ignore network errors */ } finally {
      setLoaded(true)
    }
  }, [articleSlug])

  useEffect(() => {
    fetchVotes()

    // Realtime subscription — updates the count whenever any user votes/unvotes
    const supabase = createClient()
    const channel = supabase
      .channel(`votes:${articleSlug}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'article_votes',
          filter: `article_slug=eq.${articleSlug}`,
        },
        () => fetchVotes(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [articleSlug, fetchVotes])

  const handleVote = async () => {
    if (toggling) return
    setToggling(true)

    // Optimistic update for instant feedback
    const wasVoted = voted
    setVoted(!wasVoted)
    setCount(prev => wasVoted ? prev - 1 : prev + 1)

    try {
      const res = await fetch(`/api/votes/${articleSlug}`, { method: 'POST' })

      if (res.status === 401) {
        // Not logged in — revert optimistic update, show inline hint
        setVoted(wasVoted)
        setCount(prev => wasVoted ? prev + 1 : prev - 1)
        setShowSignInHint(true)
        setTimeout(() => setShowSignInHint(false), 4000)
        return
      }

      const data = await res.json()
      // Sync with server's authoritative count
      setCount(data.count ?? 0)
      setVoted(data.voted ?? false)
    } catch {
      // Revert on network error
      setVoted(wasVoted)
      setCount(prev => wasVoted ? prev + 1 : prev - 1)
    } finally {
      setToggling(false)
    }
  }

  if (!loaded) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        padding: '1.25rem 0',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        margin: '2.5rem 0',
      }}
    >
      <button
        onClick={handleVote}
        disabled={toggling}
        aria-label={voted ? 'Remove helpful vote' : 'Mark as helpful'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '7px 18px',
          border: voted ? '1px solid var(--border-gold)' : '1px solid var(--border)',
          borderRadius: '100px',
          background: voted ? 'var(--gold-dim)' : 'transparent',
          color: voted ? 'var(--gold)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          letterSpacing: '0.06em',
          cursor: toggling ? 'default' : 'pointer',
          transition: 'all 0.2s',
          opacity: toggling ? 0.7 : 1,
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!voted && !toggling) {
            e.currentTarget.style.borderColor = 'var(--border-gold)'
            e.currentTarget.style.color = 'var(--gold)'
          }
        }}
        onMouseLeave={e => {
          if (!voted) {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }
        }}
      >
        {/* Heart icon — filled when voted */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill={voted ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'fill 0.2s' }}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {voted ? 'Helpful!' : 'Helpful?'}
      </button>

      {showSignInHint ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <a href="/auth" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Sign in</a>
          {' '}to vote
        </span>
      ) : count > 0 ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.04em',
          }}
        >
          {count.toLocaleString()}{' '}
          {count === 1 ? 'student found this helpful' : 'students found this helpful'}
        </span>
      ) : null}
    </div>
  )
}
