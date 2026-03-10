import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import PricingPlans from '@/components/PricingPlans'
import HomeBackground from '@/components/HomeBackground'
import ParticleCanvas from '@/components/ParticleCanvas'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export const metadata: Metadata = {
  title:       'Pricing',
  description: 'Choose a Forcapedia plan. Scholar and Researcher tiers unlock more articles, study rooms, and AI-powered explanations. Monthly or yearly billing.',
  alternates:  { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title:       'Pricing — Forcapedia',
    description: 'Scholar and Researcher plans with monthly or yearly billing. Unlock more knowledge.',
    url:         `${SITE_URL}/pricing`,
    siteName:    'Forcapedia',
    type:        'website',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Pricing — Forcapedia',
    description: 'Scholar and Researcher plans with monthly or yearly billing.',
  },
}

interface Props {
  searchParams: Promise<{ billing?: string }>
}

export default async function PricingPage({ searchParams }: Props) {
  const params = await searchParams
  const initialBilling = params?.billing === 'yearly' ? 'yearly' : 'monthly'

  // ── Server-side geo detection (eliminates client flicker) ─────────────────
  const hdrs = await headers()
  const forced        = process.env.NEXT_PUBLIC_FORCE_REGION?.toUpperCase()
  const vercelCountry = hdrs.get('x-vercel-ip-country')
  const cfCountry     = hdrs.get('cf-ipcountry')
  const country       = forced ?? vercelCountry ?? cfCountry ?? 'US'
  const initialRegion: 'IN' | 'GLOBAL' = country === 'IN' ? 'IN' : 'GLOBAL'

  // ── Auth + plan state ─────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let currentTier                = 'none'
  let currentBillingCycle:         'monthly' | 'yearly' | null = null
  let currentSubCancelAtPeriodEnd = false

  if (user) {
    const [{ data: usage }, { data: activeSub }] = await Promise.all([
      supabase
        .from('user_usage')
        .select('tier')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('subscriptions')
        .select('billing_cycle, cancel_at_period_end')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    currentTier                = usage?.tier ?? 'free'
    currentBillingCycle        = (activeSub?.billing_cycle as 'monthly' | 'yearly' | undefined) ?? null
    currentSubCancelAtPeriodEnd = activeSub?.cancel_at_period_end ?? false
  }



  return (
    <>
      <HomeBackground noMars />
      <ParticleCanvas fullScreen count={80} />
      <Nav />
      <main className="starfield-content" style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: '1020px', margin: '0 auto', padding: '2.8rem 1.5rem 0' }}>
          <PricingPlans
            user={Boolean(user)}
            currentTier={currentTier}
            initialBilling={initialBilling}
            currentBillingCycle={currentBillingCycle}
            currentSubCancelAtPeriodEnd={currentSubCancelAtPeriodEnd}
            initialRegion={initialRegion}
          />
        </div>
      </main>
    </>
  )
}
