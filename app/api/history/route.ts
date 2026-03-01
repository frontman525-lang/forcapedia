import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/history — record that the current user read an article
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.slug || !body?.title) {
    return NextResponse.json({ error: 'Missing slug or title.' }, { status: 400 })
  }

  await supabase.from('reading_history').upsert(
    {
      user_id: user.id,
      article_slug: String(body.slug).slice(0, 200),
      article_title: String(body.title).slice(0, 200),
      article_category: String(body.category ?? 'Other').slice(0, 50),
      read_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,article_slug' },
  )

  return NextResponse.json({ ok: true })
}

// GET /api/history — return the last 12 articles the current user has read
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ items: [] })

  const { data } = await supabase
    .from('reading_history')
    .select('article_slug, article_title, article_category, read_at')
    .eq('user_id', user.id)
    .order('read_at', { ascending: false })
    .limit(12)

  return NextResponse.json({ items: data ?? [] })
}
