'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number
  opacity: number
  targetOpacity: number
  twinkleSpeed: number
  gold: boolean
}

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    const COUNT = 200
    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      size: Math.random() * 1.4 + 0.2,
      opacity: Math.random() * 0.6 + 0.05,
      targetOpacity: Math.random() * 0.7 + 0.1,
      twinkleSpeed: Math.random() * 0.008 + 0.002,
      gold: Math.random() > 0.88,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Check theme at draw time — zero overhead, no re-renders needed
      const isLight = document.documentElement.classList.contains('light')
      const baseColor = isLight ? '#3A3D4A' : '#F0EDE8'
      const goldColor = isLight ? '#A07828' : '#C9A96E'

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.x < -2) p.x = canvas.width + 2
        if (p.x > canvas.width + 2) p.x = -2
        if (p.y < -2) p.y = canvas.height + 2
        if (p.y > canvas.height + 2) p.y = -2

        const diff = p.targetOpacity - p.opacity
        if (Math.abs(diff) < p.twinkleSpeed) {
          p.targetOpacity = Math.random() * 0.7 + 0.05
        } else {
          p.opacity += diff > 0 ? p.twinkleSpeed : -p.twinkleSpeed
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.gold ? goldColor : baseColor
        ctx.globalAlpha = Math.max(0, Math.min(isLight ? p.opacity * 0.5 : p.opacity, 1))
        ctx.fill()
      }

      ctx.globalAlpha = 1
      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  )
}
