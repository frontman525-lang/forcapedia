import {
  Body, Button, Container, Head, Heading, Html,
  Link, Preview, Section, Text, Hr,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface ConfirmEmailProps {
  confirmLink: string
  email:       string
}

export function ConfirmEmail({
  confirmLink = '#',
  email       = '',
}: ConfirmEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Confirm your Forcapedia account to start learning.</Preview>
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
            <Heading style={h1}>Confirm your email.</Heading>
            <Text style={para}>
              Thanks for signing up. Click the button below to verify
              <strong> {email}</strong> and activate your Forcapedia account.
            </Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Button href={confirmLink} style={ctaButton}>
              Confirm email address
            </Button>
          </Section>

          {/* Note */}
          <Section style={noteSection}>
            <Text style={noteText}>
              This link will expire in 24 hours. If you didn't create an
              account, you can safely ignore this email.
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
const ctaSection: React.CSSProperties = { padding: '12px 40px 32px', textAlign: 'center' }
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
  fontSize: '13px', lineHeight: '1.6', color: '#888888', margin: 0,
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
