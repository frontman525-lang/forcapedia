// Shown by Next.js while the chat page server-renders (auth + DB fetch).
// Dark skeleton prevents the white flash during navigation on mobile.
export default function ChatLoading() {
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: '#0F0D0C', color: '#F0EDE8',
    }}>
      {/* Header skeleton */}
      <div style={{
        height: 52, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(15,13,12,0.98)',
        display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.75rem',
      }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ flex: 1, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.06)', maxWidth: 160 }} />
        <div style={{ width: 80, height: 24, borderRadius: 100, background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* Members strip skeleton */}
      <div style={{
        height: 36, flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.015)',
        display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.5rem',
      }}>
        {[20, 28, 24, 18].map((w, i) => (
          <div key={i} style={{ width: w, height: 20, borderRadius: 100, background: 'rgba(255,255,255,0.05)' }} />
        ))}
      </div>

      {/* Messages skeleton */}
      <div style={{ flex: 1, padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[72, 48, 88, 60, 96, 52].map((w, i) => (
          <div key={i} style={{
            display: 'flex', gap: '0.5rem',
            flexDirection: i % 2 === 0 ? 'row' : 'row-reverse',
          }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
            <div style={{ width: `${w}%`, maxWidth: '78%', height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }} />
          </div>
        ))}
      </div>

      {/* Input skeleton */}
      <div style={{
        padding: '0.6rem 1rem',
        paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(15,13,12,0.98)',
        display: 'flex', gap: '0.5rem',
      }}>
        <div style={{ flex: 1, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  )
}
