import {
  Body, Button, Container, Head, Heading, Html,
  Link, Preview, Section, Text, Hr,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface ResetPasswordEmailProps {
  resetLink: string
  email:     string
}

export function ResetPasswordEmail({
  resetLink = '#',
  email     = '',
}: ResetPasswordEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reset your Forcapedia password — link valid for 1 hour.</Preview>
      <Body style={body}>
        <Container style={wrapper}>

          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>
              Forca<em style={{ fontStyle: 'italic', color: GOLD }}>pedia</em>
            </Text>
          </Section>
          <div style={goldLine} />

          {/* Content */}
          <Section style={content}>
            <Heading style={h1}>Reset your password.</Heading>
            <Text style={para}>
              We received a request to reset the password for the Forcapedia
              account associated with <strong>{email}</strong>.
            </Text>
            <Text style={para}>
              Click the button below to choose a new password. This link is
              valid for <strong>1 hour</strong>.
            </Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button href={resetLink} style={ctaButton}>
              Reset password
            </Button>
          </Section>

          {/* Security note */}
          <Section style={noteSection}>
            <Text style={noteText}>
              If you didn't request this, you can safely ignore this email —
              your password will not change.
            </Text>
            <Text style={noteText}>
              For security, do not share this link with anyone.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
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

// ── Tokens ────────────────────────────────────────────────────────────────────
const GOLD   = '#C9A96E'
const INK    = '#111111'
const BORDER = '#E5E2DC'
const BG     = '#F7F5F1'

const body: React.CSSProperties = {
  backgroundColor: BG,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif',
  margin: 0, padding: 0,
}
const wrapper: React.CSSProperties = {
  backgroundColor: '#ffffff',
  maxWidth: '560px',
  margin: '0 auto',
  borderRadius: '8px',
  overflow: 'hidden',
  border: `1px solid ${BORDER}`,
}
const header: React.CSSProperties = { padding: '28px 40px 22px', borderBottom: `1px solid ${BORDER}` }
const logoText: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '22px', fontWeight: 300, color: INK,
  margin: 0, letterSpacing: '-0.01em', lineHeight: 1,
}
const goldLine: React.CSSProperties = {
  height: '3px',
  background: `linear-gradient(90deg, transparent 0%, ${GOLD} 40%, #E0B87A 60%, transparent 100%)`,
}
const content: React.CSSProperties = { padding: '36px 40px 12px' }
const h1: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '26px', fontWeight: 400, color: INK,
  margin: '0 0 16px', lineHeight: '1.25', letterSpacing: '-0.01em',
}
const para: React.CSSProperties = {
  fontSize: '15px', lineHeight: '1.7', color: '#444444', margin: '0 0 12px',
}
const ctaSection: React.CSSProperties = { padding: '12px 40px 28px', textAlign: 'center' }
const ctaButton: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: INK,
  color: '#ffffff',
  padding: '13px 32px',
  borderRadius: '6px',
  fontSize: '14px', fontWeight: 600, letterSpacing: '0.03em',
  textDecoration: 'none', textAlign: 'center',
}
const noteSection: React.CSSProperties = { padding: '0 40px 20px' }
const noteText: React.CSSProperties = {
  fontSize: '13px', lineHeight: '1.6', color: '#888888', margin: '0 0 6px',
}
const divider: React.CSSProperties = { borderColor: BORDER, margin: '0 40px' }
const footer: React.CSSProperties = {
  backgroundColor: BG, padding: '20px 40px 24px',
  borderTop: `1px solid ${BORDER}`, textAlign: 'center',
}
const footerText: React.CSSProperties = {
  fontSize: '12px', color: '#999999', lineHeight: '1.6', margin: '0 0 4px',
}
const footerLink: React.CSSProperties = { color: GOLD, textDecoration: 'none' }
