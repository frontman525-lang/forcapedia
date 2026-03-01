import {
  Body, Container, Head, Hr, Html,
  Heading, Link, Preview, Section, Text,
} from '@react-email/components'
import * as React from 'react'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export interface InvoiceEmailProps {
  firstName:     string
  email:         string
  invoiceNumber: string   // "INV-2026-00042"
  orderId:       string   // Cashfree order ID
  date:          string   // "February 26, 2026"
  planName:      string   // "Scholar"
  amount:        string   // "7.99"
  currency:      string   // "USD"
  billingPeriod: string   // "Feb 26, 2026 – Mar 26, 2026"
}

export function InvoiceEmail({
  firstName     = 'there',
  email         = '',
  invoiceNumber = 'INV-2026-00001',
  orderId       = 'ORD-000000',
  date          = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  planName      = 'Scholar',
  amount        = '7.99',
  currency      = 'USD',
  billingPeriod = '',
}: InvoiceEmailProps) {
  const subtotal = parseFloat(amount)
  const tax      = 0 // Add tax logic when needed

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Invoice {invoiceNumber} — {currency} {amount} for Forcapedia {planName}.</Preview>
      <Body style={body}>
        <div style={goldBar} />
        <Container style={container}>

          {/* Header */}
          <Section style={header}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text style={logoText}>
                Forca<em style={{ fontStyle: 'italic', color: GOLD }}>pedia</em>
              </Text>
              <div style={{ textAlign: 'right' }}>
                <Text style={invoiceLabel}>INVOICE</Text>
                <Text style={invoiceNum}>{invoiceNumber}</Text>
              </div>
            </div>
          </Section>

          {/* Meta */}
          <Section style={{ padding: '20px 40px' }}>
            <div style={metaGrid}>
              <div>
                <Text style={metaLabel}>BILLED TO</Text>
                <Text style={metaVal}>{firstName}</Text>
                <Text style={metaVal}>{email}</Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text style={metaLabel}>DATE</Text>
                <Text style={metaVal}>{date}</Text>
                {billingPeriod && (
                  <>
                    <Text style={{ ...metaLabel, marginTop: '12px' }}>BILLING PERIOD</Text>
                    <Text style={metaVal}>{billingPeriod}</Text>
                  </>
                )}
              </div>
            </div>
          </Section>

          <Hr style={divider} />

          {/* Line items */}
          <Section style={{ padding: '20px 40px' }}>
            <div style={tableHeader}>
              <Text style={tableHeadCell}>Description</Text>
              <Text style={{ ...tableHeadCell, textAlign: 'right' }}>Amount</Text>
            </div>
            <Hr style={{ ...divider, margin: '8px 0' }} />
            <div style={tableRow}>
              <div>
                <Text style={itemTitle}>Forcapedia {planName}</Text>
                <Text style={itemDesc}>Monthly subscription</Text>
              </div>
              <Text style={itemAmount}>{currency} {subtotal.toFixed(2)}</Text>
            </div>
            <Hr style={{ ...divider, margin: '8px 0' }} />
            {tax > 0 && (
              <div style={tableRow}>
                <Text style={{ fontSize: '13px', color: '#666', margin: 0 }}>Tax</Text>
                <Text style={itemAmount}>{currency} {tax.toFixed(2)}</Text>
              </div>
            )}
            <div style={totalRow}>
              <Text style={totalLabel}>Total</Text>
              <Text style={totalAmount}>{currency} {(subtotal + tax).toFixed(2)}</Text>
            </div>
          </Section>

          <Hr style={divider} />

          {/* Order ref */}
          <Section style={{ padding: '16px 40px' }}>
            <Text style={refText}>Order reference: <strong>{orderId}</strong></Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Thank you for subscribing to Forcapedia.
            </Text>
            <Text style={footerText}>
              Questions?{' '}
              <Link href={`${SITE}/contact`} style={footerLink}>Contact support</Link>
              {' · '}
              <Link href={`${SITE}/refund`} style={footerLink}>Refund Policy</Link>
            </Text>
            <Text style={footerText}>© {new Date().getFullYear()} Forcapedia. All rights reserved.</Text>
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
  backgroundColor: '#ffffff', maxWidth: '600px', margin: '0 auto',
  padding: '0 0 32px',
  borderLeft: `1px solid ${BORDER}`, borderRight: `1px solid ${BORDER}`,
  borderBottom: `1px solid ${BORDER}`,
}
const header: React.CSSProperties = {
  padding: '28px 40px', borderBottom: `1px solid ${BORDER}`,
}
const logoText: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '22px', fontWeight: 300, color: INK, margin: 0,
}
const invoiceLabel: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px', letterSpacing: '0.12em', color: GRAY, margin: '0 0 2px',
}
const invoiceNum: React.CSSProperties = {
  fontSize: '14px', fontWeight: 700, color: INK, margin: 0,
  fontFamily: '"Courier New", Courier, monospace',
}
const metaGrid: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
}
const metaLabel: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase',
  color: GRAY, margin: '0 0 3px',
}
const metaVal: React.CSSProperties = {
  fontSize: '13.5px', color: INK, margin: '0 0 1px',
}
const divider: React.CSSProperties = { borderColor: BORDER, margin: '0 40px' }
const tableHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
}
const tableHeadCell: React.CSSProperties = {
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
  color: GRAY, margin: 0,
}
const tableRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'flex-start', padding: '10px 0',
}
const itemTitle: React.CSSProperties = {
  fontSize: '14px', fontWeight: 600, color: INK, margin: '0 0 2px',
}
const itemDesc: React.CSSProperties = {
  fontSize: '12px', color: GRAY, margin: 0,
}
const itemAmount: React.CSSProperties = {
  fontSize: '14px', fontWeight: 500, color: INK, margin: 0, textAlign: 'right',
}
const totalRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', padding: '12px 0 0',
}
const totalLabel: React.CSSProperties = {
  fontSize: '15px', fontWeight: 700, color: INK, margin: 0,
}
const totalAmount: React.CSSProperties = {
  fontSize: '18px', fontWeight: 700, color: INK, margin: 0,
}
const refText: React.CSSProperties = {
  fontSize: '12px', color: GRAY, margin: 0,
  fontFamily: '"Courier New", Courier, monospace',
}
const footerSection: React.CSSProperties = {
  padding: '20px 40px 0', textAlign: 'center',
  borderTop: `1px solid ${BORDER}`, marginTop: '8px',
}
const footerText: React.CSSProperties = {
  fontSize: '12px', color: '#999999', lineHeight: '1.6', margin: '0 0 4px',
}
const footerLink: React.CSSProperties = { color: GOLD, textDecoration: 'none' }
