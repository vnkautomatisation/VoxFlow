'use client'
import DialerFAB from '@/components/shared/DialerFAB'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

const NAV_GROUPS = [
    {
        label: 'Vue globale',
        href: '/admin/dashboard',
        single: true,
    },
    {
        label: 'Téléphonie',
        items: [
            { label: 'Agents', href: '/admin/agents', desc: 'Gérer les agents et extensions' },
            { label: "Files d'attente", href: '/admin/queues', desc: 'Stratégies de routage ACD' },
            { label: 'IVR', href: '/admin/ivr', desc: 'Menus vocaux interactifs' },
            { label: 'Médias', href: '/admin/media', desc: 'Musiques et messages audio' },
            { label: 'Numéros DID',   href: '/admin/numbers',   desc: 'Numéros Twilio et assignations' },
            { label: 'Voicemails', href: '/admin/voicemails', desc: 'Messagerie vocale' },
            { label: 'Horaires',      href: '/admin/schedules', desc: 'Heures ouverture et feries' },
            { label: 'Scripts',       href: '/admin/scripts',   desc: 'Scripts appel pour agents' },
        ],
    },
    {
        label: 'Supervision',
        items: [
            { label: 'Live', href: '/admin/supervision', desc: 'Appels en temps réel' },
            { label: 'Rapports', href: '/admin/reports', desc: 'Graphiques, export CSV, par agent' },
        ],
    },
    {
        label: 'Clients',
        items: [
            { label: 'CRM', href: '/admin/crm', desc: 'Contacts et pipeline' },
            { label: 'Omnicanal', href: '/admin/inbox', desc: 'Chat, SMS, email' },
        ],
    },
    {
        label: 'Config',
        items: [
            { label: 'Intégrations', href: '/admin/integrations', desc: 'CRM, webhooks, API' },
        ],
    },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const { isAuth, user } = useAuthStore()
    const [mounted, setMounted] = useState(false)
    const [openGroup, setOpenGroup] = useState<string | null>(null)
    const navRef = useRef<HTMLDivElement>(null)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        if (!mounted) return
        if (!isAuth) { router.push('/login'); return }
        if (user?.role !== 'ADMIN' && user?.role !== 'OWNER') router.push('/login')
    }, [mounted, isAuth, user, router])

    // Fermer si clic dehors
    useEffect(() => {
        const fn = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null)
        }
        document.addEventListener('mousedown', fn)
        return () => document.removeEventListener('mousedown', fn)
    }, [])

    // Fermer sur navigation
    useEffect(() => { setOpenGroup(null) }, [pathname])

    if (!mounted || !isAuth) return null

    const activeGroup = NAV_GROUPS.find(g =>
        g.single ? pathname.startsWith(g.href!) : g.items?.some(i => pathname.startsWith(i.href))
    )

    return (
        <div className="min-h-screen bg-[#111118] text-[#eeeef8]">
            <nav ref={navRef} className="border-b border-[#2e2e44] bg-[#111118] sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 flex items-center gap-0.5 h-12">

                    {/* Logo */}
                    <div className="flex items-center gap-2 flex-shrink-0 mr-4">
                        <div className="w-2 h-2 rounded-full bg-[#7b61ff]" style={{ boxShadow: '0 0 8px #7b61ff' }} />
                        <span className="font-bold text-sm">
                            <span className="text-[#7b61ff]">Vox</span>
                            <span className="text-[#00d4aa]">Flow</span>
                        </span>
                    </div>

                    {/* Groupes */}
                    <div className="flex items-center gap-0.5 flex-1">
                        {NAV_GROUPS.map(group => {
                            const isActive = activeGroup?.label === group.label
                            const isOpen = openGroup === group.label

                            // Lien simple
                            if (group.single) {
                                return (
                                    <button key={group.label}
                                        onClick={() => router.push(group.href!)}
                                        className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg whitespace-nowrap transition-all
                      ${isActive
                                                ? 'bg-[#7b61ff]/15 text-[#eeeef8] border border-[#7b61ff]/30'
                                                : 'text-[#55557a] hover:text-[#9898b8] hover:bg-[#1f1f2a]'}`}>
                                        {group.label}
                                    </button>
                                )
                            }

                            // Groupe avec dropdown
                            const activePage = group.items?.find(i => pathname.startsWith(i.href))

                            return (
                                <div key={group.label} className="relative">
                                    <button
                                        onClick={() => setOpenGroup(isOpen ? null : group.label)}
                                        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg whitespace-nowrap transition-all
                      ${isActive || isOpen
                                                ? 'bg-[#7b61ff]/15 text-[#eeeef8] border border-[#7b61ff]/30'
                                                : 'text-[#55557a] hover:text-[#9898b8] hover:bg-[#1f1f2a]'}`}>
                                        {group.label}
                                        {/* Sous-page active */}
                                        {isActive && activePage && (
                                            <span className="text-[9px] bg-[#7b61ff]/25 text-violet-300 px-1.5 py-0.5 rounded font-bold normal-case tracking-normal">
                                                {activePage.label}
                                            </span>
                                        )}
                                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                                            style={{ transition: 'transform .15s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </button>

                                    {/* Dropdown panel */}
                                    {isOpen && (
                                        <div className="absolute top-full left-0 mt-1.5 bg-[#18181f] border border-[#2e2e44] rounded-xl shadow-2xl z-50 min-w-[220px] overflow-hidden"
                                            style={{ boxShadow: '0 8px 32px rgba(0,0,0,.7), 0 0 0 1px rgba(123,97,255,.1)' }}>
                                            <div className="p-1.5 space-y-0.5">
                                                {group.items?.map(item => {
                                                    const active = pathname.startsWith(item.href)
                                                    return (
                                                        <button key={item.href}
                                                            onClick={() => router.push(item.href)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group
                                ${active ? 'bg-[#7b61ff]/15' : 'hover:bg-[#2e2e44]/60'}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all
                                ${active ? 'bg-[#7b61ff]' : 'bg-[#3a3a55] group-hover:bg-[#7b61ff]/50'}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`text-xs font-semibold leading-tight
                                  ${active ? 'text-[#eeeef8]' : 'text-[#9898b8] group-hover:text-[#eeeef8]'}`}>
                                                                    {item.label}
                                                                </div>
                                                                <div className="text-[10px] text-[#55557a] leading-tight mt-0.5">{item.desc}</div>
                                                            </div>
                                                            {active && (
                                                                <svg width="12" height="12" fill="none" stroke="#7b61ff" strokeWidth="2.5" viewBox="0 0 24 24">
                                                                    <polyline points="20 6 9 17 4 12" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* User + déconnexion */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                            <div className="text-xs font-semibold text-[#eeeef8] leading-tight">
                                {user?.name || user?.email?.split('@')[0] || 'Admin'}
                            </div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-[#7b61ff]">{user?.role}</div>
                        </div>
                        <button
                            onClick={() => { useAuthStore.getState().logout?.(); router.push('/login') }}
                            className="text-[10px] font-bold text-[#55557a] border border-[#2e2e44] px-3 py-1.5 rounded-lg hover:text-[#eeeef8] hover:border-[#3a3a55] transition-colors">
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
