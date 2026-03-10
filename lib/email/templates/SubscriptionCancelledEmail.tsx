import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Link, Preview, Section, Text,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface SubscriptionCancelledEmailProps {
  firstName:   string
  planName:    string   // "Scholar" | "Researcher"
  accessUntil: string   // "April 10, 2026" or "" (immediate cancellation)
}

export function SubscriptionCancelledEmail({
  firstName   = 'there',
  planName    = 'Scholar',
  accessUntil = '',
}: SubscriptionCancelledEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your {planName} subscription has been cancelled.</Preview>
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
            <Text style={cancelBadge}>Subscription Cancelled</Text>
            <Heading style={h1}>Your {planName} plan has been cancelled.</Heading>
            <Text style={paragraph}>
              Hi {firstName}, we&apos;ve confirmed the cancellation of your{' '}
              <strong>{planName}</strong> subscription.
              {accessUntil
                ? ` You'll retain access to all ${planName} features until ${accessUntil}.`
                : ' Your access has been downgraded to the free plan.'}
            </Text>
          </Section>

          <Hr style={divider} />

          {/* ── What happens next ── */}
          <Section style={featuresSection}>
            <Text style={sectionLabel}>WHAT HAPPENS NEXT</Text>
            {[
              accessUntil
                ? `Premium access continues until ${accessUntil}`
                : 'Your account is now on the free plan',
              'No further charges will be made',
              'Your search history and saved articles remain intact',
              'You can upgrade again at any time',
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
            <Button href={`${SITE}/pricing`} style={ctaButton}>Upgrade again anytime</Button>
            <Text style={ctaHint}>
              Questions?{' '}
              <Link href={`${SITE}/contact`} style={inlineLink}>Contact support</Link>
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

const cancelBadge: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: MUTED,
  background: 'rgba(102,102,102,0.08)',
  border: `1px solid rgba(102,102,102,0.22)`,
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

const featuresSection: React.CSSProperties = {
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
