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
import { sendViaZeptoMail } from '@/lib/email/send'
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

// ── Svix HMAC-SHA256 signature verification ────────────────────────────────────
// Supabase uses Svix for hook delivery.
// Signed content = "{webhook-id}.{webhook-timestamp}.{body}"
// Header: webhook-signature: v1,<base64(hmac-sha256(signed-content, secret))>
async function verifyToken(req: Request, rawBody: string): Promise<boolean> {
  if (!SECRET) return true   // skip in dev if secret not set

  const msgId     = req.headers.get('webhook-id')        ?? ''
  const timestamp = req.headers.get('webhook-timestamp') ?? ''
  const sigHeader = req.headers.get('webhook-signature') ?? ''

  if (!msgId || !timestamp || !sigHeader) return false

  const signed  = `${msgId}.${timestamp}.${rawBody}`
  const encoder = new TextEncoder()

  // Secret format from Supabase dashboard: "v1,whsec_<base64-encoded-key>"
  // Strip the prefix, then base64-decode to get the raw HMAC key bytes.
  const b64Key  = SECRET.replace(/^v1,whsec_/, '')
  const keyNums = Array.from(atob(b64Key), c => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'raw', new Uint8Array(keyNums),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )

  const sigBuf  = await crypto.subtle.sign('HMAC', key, encoder.encode(signed))
  const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))

  // Header may list multiple sigs: "v1,abc v1,def"
  return sigHeader.split(' ').some(s => s === `v1,${computed}`)
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const rawBody = await req.text()

  if (!(await verifyToken(req, rawBody))) {
    console.error('[auth/hook] signature verification failed')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: HookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { user, email_data } = payload
  const { email_action_type, token_hash, token, redirect_to } = email_data
  const userEmail = user.email

  if (!userEmail) {
    return NextResponse.json({ error: 'Missing user email' }, { status: 400 })
  }

  // Build the action URL that Supabase will verify when clicked.
  // Payload site_url can be either:
  // - https://<project>.supabase.co
  // - https://<project>.supabase.co/auth/v1
  // Normalize it to avoid duplicated "/auth/v1/auth/v1/verify".
  const rawSiteUrl = (email_data.site_url || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const authBase = rawSiteUrl.endsWith('/auth/v1') ? rawSiteUrl : `${rawSiteUrl}/auth/v1`
  const verifyBase = `${authBase}/verify`
  const type = email_action_type === 'signup'   ? 'signup'
             : email_action_type === 'recovery' ? 'recovery'
             : email_action_type               // email_change_new / email_change_current

  const tokenHash = (token_hash ?? '').trim()
  const plainToken = (token ?? '').trim()

  if (!tokenHash && !plainToken) {
    console.error('[auth/hook] Missing token and token_hash in payload', {
      email_action_type,
      hasSiteUrl: Boolean(email_data.site_url),
      hasRedirectTo: Boolean(redirect_to),
    })
    return NextResponse.json({ error: 'Invalid payload: missing verification token' }, { status: 400 })
  }

  const tokenQuery = tokenHash
    ? `token_hash=${encodeURIComponent(tokenHash)}`
    : `token=${encodeURIComponent(plainToken)}`

  const actionUrl =
    `${verifyBase}?apikey=${encodeURIComponent(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')}` +
    `&${tokenQuery}` +
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
    return NextResponse.json({ success: true, provider: 'resend' })
  } catch (resendErr) {
    console.warn('[auth/hook] Resend failed, trying ZeptoMail fallback:', resendErr)
  }

  try {
    await sendViaZeptoMail({ to: userEmail, subject, html, text })
    return NextResponse.json({ success: true, provider: 'zepto' })
  } catch (zeptoErr) {
    console.error('[auth/hook] ZeptoMail fallback failed:', zeptoErr)
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
  }
}
