import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import SearchBox from '@/components/SearchBox'

export const metadata: Metadata = {
  title: 'Page Not Found — Forcapedia',
  description: 'This page does not exist. Search for anything on Forcapedia.',
}

export default function NotFound() {
  return (
    <>
      <Nav />
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 1.5rem',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* 404 number */}
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginBottom: '1.25rem',
          opacity: 0,
          animation: 'fadeUp 0.6s 0.1s ease forwards',
        }}>
          404 — Not found
        </p>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(2rem, 8vw, 4rem)',
          fontWeight: 300,
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          marginBottom: '1rem',
          opacity: 0,
          animation: 'fadeUp 0.6s 0.2s ease forwards',
        }}>
          Nothing here.
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: '15px',
          color: 'var(--text-tertiary)',
          fontWeight: 300,
          marginBottom: '2.5rem',
          maxWidth: '380px',
          lineHeight: 1.7,
          opacity: 0,
          animation: 'fadeUp 0.6s 0.3s ease forwards',
        }}>
          This page doesn&apos;t exist or was moved. Search for anything below — we probably know it.
        </p>

        {/* Search box */}
        <div style={{
          width: '100%',
          maxWidth: '540px',
          opacity: 0,
          animation: 'fadeUp 0.6s 0.4s ease forwards',
        }}>
          <SearchBox />
        </div>

        {/* Back home */}
        <div style={{
          marginTop: '2rem',
          opacity: 0,
          animation: 'fadeUp 0.6s 0.5s ease forwards',
        }}>
          <style>{`.nf-back:hover{color:var(--gold)!important}`}</style>
          <Link
            href="/"
            className="nf-back"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
          >
            ← Back to Forcapedia
          </Link>
        </div>

      </main>
    </>
  )
}
