'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAlert } from './Alert'

type Mode = 'simple' | 'eli10'

interface SelectionState {
  text: string
  toolbarX: number // viewport X centre (fixed positioning)
  toolbarY: number // viewport Y (top of toolbar)
  positionAbove: boolean // true = toolbar above selection, false = below
  wordCount: number
}

interface UsageInfo {
  used: number
  limit: number
}

interface ExplainPanelProps {
  articleSlug: string
  contentRef: React.RefObject<HTMLDivElement | null>
}

const MAX_WORDS = 500

export default function ExplainPanel({ articleSlug, contentRef }: ExplainPanelProps) {
  const { showAlert } = useAlert()

  // ── Selection state ──────────────────────────────────────────────────────
  const [selection, setSelection] = useState<SelectionState | null>(null)

  // ── Panel state ──────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('simple')
  const [currentText, setCurrentText] = useState('')
  const [explanation, setExplanation] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false) // for CSS transition
  const [isSharing, setIsSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [toolbarCopied, setToolbarCopied] = useState(false)

  const explanationRef = useRef<HTMLDivElement>(null)
  // Track whether a pointer (mouse/touch) is currently held down to suppress
  // selectionchange events during drag (prevents toolbar flicker).
  const pointerDownRef = useRef(false)
  const selectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Timestamp of the last explain call — enforces 10-second client-side cooldown
  const lastExplainRef = useRef<number>(0)

  // ── Mobile detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Panel open/close transition ──────────────────────────────────────────
  useEffect(() => {
    if (panelOpen) {
      requestAnimationFrame(() => setPanelVisible(true))
    } else {
      setPanelVisible(false)
    }
  }, [panelOpen])

  // ── Prevent body scroll on mobile when sheet is open ─────────────────────
  useEffect(() => {
    if (panelOpen && isMobile) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [panelOpen, isMobile])

  // ── Auto-scroll explanation to bottom as tokens arrive ───────────────────
  useEffect(() => {
    if (explanationRef.current && isLoading) {
      explanationRef.current.scrollTop = explanationRef.current.scrollHeight
    }
  }, [explanation, isLoading])

  // ── Text selection detection ─────────────────────────────────────────────
  useEffect(() => {
    const TOOLBAR_H = 44 // approximate toolbar height in px
    const MARGIN = 10

    const checkSelection = () => {
      // Never interfere while the explain panel is open
      if (panelOpen) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setSelection(null)
        return
      }

      const text = sel.toString().trim()
      if (text.length < 10) {
        setSelection(null)
        return
      }

      // Only allow if the selection STARTS (or has its ancestor) inside the article body.
      // startContainer check is more reliable than commonAncestorContainer for long
      // cross-section selections where the ancestor rises above contentRef.
      if (contentRef.current) {
        const range = sel.getRangeAt(0)
        const startIn = contentRef.current.contains(range.startContainer)
        const ancestorIn = contentRef.current.contains(range.commonAncestorContainer)
        if (!startIn && !ancestorIn) {
          setSelection(null)
          return
        }
      }

      const range = sel.getRangeAt(0)
      const rects = range.getClientRects()
      if (!rects.length) {
        setSelection(null)
        return
      }

      const firstRect = rects[0]
      const lastRect = rects[rects.length - 1]

      // Smart positioning: prefer below selection end; fall back to above start
      // if there isn't enough room below.
      const spaceBelow = window.innerHeight - lastRect.bottom
      const positionAbove = spaceBelow < TOOLBAR_H + MARGIN + 8

      const toolbarY = positionAbove
        ? Math.max(MARGIN, firstRect.top - TOOLBAR_H - MARGIN)
        : lastRect.bottom + MARGIN

      // Centre the toolbar around the end of the last selection rect, clamped
      const toolbarX = Math.max(80, Math.min(window.innerWidth - 80, lastRect.right - 60))

      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length

      setSelection({ text, toolbarX, toolbarY, positionAbove, wordCount })
    }

    // ── Event handlers ───────────────────────────────────────────────────────
    const onPointerDown = () => {
      pointerDownRef.current = true
      if (selectionDebounceRef.current) {
        clearTimeout(selectionDebounceRef.current)
        selectionDebounceRef.current = null
      }
    }

    // Fires when the user finishes a mouse/touch drag — most reliable trigger.
    const onPointerUp = () => {
      pointerDownRef.current = false
      // Short delay lets the browser finalise the selection range.
      setTimeout(checkSelection, 20)
    }

    // iOS Safari: when text is selected via long-press, the browser intercepts
    // the touch for selection handles and pointerup may not fire. pointerDownRef
    // then stays true forever, silencing selectionchange. touchend is more
    // reliable on iOS for signalling the end of a touch interaction.
    const onTouchEnd = () => {
      pointerDownRef.current = false
      // Longer delay: iOS needs ~80ms to finalise the selection range after
      // the user lifts their finger from a long-press text selection.
      setTimeout(checkSelection, 80)
    }

    // On touch devices (iOS/Android), selectionchange is the primary and most
    // reliable signal. We must NOT skip it based on pointerDownRef because
    // pointerup often fires before the selection handles are done moving.
    // On desktop (mouse), we still skip during drag to prevent toolbar flicker.
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    const onSelectionChange = () => {
      if (pointerDownRef.current && !isTouch) return
      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current)
      // Touch needs a longer debounce — the user may still be dragging handles
      selectionDebounceRef.current = setTimeout(checkSelection, isTouch ? 350 : 120)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('selectionchange', onSelectionChange)
      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current)
    }
  }, [contentRef, panelOpen])

  // ── ESC closes panel ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core explain function ─────────────────────────────────────────────────
  const runExplain = useCallback(async (text: string, explainMode: Mode) => {
    // Client-side 10-second cooldown gate (server enforces this too)
    const COOLDOWN_MS = 10_000
    const elapsed = Date.now() - lastExplainRef.current
    if (lastExplainRef.current > 0 && elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
      showAlert(`Wait ${remaining}s before explaining again.`, 'error')
      return
    }
    lastExplainRef.current = Date.now()

    setCurrentText(text)
    setMode(explainMode)
    setExplanation('')
    setError(null)
    setUsage(null)
    setShareUrl(null)
    setLinkCopied(false)
    setPanelOpen(true)
    setIsLoading(true)
    setSelection(null)
    window.getSelection()?.removeAllRanges()

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode: explainMode, articleSlug }),
      })

      if (res.status === 401) {
        setError('Sign in to use Explain.')
        return
      }
      if (res.status === 429) {
        const data = await res.json()
        if (typeof data.used === 'number') {
          // Daily limit hit
          setError(`Daily limit reached (${data.used}/${data.limit} used today). ${data.tier === 'free' ? 'Upgrade for more.' : 'Resets tomorrow.'}`)
        } else {
          // Cooldown or other rate limit
          setError(data.error ?? 'Too many requests. Please wait.')
        }
        return
      }
      if (!res.ok) {
        setError('Failed to generate. Please try again.')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'usage') {
              setUsage({ used: parsed.used, limit: parsed.limit })
            } else if (parsed.type === 'token' && parsed.token) {
              accumulated += parsed.token
              setExplanation(accumulated)
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [articleSlug])

  const handleExplainButton = (selectedMode: Mode) => {
    if (!selection) return
    if (selection.wordCount > MAX_WORDS) {
      showAlert(`Please select fewer than ${MAX_WORDS} words to explain.`, 'error')
      return
    }
    runExplain(selection.text, selectedMode)
  }

  const handleModeSwitch = (newMode: Mode) => {
    if (newMode === mode || isLoading || !currentText) return
    runExplain(currentText, newMode)
  }

  const handleToolbarCopy = () => {
    if (!selection) return
    navigator.clipboard.writeText(selection.text).catch(() => null)
    setToolbarCopied(true)
    setTimeout(() => setToolbarCopied(false), 1800)
  }

  // ── Create share link (returns the URL, caches it in state) ─────────────
  const createShareLink = async (): Promise<string | null> => {
    if (shareUrl) return shareUrl
    if (!explanation || isLoading) return null
    setIsSharing(true)
    try {
      const res = await fetch('/api/explain/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentText, explanation, mode, articleSlug }),
      })
      if (res.status === 401) {
        showAlert('Sign in to share an explanation.', 'error')
        return null
      }
      const data = await res.json()
      if (!data.hash) {
        showAlert('Could not create share link. Try again.', 'error')
        return null
      }
      const url = `${window.location.origin}/explain/${data.hash}`
      setShareUrl(url)
      return url
    } catch {
      showAlert('Could not create share link.', 'error')
      return null
    } finally {
      setIsSharing(false)
    }
  }

  // Copy link — one tap
  const handleCopyLink = async () => {
    const url = await createShareLink()
    if (!url) return
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  // Share — prefilled native share or WhatsApp fallback
  const handleShare = async () => {
    const url = await createShareLink()
    if (!url) return
    const shareText = `Check out this AI explanation on Forcapedia: ${url}`
    if (navigator.share) {
      await navigator.share({ title: 'Forcapedia Explanation', text: shareText, url }).catch(() => null)
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
    }
  }

  const closePanel = () => {
    setPanelOpen(false)
    setExplanation('')
    setError(null)
    setCurrentText('')
    setUsage(null)
    setShareUrl(null)
    setLinkCopied(false)
  }

  // ── Shared panel content ─────────────────────────────────────────────────
  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--gold)', fontSize: '14px' }}>✦</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}>
            Explain
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Mode toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--ink-2)',
            border: '1px solid var(--border)',
            borderRadius: '100px',
            padding: '2px',
            gap: '2px',
          }}>
            {(['simple', 'eli10'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => handleModeSwitch(m)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '100px',
                  border: 'none',
                  background: mode === m ? 'var(--gold-dim)' : 'transparent',
                  color: mode === m ? 'var(--gold)' : 'var(--text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: isLoading ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                  opacity: isLoading && mode !== m ? 0.4 : 1,
                }}
              >
                {m === 'eli10' ? 'For Kids' : 'Simple'}
              </button>
            ))}
          </div>

          {/* Close */}
          <button
            onClick={closePanel}
            style={{
              width: '30px', height: '30px',
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--border-gold)'
              e.currentTarget.style.color = 'var(--gold)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-tertiary)'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Quoted text */}
      <div style={{
        padding: '0.875rem 1.25rem',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <p style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          lineHeight: 1.55,
          fontStyle: 'italic',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          &ldquo;{currentText}&rdquo;
        </p>
      </div>

      {/* Explanation area */}
      <div
        ref={explanationRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          scrollbarWidth: 'thin',
        }}
      >
        {isLoading && !explanation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[80, 65, 90, 55, 75].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: '13px', width: `${w}%` }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            background: 'rgba(244,124,124,0.08)',
            border: '1px solid rgba(244,124,124,0.2)',
            borderRadius: '10px',
            fontSize: '13px',
            color: 'var(--red)',
            lineHeight: 1.6,
          }}>
            {error}
            {error.includes('Sign in') && (
              <a href="/auth" style={{ color: 'var(--gold)', marginLeft: '0.5rem', textDecoration: 'underline' }}>
                Sign in →
              </a>
            )}
          </div>
        )}

        {explanation && (
          <p style={{
            fontSize: '14.5px',
            color: 'var(--text-primary)',
            lineHeight: 1.85,
            fontWeight: 300,
            whiteSpace: 'pre-wrap',
          }}>
            {explanation}
            {isLoading && (
              <span style={{
                display: 'inline-block',
                width: '2px',
                height: '14px',
                background: 'var(--gold)',
                marginLeft: '2px',
                verticalAlign: 'middle',
                animation: 'pulseGold 0.8s ease-in-out infinite',
              }} />
            )}
          </p>
        )}
      </div>

      {/* Footer: share + usage */}
      {!error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.875rem 1.25rem',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          gap: '0.5rem',
          paddingBottom: isMobile ? 'calc(0.875rem + env(safe-area-inset-bottom, 0px))' : '0.875rem',
        }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              disabled={!explanation || isLoading || isSharing}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '5px 12px',
                border: '1px solid var(--border)',
                borderRadius: '100px',
                background: linkCopied ? 'rgba(34,197,94,0.08)' : 'transparent',
                color: linkCopied ? '#22c55e' : 'var(--text-secondary)',
                borderColor: linkCopied ? 'rgba(34,197,94,0.4)' : 'var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.06em',
                cursor: !explanation || isLoading || isSharing ? 'default' : 'pointer',
                opacity: !explanation || isLoading || isSharing ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (explanation && !isLoading && !isSharing && !linkCopied) {
                  e.currentTarget.style.borderColor = 'var(--border-gold)'
                  e.currentTarget.style.color = 'var(--gold)'
                }
              }}
              onMouseLeave={e => {
                if (!linkCopied) {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              {linkCopied ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
              {linkCopied ? 'Copied!' : 'Copy link'}
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              disabled={!explanation || isLoading || isSharing}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '5px 12px',
                border: '1px solid var(--border)',
                borderRadius: '100px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.06em',
                cursor: !explanation || isLoading || isSharing ? 'default' : 'pointer',
                opacity: !explanation || isLoading || isSharing ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (explanation && !isLoading && !isSharing) {
                  e.currentTarget.style.borderColor = 'var(--border-gold)'
                  e.currentTarget.style.color = 'var(--gold)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
              </svg>
              {isSharing ? 'Sharing…' : 'Share'}
            </button>
          </div>

          {/* Usage counter */}
          {usage && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}>
              {usage.used}/{usage.limit} today
            </span>
          )}
        </div>
      )}
    </div>
  )

  // ── Toolbar buttons (shared between desktop and mobile bar) ──────────────
  const tooLong = (selection?.wordCount ?? 0) > MAX_WORDS

  return (
    <>
      {/* ── Desktop: floating toolbar near selection ──────────────────────── */}
      {selection && !panelOpen && !isMobile && (
        <div
          style={{
            position: 'fixed',
            left: `${selection.toolbarX}px`,
            top: `${selection.toolbarY}px`,
            transform: 'translateX(-50%)',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            background: 'var(--ink-3)',
            border: '1px solid var(--border)',
            borderRadius: '100px',
            padding: tooLong ? '6px 14px' : '4px',
            gap: '2px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.15s ease forwards',
          }}
        >
          {tooLong ? (
            /* Too-long state: show a hint, no explain buttons */
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}>
              Select fewer than {MAX_WORDS} words
            </span>
          ) : (
            /* Normal state: explain buttons */
            <>
              {(['simple', 'eli10'] as Mode[]).map((m, i) => (
                <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {i === 1 && (
                    <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
                  )}
                  <button
                    onMouseDown={e => e.preventDefault()} // keep text selection alive
                    onClick={() => handleExplainButton(m)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      padding: '5px 12px',
                      borderRadius: '100px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--gold-dim)'
                      e.currentTarget.style.color = 'var(--gold)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                  >
                    {i === 0 && <span style={{ fontSize: '10px', color: 'var(--gold)' }}>✦</span>}
                    {m === 'eli10' ? 'For Kids' : 'Simple'}
                  </button>
                </div>
              ))}

              {/* Copy separator + button */}
              <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={handleToolbarCopy}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  padding: '5px 12px',
                  borderRadius: '100px',
                  border: 'none',
                  background: toolbarCopied ? 'rgba(34,197,94,0.12)' : 'transparent',
                  color: toolbarCopied ? '#22c55e' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (!toolbarCopied) {
                    e.currentTarget.style.background = 'var(--gold-dim)'
                    e.currentTarget.style.color = 'var(--gold)'
                  }
                }}
                onMouseLeave={e => {
                  if (!toolbarCopied) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }
                }}
              >
                {toolbarCopied ? '✓ Copied' : 'Copy'}
              </button>
            </>
          )}

          {/* Arrow indicator: points toward the selected text */}
          <div style={{
            position: 'absolute',
            ...(selection.positionAbove
              ? { bottom: '-5px', borderTop: '5px solid var(--ink-3)', borderBottom: 'none' }
              : { top: '-5px', borderBottom: '5px solid var(--ink-3)', borderTop: 'none' }),
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
          }} />
        </div>
      )}

      {/* ── Mobile: floating pill above Android bottom chrome ─────────────── */}
      {selection && !panelOpen && isMobile && (
        <div
          style={{
            position: 'fixed',
            // 88px clears Android's nav bar + Google Tap-to-search suggestion bar
            bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9001,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'var(--ink-2)',
            border: '1px solid var(--border)',
            borderRadius: '100px',
            padding: tooLong ? '8px 18px' : '5px 7px 5px 12px',
            boxShadow: '0 6px 28px rgba(0,0,0,0.65)',
            animation: 'slideInFromBottom 0.18s ease forwards',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          {/* Gold spark + preview */}
          <span style={{ color: 'var(--gold)', fontSize: '10px', flexShrink: 0 }}>✦</span>
          {tooLong ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
              Select fewer than {MAX_WORDS} words
            </span>
          ) : (
            <>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginLeft: '3px',
                marginRight: '2px',
              }}>
                &ldquo;{selection.text.slice(0, 18)}{selection.text.length > 18 ? '…' : ''}&rdquo;
              </span>

              <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 3px', flexShrink: 0 }} />

              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleExplainButton('simple')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '100px',
                  border: '1px solid var(--border-gold)',
                  background: 'var(--gold-dim)',
                  color: 'var(--gold)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Simple
              </button>

              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleExplainButton('eli10')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '100px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                For Kids
              </button>

              <button
                onMouseDown={e => e.preventDefault()}
                onClick={handleToolbarCopy}
                style={{
                  padding: '6px 12px',
                  borderRadius: '100px',
                  border: toolbarCopied ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border)',
                  background: toolbarCopied ? 'rgba(34,197,94,0.08)' : 'transparent',
                  color: toolbarCopied ? '#22c55e' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {toolbarCopied ? '✓' : 'Copy'}
              </button>
            </>
          )}

          {/* Downward arrow — visually connects pill to selected text */}
          <div style={{
            position: 'absolute', bottom: '-6px', left: '50%',
            transform: 'translateX(-50%)',
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '6px solid var(--border)',
          }} />
          <div style={{
            position: 'absolute', bottom: '-5px', left: '50%',
            transform: 'translateX(-50%)',
            borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
            borderTop: '5px solid var(--ink-2)',
          }} />
        </div>
      )}

      {/* ── Backdrop (desktop only) ───────────────────────────────────────── */}
      {panelOpen && !isMobile && (
        <div
          onClick={closePanel}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 8998,
            animation: 'fadeInBackdrop 0.2s ease forwards',
          }}
        />
      )}

      {/* ── Mobile backdrop ───────────────────────────────────────────────── */}
      {panelOpen && isMobile && (
        <div
          onClick={closePanel}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 8998,
            animation: 'fadeInBackdrop 0.2s ease forwards',
          }}
        />
      )}

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div
          style={{
            position: 'fixed',
            zIndex: 8999,
            background: 'var(--ink-2)',
            overflow: 'hidden',
            ...(isMobile
              ? {
                  bottom: 0, left: 0, right: 0,
                  height: '78vh',
                  borderRadius: '20px 20px 0 0',
                  borderTop: '1px solid var(--border)',
                  transform: panelVisible ? 'translateY(0)' : 'translateY(100%)',
                  transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
                }
              : {
                  top: 0, right: 0, bottom: 0,
                  width: '380px',
                  maxWidth: '100vw',
                  borderLeft: '1px solid var(--border)',
                  transform: panelVisible ? 'translateX(0)' : 'translateX(100%)',
                  transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
                  boxShadow: '-16px 0 48px rgba(0,0,0,0.4)',
                }),
          }}
        >
          {/* Mobile drag handle */}
          {isMobile && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '10px 0 2px',
              flexShrink: 0,
            }}>
              <div style={{
                width: '36px', height: '4px',
                borderRadius: '2px',
                background: 'var(--border)',
              }} />
            </div>
          )}

          {panelContent}
        </div>
      )}
    </>
  )
}
