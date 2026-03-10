// GET /api/article?slug=...
// Returns article content by slug. Used by the study room when navigating.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('articles')
    .select('slug, title, content, summary, category, wiki_url, verified_at, tags, sources')
    .eq('slug', slug)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  return NextResponse.json(data)
}
