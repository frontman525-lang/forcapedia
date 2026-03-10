import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const alt         = 'Forcapedia — The Living Encyclopedia'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#191919',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Subtle gold radial glow */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          background: 'radial-gradient(ellipse at 50% 30%, rgba(201,169,110,0.10) 0%, transparent 65%)',
        }} />

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{
            fontSize: 88, fontWeight: 300, color: '#F0EDE8',
            letterSpacing: '-0.02em', fontFamily: 'Georgia, serif',
          }}>
            Forca
          </span>
          <span style={{
            fontSize: 88, fontWeight: 300, color: '#C9A96E',
            letterSpacing: '-0.02em', fontStyle: 'italic', fontFamily: 'Georgia, serif',
          }}>
            pedia
          </span>
        </div>

        {/* Tagline */}
        <div style={{
          display: 'flex', marginTop: 20,
          fontSize: 22, fontWeight: 300,
          color: 'rgba(240,237,232,0.45)',
          letterSpacing: '0.12em',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
        }}>
          The Living Encyclopedia
        </div>

        {/* Gold accent line */}
        <div style={{
          display: 'flex',
          width: 80, height: 1,
          background: '#C9A96E',
          marginTop: 44, opacity: 0.35,
        }} />
      </div>
    ),
    size,
  )
}
