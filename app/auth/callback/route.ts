import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, WelcomeEmail } from '@/lib/email/send'
import * as React from 'react'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // ?next= is used by the password-reset flow to redirect to /auth/update-password
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)

    // Send welcome email on first-ever confirmation (new signup)
    // created_at ≈ confirmed_at means they just confirmed for the first time
    const user = data?.user
    if (user?.email && user.confirmed_at && user.created_at) {
      const confirmedAt = new Date(user.confirmed_at).getTime()
      const createdAt   = new Date(user.created_at).getTime()
      const isNewSignup = confirmedAt - createdAt < 5 * 60 * 1000  // within 5 min of creation
      if (isNewSignup) {
        const firstName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? 'there'
        sendEmail({
          to:       user.email,
          subject:  `Welcome to Forcapedia, ${firstName}`,
          template: React.createElement(WelcomeEmail, { firstName }),
        }).catch(err => console.error('[callback] welcome email failed:', err))
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
