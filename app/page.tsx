import Link from 'next/link'
import Nav from '@/components/Nav'
import SearchBox from '@/components/SearchBox'
import ParticleCanvas from '@/components/ParticleCanvas'
import RecentVerified from '@/components/RecentVerified'
import ArticleCount from '@/components/ArticleCount'

export default function HomePage() {
  return (
    <>
      <Nav />
      <ParticleCanvas />

      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 1.5rem',
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(3rem, 10vw, 6.5rem)',
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            marginBottom: '2.25rem',
            color: 'var(--text-primary)',
            opacity: 0,
            animation: 'fadeUp 0.7s 0.15s ease forwards',
          }}
        >
          Forca<em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>pedia</em>
        </h1>

        <div
          style={{
            width: '100%',
            maxWidth: '620px',
            opacity: 0,
            animation: 'fadeUp 0.7s 0.3s ease forwards',
          }}
        >
          <SearchBox />
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: '620px',
            marginTop: '1.25rem',
            opacity: 0,
            animation: 'fadeUp 0.7s 0.5s ease forwards',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <RecentVerified />
        </div>
      </main>

      <ArticleCount />

      <div
        style={{
          position: 'fixed',
          right: '1.25rem',
          bottom: '1.1rem',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        <Link href="/terms" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          Terms
        </Link>
        <Link href="/privacy" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          Privacy
        </Link>
        <Link href="/pricing" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          Pricing
        </Link>
        <Link href="/contact" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>
          Contact
        </Link>
      </div>
    </>
  )
}
