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
}

module.exports = nextConfig
