import {
  Body, Button, Container, Head, Hr, Html,
  Heading, Link, Preview, Section, Text,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface PaymentFailedEmailProps {
  firstName: string
  planName:  string   // "Scholar" | "Researcher"
  retryUrl:  string   // URL to retry payment
  reason?:   string   // Optional reason from payment gateway
}

export function PaymentFailedEmail({
  firstName = 'there',
  planName  = 'Scholar',
  retryUrl  = `${SITE}/pricing`,
  reason,
}: PaymentFailedEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your payment for {planName} didn&apos;t go through — here&apos;s what to do.</Preview>
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
            <Text style={failBadge}>⚠ Payment Failed</Text>
            <Heading style={h1}>We couldn&apos;t process your payment.</Heading>
            <Text style={paragraph}>
              Hi {firstName}, your payment for the <strong>{planName}</strong> plan
              was not successful.{' '}
              {reason && <span>Reason: <em>{reason}</em>. </span>}
              Don&apos;t worry — your account remains active on the Free plan and no
              charges were made.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Steps */}
          <Section style={{ padding: '20px 40px' }}>
            <Text style={label}>WHAT TO DO NEXT</Text>
            {[
              { n: '1', t: 'Check your payment method', d: 'Make sure your card details are correct and has sufficient balance.' },
              { n: '2', t: 'Try again', d: 'Use the button below to retry the payment. It only takes a few seconds.' },
              { n: '3', t: 'Contact support', d: 'If the issue persists, reach out and we\'ll help you manually.' },
            ].map(s => (
              <div key={s.n} style={stepRow}>
                <Text style={stepNum}>{s.n}</Text>
                <div>
                  <Text style={stepTitle}>{s.t}</Text>
                  <Text style={stepDesc}>{s.d}</Text>
                </div>
              </div>
            ))}
          </Section>

          <Hr style={divider} />

          {/* CTA */}
          <Section style={{ padding: '28px 40px 8px', textAlign: 'center' }}>
            <Button href={retryUrl} style={button}>Retry Payment →</Button>
            <Text style={{ fontSize: '12px', color: '#999', margin: '12px 0 0', textAlign: 'center' }}>
              Or{' '}
              <Link href={`${SITE}/contact`} style={{ color: GOLD, textDecoration: 'none' }}>
                contact support
              </Link>
              {' '}if you need help.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              <Link href={`${SITE}/privacy`} style={footerLink}>Privacy</Link>
              {' · '}
              <Link href={`${SITE}/terms`} style={footerLink}>Terms</Link>
            </Text>
            <Text style={footerText}>© {new Date().getFullYear()} Forcapedia</Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ── Tokens ────────────────────────────────────────────────────────────────────
const GOLD   = '#C9A96E'
const INK    = '#0D0D0F'
const GRAY   = '#666666'
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
const failBadge: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#C0392B', background: 'rgba(192,57,43,0.08)',
  border: '1px solid rgba(192,57,43,0.25)',
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
  fontSize: '10px', letterSpacing: '0.12em', color: GRAY, margin: '0 0 16px',
}
const stepRow: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', marginBottom: '16px', gap: '14px',
}
const stepNum: React.CSSProperties = {
  width: '24px', height: '24px', borderRadius: '50%',
  background: GOLD, color: INK,
  fontSize: '12px', fontWeight: 700, textAlign: 'center',
  lineHeight: '24px', flexShrink: 0, margin: '0 14px 0 0',
}
const stepTitle: React.CSSProperties = {
  fontSize: '14px', fontWeight: 600, color: INK, margin: '0 0 2px',
}
const stepDesc: React.CSSProperties = {
  fontSize: '13px', color: GRAY, lineHeight: '1.5', margin: 0,
}
const button: React.CSSProperties = {
  display: 'inline-block', backgroundColor: INK, color: '#ffffff',
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
