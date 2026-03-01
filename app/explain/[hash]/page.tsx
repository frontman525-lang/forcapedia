import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import ExplainShareActions from '@/components/ExplainShareActions'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ hash: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('explain_shares')
    .select('highlighted_text')
    .eq('hash', hash)
    .single()

  if (!data) return { title: 'Explanation — Forcapedia' }
  const preview = data.highlighted_text.slice(0, 60)
  return {
    title: `"${preview}…" — Forcapedia Explanation`,
    description: `AI-powered explanation from Forcapedia.`,
  }
}

export default async function ExplainSharePage({ params }: Props) {
  const { hash } = await params
  const supabase = await createClient()

  const { data: share } = await supabase
    .from('explain_shares')
    .select('*')
    .eq('hash', hash)
    .single()

  if (!share) notFound()

  const modeLabel = share.mode === 'eli10' ? 'ELI 10' : 'Simple'

  return (
    <>
      <Nav />
      <main style={{ minHeight: '100vh', paddingTop: '64px', background: 'var(--ink)' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '3.5rem 1.5rem 6rem' }}>

          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.75rem',
          }}>
            <span style={{ color: 'var(--gold)', fontSize: '14px' }}>✦</span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}>
              Forcapedia Explanation
            </span>
            <span style={{
              background: 'var(--gold-dim)',
              border: '1px solid var(--border-gold)',
              borderRadius: '100px',
              padding: '2px 9px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
            }}>
              {modeLabel}
            </span>
          </div>

          {/* Quoted highlighted text */}
          <blockquote style={{
            borderLeft: '3px solid var(--border-gold)',
            paddingLeft: '1.25rem',
            marginBottom: '2rem',
          }}>
            <p style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.15rem',
              fontWeight: 400,
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              fontStyle: 'italic',
            }}>
              &ldquo;{share.highlighted_text}&rdquo;
            </p>
          </blockquote>

          {/* Explanation */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '3rem',
          }}>
            <p style={{
              fontSize: '15.5px',
              color: 'var(--text-primary)',
              lineHeight: 1.85,
              fontWeight: 300,
              whiteSpace: 'pre-wrap',
            }}>
              {share.explanation}
            </p>
          </div>

          {/* CTA row */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            paddingTop: '2rem',
            borderTop: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.04em',
            }}>
              Generated on Forcapedia — the living encyclopedia
            </p>

            {/* Re-share buttons */}
            <ExplainShareActions url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/explain/${share.hash}`} explanation={share.explanation} />

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {share.article_slug && (
                <Link
                  href={`/article/${share.article_slug}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 1.25rem',
                    background: 'var(--gold-dim)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '100px',
                    color: 'var(--gold)',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    transition: 'background 0.2s',
                  }}
                >
                  Read the full article →
                </Link>
              )}

              <Link
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1.5rem',
                  background: 'var(--gold)',
                  borderRadius: '100px',
                  color: 'var(--ink)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'opacity 0.2s',
                }}
              >
                Explore Forcapedia
              </Link>
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
