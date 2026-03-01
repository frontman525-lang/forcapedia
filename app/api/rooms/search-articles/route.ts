// GET /api/rooms/search-articles?q=...
// Full-text article search for host navigation inside study rooms.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ results: [] })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('articles')
    .select('slug, title, category')
    .ilike('title', `%${q}%`)
    .limit(8)

  return NextResponse.json({ results: data ?? [] })
}
