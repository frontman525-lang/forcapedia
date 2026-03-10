import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import LegalPageFooter from '@/components/LegalPageFooter'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export const metadata: Metadata = {
  title:       'Refund Policy',
  description: 'Read the Forcapedia Refund Policy. Learn about eligibility windows, token usage rules, and how to submit a refund request.',
  alternates:  { canonical: `${SITE_URL}/refund` },
  openGraph: {
    title:    'Refund Policy — Forcapedia',
    url:      `${SITE_URL}/refund`,
    siteName: 'Forcapedia',
    type:     'website',
  },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = 'February 24, 2026'

export default function RefundPage() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: '100vh', paddingTop: '64px', paddingBottom: '6rem' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '4rem 1.5rem 0' }}>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: '1rem',
            }}
          >
            Billing
          </p>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 300,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
              lineHeight: 1.1,
            }}
          >
            Refund Policy
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              marginBottom: '3rem',
            }}
          >
            Last updated: {LAST_UPDATED}
          </p>

          <div className="article-prose">
            <p>
              This Refund Policy explains when a refund may be approved, when it will not be approved,
              and how to submit a request. This policy applies to Forcapedia subscription and billing charges.
            </p>

            <h2>1. Refund Window</h2>
            <p>
              Refund requests must be submitted within 14 calendar days of the original charge date.
              Requests submitted after this window are generally not eligible unless required by law.
            </p>

            <h2>2. When a Refund May Be Approved</h2>
            <p>A request may be approved if one or more of the following conditions apply:</p>
            <ul>
              <li>Duplicate charges for the same billing period</li>
              <li>Incorrect plan charge caused by a verified billing error</li>
              <li>Unauthorized transaction confirmed after account review</li>
              <li>Verified service failure where Forcapedia could not provide paid access</li>
              <li>First billing period request submitted within 14 days with zero tokens used</li>
            </ul>

            <h2>3. Token Usage Rule</h2>
            <p>
              For usage-based eligibility, Forcapedia uses token consumption as the control metric.
              If any tokens were consumed in the requested billing period, monetary refund eligibility
              is generally unavailable except for billing error or confirmed platform fault.
            </p>

            <h2>4. When a Refund Is Not Approved</h2>
            <ul>
              <li>Any tokens consumed during the billing period for which refund is requested</li>
              <li>Partial-period or prorated refund requests after plan use begins</li>
              <li>Unused remaining monthly tokens after valid access was provided</li>
              <li>Failure to cancel before renewal date</li>
              <li>Change-of-mind requests after the Service has been used</li>
              <li>Dissatisfaction with AI output when the Service was functioning as designed</li>
              <li>Requests made with incomplete or unverifiable billing information</li>
            </ul>

            <h2>5. Cancellation vs Refund</h2>
            <p>
              Cancellation prevents future renewals. It does not automatically reverse charges already
              processed for the current cycle.
            </p>

            <h2>6. How to Submit a Refund Request</h2>
            <p>Send your request to:</p>
            <p>
              <a
                href="mailto:hello@forcapedia.com"
                style={{ color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px solid var(--border-gold)' }}
              >
                hello@forcapedia.com
              </a>
            </p>
            <p>Include all of the following:</p>
            <ul>
              <li>Account email used for purchase</li>
              <li>Charge date, amount, and currency</li>
              <li>Transaction ID, invoice ID, or receipt reference</li>
              <li>Short explanation of the issue</li>
              <li>Relevant screenshots or bank statement excerpt (optional but recommended)</li>
            </ul>

            <h2>7. Review Timelines</h2>
            <ul>
              <li>Initial response target: within 2 business days</li>
              <li>Standard decision window: 3 to 7 business days</li>
              <li>Complex investigations: may require additional time for provider review</li>
            </ul>

            <h2>8. Approved Refund Processing</h2>
            <p>
              If approved, refunds are issued to the original payment method. Bank or card settlement
              time depends on your payment provider and may take additional business days after approval.
            </p>

            <h2>9. Chargebacks</h2>
            <p>
              Before filing a chargeback, contact support so we can attempt quick resolution. Fraudulent
              or abusive chargeback patterns may result in account restrictions.
            </p>

            <h2>10. Policy Updates</h2>
            <p>
              We may update this policy from time to time. The latest posted version applies from
              its effective date.
            </p>

            <h2>11. Related Terms</h2>
            <p>
              This Refund Policy should be read together with our <Link href="/terms" style={{ color: 'var(--gold)' }}>Terms of Service</Link>
              {' '}and <Link href="/privacy" style={{ color: 'var(--gold)' }}>Privacy Policy</Link>.
            </p>
          </div>

          <LegalPageFooter />
        </div>
      </main>
    </>
  )
}
