import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, session_key, country, city, timezone, browser, os, device_type, last_active, created_at')
    .eq('user_id', user.id)
    .order('last_active', { ascending: false })

  if (error) {
    console.error('[session/list]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
