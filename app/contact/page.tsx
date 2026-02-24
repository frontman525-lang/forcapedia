import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'

export const metadata: Metadata = { title: 'Contact - Forcapedia' }

const LAST_UPDATED = 'February 24, 2026'

export default function ContactPage() {
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
            Support
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
            Contact Us
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
              Use this page to contact Forcapedia support for account, billing, privacy, and technical matters.
              Sending complete information helps us resolve your request faster and with fewer follow-ups.
            </p>

            <h2>1. Primary Support Channel</h2>
            <p>
              Email:
              {' '}
              <a
                href="mailto:hello@forcapedia.com"
                style={{ color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px solid var(--border-gold)' }}
              >
                hello@forcapedia.com
              </a>
            </p>

            <h2>2. Contact Categories</h2>
            <p>To route your request correctly, include one category in your email subject line:</p>
            <ul>
              <li><strong>Account</strong>: sign-in trouble, access issues, profile corrections</li>
              <li><strong>Billing</strong>: renewals, invoices, duplicate charge review, refund requests</li>
              <li><strong>Privacy</strong>: data access, deletion, or data-rights requests</li>
              <li><strong>Technical</strong>: bugs, failed generation, API or page behavior</li>
              <li><strong>Security</strong>: suspicious account activity or potential vulnerability reports</li>
            </ul>

            <h2>3. Required Details to Include</h2>
            <ul>
              <li>Account email associated with your Forcapedia access</li>
              <li>Clear description of the issue and expected behavior</li>
              <li>Exact page URL where the issue occurred</li>
              <li>Timestamp with timezone (for log tracing)</li>
              <li>Error message text and screenshot where applicable</li>
            </ul>

            <h2>4. Billing and Refund Requests</h2>
            <p>For faster billing support, include:</p>
            <ul>
              <li>Transaction ID, invoice number, or charge reference</li>
              <li>Charge amount, date, and payment method type</li>
              <li>Reason for review, with supporting evidence if available</li>
            </ul>
            <p>
              Refund decisions follow our <Link href="/refund" style={{ color: 'var(--gold)' }}>Refund Policy</Link>.
            </p>

            <h2>5. Privacy and Data Requests</h2>
            <p>
              For data access, correction, deletion, or related privacy requests, state &quot;Privacy Request&quot;
              in the subject line and specify the action requested. We may request verification details
              to protect account security before acting.
            </p>

            <h2>6. Response Targets</h2>
            <ul>
              <li>General support: typically within 24 to 48 business hours</li>
              <li>Billing investigations: usually within 3 to 7 business days</li>
              <li>Complex technical or security issues: timeline depends on severity and reproducibility</li>
            </ul>

            <h2>7. Security Reporting</h2>
            <p>
              If you believe you found a security issue, include reproduction steps and impact details.
              Do not publicly disclose exploitable details until remediation is completed.
            </p>

            <h2>8. Legal Notices</h2>
            <p>
              For legal or compliance notices, include &quot;Legal Notice&quot; in the subject line and provide
              complete sender identity and reference context.
            </p>
          </div>

          <div
            style={{
              marginTop: '3rem',
              paddingTop: '2rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/terms"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
              }}
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
              }}
            >
              Privacy
            </Link>
            <Link
              href="/pricing"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
              }}
            >
              Pricing
            </Link>
            <Link
              href="/"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                textDecoration: 'none',
              }}
            >
              &larr; Home
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
