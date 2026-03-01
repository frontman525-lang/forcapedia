import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import PricingPlans from '@/components/PricingPlans'

export const metadata: Metadata = { title: 'Pricing - Forcapedia' }

interface Props {
  searchParams: Promise<{ billing?: string }>
}

export default async function PricingPage({ searchParams }: Props) {
  const params = await searchParams
  const initialBilling = params?.billing === 'yearly' ? 'yearly' : 'monthly'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let currentTier = 'none'
  if (user) {
    const { data: usage } = await supabase
      .from('user_usage')
      .select('tier')
      .eq('user_id', user.id)
      .single()
    currentTier = usage?.tier ?? 'free'
  }

  return (
    <>
      <Nav />
      <main style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem', background: 'var(--ink)' }}>
        <div style={{ maxWidth: '1020px', margin: '0 auto', padding: '2.8rem 1.5rem 0' }}>
          <PricingPlans
            user={Boolean(user)}
            currentTier={currentTier}
            initialBilling={initialBilling}
          />
        </div>
      </main>
    </>
  )
}
