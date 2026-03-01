export default function ProfileLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--ink)',
    }}>
      <span style={{
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        letterSpacing: '0.06em',
      }}>
        Loading…
      </span>
    </div>
  )
}
