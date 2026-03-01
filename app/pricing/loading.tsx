export default function PricingLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--ink)',
    }}>
      <span style={{
        color: 'rgba(240,237,232,0.25)',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        letterSpacing: '0.06em',
      }}>
        Loading…
      </span>
    </div>
  )
}
