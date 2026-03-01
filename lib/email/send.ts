import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { resend } from './client'

export const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS ?? 'Forcapedia <hello@forcapedia.com>'

// Parse "Name <email>" → { name, address }
function parseFrom(from: string): { name: string; address: string } {
  const m = from.match(/^(.+?)\s*<(.+?)>$/)
  return m
    ? { name: m[1].trim(), address: m[2].trim() }
    : { name: 'Forcapedia', address: from.trim() }
}

interface SendEmailOptions {
  to:       string
  subject:  string
  template: ReactElement
}

// ── ZeptoMail fallback (no extra npm package — uses native fetch) ─────────────
export async function sendViaZeptoMail(opts: {
  to:      string
  subject: string
  html:    string
  text:    string
}) {
  const apiKey = process.env.ZEPTO_API_KEY
  if (!apiKey) throw new Error('ZEPTO_API_KEY not set — cannot use ZeptoMail fallback')

  const { name: fromName, address: fromEmail } = parseFrom(FROM_ADDRESS)

  const res = await fetch('https://api.zeptomail.in/v1.1/email', {
    method:  'POST',
    headers: {
      'Authorization': `Zoho-enczapikey ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:     { address: fromEmail, name: fromName },
      to:       [{ email_address: { address: opts.to } }],
      subject:  opts.subject,
      htmlbody: opts.html,
      textbody: opts.text,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ZeptoMail ${res.status}: ${body}`)
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────
/**
 * Renders a React Email template and sends it.
 * Primary:   Resend   (fast, developer-friendly)
 * Fallback:  ZeptoMail (reliable backup — used automatically if Resend fails)
 */
export async function sendEmail({ to, subject, template }: SendEmailOptions) {
  const [html, text] = await Promise.all([
    render(template),
    render(template, { plainText: true }),
  ])

  // ── 1. Try Resend ─────────────────────────────────────────────────────────
  try {
    await resend.emails.send({ from: FROM_ADDRESS, to: [to], subject, html, text })
    return
  } catch (err) {
    console.warn('[email] Resend failed — falling back to ZeptoMail:', err)
  }

  // ── 2. Fallback: ZeptoMail ────────────────────────────────────────────────
  await sendViaZeptoMail({ to, subject, html, text })
}

// ── Convenience re-exports (import from here in API routes) ──────────────────

export { WelcomeEmail }        from './templates/WelcomeEmail'
export { PaymentSuccessEmail } from './templates/PaymentSuccessEmail'
export { PaymentFailedEmail }  from './templates/PaymentFailedEmail'
export { InvoiceEmail }        from './templates/InvoiceEmail'
export { ResetPasswordEmail }  from './templates/ResetPasswordEmail'
export { ConfirmEmail }        from './templates/ConfirmEmail'
