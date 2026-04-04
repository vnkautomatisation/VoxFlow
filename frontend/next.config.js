/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    domains: [
      'your-supabase-project.supabase.co',
    ],
  },
}

module.exports = nextConfig
