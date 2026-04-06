import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VoxFlow — Plateforme SaaS Call Center',
  description: 'Plateforme SaaS Call Center multi-tenant. Gérez vos appels, agents et campagnes.',
  icons: {
    icon: [
      { url: '/icons/favicon.ico' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon-180.png', sizes: '180x180' },
      { url: '/icons/apple-touch-icon-152.png', sizes: '152x152' },
      { url: '/icons/apple-touch-icon-144.png', sizes: '144x144' },
      { url: '/icons/apple-touch-icon-120.png', sizes: '120x120' },
    ],
    other: [{ rel: 'mask-icon', url: '/icons/favicon.svg', color: '#7b61ff' }],
  },
  manifest: '/site.webmanifest',
  themeColor: '#7b61ff',
  openGraph: {
    title: 'VoxFlow — Plateforme SaaS Call Center',
    description: 'Gérez vos appels, agents et campagnes depuis une seule interface.',
    images: [{ url: '/icons/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VoxFlow',
    images: ['/icons/twitter-card.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body>{children}</body>
    </html>
  )
}
