import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Link, Preview, Section, Text,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface PaymentSuccessEmailProps {
  firstName:     string
  planName:      string   // "Scholar" | "Researcher"
  planPrice:     string   // "₹499/month" | "$7.99/month"
  tokens:        string   // "2,000,000"
  orderId:       string   // provider payment ID
  invoiceNumber: string   // "INV-2026-00001"
  date:          string   // "March 10, 2026"
  nextBilling:   string   // "April 10, 2026" or ""
}

export function PaymentSuccessEmail({
  firstName     = 'there',
  planName      = 'Scholar',
  planPrice     = '₹499/month',
  tokens        = '2,000,000',
  orderId       = 'ORD-000000',
  invoiceNumber = 'INV-2026-00001',
  date          = new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }),
  nextBilling   = '',
}: PaymentSuccessEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Payment confirmed — your {planName} plan is now active.</Preview>
      <Body style={body}>

        <Container style={wrapper}>

          {/* ── Header ── */}
          <Section style={header}>
            <Text style={logoText}>
              Forca<em style={{ fontStyle: 'italic', color: GOLD }}>pedia</em>
            </Text>
          </Section>

          {/* ── Gold hairline ── */}
          <div style={goldLine} />

          {/* ── Hero ── */}
          <Section style={hero}>
            <Text style={successBadge}>Payment Confirmed</Text>
            <Heading style={h1}>You&apos;re on {planName}.</Heading>
            <Text style={paragraph}>
              Hi {firstName}, your payment was successful. You now have access to{' '}
              <strong>{tokens} tokens per month</strong> and all {planName} features.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* ── Plan summary ── */}
          <Section style={summarySection}>
            <Text style={sectionLabel}>PLAN SUMMARY</Text>
            {[
              ['Plan',           planName],
              ['Price',          planPrice],
              ['Tokens / month', tokens],
              ['Invoice',        invoiceNumber],
              ['Payment ID',     orderId],
              ['Date',           date],
              ...(nextBilling ? [['Next billing', nextBilling]] : []),
            ].map(([k, v]) => (
              <div key={k} style={summaryRow}>
                <Text style={summaryKey}>{k}</Text>
                <Text style={summaryVal}>{v}</Text>
              </div>
            ))}
          </Section>

          <Hr style={divider} />

          {/* ── What's included ── */}
          <Section style={featuresSection}>
            <Text style={sectionLabel}>WHAT&apos;S INCLUDED</Text>
            {[
              `${tokens} tokens per month`,
              'Unlimited Highlight & Explain',
              'Progress tracking across all articles',
              planName === 'Researcher' ? 'Priority processing + dedicated support' : 'Priority support',
            ].map(f => (
              <Section key={f} style={featureRow}>
                <div style={featureDot} />
                <Text style={featureText}>{f}</Text>
              </Section>
            ))}
          </Section>

          <Hr style={divider} />

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button href={SITE} style={ctaButton}>Start exploring</Button>
          </Section>

          {/* ── Footer ── */}
          <Section style={footer}>
            <Text style={footerText}>
              Questions?{' '}
              <Link href={`${SITE}/contact`} style={footerLink}>Contact support</Link>
              {' '}or reply to this email.
            </Text>
            <Text style={footerText}>
              <Link href={`${SITE}/privacy`} style={footerLink}>Privacy</Link>
              {' · '}
              <Link href={`${SITE}/terms`} style={footerLink}>Terms</Link>
              {' · '}
              <Link href={`${SITE}/refund`} style={footerLink}>Refund Policy</Link>
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} Forcapedia. All rights reserved.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ── Design tokens (identical to WelcomeEmail) ─────────────────────────────────
const GOLD   = '#C9A96E'
const INK    = '#111111'
const MUTED  = '#666666'
const BORDER = '#E5E2DC'
const BG     = '#F7F5F1'

const body: React.CSSProperties = {
  backgroundColor: BG,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif',
  margin: 0,
  padding: 0,
}

const wrapper: React.CSSProperties = {
  backgroundColor: '#ffffff',
  maxWidth: '560px',
  margin: '0 auto',
  borderRadius: '8px',
  overflow: 'hidden',
  border: `1px solid ${BORDER}`,
}

const header: React.CSSProperties = {
  padding: '28px 40px 22px',
  borderBottom: `1px solid ${BORDER}`,
}

const logoText: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '22px',
  fontWeight: 300,
  color: INK,
  margin: 0,
  letterSpacing: '-0.01em',
  lineHeight: 1,
}

const goldLine: React.CSSProperties = {
  height: '3px',
  background: `linear-gradient(90deg, transparent 0%, ${GOLD} 40%, #E0B87A 60%, transparent 100%)`,
}

const hero: React.CSSProperties = {
  padding: '32px 40px 20px',
}

const successBadge: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#2D7A4F',
  background: 'rgba(45,122,79,0.08)',
  border: '1px solid rgba(45,122,79,0.22)',
  padding: '4px 12px',
  borderRadius: '100px',
  margin: '0 0 14px',
}

const h1: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '28px',
  fontWeight: 400,
  color: INK,
  margin: '0 0 14px',
  lineHeight: '1.2',
  letterSpacing: '-0.01em',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.7',
  color: '#444444',
  margin: 0,
}

const divider: React.CSSProperties = {
  borderColor: BORDER,
  margin: '0 40px',
}

const summarySection: React.CSSProperties = {
  padding: '8px 0',
}

const sectionLabel: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px',
  letterSpacing: '0.14em',
  color: MUTED,
  margin: '24px 40px 12px',
  textTransform: 'uppercase' as const,
}

const summaryRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${BORDER}`,
  padding: '8px 40px',
}

const summaryKey: React.CSSProperties = {
  fontSize: '13px',
  color: MUTED,
  margin: 0,
}

const summaryVal: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: INK,
  margin: 0,
}

const featuresSection: React.CSSProperties = {
  padding: '8px 0',
}

const featureRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '5px 40px 5px 36px',
  gap: '14px',
}

const featureDot: React.CSSProperties = {
  width: '5px',
  height: '5px',
  borderRadius: '50%',
  backgroundColor: GOLD,
  marginTop: '7px',
  flexShrink: 0,
}

const featureText: React.CSSProperties = {
  fontSize: '13.5px',
  color: '#333333',
  margin: 0,
  lineHeight: '1.6',
}

const ctaSection: React.CSSProperties = {
  padding: '32px 40px 24px',
  textAlign: 'center',
}

const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: INK,
  color: '#ffffff',
  padding: '13px 32px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 600,
  letterSpacing: '0.03em',
  textDecoration: 'none',
  textAlign: 'center',
}

const footer: React.CSSProperties = {
  backgroundColor: BG,
  padding: '20px 40px 24px',
  borderTop: `1px solid ${BORDER}`,
  textAlign: 'center',
}

const footerText: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  lineHeight: '1.6',
  margin: '0 0 4px',
}

const footerLink: React.CSSProperties = {
  color: GOLD,
  textDecoration: 'none',
}
