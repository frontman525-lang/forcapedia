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
      <style>{`
        .sp-bg {
          position: fixed; inset: 0; z-index: 0;
          background: #000; overflow: hidden;
        }
        .sp-bg::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            radial-gradient(1px   1px   at  6%  6%,  rgba(255,255,255,0.75) 0%, transparent 100%),
            radial-gradient(1px   1px   at 18% 12%,  rgba(255,255,255,0.45) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 31%  4%,  rgba(255,255,255,0.65) 0%, transparent 100%),
            radial-gradient(1px   1px   at 44% 19%,  rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px   1px   at 57%  8%,  rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 70%  3%,  rgba(255,255,255,0.85) 0%, transparent 100%),
            radial-gradient(1px   1px   at 82% 15%,  rgba(255,255,255,0.45) 0%, transparent 100%),
            radial-gradient(1px   1px   at 93% 22%,  rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1px   1px   at  3% 28%,  rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px   1px   at 12% 38%,  rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 25% 32%,  rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1px   1px   at 38% 44%,  rgba(255,255,255,0.32) 0%, transparent 100%),
            radial-gradient(1px   1px   at 52% 36%,  rgba(255,255,255,0.42) 0%, transparent 100%),
            radial-gradient(1px   1px   at 65% 28%,  rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 77% 40%,  rgba(255,255,255,0.60) 0%, transparent 100%),
            radial-gradient(1px   1px   at 88% 33%,  rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px   1px   at  8% 55%,  rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px   1px   at 48% 70%,  rgba(255,255,255,0.22) 0%, transparent 100%),
            radial-gradient(1px   1px   at 91% 62%,  rgba(255,255,255,0.22) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 35% 80%,  rgba(255,255,255,0.32) 0%, transparent 100%),
            radial-gradient(1px   1px   at 72% 75%,  rgba(255,255,255,0.20) 0%, transparent 100%),
            radial-gradient(1px   1px   at 15% 65%,  rgba(255,255,255,0.20) 0%, transparent 100%),
            radial-gradient(1px   1px   at 58% 88%,  rgba(255,255,255,0.18) 0%, transparent 100%);
        }
        html.light .sp-bg { background: #F7F5F0; }
        html.light .sp-bg::before { display: none; }
      `}</style>
      <div className="sp-bg" />
      <Nav />
      <ProfileDashboard user={user} usage={usage} />
    </>
  )
}
