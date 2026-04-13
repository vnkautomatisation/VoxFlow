'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { VoxFlowLogo } from '@/components/shared/VoxFlowLogo'
import TrialBanner from '@/components/shared/TrialBanner'
import { usePlanPoller } from '@/hooks/usePlanPoller'

const NAV = [
  { href: '/client',         label: 'Mon compte',     icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
  { href: '/client/plans',   label: 'Mes forfaits',   icon: 'M2 7h20v14H2z M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' },
  { href: '/client/numbers', label: 'Mes numeros',    icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6.29 6.29l1.86-1.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z' },
  { href: '/client/invoices', label: 'Factures',      icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  { href: '/client/robot',   label: "Robot d'appel",   icon: 'M12 2v2 M12 10v12 M8 14H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4 M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { href: '/client/support', label: 'Support',         icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
]

function useAuth() {
  const [user, setUser] = useState<{ name: string; email: string; org: string; role: string } | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const tok = localStorage.getItem('vf_tok')
      if (!tok) return
      const payload = JSON.parse(atob(tok.split('.')[1]))
      setUser({ name: payload.name || payload.email?.split('@')[0] || 'Admin', email: payload.email || '', org: payload.org_name || 'Mon organisation', role: payload.role || '' })
    } catch {}
  }, [])
  return user
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuth()
  const userRole = user?.role?.toUpperCase() || ''
  const [collapsed, setCollapsed] = useState(false)
  usePlanPoller()

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vf_tok')
      localStorage.removeItem('vf_url')
    }
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-[#111118] overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-[60px]' : 'w-[220px]'} flex-shrink-0 bg-[#0c0c16] border-r border-[#2e2e44] flex flex-col transition-all duration-200 overflow-hidden`}>

        {/* Logo */}
        <div className={`${collapsed ? 'px-0 justify-center' : 'px-4 justify-between'} py-4 border-b border-[#1f1f2a] flex items-center min-h-[56px]`}>
          {collapsed ? (
            <div className="w-7 h-7 rounded-lg bg-[#7b61ff]/15 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2.5"><path d="M12 2v8M8 6v4M16 6v4M4 10v2M20 10v2"/></svg>
            </div>
          ) : (
            <Link href="/client" className="no-underline"><VoxFlowLogo size="sm" /></Link>
          )}
          {!collapsed && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#7b61ff]/15 text-[#7b61ff] border border-[#7b61ff]/25 font-bold tracking-wider">CLIENT</span>
          )}
        </div>

        {/* Org info */}
        {!collapsed && user && (
          <div className="px-4 py-3 border-b border-[#1f1f2a]">
            <div className="text-[9px] text-[#55557a] uppercase tracking-wider mb-1">Organisation</div>
            <div className="text-xs font-semibold text-[#9898b8] truncate">{user.org}</div>
            <div className="text-[11px] text-[#55557a] truncate mt-0.5">{user.email}</div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/client' && pathname?.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-[13px] no-underline transition-all border-l-2 ${
                  active
                    ? 'text-[#a695ff] bg-[#7b61ff]/10 border-[#7b61ff] font-semibold'
                    : 'text-[#55557a] border-transparent hover:text-[#9898b8] hover:bg-[#1f1f2a]/50'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <span className={active ? 'opacity-100' : 'opacity-60'}><NavIcon d={item.icon} /></span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className={`${collapsed ? 'px-1' : 'px-4'} py-3 border-t border-[#1f1f2a]`}>
          {!collapsed && userRole === 'ADMIN' && (
            <Link href="/admin/dashboard" className="flex items-center gap-1.5 text-[11px] text-[#7b61ff] font-semibold no-underline mb-2 hover:text-[#a695ff]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Retour portail admin
            </Link>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            className="block w-full text-center text-[11px] text-[#55557a] bg-transparent border-none cursor-pointer mb-1 hover:text-[#9898b8]">
            {collapsed ? '→' : '← Reduire'}
          </button>
          <button onClick={handleLogout}
            className={`flex items-center gap-2 w-full bg-transparent border-none text-[11px] text-[#55557a] cursor-pointer hover:text-[#9898b8] ${collapsed ? 'justify-center' : ''}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {!collapsed && 'Deconnexion'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-12 bg-[#0c0c16] border-b border-[#1f1f2a] flex items-center justify-between px-6 flex-shrink-0">
          <div className="text-[13px] text-[#55557a] font-medium">
            {NAV.find(n => pathname === n.href || (n.href !== '/client' && pathname?.startsWith(n.href)))?.label || 'Portail client'}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              En ligne
            </span>
            <span className="text-xs font-bold text-[#7b61ff] px-2.5 py-1 bg-[#7b61ff]/12 border border-[#7b61ff]/25 rounded-md">
              {user?.name?.toUpperCase() || 'CLIENT'}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <TrialBanner />
          {children}
        </main>
      </div>
    </div>
  )
}
