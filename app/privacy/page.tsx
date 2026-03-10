import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import LegalPageFooter from '@/components/LegalPageFooter'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export const metadata: Metadata = {
  title:       'Privacy Policy',
  description: 'Read the Forcapedia Privacy Policy. Understand what data we collect, how we use it, and your rights including access, correction, and deletion.',
  alternates:  { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title:    'Privacy Policy — Forcapedia',
    url:      `${SITE_URL}/privacy`,
    siteName: 'Forcapedia',
    type:     'website',
  },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = 'February 27, 2026'

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '4rem 1.5rem 0' }}>
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
              This Privacy Policy explains what information Forcapedia collects, why we collect it,
              how we use it, and the choices available to you. This policy applies to our website,
              application interfaces, and related services.
            </p>

            <h2>1. Information We Collect</h2>
            <h3>1.1 Account and identity data</h3>
            <ul>
              <li>Name, email address, and profile image provided by your auth provider</li>
              <li>Unique account identifiers and authentication metadata</li>
              <li>Account creation and last sign-in timestamps</li>
            </ul>

            <h3>1.2 Service usage data</h3>
            <ul>
              <li>Search queries, topic lookups, and follow-up prompts</li>
              <li>Generated outputs and related article metadata</li>
              <li>Token usage, plan tier, and period usage counters</li>
              <li>Operational logs needed for reliability and abuse prevention</li>
            </ul>

            <h3>1.3 Session and device data</h3>
            <p>
              When you sign in, we record session information to help you manage your
              active devices and detect unauthorized access. This includes:
            </p>
            <ul>
              <li>A randomly generated session identifier stored in your browser (localStorage)</li>
              <li>Your IP address — used solely to derive an approximate city and country for
                display in Account &rarr; Sessions. The raw IP address is not stored in our
                database and is not displayed to you.</li>
              <li>Browser name, operating system, and device type (derived from User-Agent)</li>
              <li>Browser-reported timezone</li>
              <li>Last active timestamp</li>
            </ul>
            <p>
              You can view and remove individual sessions at any time from{' '}
              <Link href="/profile" style={{ color: 'var(--gold)' }}>Account &rarr; Sessions</Link>.
            </p>

            <h3>1.4 Billing and transaction context</h3>
            <p>
              If paid plans are enabled, payment processing is handled by authorized payment providers.
              We may receive transaction status, invoice references, and plan details, but not full card numbers.
            </p>

            <h2>2. How We Use Information</h2>
            <p>We use personal information to:</p>
            <ul>
              <li>Authenticate accounts and maintain secure sessions</li>
              <li>Provide article generation, caching, and follow-up responses</li>
              <li>Apply plan limits, enforce fair usage, and prevent abuse</li>
              <li>Troubleshoot service issues and improve performance</li>
              <li>Respond to support requests and legal obligations</li>
              <li>Communicate service updates, policy changes, and account notices</li>
            </ul>

            <h2>3. Legal Bases for Processing</h2>
            <p>Where required by applicable law, we process data under one or more legal bases:</p>
            <ul>
              <li>Performance of contract (providing the Service you requested)</li>
              <li>Legitimate interests (security, fraud prevention, product reliability)</li>
              <li>Legal compliance (records, regulatory obligations, lawful requests)</li>
              <li>Consent where specifically requested</li>
            </ul>

            <h2>4. Data Sharing and Disclosure</h2>
            <p>We do not sell personal data. We may disclose limited data to:</p>
            <ul>
              <li>Infrastructure providers (hosting, database, authentication)</li>
              <li>AI model providers for prompt processing</li>
              <li>Analytics/monitoring providers for operational diagnostics</li>
              <li>Professional advisors or authorities when required by law</li>
            </ul>
            <p>
              Shared data is limited to what is necessary for each purpose and is subject to
              contractual or policy controls.
            </p>

         

            <h2>5. Cookies and Session Technologies</h2>
            <p>
              We use essential cookies and session tokens to keep you signed in and secure your account.
              These are required for core functionality. We do not run third-party ad tracking cookies.
            </p>

            <h2>6. Data Retention</h2>
            <p>
              We retain account and usage data for as long as needed to provide the Service,
              enforce policies, resolve disputes, and meet legal obligations.
            </p>
            <p>
              If your account is deleted, personal account data is removed or anonymized within
              reasonable operational timelines, except where retention is legally required.
            </p>

            <h2>7. Data Security</h2>
            <p>
              We use administrative, technical, and organizational safeguards to protect data.
              However, no method of transmission or storage is completely secure, and absolute
              security cannot be guaranteed.
            </p>

            <h2>8. Your Rights and Choices</h2>
            <p>Depending on your location, you may have rights to:</p>
            <ul>
              <li>Access data we hold about you</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal data</li>
              <li>Object to or restrict certain processing</li>
              <li>Request data portability where applicable</li>
              <li>Withdraw consent where processing is consent-based</li>
            </ul>
            <p>
              You can manage key account actions from <Link href="/profile" style={{ color: 'var(--gold)' }}>Account settings</Link>.
              For formal privacy requests, contact support.
            </p>

            <h2>9. International Data Transfers</h2>
            <p>
              Service providers may process data in multiple jurisdictions. Where required,
              we apply safeguards intended to support lawful cross-border data transfer.
            </p>

            <h2>10. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to children under 13, and we do not knowingly collect
              personal data from children under 13. If such data is identified, we will take
              appropriate deletion steps.
            </p>

            <h2>11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy to reflect operational, legal, or product changes.
              The updated version is effective when posted unless otherwise stated.
            </p>

            <h2>12. Contact for Privacy Matters</h2>
            <p>
              For privacy questions, data rights requests, or account data concerns,
              use the channels listed on our <Link href="/contact" style={{ color: 'var(--gold)' }}>Contact page</Link>.
            </p>
          </div>

          <LegalPageFooter />
        </div>
      </main>
    </>
  )
}
