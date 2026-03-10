import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Link, Preview, Section, Text,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface PaymentFailedEmailProps {
  firstName: string
  planName:  string   // "Scholar" | "Researcher"
  retryUrl:  string   // URL to update payment method
}

export function PaymentFailedEmail({
  firstName = 'there',
  planName  = 'Scholar',
  retryUrl  = `${SITE}/pricing`,
}: PaymentFailedEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {planName} payment failed — here&apos;s what to do next.</Preview>
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
            <Text style={failBadge}>Payment Failed</Text>
            <Heading style={h1}>We couldn&apos;t process your payment.</Heading>
            <Text style={paragraph}>
              Hi {firstName}, your payment for the <strong>{planName}</strong> plan
              didn&apos;t go through. Your access is retained while we retry — no
              action is needed right now, but please check your payment method.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* ── Steps ── */}
          <Section style={stepsSection}>
            <Text style={sectionLabel}>WHAT TO DO NEXT</Text>
            {[
              {
                n: '1',
                title: 'Check your payment method',
                desc:  'Make sure your card is valid and has sufficient balance.',
              },
              {
                n: '2',
                title: 'We will retry automatically',
                desc:  'Your payment provider will attempt to charge again. No action needed unless retries fail.',
              },
              {
                n: '3',
                title: 'Contact support if it persists',
                desc:  'If the issue continues after retries, reach out and we\'ll help you manually.',
              },
            ].map(s => (
              <Section key={s.n} style={stepRow}>
                <div style={stepNum}>{s.n}</div>
                <div>
                  <Text style={stepTitle}>{s.title}</Text>
                  <Text style={stepDesc}>{s.desc}</Text>
                </div>
              </Section>
            ))}
          </Section>

          <Hr style={divider} />

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button href={retryUrl} style={ctaButton}>Update payment method</Button>
            <Text style={ctaHint}>
              Or{' '}
              <Link href={`${SITE}/contact`} style={inlineLink}>contact support</Link>
              {' '}if you need help.
            </Text>
          </Section>

          {/* ── Footer ── */}
          <Section style={footer}>
            <Text style={footerText}>
              <Link href={`${SITE}/privacy`} style={footerLink}>Privacy</Link>
              {' · '}
              <Link href={`${SITE}/terms`} style={footerLink}>Terms</Link>
              {' · '}
              <Link href={`${SITE}/contact`} style={footerLink}>Contact</Link>
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

const failBadge: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#C0392B',
  background: 'rgba(192,57,43,0.07)',
  border: '1px solid rgba(192,57,43,0.22)',
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

const stepsSection: React.CSSProperties = {
  padding: '8px 0',
}

const sectionLabel: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px',
  letterSpacing: '0.14em',
  color: MUTED,
  margin: '24px 40px 16px',
  textTransform: 'uppercase' as const,
}

const stepRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '4px 40px 12px',
  gap: '14px',
}

const stepNum: React.CSSProperties = {
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  backgroundColor: GOLD,
  color: INK,
  fontSize: '11px',
  fontWeight: 700,
  textAlign: 'center',
  lineHeight: '22px',
  flexShrink: 0,
}

const stepTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: INK,
  margin: '0 0 3px',
}

const stepDesc: React.CSSProperties = {
  fontSize: '13px',
  color: MUTED,
  lineHeight: '1.55',
  margin: 0,
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

const ctaHint: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  margin: '12px 0 0',
  textAlign: 'center',
}

const inlineLink: React.CSSProperties = {
  color: GOLD,
  textDecoration: 'none',
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
