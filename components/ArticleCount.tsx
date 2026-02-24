import { createClient } from '@/lib/supabase/server'

export default async function ArticleCount() {
  let count = 0
  try {
    const supabase = await createClient()
    const { count: c } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
    count = c ?? 0
  } catch {
    count = 0
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      textAlign: 'center',
      zIndex: 1,
      pointerEvents: 'none',
    }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'rgba(240,237,232,0.2)',
        marginBottom: '0.2rem',
      }}>
        Articles Verified
      </p>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '1.4rem',
        fontWeight: 400,
        color: 'rgba(240,237,232,0.35)',
        letterSpacing: '0.05em',
      }}>
        {count.toLocaleString()}
      </p>
    </div>
  )
}
