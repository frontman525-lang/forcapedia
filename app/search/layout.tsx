import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

export const metadata: Metadata = {
  title:       'Search — Forcapedia',
  description: 'Search millions of topics on Forcapedia. Get AI-verified articles with historical depth and live intelligence — instantly.',
  alternates:  { canonical: `${SITE_URL}/search` },
  openGraph: {
    title:       'Search — Forcapedia',
    description: 'Search millions of topics and get AI-verified, date-stamped articles instantly.',
    url:         `${SITE_URL}/search`,
    siteName:    'Forcapedia',
    type:        'website',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Search — Forcapedia',
    description: 'Search millions of topics and get AI-verified, date-stamped articles instantly.',
  },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
