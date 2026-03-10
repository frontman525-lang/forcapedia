'use client'

// ── Premium Badge System ───────────────────────────────────────────────────────
// PUBG-style corner marker badges. Each badge is a small SVG pinned at the
// bottom-right of the avatar. Tier 1 = solid circle + icon.
// Tier 2 = shield/gem shape + glow filter + icon.

const TIER2 = new Set(['researcher', 'diamond', 'explorer', 'elite', 'legend'])

function shieldPath() {
  return 'M10,1.5 L17.5,5 L17.5,12 C17.5,15.5 10,18.5 10,18.5 C10,18.5 2.5,15.5 2.5,12 L2.5,5 Z'
}

function hexPath() {
  return 'M10,2 L17,5.5 L17,13.5 L10,17 L3,13.5 L3,5.5 Z'
}

export function BadgeSVG({ badge, size }: { badge: string; size: number }) {
  const isTier2 = TIER2.has(badge)
  const uid     = `b${badge}`   // unique id prefix for SVG filters/gradients

  // ── icon paths ───────────────────────────────────────────────────────────────
  function Icon() {
    switch (badge) {
      case 'scholar':
        return (
          <>
            <polygon points="10,6 14,8.5 10,11 6,8.5" fill="white" opacity={0.95} />
            <line x1="6" y1="8.5" x2="14" y2="8.5" stroke="white" strokeWidth="1.1" />
            <line x1="14" y1="8.5" x2="14" y2="12.2" stroke="white" strokeWidth="1.1" />
            <circle cx="14" cy="12.8" r="0.9" fill="white" />
          </>
        )
      case 'star':
        return (
          <polygon
            points="10,3.5 11.6,8.2 16.5,8.2 12.4,11 14,15.8 10,13 6,15.8 7.6,11 3.5,8.2 8.4,8.2"
            fill="white" opacity={0.95}
          />
        )
      case 'science':
        return (
          <>
            <circle cx="10" cy="10" r="1.5" fill="white" opacity={0.95} />
            <ellipse cx="10" cy="10" rx="5.5" ry="2.5" fill="none" stroke="white" strokeWidth="1.1" opacity={0.85} />
            <ellipse cx="10" cy="10" rx="5.5" ry="2.5" fill="none" stroke="white" strokeWidth="1.1" opacity={0.85} transform="rotate(60 10 10)" />
            <ellipse cx="10" cy="10" rx="5.5" ry="2.5" fill="none" stroke="white" strokeWidth="1.1" opacity={0.85} transform="rotate(-60 10 10)" />
          </>
        )
      case 'bookworm':
        return (
          <>
            <path d="M4.5,6.5 L10,7.5 L10,14.5 L4.5,13.5 Z" fill="white" opacity={0.9} />
            <path d="M10,7.5 L15.5,6.5 L15.5,13.5 L10,14.5 Z" fill="white" opacity={0.65} />
            <line x1="10" y1="7.5" x2="10" y2="14.5" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
          </>
        )
      case 'researcher':
        return (
          <>
            <path d="M5.5,13 L5.5,9 L7.8,11 L10,6.5 L12.2,11 L14.5,9 L14.5,13 Z" fill="white" opacity={0.95} />
            <rect x="5.5" y="13" width="9" height="1.5" rx="0.75" fill="white" opacity={0.9} />
          </>
        )
      case 'diamond':
        return (
          <>
            <path d="M10,3 L15.5,9 L10,17 L4.5,9 Z" fill="white" opacity={0.15} />
            <path d="M10,3 L15.5,9 L10,17 L4.5,9 Z" fill="none" stroke="white" strokeWidth="1.3" opacity={0.9} />
            <line x1="4.5" y1="9" x2="15.5" y2="9" stroke="white" strokeWidth="0.8" opacity={0.55} />
            <line x1="10" y1="3" x2="7" y2="9" stroke="white" strokeWidth="0.7" opacity={0.35} />
            <line x1="10" y1="3" x2="13" y2="9" stroke="white" strokeWidth="0.7" opacity={0.35} />
          </>
        )
      case 'explorer':
        return (
          <>
            <path d="M10,5.5 L12.5,9.5 L12.5,12.5 L10,14 L7.5,12.5 L7.5,9.5 Z" fill="white" opacity={0.95} />
            <path d="M7.5,11.5 L5.5,14.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity={0.85} />
            <path d="M12.5,11.5 L14.5,14.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity={0.85} />
            <circle cx="10" cy="10" r="1.4" fill="rgba(123,31,162,0.8)" />
          </>
        )
      case 'elite':
        return (
          <path d="M11.5,4.5 L7.5,11 L11,11 L8.5,15.5 L13.5,9 L9.5,9 Z" fill="white" opacity={0.95} />
        )
      case 'legend':
        return (
          <polygon
            points="10,3.8 11.6,8.5 16.8,8.5 12.6,11.4 14.2,16.2 10,13.3 5.8,16.2 7.4,11.4 3.2,8.5 8.4,8.5"
            fill="white" opacity={0.95}
          />
        )
      default:
        return null
    }
  }

  // ── background shape ─────────────────────────────────────────────────────────
  function Bg() {
    if (badge === 'legend') {
      return (
        <>
          <defs>
            <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#FF6B6B" />
              <stop offset="33%"  stopColor="#FFD93D" />
              <stop offset="66%"  stopColor="#6BCB77" />
              <stop offset="100%" stopColor="#4D96FF" />
            </linearGradient>
            <filter id={`${uid}f`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d={shieldPath()} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} />
          <path d={shieldPath()} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
        </>
      )
    }

    if (badge === 'researcher') {
      return (
        <>
          <defs>
            <filter id={`${uid}f`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d={shieldPath()} fill="#C9A96E" filter={`url(#${uid}f)`} />
          <path d={shieldPath()} fill="none" stroke="#F5D87A" strokeWidth="1" opacity={0.75} />
        </>
      )
    }

    if (badge === 'diamond') {
      return (
        <>
          <defs>
            <filter id={`${uid}f`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#7DF9FF" />
              <stop offset="100%" stopColor="#00BCD4" />
            </linearGradient>
          </defs>
          <path d="M10,1.5 L18.5,10 L10,18.5 L1.5,10 Z" fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} />
          <path d="M10,1.5 L18.5,10 L10,18.5 L1.5,10 Z" fill="none" stroke="#B2FEFA" strokeWidth="0.8" opacity={0.7} />
        </>
      )
    }

    if (badge === 'explorer') {
      return (
        <>
          <defs>
            <filter id={`${uid}f`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d={hexPath()} fill="#7B1FA2" filter={`url(#${uid}f)`} />
          <path d={hexPath()} fill="none" stroke="#CE93D8" strokeWidth="0.9" opacity={0.7} />
        </>
      )
    }

    if (badge === 'elite') {
      return (
        <>
          <defs>
            <filter id={`${uid}f`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#006064" />
              <stop offset="100%" stopColor="#00E5FF" />
            </linearGradient>
          </defs>
          <path d={shieldPath()} fill={`url(#${uid}g)`} filter={`url(#${uid}f)`} />
          <path d={shieldPath()} fill="none" stroke="#18FFFF" strokeWidth="0.9" opacity={0.65} />
        </>
      )
    }

    // Tier 1 — solid colored circle
    const tier1Colors: Record<string, string> = {
      scholar:  '#C9A96E',
      star:     '#78909C',
      science:  '#00ACC1',
      bookworm: '#F57C00',
    }
    return <circle cx="10" cy="10" r="9" fill={tier1Colors[badge] ?? '#888'} />
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <Bg />
      {/* Outer dark ring for legibility on any bg */}
      {!isTier2 && <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />}
      <Icon />
    </svg>
  )
}

// ── AvatarWithBadge ───────────────────────────────────────────────────────────
// Drop-in replacement for Avatar. Renders a corner badge marker at bottom-right.
export function AvatarWithBadge({
  name, color, size = 28, badge,
}: {
  name: string
  color: string
  size?: number
  badge?: string | null
}) {
  const badgeSize = Math.round(size * 0.52)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Avatar circle */}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 600, color: '#191919',
        fontFamily: 'var(--font-sans, system-ui)', overflow: 'hidden',
      }}>
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Corner badge */}
      {badge && (
        <div style={{
          position: 'absolute',
          bottom: -Math.round(badgeSize * 0.2),
          right:  -Math.round(badgeSize * 0.2),
          width: badgeSize,
          height: badgeSize,
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))',
          pointerEvents: 'none',
        }}>
          <BadgeSVG badge={badge} size={badgeSize} />
        </div>
      )}
    </div>
  )
}
