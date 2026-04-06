'use client'
import DialerFAB from '@/components/shared/DialerFAB'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { isAuth, user } = useAuthStore()

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isAuth) { router.push('/login'); return }
    if (user?.role !== 'ADMIN' && user?.role !== 'OWNER') { router.push('/login') }
  }, [mounted, isAuth, user, router])

  if (!mounted || !isAuth) return null

  const nav = [
    { label: 'Vue globale',  href: '/admin/dashboard' },
    { label: 'Agents',       href: '/admin/agents' },
    { label: 'Supervision',  href: '/admin/supervision' },
    { label: 'CRM',          href: '/admin/crm' },
    { label: 'Analytiques',  href: '/admin/analytics' },
    { label: 'Omnicanal',    href: '/admin/inbox' },
    { label: 'Voicemails',   href: '/admin/voicemails' },
    { label: 'Intégrations', href: '/admin/integrations' },
  ]

  return (
    <div className="min-h-screen bg-[#111118] text-[#eeeef8]">
      <nav className="border-b border-[#2e2e44] bg-[#111118] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-12">
          <div className="flex items-center gap-2 flex-shrink-0 mr-2">
            <div className="w-2 h-2 rounded-full bg-[#7b61ff]" style={{ boxShadow: '0 0 8px #7b61ff' }} />
            <span className="font-bold text-sm">
              <span className="text-[#7b61ff]">Vox</span>
              <span className="text-[#00d4aa]">Flow</span>
            </span>
          </div>
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {nav.map(n => (
              <button key={n.href} onClick={() => router.push(n.href)}
                className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg whitespace-nowrap transition-all
                  ${pathname.startsWith(n.href)
                    ? 'bg-[#7b61ff]/15 text-[#eeeef8] border border-[#7b61ff]/30'
                    : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                {n.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="text-xs font-semibold text-[#eeeef8]">{user?.name || user?.email?.split('@')[0] || 'Admin'}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#7b61ff]">{user?.role}</div>
            </div>
            <button onClick={() => { useAuthStore.getState().logout?.(); router.push('/login') }}
              className="text-[10px] font-bold text-[#55557a] border border-[#2e2e44] px-3 py-1.5 rounded-lg hover:text-[#eeeef8] transition-colors">
              Déconnexion
            </button>
          </div>
        </div>
      </nav>
      <DialerFAB />
      <main>{children}</main>
    </div>
  )
}


