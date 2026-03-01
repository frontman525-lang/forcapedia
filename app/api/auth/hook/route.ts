/**
 * Supabase "Send Email" Auth Hook
 *
 * How to enable in Supabase dashboard:
 *   Authentication → Hooks → Send Email → HTTP
 *   Endpoint URL : https://forcapedia.com/api/auth/hook
 *   JWT Secret   : (generate a random secret, paste into SUPABASE_HOOK_SECRET env var)
 *
 * Required env vars:
 *   RESEND_API_KEY           — your Resend API key
 *   SUPABASE_HOOK_SECRET     — the secret you set in the Supabase hook settings
 *   NEXT_PUBLIC_SITE_URL     — https://forcapedia.com
 *   EMAIL_FROM_ADDRESS       — Forcapedia <hello@forcapedia.com>
 *
 * Email action types handled:
 *   signup           → ConfirmEmail
 *   recovery         → ResetPasswordEmail
 *   email_change_*   → generic confirmation (falls through to ConfirmEmail)
 */

import { NextResponse } from 'next/server'
import { createElement }    from 'react'
import { render }           from '@react-email/render'
import { resend }           from '@/lib/email/client'
import { ConfirmEmail }     from '@/lib/email/templates/ConfirmEmail'
import { ResetPasswordEmail } from '@/lib/email/templates/ResetPasswordEmail'

const SITE    = process.env.NEXT_PUBLIC_SITE_URL    ?? 'https://forcapedia.com'
const FROM    = process.env.EMAIL_FROM_ADDRESS       ?? 'Forcapedia <hello@forcapedia.com>'
const SECRET  = process.env.SUPABASE_HOOK_SECRET     ?? ''

// ── Payload types ─────────────────────────────────────────────────────────────
interface HookPayload {
  user: {
    id:    string
    email: string
    user_metadata?: Record<string, unknown>
  }
  email_data: {
    token:             string
    token_hash:        string
    redirect_to:       string
    email_action_type: string
    site_url:          string
    token_new?:        string
    token_hash_new?:   string
  }
}

// ── HMAC-SHA256 signature verification ────────────────────────────────────────
// Supabase sends: Authorization: Bearer v1,<hex(hmac-sha256(body, secret))>
async function verifyToken(req: Request, rawBody: string): Promise<boolean> {
  if (!SECRET) return true   // skip in dev if secret not set

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer v1,')) return false

  const receivedHex = auth.slice('Bearer v1,'.length)

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )

  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const computedHex = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return computedHex === receivedHex
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const rawBody = await req.text()

  // DEBUG — log all headers to find what Supabase actually sends
  const allHeaders: Record<string, string> = {}
  req.headers.forEach((val, key) => { allHeaders[key] = key.toLowerCase().includes('auth') ? val.substring(0, 40) : val })
  console.log('[hook] headers:', JSON.stringify(allHeaders))
  console.log('[hook] SECRET set:', !!SECRET, '| body length:', rawBody.length)

  if (!(await verifyToken(req, rawBody))) {
    console.log('[hook] signature mismatch — returning 401')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: HookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { user, email_data } = payload
  const { email_action_type, token_hash, redirect_to } = email_data
  const userEmail = user.email

  // Build the action URL that Supabase will verify when clicked
  const verifyBase = `${email_data.site_url}/auth/v1/verify`
  const type = email_action_type === 'signup'   ? 'signup'
             : email_action_type === 'recovery' ? 'recovery'
             : email_action_type               // email_change_new / email_change_current

  const actionUrl =
    `${verifyBase}?token_hash=${encodeURIComponent(token_hash)}` +
    `&type=${encodeURIComponent(type)}` +
    `&redirect_to=${encodeURIComponent(redirect_to || SITE)}`

  let subject: string
  let html:    string
  let text:    string

  if (email_action_type === 'recovery') {
    // ── Reset password email ────────────────────────────────────────────────
    subject = 'Reset your Forcapedia password'
    ;[html, text] = await Promise.all([
      render(createElement(ResetPasswordEmail, { resetLink: actionUrl, email: userEmail })),
      render(createElement(ResetPasswordEmail, { resetLink: actionUrl, email: userEmail }), { plainText: true }),
    ])
  } else {
    // ── Confirm email (signup, email_change, magic_link, etc.) ──────────────
    subject = email_action_type === 'signup'
      ? 'Confirm your Forcapedia account'
      : 'Confirm your new email address — Forcapedia'
    ;[html, text] = await Promise.all([
      render(createElement(ConfirmEmail, { confirmLink: actionUrl, email: userEmail })),
      render(createElement(ConfirmEmail, { confirmLink: actionUrl, email: userEmail }), { plainText: true }),
    ])
  }

  try {
    await resend.emails.send({ from: FROM, to: [userEmail], subject, html, text })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/hook] Resend error:', err)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }
}
