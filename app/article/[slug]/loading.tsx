// Shown by Next.js App Router while the article page is fetching.
// Provides a smooth shimmer skeleton for BOTH cached and new article navigation.
import Nav from '@/components/Nav'

function SkeletonLine({ width, height = 14, radius = 4 }: { width: string; height?: number; radius?: number }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'rgba(255,255,255,0.06)',
      animation: 'skeletonPulse 1.5s ease-in-out infinite',
    }} />
  )
}

export default function ArticleLoading() {
  return (
    <>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 0.45 }
          50%       { opacity: 0.9 }
        }
      `}</style>
      <Nav />
      <div style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem', background: 'var(--ink)' }}>
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '3rem 1.25rem 0' }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', alignItems: 'center' }}>
            <SkeletonLine width="55px" height={10} />
            <SkeletonLine width="5px"  height={10} radius={2} />
            <SkeletonLine width="75px" height={10} />
          </div>

          {/* Badge */}
          <SkeletonLine width="130px" height={22} radius={100} />
          <div style={{ height: 20 }} />

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            <SkeletonLine width="85%" height={40} radius={6} />
            <SkeletonLine width="60%" height={40} radius={6} />
          </div>

          {/* Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <SkeletonLine width="95%" />
            <SkeletonLine width="88%" />
            <SkeletonLine width="70%" />
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[90, 82, 87, 78, 92, 70, 85, 88, 74, 80, 68, 84, 90, 76, 60].map((w, i) => (
              <SkeletonLine key={i} width={`${w}%`} />
            ))}
          </div>

        </main>
      </div>
    </>
  )
}
