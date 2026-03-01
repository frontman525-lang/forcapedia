import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\//i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua)) return 'Safari'
  return 'Unknown'
}

function parseOS(ua: string): string {
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'macOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad/i.test(ua)) return 'iOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Unknown'
}

function parseDevice(ua: string): string {
  if (/Mobi/i.test(ua)) return 'mobile'
  if (/Tablet|iPad/i.test(ua)) return 'tablet'
  return 'desktop'
}

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    null
  )
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { session_key?: string; timezone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { session_key, timezone } = body
  if (!session_key) {
    return NextResponse.json({ error: 'Missing session_key' }, { status: 400 })
  }

  const ua = request.headers.get('user-agent') ?? ''
  const browser = parseBrowser(ua)
  const os = parseOS(ua)
  const device_type = parseDevice(ua)

  // Geo lookup from IP — non-blocking, graceful on failure
  let country: string | null = null
  let city: string | null = null
  const ip = getClientIp(request)
  if (ip && ip !== '127.0.0.1' && ip !== '::1') {
    try {
      const geoRes = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,country,city`,
        { signal: AbortSignal.timeout(2000) }
      )
      if (geoRes.ok) {
        const geo = await geoRes.json()
        if (geo.status === 'success') {
          country = geo.country ?? null
          city = geo.city ?? null
        }
      }
    } catch {
      // Geo lookup failed — session is still saved without location
    }
  }

  const { error } = await supabase
    .from('user_sessions')
    .upsert(
      {
        user_id: user.id,
        session_key,
        country,
        city,
        timezone: timezone ?? null,
        browser,
        os,
        device_type,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_key' }
    )

  if (error) {
    console.error('[session/track]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
