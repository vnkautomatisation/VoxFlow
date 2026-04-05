/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oqjphhctjkefqpruyjhx.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/VoxFlow-Dialer.html',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.twilio.com https://fonts.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.twilio.com wss://*.twilio.com http://localhost:4000 https://*.ngrok-free.dev",
              "media-src 'self' blob: https://*.twilio.com",
              "img-src 'self' data: blob:",
            ].join('; ')
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig