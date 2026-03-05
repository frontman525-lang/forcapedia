import Link from 'next/link'

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
}

const linkStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  lineHeight: 1.7,
}

export default function LegalPageFooter() {
  return (
    <footer
      style={{
        marginTop: '3.5rem',
        paddingTop: '2.2rem',
        borderTop: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <div>
          <p style={sectionTitleStyle}>Forcapedia</p>
          <p
            style={{
              margin: '0.6rem 0 0',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}
          >
            Research-Grade Knowledge for the Modern Web.
          </p>
        </div>

        <div>
          <p style={sectionTitleStyle}>Company</p>
          <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column' }}>
            <Link href="/" style={linkStyle}>Home</Link>
            <Link href="/pricing" style={linkStyle}>Pricing</Link>
            <Link href="/contact" style={linkStyle}>Contact</Link>
          </div>
        </div>

        <div>
          <p style={sectionTitleStyle}>Legal</p>
          <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column' }}>
            <Link href="/terms" style={linkStyle}>Terms</Link>
            <Link href="/privacy" style={linkStyle}>Privacy</Link>
            <Link href="/refund" style={linkStyle}>Refund</Link>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: '1.8rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.9rem',
          flexWrap: 'wrap',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
          }}
        >
          (c) 2026 Forcapedia. Operated by ForcaLabs.
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
          }}
        >
          Terms apply. Privacy respected.
        </p>
      </div>
    </footer>
  )
}
