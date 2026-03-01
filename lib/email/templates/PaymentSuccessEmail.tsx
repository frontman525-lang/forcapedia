import {
  Body, Button, Container, Head, Hr, Html,
  Heading, Link, Preview, Section, Text,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface PaymentSuccessEmailProps {
  firstName:   string
  planName:    string   // "Scholar" | "Researcher"
  planPrice:   string   // "$7.99/month"
  tokens:      string   // "2,000,000"
  orderId:     string   // Cashfree order ID
  date:        string   // "February 26, 2026"
  nextBilling: string   // "March 26, 2026"
}

export function PaymentSuccessEmail({
  firstName   = 'there',
  planName    = 'Scholar',
  planPrice   = '$7.99/month',
  tokens      = '2,000,000',
  orderId     = 'ORD-000000',
  date        = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  nextBilling = '',
}: PaymentSuccessEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Payment confirmed — your {planName} plan is now active.</Preview>
      <Body style={body}>
        <div style={goldBar} />
        <Container style={container}>

          {/* Logo */}
          <Section style={logoSection}>
            <Text style={logoText}>
              Forca<em style={{ fontStyle: 'italic', color: GOLD }}>pedia</em>
            </Text>
          </Section>

          {/* Hero */}
          <Section style={{ padding: '32px 40px 20px' }}>
            <Text style={successBadge}>✓ Payment Confirmed</Text>
            <Heading style={h1}>You&apos;re on {planName}.</Heading>
            <Text style={paragraph}>
              Hi {firstName}, your upgrade was successful. You now have access to{' '}
              <strong>{tokens} tokens per month</strong> and all {planName} features.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Plan summary */}
          <Section style={{ padding: '20px 40px' }}>
            <Text style={label}>PLAN SUMMARY</Text>
            {[
              ['Plan',         planName],
              ['Price',        planPrice],
              ['Tokens/month', tokens],
              ['Order ID',     orderId],
              ['Date',         date],
              nextBilling ? ['Next billing', nextBilling] : null,
            ].filter(Boolean).map(([k, v]) => (
              <div key={k as string} style={summaryRow}>
                <Text style={summaryKey}>{k}</Text>
                <Text style={summaryVal}>{v}</Text>
              </div>
            ))}
          </Section>

          <Hr style={divider} />

          {/* Features recap */}
          <Section style={{ padding: '20px 40px' }}>
            <Text style={label}>WHAT&apos;S INCLUDED</Text>
            {[
              `${tokens} tokens per month`,
              'Unlimited Highlight & Explain',
              'Memory Progress Tracking',
              planName === 'Researcher' ? 'Priority processing + dedicated support' : 'Priority support',
            ].map(f => (
              <Text key={f} style={featureItem}>
                <span style={{ color: GOLD, marginRight: '8px' }}>✓</span>{f}
              </Text>
            ))}
          </Section>

          <Hr style={divider} />

          {/* CTA */}
          <Section style={{ padding: '28px 40px 8px', textAlign: 'center' }}>
            <Button href={SITE} style={button}>Start Searching →</Button>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Questions? Contact us at{' '}
              <Link href={`${SITE}/contact`} style={footerLink}>support</Link>
              {' '}or reply to this email.
            </Text>
            <Text style={footerText}>
              <Link href={`${SITE}/privacy`} style={footerLink}>Privacy</Link>
              {' · '}
              <Link href={`${SITE}/terms`} style={footerLink}>Terms</Link>
              {' · '}
              <Link href={`${SITE}/refund`} style={footerLink}>Refund Policy</Link>
            </Text>
            <Text style={footerText}>© {new Date().getFullYear()} Forcapedia</Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ── Tokens ────────────────────────────────────────────────────────────────────
const GOLD = '#C9A96E'
const INK  = '#0D0D0F'
const GRAY = '#666666'
const BORDER = '#E8E4DC'

const body: React.CSSProperties = {
  backgroundColor: '#F5F3EE',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0, padding: 0,
}
const goldBar: React.CSSProperties = {
  height: '4px',
  background: `linear-gradient(90deg, ${GOLD}, #E8C97A, ${GOLD})`,
}
const container: React.CSSProperties = {
  backgroundColor: '#ffffff', maxWidth: '560px', margin: '0 auto',
  padding: '0 0 32px',
  borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`,
  borderBottom: `1px solid ${BORDER}`,
}
const logoSection: React.CSSProperties = {
  padding: '28px 40px 12px', borderBottom: `1px solid ${BORDER}`,
}
const logoText: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '22px', fontWeight: 300, color: INK, margin: 0,
}
const successBadge: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#2D7A4F', background: 'rgba(45,122,79,0.1)',
  border: '1px solid rgba(45,122,79,0.25)',
  padding: '4px 12px', borderRadius: '100px', margin: '0 0 12px',
}
const h1: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '26px', fontWeight: 400, color: INK,
  margin: '0 0 12px', lineHeight: '1.25',
}
const paragraph: React.CSSProperties = {
  fontSize: '15px', lineHeight: '1.7', color: '#333333', margin: 0,
}
const divider: React.CSSProperties = { borderColor: BORDER, margin: '0 40px' }
const label: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px', letterSpacing: '0.12em', color: GRAY, margin: '0 0 12px',
}
const summaryRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  borderBottom: `1px solid ${BORDER}`, padding: '8px 0',
}
const summaryKey: React.CSSProperties = {
  fontSize: '13px', color: GRAY, margin: 0,
}
const summaryVal: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: INK, margin: 0,
}
const featureItem: React.CSSProperties = {
  fontSize: '13.5px', color: '#333333', margin: '4px 0',
}
const button: React.CSSProperties = {
  display: 'inline-block', backgroundColor: GOLD, color: '#0D0D0F',
  padding: '12px 28px', borderRadius: '8px',
  fontSize: '14px', fontWeight: 600, textDecoration: 'none', textAlign: 'center',
}
const footerSection: React.CSSProperties = {
  padding: '20px 40px 0', textAlign: 'center',
}
const footerText: React.CSSProperties = {
  fontSize: '12px', color: '#999999', lineHeight: '1.6', margin: '0 0 4px',
}
const footerLink: React.CSSProperties = { color: GOLD, textDecoration: 'none' }
