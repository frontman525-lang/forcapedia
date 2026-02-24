import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import ProfileDashboard from '@/components/ProfileDashboard'

export const metadata: Metadata = { title: 'Account — Forcapedia' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: usage } = await supabase
    .from('user_usage')
    .select('tier, tokens_used, period_start')
    .eq('user_id', user.id)
    .single()

  return (
    <>
      <Nav />
      <ProfileDashboard user={user} usage={usage} />
    </>
  )
}
