import {
  Body, Container, Head, Heading, Hr, Html,
  Link, Preview, Section, Text,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface OtpEmailProps {
  otp:   string   // 6-digit code
  email: string
}

export function OtpEmail({ otp = '000000', email = '' }: OtpEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your Forcapedia verification code: {otp}</Preview>
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
            <Heading style={h1}>Your verification code.</Heading>
            <Text style={paragraph}>
              Use the code below to reset your password for{' '}
              <strong>{email}</strong>.
            </Text>
          </Section>

          {/* ── OTP display ── */}
          <Section style={otpSection}>
            <Text style={otpCode}>{otp}</Text>
            <Text style={otpHint}>This code expires in 1 hour.</Text>
          </Section>

          <Hr style={divider} />

          {/* ── Footer ── */}
          <Section style={footer}>
            <Text style={footerText}>
              If you didn't request this, ignore this email — your account is safe.
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
  maxWidth: '480px',
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
  padding: '32px 40px 8px',
}

const h1: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '26px',
  fontWeight: 400,
  color: INK,
  margin: '0 0 12px',
  lineHeight: '1.2',
  letterSpacing: '-0.01em',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '1.7',
  color: '#444444',
  margin: 0,
}

const otpSection: React.CSSProperties = {
  padding: '32px 40px 28px',
  textAlign: 'center',
}

const otpCode: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '48px',
  fontWeight: 700,
  letterSpacing: '14px',
  color: INK,
  margin: '0 0 10px',
  lineHeight: 1,
}

const otpHint: React.CSSProperties = {
  fontSize: '13px',
  color: MUTED,
  margin: 0,
}

const divider: React.CSSProperties = {
  borderColor: BORDER,
  margin: '0 40px',
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
