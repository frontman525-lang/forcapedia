import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans, DM_Mono } from 'next/font/google'
import { AlertProvider } from '@/components/Alert'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Forcapedia — The Modern pedia',
  description:
    'A living, verified knowledge platform. Historical depth meets live intelligence. Every article carries a verified date stamp.',
  keywords: ['encyclopedia', 'History', 'AI research', 'live news', 'fact-checked'],
  openGraph: {
    title: 'Forcapedia',
    description: 'A living, verified knowledge platform. Historical depth meets live intelligence.',
    type: 'website',
  },
}

// Runs before first paint — prevents white flash when user set light mode
const themeInitScript = `(function(){try{var t=localStorage.getItem('fp-theme');if(t==='light'){document.documentElement.classList.add('light');document.documentElement.style.background='#F7F5F0';document.body&&(document.body.style.background='#F7F5F0');}else{document.documentElement.style.background='#191919';}}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}
      style={{ background: '#191919' }}
      suppressHydrationWarning
    >
      <body style={{ background: '#191919', color: '#F0EDE8' }} suppressHydrationWarning>
        {/* Must be first child — sets bg before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <AlertProvider>
            {children}
          </AlertProvider>
        </ThemeProvider>
        <footer
          style={{
            textAlign: 'center',
            padding: '1rem 0 1.5rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          © 2026 FORCAPEDIA. All rights reserved.
        </footer>
      </body>
    </html>
  )
}
