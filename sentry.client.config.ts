import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of sessions for performance monitoring (adjust in production)
  tracesSampleRate: 0.1,

  // Capture 100% of replays when an error occurs
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,

  integrations: [
    Sentry.replayIntegration(),
  ],

  // Don't show debug output in production
  debug: false,
})
