import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Link, Preview, Section, Text,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface WelcomeEmailProps {
  firstName: string
}

export function WelcomeEmail({ firstName = 'there' }: WelcomeEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to Forcapedia — your knowledge journey starts now.</Preview>
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
            <Heading style={h1}>Welcome, {firstName}.</Heading>
            <Text style={body2}>
              Your account is ready. You now have access to the world's most
              intelligent encyclopedia — search any topic and get a clear,
              structured answer in seconds.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* ── Features — no emojis, clean marker ── */}
          <Section style={featuresSection}>
            <Text style={sectionLabel}>WHAT YOU CAN DO</Text>

            {[
              {
                title: 'Search anything',
                desc: 'Type any topic and get a full AI-generated article grounded in verified sources.',
              },
              {
                title: 'Highlight & Explain',
                desc: 'Select any passage in an article and get a simpler explanation on the spot.',
              },
              {
                title: 'Track your learning',
                desc: 'Every article you read is saved. Pick up exactly where you left off.',
              },
            ].map(f => (
              <Section key={f.title} style={featureRow}>
                <div style={featureDot} />
                <div>
                  <Text style={featureTitle}>{f.title}</Text>
                  <Text style={featureDesc}>{f.desc}</Text>
                </div>
              </Section>
            ))}
          </Section>

          <Hr style={divider} />

          {/* ── CTA ── */}
          <Section style={ctaSection}>
            <Button href={SITE} style={ctaButton}>
              Start exploring
            </Button>
          </Section>

          {/* ── Footer ── */}
          <Section style={footer}>
            <Text style={footerText}>
              You received this because you created a Forcapedia account.
            </Text>
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

// ── Design tokens ──────────────────────────────────────────────────────────────
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
  padding: '36px 40px 24px',
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

const body2: React.CSSProperties = {
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
  padding: '6px 40px 6px 36px',
  gap: '14px',
}

const featureDot: React.CSSProperties = {
  width: '5px',
  height: '5px',
  borderRadius: '50%',
  backgroundColor: GOLD,
  marginTop: '6px',
  flexShrink: 0,
}

const featureTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: INK,
  margin: '0 0 3px',
  letterSpacing: '0.01em',
}

const featureDesc: React.CSSProperties = {
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
