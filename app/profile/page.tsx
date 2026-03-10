import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import ProfileDashboard from '@/components/ProfileDashboard'
import HomeBackground from '@/components/HomeBackground'
import ParticleCanvas from '@/components/ParticleCanvas'

export const dynamic  = 'force-dynamic'   // always fetch fresh data — never serve cached tier info
export const metadata: Metadata = {
  title:  'Account',
  robots: { index: false, follow: false },
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: usage } = await supabase
    .from('user_usage')
    .select('tier, tokens_used, period_start, preferred_badge')
    .eq('user_id', user.id)
    .single()

  return (
    <>
      <HomeBackground noMars />
      <ParticleCanvas fullScreen count={80} />
      <Nav />
      <ProfileDashboard user={user} usage={usage} />
    </>
  )
}
