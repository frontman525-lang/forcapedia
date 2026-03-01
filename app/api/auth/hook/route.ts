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

// ── Signature verification ─────────────────────────────────────────────────────
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!SECRET) return true   // if no secret configured, skip verification in dev

  const header = req.headers.get('x-supabase-signature')
  if (!header) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  )

  // Header format: sha256=<hex>
  const hexSig  = header.replace('sha256=', '')
  const sigBuf  = new Uint8Array(hexSig.match(/.{2}/g)!.map(h => parseInt(h, 16)))
  const bodyBuf = encoder.encode(rawBody)

  return crypto.subtle.verify('HMAC', key, sigBuf, bodyBuf)
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const rawBody = await req.text()

  if (!(await verifySignature(req, rawBody))) {
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
