// GET /api/geo
// Returns the visitor's ISO-3166-1 alpha-2 country code.
//
// Detection priority:
//  1. NEXT_PUBLIC_FORCE_REGION env var  — local dev override (set to 'IN' to test India pricing)
//  2. x-vercel-ip-country              — set by Vercel Edge on every request (production)
//  3. cf-ipcountry                     — set by Cloudflare (if behind CF proxy)
//  4. x-real-ip / x-forwarded-for     — fall back to ipapi.co lookup
//  5. 'US'                             — absolute fallback

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // ── Priority 1: Local dev override (instant, no network call) ────────────
  const forced = process.env.NEXT_PUBLIC_FORCE_REGION
  if (forced && forced.length === 2 && /^[A-Z]{2}$/.test(forced.toUpperCase())) {
    return NextResponse.json({ country: forced.toUpperCase() }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // ── Priority 2 & 3: Edge network headers (zero-latency) ──────────────────
  const vercelCountry = request.headers.get('x-vercel-ip-country')
  const cfCountry     = request.headers.get('cf-ipcountry')

  const country = vercelCountry ?? cfCountry

  if (country && country !== 'XX' && country.length === 2) {
    return NextResponse.json({ country }, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    })
  }

  // ── Priority 4: Default (skip slow external IP lookups — geo is best-effort) ─
  // ipapi.co and similar services add 1-3s latency in dev and can rate-limit.
  // Vercel/CF headers (Priority 2 & 3) cover production. Fallback to US for dev.
  return NextResponse.json({ country: 'US' }, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  })
}
