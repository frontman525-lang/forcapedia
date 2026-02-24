import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'

export const metadata: Metadata = { title: 'Terms of Service - Forcapedia' }

const LAST_UPDATED = 'February 24, 2026'

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)',
            marginBottom: '3rem',
          }}>
            Last updated: {LAST_UPDATED}
          </p>

          <div className="article-prose">
            <p>
              These Terms of Service (&quot;Terms&quot;) are a legal agreement between you and Forcapedia
              (&quot;Forcapedia&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By accessing or using our website, APIs, and related
              services (collectively, the &quot;Service&quot;), you agree to these Terms. If you do not agree,
              do not use the Service.
            </p>

            <h2>1. Scope of Service</h2>
            <p>
              Forcapedia provides AI-generated knowledge content, including topic-based articles,
              follow-up answers, and related contextual information. Content may include a &quot;verified at&quot;
              timestamp that indicates generation or refresh time.
            </p>
            <p>
              The Service is informational. It is not professional advice and must not be treated
              as medical, legal, financial, safety, or other regulated guidance.
            </p>

            <h2>2. Eligibility and Account Requirements</h2>
            <p>
              You must be at least 13 years old to use the Service. By creating an account or signing in,
              you represent that you meet this requirement and that the information you provide is accurate.
            </p>
            <p>
              You are responsible for activity performed under your account. Keep your login credentials
              secure and promptly notify us if you suspect unauthorized access.
            </p>

            <h2>3. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Generate, promote, or distribute unlawful, harmful, fraudulent, or deceptive content</li>
              <li>Bypass usage controls such as token limits, tier restrictions, or rate limits</li>
              <li>Perform bulk scraping, reverse engineering, probing, or abuse of our systems</li>
              <li>Operate bots or automation that materially harms service reliability or fairness</li>
              <li>Impersonate others or create multiple accounts to evade platform policies</li>
              <li>Resell or sublicense access to the Service without written permission</li>
            </ul>
            <p>
              We may suspend or terminate access for violations, abuse, fraud risk, legal compliance,
              or security reasons.
            </p>

            <h2>4. Plans, Tokens, and Usage Controls</h2>
            <p>
              Plans include monthly usage allowances. When you reach your plan limit, access to some
              capabilities may be restricted until your next cycle or plan upgrade.
            </p>
            <p>
              Limits, features, and pricing may differ by tier and may be updated over time. Current plan
              details are shown on the <Link href="/pricing" style={{ color: 'var(--gold)' }}>Pricing page</Link>.
            </p>
            <p>
              Unless expressly stated, unused monthly tokens do not roll over.
            </p>

            <h2>5. AI Content and Accuracy Disclaimer</h2>
            <p>
              Content is generated or transformed using AI models and external information sources.
              While we design for quality and factual grounding, outputs may still contain errors,
              omissions, or outdated statements.
            </p>
            <p>
              You are responsible for independent verification before relying on any output,
              especially for high-impact decisions.
            </p>

            <h2>6. Intellectual Property and License</h2>
            <p>
              The Forcapedia brand, platform design, and software are proprietary and protected by
              applicable law. Subject to these Terms, we grant you a limited, non-exclusive,
              revocable license to use the Service for personal or internal business use.
            </p>
            <p>
              You may not remove notices, copy substantial portions of the platform, or redistribute
              content at scale in ways that violate law or these Terms.
            </p>

            <h2>7. Payments, Billing, and Renewals</h2>
            <p>
              Paid plans, when enabled, are billed on a recurring basis unless cancelled. You authorize
              applicable charges, taxes, and processing fees tied to your selected plan.
            </p>
            <p>
              Cancellation stops future renewals and takes effect at the end of your current billing cycle
              unless otherwise required by law.
            </p>

            <h2>8. Refunds</h2>
            <p>
              Refunds are handled under our <Link href="/refund" style={{ color: 'var(--gold)' }}>Refund Policy</Link>.
              Except where required by law, fees are generally non-refundable once a billing cycle has started.
            </p>

            <h2>9. Service Availability and Changes</h2>
            <p>
              We may change, improve, suspend, or discontinue parts of the Service at any time.
              We target reliable operation but do not guarantee uninterrupted or error-free availability.
            </p>

            <h2>10. Suspension and Termination</h2>
            <p>
              You may stop using the Service at any time. We may suspend or terminate accounts for policy
              violations, abuse, legal compliance, security risk, or prolonged inactivity.
            </p>
            <p>
              Provisions that by nature should survive termination will survive, including limitations
              of liability and dispute-related terms.
            </p>

            <h2>11. Warranties and Limitation of Liability</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available.&quot; To the maximum extent permitted by law,
              we disclaim implied warranties, including merchantability, fitness for a particular purpose,
              and non-infringement.
            </p>
            <p>
              To the maximum extent permitted by law, we are not liable for indirect, incidental, special,
              consequential, or punitive damages, or loss of data, profits, goodwill, or business opportunity.
            </p>

            <h2>12. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Forcapedia and its operators from claims, damages,
              liabilities, and expenses arising from your misuse of the Service, your content, or your
              violation of these Terms or applicable law.
            </p>

            <h2>13. Governing Law and Disputes</h2>
            <p>
              These Terms are governed by applicable law in the jurisdiction associated with Forcapedia&apos;s
              operating entity, without regard to conflict-of-law rules.
            </p>
            <p>
              Before filing formal claims, you agree to contact us and attempt good-faith resolution.
            </p>

            <h2>14. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Updated Terms become effective when posted,
              unless a later date is stated. Continued use after updates means you accept the revised Terms.
            </p>

            <h2>15. Contact</h2>
            <p>
              For questions about these Terms, see our <Link href="/contact" style={{ color: 'var(--gold)' }}>Contact page</Link>.
              For account and data actions, visit your <Link href="/profile" style={{ color: 'var(--gold)' }}>Account settings</Link>.
            </p>
          </div>

          <div style={{
            marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)',
            display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
          }}>
            <Link href="/privacy" style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.05em',
              textTransform: 'uppercase', color: 'var(--text-tertiary)', textDecoration: 'none',
            }}>
              Privacy Policy
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
              &larr; Home
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
