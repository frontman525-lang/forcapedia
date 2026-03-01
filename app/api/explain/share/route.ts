import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to share.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const { text, explanation, mode, articleSlug } = body

  if (!text || !explanation || !mode) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }
  
  
  const hash = randomUUID().replace(/-/g, '').slice(0, 12)

  const { error } = await supabase.from('explain_shares').insert({
    hash,
    highlighted_text: String(text).slice(0, 350),
    explanation: String(explanation).slice(0, 3000),
    mode,
    article_slug: articleSlug || null,
    created_by: user.id,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to save.' }, { status: 500 })
  }

  return NextResponse.json({ hash })
}
