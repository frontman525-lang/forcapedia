import Nav from '@/components/Nav'

// Text-only shimmer skeleton — shown instantly while the article page SSR-renders.
// Mirrors the ArticleView layout so there's no layout-shift when the real content arrives.
export default function ArticleLoading() {
  // Lines: width% → body text; negative → paragraph break; > 80 means it's an h2 heading
  const bodyLines = [
    100, 96, 90, 94, 83,          // paragraph 1
    -1,
    100, 93, 97, 88, 100, 79,     // paragraph 2
    -1,
    100, 91, 95, 86, 73,          // paragraph 3
    -1,
    82,                            // h2 heading
    -1,
    100, 94, 98, 89, 84, 100, 68, // paragraph 4
    -1,
    100, 92, 96, 87, 100, 77,     // paragraph 5
    -1,
    78,                            // h2 heading
    -1,
    100, 95, 90, 84, 100, 72,     // paragraph 6
    -1,
    100, 93, 88, 100, 65,         // paragraph 7
  ]

  return (
    <div style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem', background: 'var(--ink)' }}>
      <Nav />

      {/* Solo / Study Together bar skeleton */}
      <div style={{
        width: '100%', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'center',
        padding: '6px 0', background: 'var(--ink)',
      }}>
        <div className="skeleton" style={{ width: 185, height: 32, borderRadius: 100 }} />
      </div>

      {/* Main column — centred, matches ArticleView's 720 px max-width */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2.5rem 1.5rem 0' }}>

        {/* Category pill */}
        <div className="skeleton" style={{ width: 72, height: 10, marginBottom: '1.25rem', borderRadius: 4 }} />

        {/* Title — two lines */}
        <div className="skeleton" style={{ width: '88%', height: 42, marginBottom: '0.65rem', borderRadius: 8 }} />
        <div className="skeleton" style={{ width: '62%', height: 42, marginBottom: '1.75rem', borderRadius: 8 }} />

        {/* Badges row */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div className="skeleton" style={{ width: 92, height: 22, borderRadius: 100 }} />
          <div className="skeleton" style={{ width: 56, height: 22, borderRadius: 100 }} />
          <div className="skeleton" style={{ width: 74, height: 22, borderRadius: 100 }} />
        </div>

        {/* Summary — 3 lines */}
        {[100, 96, 68].map((w, i) => (
          <div key={`s${i}`} className="skeleton" style={{ width: `${w}%`, height: 16, marginBottom: '0.6rem', borderRadius: 4 }} />
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '1.75rem 0' }} />

        {/* Article body */}
        {bodyLines.map((w, i) =>
          w < 0 ? (
            <div key={i} style={{ height: '1.1rem' }} />
          ) : w > 80 && w < 85 ? (
            // h2 heading — taller, narrower
            <div key={i} className="skeleton" style={{ width: `${w - 20}%`, height: 22, marginBottom: '0.75rem', borderRadius: 6 }} />
          ) : (
            // body text line
            <div key={i} className="skeleton" style={{ width: `${w}%`, height: 14, marginBottom: '0.55rem', borderRadius: 4 }} />
          )
        )}
      </div>
    </div>
  )
}
