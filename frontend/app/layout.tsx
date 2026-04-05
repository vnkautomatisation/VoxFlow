import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VoxFlow — Plateforme SaaS Call Center',
  description: 'Plateforme SaaS Call Center multi-tenant. Un produit de VNK Automatisation Inc.',
  keywords: ['call center', 'voip', 'saas', 'voxflow', 'vnk'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <body className={inter.className}>{children}
{/* Migration session — relit le token Zustand et le met dans un cookie */}
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    try {
      var raw = localStorage.getItem('voxflow-auth');
      if (!raw) return;
      var state = JSON.parse(raw).state;
      if (!state || !state.accessToken || !state.isAuth) return;
      // Verifier si le cookie existe deja
      if (document.cookie.indexOf('vf_access_token=') !== -1) return;
      // Creer le cookie
      var expires = new Date(Date.now() + 7 * 864e5).toUTCString();
      document.cookie = 'vf_access_token=' + encodeURIComponent(state.accessToken) + ';expires=' + expires + ';path=/;SameSite=Lax';
      if (state.user && state.user.role) {
        document.cookie = 'vf_role=' + state.user.role + ';expires=' + expires + ';path=/;SameSite=Lax';
      }
      // Recharger pour que le middleware voit le cookie
      if (window.location.pathname === '/login') {
        var role = state.user && state.user.role;
        var routes = { OWNER: '/owner/dashboard', ADMIN: '/admin/dashboard', AGENT: '/agent/dashboard' };
        var dest = routes[role] || '/admin/dashboard';
        window.location.href = dest;
      }
    } catch(e) {}
  })();
` }} />
      </body>
    </html>
  )
}
