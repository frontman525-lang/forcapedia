'use client'

import { useEffect, useRef } from 'react'

// ─── Star types & colour data ─────────────────────────────────────────────────
type StarType = 'white' | 'warm' | 'cool' | 'gold'

// Per-type RGB used for glow and core (avoids string building every frame)
const GLOW_RGB: Record<StarType, readonly [number, number, number]> = {
  white: [210, 225, 255],
  warm:  [255, 175,  80],
  cool:  [ 80, 140, 255],
  gold:  [201, 169, 110],
}
const CORE_RGB: Record<StarType, readonly [number, number, number]> = {
  white: [255, 255, 255],
  warm:  [255, 235, 190],
  cool:  [200, 220, 255],
  gold:  [255, 220, 140],
}

interface Star {
  x: number; y: number
  vx: number; vy: number
  // Radii for multi-layer rendering
  coreR:  number   // tiny point-source nucleus (≤ 0.7 px)
  haloR:  number   // inner bright halo (shadowBlur value)
  glowR:  number   // outer diffuse glow (shadowBlur value, only bright stars)
  alpha:  number   // current opacity (animated by scintillation)
  baseA:  number   // equilibrium opacity
  dA:     number   // direction of opacity change (+1 / -1)
  dAspd:  number   // how fast alpha drifts (scintillation speed)
  flare:  number   // 0-1 countdown for a scintillation "spike" event
  bright: number   // 0-1 brightness level (power-curve biased toward faint)
  type:   StarType
}

function makeStar(w: number, maxY: number): Star {
  // Very heavily weighted toward faint stars — a few bright ones stand out
  const b = Math.pow(Math.random(), 2.8)

  // Core is a true point-source. Even the brightest is < 0.7 px.
  const coreR = 0.22 + b * 0.48

  // Inner halo (shadowBlur) — makes the star look like it has "body"
  const haloR = 1.2 + b * 9.0     // 1–10 px

  // Outer diffuse nebula-like glow (only stars bright enough to warrant it)
  const glowR = b > 0.40 ? ((b - 0.40) / 0.60) * 28 : 0   // up to 28 px

  const baseA = 0.12 + b * 0.82

  // Very slow drift — 0.03–0.09 px/frame ≈ 2–5 px/sec
  // Stars in real cinematics barely move; scintillation is what makes them live
  const speed = 0.030 + Math.random() * 0.058
  const angle = Math.random() * Math.PI * 2

  const roll = Math.random()
  const type: StarType =
    roll < 0.03 ? 'gold' :
    roll < 0.12 ? 'cool' :
    roll < 0.28 ? 'warm' : 'white'

  return {
    x: Math.random() * w,
    y: Math.random() * maxY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    coreR, haloR, glowR,
    alpha: baseA * (0.55 + Math.random() * 0.45),
    baseA,
    dA:    Math.random() > 0.5 ? 1 : -1,
    dAspd: 0.006 + Math.random() * 0.016,   // fast twinkle — visible but not strobing
    flare: 0,
    bright: b,
    type,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  /** fullScreen — disable the Mars exclusion zone (use on pages without Mars) */
  fullScreen?: boolean
  count?: number
}

export default function ParticleCanvas({ fullScreen = false, count = 80 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // Mars-safe spawn ceiling for the home page
    const SPAWN  = fullScreen ? 1.00 : 0.72   // spawn only above this Y fraction
    const FADE_S = fullScreen ? 1.00 : 0.63   // start fading toward Mars
    const FADE_E = fullScreen ? 1.00 : 0.72   // fully hidden

    let animId: number

    // On mobile, the virtual keyboard fires a resize event that shrinks
    // window.innerHeight — we don't want the canvas to shrink because that
    // causes the background to visually jump/reflow.
    // Strategy: only resize when the WIDTH changes (orientation change) or
    // when the new height is LARGER than the current canvas (keyboard closed).
    const resize = () => {
      const newW = window.innerWidth
      const newH = window.innerHeight
      if (newW !== canvas.width || newH > canvas.height) {
        canvas.width  = newW
        canvas.height = newH
      }
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    const stars: Star[] = Array.from({ length: count }, () =>
      makeStar(canvas.width, canvas.height * SPAWN)
    )

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      const isLight = document.documentElement.classList.contains('light')
      const maxY = h * SPAWN

      ctx.clearRect(0, 0, w, h)

      for (const s of stars) {
        // ── Slow drift ────────────────────────────────────────────────────
        s.x += s.vx
        s.y += s.vy
        if (s.x < -30)       s.x = w + 30
        if (s.x > w + 30)    s.x = -30
        if (s.y < -30)       s.y = maxY + 30
        if (s.y > maxY + 30) s.y = -30

        // ── Atmospheric scintillation ─────────────────────────────────────
        // Continuous sine-like oscillation with occasional bright spikes
        s.alpha += s.dA * s.dAspd
        const ceiling = s.baseA + 0.22 * s.bright + 0.04
        const floor   = s.baseA - 0.22 * s.bright - 0.03

        if (s.alpha >= ceiling) s.dA = -1
        if (s.alpha <= floor)   s.dA =  1
        s.alpha = Math.max(0.02, Math.min(1, s.alpha))

        // Random scintillation "flare" — sudden brightness spike
        if (s.bright > 0.45 && Math.random() < 0.0025) {
          s.alpha = Math.min(1, ceiling * 1.35)
          s.dA    = -1
        }

        // ── Mars fade zone ────────────────────────────────────────────────
        let a = s.alpha
        if (!fullScreen) {
          const yFrac = s.y / h
          if (yFrac >= FADE_E) continue
          if (yFrac > FADE_S) a *= 1 - (yFrac - FADE_S) / (FADE_E - FADE_S)
        }
        if (a < 0.012) continue

        // ── Light mode — simple dim dots ──────────────────────────────────
        if (isLight) {
          ctx.save()
          ctx.globalAlpha = a * 0.20
          ctx.fillStyle = '#3A3D4A'
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.coreR, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          continue
        }

        const [gr, gg, gb] = GLOW_RGB[s.type]
        const [cr, cg, cb] = CORE_RGB[s.type]

        // ── Layer 1 — outer diffuse nebula glow (bright stars only) ──────
        if (s.glowR > 3) {
          ctx.save()
          ctx.globalAlpha = a * 0.22
          ctx.shadowBlur   = s.glowR * 2.2
          ctx.shadowColor  = `rgb(${gr},${gg},${gb})`
          ctx.beginPath()
          ctx.arc(s.x, s.y, 1.0, 0, Math.PI * 2)
          ctx.fillStyle = `rgb(${gr},${gg},${gb})`
          ctx.fill()
          ctx.restore()
        }

        // ── Layer 2 — inner bright halo ───────────────────────────────────
        ctx.save()
        ctx.globalAlpha = a * 0.60
        ctx.shadowBlur   = s.haloR * 1.6
        ctx.shadowColor  = `rgb(${cr},${cg},${cb})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.coreR * 1.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`
        ctx.fill()
        ctx.restore()

        // ── Layer 3 — diffraction spikes (very bright stars only) ─────────
        if (s.bright > 0.75 && s.glowR > 14) {
          const sLen = s.glowR * 1.9
          ctx.save()
          ctx.globalAlpha = a * 0.10
          ctx.strokeStyle = `rgb(${cr},${cg},${cb})`
          ctx.lineWidth   = 0.65
          ctx.shadowBlur  = 6
          ctx.shadowColor = `rgb(${cr},${cg},${cb})`
          ctx.beginPath()
          ctx.moveTo(s.x - sLen, s.y); ctx.lineTo(s.x + sLen, s.y)
          ctx.moveTo(s.x, s.y - sLen); ctx.lineTo(s.x, s.y + sLen)
          ctx.stroke()
          ctx.restore()
        }

        // ── Layer 4 — bright point-source core ────────────────────────────
        ctx.save()
        ctx.globalAlpha = a
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.coreR, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`
        ctx.fill()
        ctx.restore()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [fullScreen, count])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', display: 'block' }}
    />
  )
}
