import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const alt         = 'Forcapedia Article'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Derive readable title from slug as default
  let title    = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  let category = ''

  // Fetch real title + category via Supabase REST (edge-compatible, no Node.js APIs)
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/articles` +
      `?slug=eq.${encodeURIComponent(slug)}&select=title,category&limit=1`,
      {
        headers: {
          apikey:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        next: { revalidate: 3600 },
      },
    )
    const rows = await res.json()
    if (rows?.[0]?.title)    title    = rows[0].title
    if (rows?.[0]?.category) category = rows[0].category
  } catch {
    // Fallback to slug-derived title — safe to ignore
  }

  const fontSize = title.length > 60 ? 48 : title.length > 40 ? 56 : 64

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#191919',
          display: 'flex', flexDirection: 'column',
          padding: '72px 80px',
          justifyContent: 'space-between',
        }}
      >
        {/* Gold gradient top accent */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(201,169,110,0.07) 0%, transparent 55%)',
        }} />

        {/* Header: brand + category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontSize: 22, color: 'rgba(240,237,232,0.5)',
            fontFamily: 'Georgia, serif', letterSpacing: '-0.01em',
          }}>
            Forca<span style={{ color: '#C9A96E', fontStyle: 'italic' }}>pedia</span>
          </span>
          {category && (
            <>
              <span style={{ display: 'flex', color: 'rgba(240,237,232,0.2)', fontSize: 18 }}>·</span>
              <span style={{
                display: 'flex', fontSize: 14, color: '#C9A96E',
                fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                {category}
              </span>
            </>
          )}
        </div>

        {/* Article title + rule */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div style={{
            fontSize, fontWeight: 300, color: '#F0EDE8',
            lineHeight: 1.15, letterSpacing: '-0.02em',
            fontFamily: 'Georgia, serif', maxWidth: 960,
          }}>
            {title}
          </div>
          <div style={{
            display: 'flex', width: 80, height: 1,
            background: '#C9A96E', opacity: 0.5,
          }} />
        </div>
      </div>
    ),
    size,
  )
}
