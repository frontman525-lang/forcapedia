import { NextResponse } from 'next/server'
import * as React from 'react'
import { render }             from '@react-email/render'
import { sendEmail, sendViaZeptoMail, FROM_ADDRESS } from '@/lib/email/send'
import { resend }             from '@/lib/email/client'
import { WelcomeEmail }        from '@/lib/email/templates/WelcomeEmail'
import { ResetPasswordEmail }  from '@/lib/email/templates/ResetPasswordEmail'
import { ConfirmEmail }        from '@/lib/email/templates/ConfirmEmail'
import { PaymentSuccessEmail } from '@/lib/email/templates/PaymentSuccessEmail'
import { InvoiceEmail }        from '@/lib/email/templates/InvoiceEmail'

/**
 * Email test endpoint — sends a real email so you can inspect design + delivery.
 *
 * Usage:
 *   /api/email/test?secret=XXX&to=you@email.com&template=welcome&force=resend
 *
 * Params:
 *   secret   — must match CRON_SECRET in .env.local
 *   to       — recipient email address
 *   template — welcome | confirm | reset | payment | invoice   (default: welcome)
 *   force    — resend | zepto | auto                           (default: auto)
 *              auto   = try Resend, fall back to ZeptoMail
 *              resend = Resend only (skip fallback)
 *              zepto  = ZeptoMail only (skip Resend — use this to test ZeptoMail)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const secret   = searchParams.get('secret')
  const to       = searchParams.get('to')
  const template = searchParams.get('template') ?? 'welcome'
  const force    = searchParams.get('force')    ?? 'auto'

  // ── Auth check ──────────────────────────────────────────────────────────────
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized — add ?secret=YOUR_CRON_SECRET to the URL' },
      { status: 401 },
    )
  }
  if (!to) {
    return NextResponse.json(
      { error: 'Missing ?to= param. Usage: /api/email/test?secret=XXX&to=you@email.com&template=welcome&force=auto' },
      { status: 400 },
    )
  }

  // ── Build template element ───────────────────────────────────────────────────
  let element: React.ReactElement
  let subject: string

  switch (template) {
    case 'reset':
      element = React.createElement(ResetPasswordEmail, {
        email:     to,
        resetLink: 'https://forcapedia.com/auth/update-password?token_hash=PREVIEW_ONLY&type=recovery',
      })
      subject = 'Reset your Forcapedia password'
      break
    case 'confirm':
      element = React.createElement(ConfirmEmail, {
        email:       to,
        confirmLink: 'https://forcapedia.com/auth/callback?token_hash=PREVIEW_ONLY&type=signup',
      })
      subject = 'Confirm your Forcapedia account'
      break
    case 'payment':
      element = React.createElement(PaymentSuccessEmail, {
        firstName:   'Shaik',
        planName:    'Scholar',
        planPrice:   '$7.99/month',
        tokens:      '2,000,000',
        orderId:     'TEST-ORDER-001',
        invoiceNumber: 'INV-2026-00001',
        date:        new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                       .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      })
      subject = 'Payment confirmed — your Scholar plan is now active'
      break
    case 'invoice':
      element = React.createElement(InvoiceEmail, {
        firstName:     'Shaik',
        email:         to,
        invoiceNumber: 'INV-2026-00001',
        orderId:       'TEST-ORDER-001',
        date:          new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        planName:      'Scholar',
        amount:        '7.99',
        currency:      'USD',
        billingPeriod: 'Feb 26, 2026 – Mar 26, 2026',
      })
      subject = 'Your Forcapedia invoice — INV-2026-00001'
      break
    default: // 'welcome'
      element = React.createElement(WelcomeEmail, { firstName: 'Shaik' })
      subject = 'Welcome to Forcapedia'
  }

  try {
    let provider: string

    if (force === 'zepto') {
      // ── Force ZeptoMail only ─────────────────────────────────────────────
      const [html, text] = await Promise.all([
        render(element),
        render(element, { plainText: true }),
      ])
      await sendViaZeptoMail({ to, subject, html, text })
      provider = 'ZeptoMail'

    } else if (force === 'resend') {
      // ── Force Resend only ────────────────────────────────────────────────
      const [html, text] = await Promise.all([
        render(element),
        render(element, { plainText: true }),
      ])
      await resend.emails.send({ from: FROM_ADDRESS, to: [to], subject, html, text })
      provider = 'Resend'

    } else {
      // ── Auto: Resend → ZeptoMail fallback ────────────────────────────────
      await sendEmail({ to, subject, template: element })
      provider = 'auto (Resend → ZeptoMail fallback)'
    }

    return NextResponse.json({ ok: true, sent_to: to, template, provider })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email/test] send failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
