import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // These packages are server-only. Never bundle them into client code.
  // Without this, Turbopack analyzes their full import graph even for
  // server components, which adds seconds to every compilation.
  serverExternalPackages: [
    '@aws-sdk/client-ses',
    '@react-email/components',
    '@react-email/render',
  ],
}

export default nextConfig
