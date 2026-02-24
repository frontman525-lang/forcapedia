import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'

export const metadata: Metadata = { title: 'Privacy Policy — Forcapedia' }

const LAST_UPDATED = 'February 22, 2026'

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '4rem 1.5rem 0' }}>

          {/* Header */}
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1rem',
          }}>
            Legal
          </p>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 300, color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.1,
          }}>
            Privacy Policy
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)',
            marginBottom: '3rem',
          }}>
            Last updated: {LAST_UPDATED}
          </p>

          <div className="article-prose">

            <p>
              Your privacy matters. This policy explains what data Forcapedia collects, how we use it,
              and what controls you have. We keep it short and plain.
            </p>

            <h2>1. What We Collect</h2>
            <p>When you sign in with Google, we receive and store:</p>
            <ul>
              <li>Your name and email address (from your Google account)</li>
              <li>Your Google profile photo URL</li>
              <li>A unique user ID linked to your Google account</li>
            </ul>
            <p>When you use the Service, we also collect:</p>
            <ul>
              <li>Search queries you submit (to generate and cache articles)</li>
              <li>Follow-up questions you ask on articles</li>
              <li>Token usage counts (to enforce plan limits)</li>
              <li>Your subscription tier (Free, Scholar, or Researcher)</li>
              <li>Timestamps of account creation and last sign-in</li>
            </ul>
            <p>We do <strong>not</strong> collect passwords, payment card details, or device fingerprints.</p>

            <h2>2. How We Use Your Data</h2>
            <p>We use your data to:</p>
            <ul>
              <li>Authenticate you via Google OAuth</li>
              <li>Enforce monthly token limits per plan</li>
              <li>Cache and serve AI-generated articles</li>
              <li>Display your profile information in the account dashboard</li>
              <li>Detect and prevent abuse (rate limiting, duplicate account detection)</li>
              <li>Send transactional communications if required (e.g. billing alerts)</li>
            </ul>
            <p>We do <strong>not</strong> sell your data. We do not use your data to train AI models.</p>

            <h2>3. Data Storage</h2>
            <p>
              All data is stored in <strong>Supabase</strong> (PostgreSQL), hosted on secure cloud
              infrastructure. Row-level security (RLS) ensures you can only access your own data —
              no user can read another user's records.
            </p>
            <p>
              Article content generated from your searches is stored in our shared articles cache.
              Since articles are public knowledge, the same article may be served to multiple users
              who search the same topic.
            </p>

            <h2>4. Third-Party Services</h2>
            <p>Forcapedia uses the following third-party services:</p>
            <ul>
              <li><strong>Google OAuth</strong> — authentication only. We do not access your Gmail, Drive, or other Google services.</li>
              <li><strong>Supabase</strong> — database and authentication infrastructure.</li>
              <li><strong>Groq / Gemini / DeepSeek</strong> — AI article generation. Your search query is sent to these services to generate content. We do not send your name or email to AI providers.</li>
              <li><strong>Serper.dev</strong> — web search for live news content (Tier 1 & 2 only). Only your search query is sent.</li>
              <li><strong>Vercel</strong> — hosting and edge delivery.</li>
            </ul>

            <h2>5. Cookies & Sessions</h2>
            <p>
              We use a single session cookie to keep you signed in. This cookie is set by Supabase
              Auth and is necessary for the Service to function. We do not use advertising cookies
              or third-party tracking cookies.
            </p>

            <h2>6. Data Retention</h2>
            <p>
              Your account data is retained for as long as your account is active. If you delete your
              account, your personal data (name, email, usage records, saved articles, follow-ups)
              is permanently deleted. Cached article content you triggered may remain, as it is shared
              public knowledge not linked to your identity.
            </p>

            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access</strong> — view your data in your Account dashboard at any time</li>
              <li><strong>Delete</strong> — delete your account and associated data from Account → Data</li>
              <li><strong>Export</strong> — download your data (available to paid tier users)</li>
              <li><strong>Opt out</strong> — stop using the Service and delete your account at any time</li>
            </ul>

            <h2>8. Children's Privacy</h2>
            <p>
              Forcapedia is not directed to children under 13. We do not knowingly collect data from
              children. If you believe a child has created an account, contact us for removal.
            </p>

            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The "Last updated" date at the top
              reflects the most recent change. Continued use of the Service constitutes acceptance.
            </p>

            <h2>10. Contact</h2>
            <p>
              For privacy questions or data requests, use the contact information available on
              the platform. To delete your account, visit{' '}
              <Link href="/profile" style={{ color: 'var(--gold)' }}>Account → Data</Link>.
            </p>

          </div>

          {/* Footer nav */}
          <div style={{
            marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)',
            display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
          }}>
            <Link href="/terms" style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.05em',
              textTransform: 'uppercase', color: 'var(--text-tertiary)', textDecoration: 'none',
            }}>
              Terms of Service
            </Link>
            <Link href="/pricing" style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.05em',
              textTransform: 'uppercase', color: 'var(--text-tertiary)', textDecoration: 'none',
            }}>
              Pricing
            </Link>
            <Link href="/" style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.05em',
              textTransform: 'uppercase', color: 'var(--text-tertiary)', textDecoration: 'none',
            }}>
              ← Home
            </Link>
          </div>

        </div>
      </main>
    </>
  )
}
