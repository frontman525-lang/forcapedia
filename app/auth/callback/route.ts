import { NextResponse } from 'next/server'
import * as React from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, WelcomeEmail } from '@/lib/email/send'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // ?next= is used by the password-reset flow to redirect to /auth/update-password
  const next = searchParams.get('next') ?? '/'
  const isPasswordResetFlow = next.startsWith('/auth/update-password')

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[callback] exchangeCodeForSession failed:', error.message)
    }

    // Send welcome email exactly once per account and skip reset-password flow.
    const user = data?.user
    if (user?.email && !isPasswordResetFlow) {
      const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>
      const alreadyWelcomed = Boolean(appMeta.welcome_email_sent)

      if (!alreadyWelcomed) {
        const firstName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there'

        try {
          await sendEmail({
            to: user.email,
            subject: `Welcome to Forcapedia, ${firstName}`,
            template: React.createElement(WelcomeEmail, { firstName }),
          })

          const admin = createAdminClient()
          const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
            app_metadata: { ...appMeta, welcome_email_sent: true },
          })
          if (updateErr) {
            console.error('[callback] failed to mark welcome_email_sent:', updateErr.message)
          }
        } catch (sendErr) {
          console.error('[callback] welcome email failed:', sendErr)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
