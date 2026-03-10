import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans, DM_Mono } from 'next/font/google'
import { AlertProvider } from '@/components/Alert'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

// ─── Fonts ────────────────────────────────────────────────────────────────────

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets:  ['latin'],
  weight:   ['300', '400', '600'],
  style:    ['normal', 'italic'],
  display:  'swap',
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets:  ['latin'],
  weight:   ['300', '400', '500', '600'],
  display:  'swap',
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets:  ['latin'],
  weight:   ['400', '500'],
  display:  'swap',
})

// ─── Site constant ────────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

// ─── Viewport ─────────────────────────────────────────────────────────────────
// themeColor lives here since Next.js 14 (removed from Metadata)

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#191919' },
    { media: '(prefers-color-scheme: light)', color: '#F7F5F0' },
  ],
}

// ─── Global metadata ──────────────────────────────────────────────────────────
// Every page inherits these; individual pages override specific fields.
// Sections:
//   1. Identification
//   2. Title + Description
//   3. Indexing (robots + googleBot directives)
//   4. Open Graph
//   5. Twitter / X
//   6. Search console verification (injected from env vars)
//   7. Progressive web app + Apple
//   8. Icons

export const metadata: Metadata = {

  // ── 1. Identification ──────────────────────────────────────────────────────
  metadataBase:    new URL(SITE_URL),
  applicationName: 'Forcapedia',
  category:        'reference',
  creator:         'Forcapedia',
  publisher:       'Forcapedia',
  authors:         [{ name: 'Forcapedia', url: SITE_URL }],
  keywords: [
    'encyclopedia', 'knowledge base', 'AI research',
    'verified articles', 'history', 'live news', 'fact-checked',
    'living encyclopedia', 'online reference',
  ],

  // ── 2. Title + Description ─────────────────────────────────────────────────
  title: {
    default:  'Forcapedia — The Living Encyclopedia',
    template: '%s — Forcapedia',
  },
  description:
    'A living, verified knowledge platform. Historical depth meets live intelligence. Every article carries a verified date stamp.',

  // ── 3. Indexing ────────────────────────────────────────────────────────────
  // Global default — private pages override with { index: false, follow: false }
  // googleBot directives unlock rich snippets and large image previews in SERPs
  robots: {
    index:     true,
    follow:    true,
    googleBot: {
      index:                true,
      follow:               true,
      'max-snippet':        -1,      // full snippet length
      'max-image-preview':  'large', // full-size image previews
      'max-video-preview':  -1,      // full video preview
    },
  },

  // ── 4. Open Graph ──────────────────────────────────────────────────────────
  // Used by Facebook, LinkedIn, WhatsApp, Telegram, Discord, Slack, etc.
  openGraph: {
    title:       'Forcapedia — The Living Encyclopedia',
    description: 'A living, verified knowledge platform. Historical depth meets live intelligence.',
    url:         SITE_URL,
    siteName:    'Forcapedia',
    type:        'website',
    locale:      'en_US',
    images: [{
      url:    '/opengraph-image',
      width:  1200,
      height: 630,
      alt:    'Forcapedia — The Living Encyclopedia',
    }],
  },

  // ── 5. Twitter / X ─────────────────────────────────────────────────────────
  // summary_large_image = full-width card with image in timeline
  twitter: {
    card:        'summary_large_image',
    title:       'Forcapedia — The Living Encyclopedia',
    description: 'A living, verified knowledge platform. Historical depth meets live intelligence.',
    images:      ['/opengraph-image'],
  },

  // ── 6. Search console verification ────────────────────────────────────────
  // Add NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION and NEXT_PUBLIC_BING_SITE_VERIFICATION
  // to your .env / Vercel env vars — tags are omitted automatically if undefined.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { 'msvalidate.01': [process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION] }
      : undefined,
  },

  // ── 7. Progressive web app + Apple ────────────────────────────────────────
  appleWebApp: {
    capable:        true,
    title:          'Forcapedia',
    statusBarStyle: 'black-translucent',
  },
  // Prevents iOS Safari from auto-linking phone numbers, addresses, etc.
  // (avoids layout shifts and unintended tap targets)
  formatDetection: {
    email:     false,
    address:   false,
    telephone: false,
  },

  // ── 8. Icons ───────────────────────────────────────────────────────────────
  icons: {
    icon:     [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
    shortcut: '/icon.png',
    apple:    [{ url: '/icon.png', sizes: '512x512' }],
  },
}

// ─── Global JSON-LD ──────────────────────────────────────────────────────────
// @graph puts Organization + WebSite in a single script block on every page.
// Organization = brand entity (Google uses this for Knowledge Panel)
// WebSite      = SearchAction powers the Google Sitelinks Search Box

const globalJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type':      'Organization',
      '@id':        `${SITE_URL}/#organization`,
      name:         'Forcapedia',
      url:          SITE_URL,
      description:  'A living, verified knowledge platform. Historical depth meets live intelligence.',
      foundingDate: '2025',
      email:        'hello@forcapedia.com',
      logo: {
        '@type':      'ImageObject',
        '@id':        `${SITE_URL}/#logo`,
        url:          `${SITE_URL}/opengraph-image`,
        width:        1200,
        height:       630,
        caption:      'Forcapedia',
      },
      sameAs: [
        // Add your social profile URLs here when ready, e.g.:
        // 'https://twitter.com/forcapedia',
        // 'https://linkedin.com/company/forcapedia',
      ],
    },
    {
      '@type':     'WebSite',
      '@id':       `${SITE_URL}/#website`,
      name:        'Forcapedia',
      url:         SITE_URL,
      inLanguage:  'en-US',
      publisher:   { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type':     'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
}

// ─── Theme init script ────────────────────────────────────────────────────────
// Runs before first paint — prevents white flash when user has set light mode

const themeInitScript = `(function(){try{var t=localStorage.getItem('fp-theme');if(t==='light'){document.documentElement.classList.add('light');document.documentElement.style.background='#F7F5F0';document.body&&(document.body.style.background='#F7F5F0');}else{document.documentElement.style.background='#191919';}}catch(e){}})();`

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}
      style={{ background: '#191919' }}
      suppressHydrationWarning
    >
      <body style={{ background: '#191919', color: '#F0EDE8' }} suppressHydrationWarning>
        {/* Global Organization + WebSite schema — Google Knowledge Panel + Sitelinks Search Box */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(globalJsonLd) }}
        />
        {/* Must be first child — sets bg before React hydrates, prevents flash */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <AlertProvider>
            {children}
          </AlertProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
