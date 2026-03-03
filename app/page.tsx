import Link from 'next/link'
import Nav from '@/components/Nav'
import SearchBox from '@/components/SearchBox'
import HomeBackground from '@/components/HomeBackground'
import ParticleCanvas from '@/components/ParticleCanvas'
import RecentVerified from '@/components/RecentVerified'

export default function HomePage() {
  return (
    <>
      <Nav />

      {/* Layer 0: #000 base + 20 static CSS stars */}
      <HomeBackground />

      {/* Layer 1: animated stars — transparent canvas, Mars-safe spawn zone */}
      <ParticleCanvas count={90} />

      {/* Layer 2: Mars planet — rendered by HomeBackground at z-index 2 */}

      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 'clamp(88px, 26vh, 210px)',
          paddingLeft: 'clamp(1rem, 4vw, 1.5rem)',
          paddingRight: 'clamp(1rem, 4vw, 1.5rem)',
          paddingBottom: '5rem',
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          width: '100%',
          // overflow: clip does NOT create a scroll context (unlike overflow: hidden)
          // so no phantom scrollbars appear
          overflow: 'clip',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(2.75rem, 9vw, 6.5rem)',
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            marginBottom: '2rem',
            color: 'var(--text-primary)',
            opacity: 0,
            animation: 'fadeIn 0.35s 0s ease forwards',
            width: '100%',
            maxWidth: '700px',
          }}
        >
          Forca<em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>pedia</em>
        </h1>

        <div
          style={{
            width: '100%',
            maxWidth: '620px',
            opacity: 0,
            animation: 'fadeIn 0.35s 0.07s ease forwards',
          }}
        >
          <SearchBox />
        </div>

        {/* Carousel — no overflow wrapper so ghost-card overflow is never scrollable */}
        <div
          style={{
            width: '100%',
            maxWidth: '620px',
            marginTop: '1.125rem',
            opacity: 0,
            animation: 'fadeIn 0.35s 0.14s ease forwards',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <RecentVerified />
        </div>

      </main>

      <div
        style={{
          position: 'fixed',
          right: 'clamp(0.75rem, 2vw, 1.25rem)',
          bottom: '1rem',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.45rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.7rem' }}>
          <Link href="/terms"   style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Terms</Link>
          <Link href="/privacy" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/pricing" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Pricing</Link>
          <Link href="/contact" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Contact</Link>
        </div>
        <p style={{ margin: 0, color: 'var(--text-tertiary)', opacity: 0.7 }}>
          © 2026 FORCAPEDIA. All rights reserved.
        </p>
      </div>
    </>
  )
}
