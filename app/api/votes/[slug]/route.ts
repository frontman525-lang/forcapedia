import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ slug: string }> }

// GET /api/votes/[slug] — return vote count + whether current user voted
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { count } = await supabase
    .from('article_votes')
    .select('*', { count: 'exact', head: true })
    .eq('article_slug', slug)

  let voted = false
  if (user) {
    const { data } = await supabase
      .from('article_votes')
      .select('user_id')
      .eq('article_slug', slug)
      .eq('user_id', user.id)
      .maybeSingle()
    voted = !!data
  }

  return NextResponse.json({ count: count ?? 0, voted })
}

// POST /api/votes/[slug] — toggle vote (add if not voted, remove if already voted)
export async function POST(_req: NextRequest, { params }: Params) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to vote.' }, { status: 401 })
  }

  // Check current vote state
  const { data: existing } = await supabase
    .from('article_votes')
    .select('user_id')
    .eq('article_slug', slug)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('article_votes')
      .delete()
      .eq('article_slug', slug)
      .eq('user_id', user.id)
  } else {
    await supabase
      .from('article_votes')
      .insert({ user_id: user.id, article_slug: slug })
  }

  // Return fresh count
  const { count } = await supabase
    .from('article_votes')
    .select('*', { count: 'exact', head: true })
    .eq('article_slug', slug)

  return NextResponse.json({ count: count ?? 0, voted: !existing })
}
