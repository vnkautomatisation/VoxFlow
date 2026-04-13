'use client'
import dynamic from 'next/dynamic'
const DialerSidebar = dynamic(() => import('@/components/shared/DialerSidebar'), { ssr: false })
import TrialBanner from '@/components/shared/TrialBanner'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { usePlanPoller } from '@/hooks/usePlanPoller'
import { useDialerSync } from '@/hooks/useDialerSync'
import { useInboxNotifications } from '@/hooks/useInboxNotifications'

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
            { label: 'Enregistrements', href: '/admin/recordings', desc: 'Ecoute et recherche des appels' },
            { label: 'Horaires',      href: '/admin/schedules', desc: 'Heures ouverture et feries' },
            { label: 'Scripts',       href: '/admin/scripts',   desc: 'Scripts appel pour agents' },
            { label: 'Tags',         href: '/admin/tags',      desc: 'Tags pour appels et contacts' },
        ],
    },
    {
        label: 'Supervision',
        items: [
            { label: 'Live', href: '/admin/supervision', desc: 'Appels en temps réel' },
            { label: 'Rapports', href: '/admin/reports', desc: 'Graphiques, export CSV, par agent' },
            { label: 'Analytics', href: '/admin/analytics', desc: 'Heatmap et tendances' },
            { label: 'IA', href: '/admin/ia', desc: 'Coaching, quality scores' },
            { label: 'Campagnes', href: '/admin/campaigns', desc: 'Robot dialer, prospection' },
            { label: 'Wallboard', href: '/admin/wallboard', desc: 'KPIs plein ecran TV' },
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
    // Poll /auth/me toutes les 2 min pour détecter les changements de plan
    // faits par le OWNER (upgrade/downgrade du forfait de l'org).
    usePlanPoller()
    useDialerSync() // Heartbeat presence + sync token avec dialer
    useInboxNotifications() // Notifications messages inbox en temps reel
    const [mounted, setMounted] = useState(false)
    const [openGroup, setOpenGroup] = useState<string | null>(null)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [mobileExpandedGroup, setMobileExpandedGroup] = useState<string | null>(null)
    const navRef = useRef<HTMLDivElement>(null)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        if (!mounted) return
        if (!isAuth) { router.push('/login'); return }
        // OWNER + OWNER_STAFF peuvent accéder à l'admin panel (support cross-org)
        if (user?.role !== 'ADMIN' && user?.role !== 'SUPERVISOR' && user?.role !== 'OWNER' && user?.role !== 'OWNER_STAFF') router.push('/login')
    }, [mounted, isAuth, user, router])

    // Fermer dropdowns si clic dehors
    useEffect(() => {
        const fn = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null)
        }
        document.addEventListener('mousedown', fn)
        return () => document.removeEventListener('mousedown', fn)
    }, [])

    // Fermer sur navigation
    useEffect(() => {
        setOpenGroup(null)
        setMobileOpen(false)
        setMobileExpandedGroup(null)
    }, [pathname])

    // Auto-expand le groupe actif quand on ouvre le menu mobile
    useEffect(() => {
        if (mobileOpen && !mobileExpandedGroup) {
            const active = NAV_GROUPS.find(g =>
                g.items?.some(i => pathname.startsWith(i.href))
            )
            if (active) setMobileExpandedGroup(active.label)
        }
    }, [mobileOpen])

    if (!mounted || !isAuth) return null

    // Wallboard = full-screen, pas de nav/layout
    if (pathname === '/admin/wallboard') return <>{children}</>

    const activeGroup = NAV_GROUPS.find(g =>
        g.single ? pathname.startsWith(g.href!) : g.items?.some(i => pathname.startsWith(i.href))
    )

    const userName = user?.name || user?.email?.split('@')[0] || 'Admin'

    return (
        <div className="h-screen flex flex-col bg-[#111118] text-[#eeeef8] overflow-hidden">
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

                    {/* Groupes — DESKTOP uniquement (hidden sur mobile) */}
                    <div className="hidden lg:flex items-center gap-0.5 flex-1">
                        {NAV_GROUPS.map(group => {
                            const isActive = activeGroup?.label === group.label
                            const isOpen = openGroup === group.label

                            // Lien simple
                            if (group.single) {
                                return (
                                    <button key={group.label}
                                        onClick={() => router.push(group.href!)}
                                        className={`text-[10px] font-bold uppercase tracking-wider px-2 xl:px-3 py-1.5 rounded-lg whitespace-nowrap transition-all
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

                    {/* Spacer mobile pour pousser les boutons à droite */}
                    <div className="flex-1 lg:hidden" />

                    {/* User + déconnexion — DESKTOP uniquement */}
                    <div className="hidden lg:flex items-center gap-2 xl:gap-3 flex-shrink-0 ml-2">
                        <div className="text-right hidden xl:block">
                            <div className="text-xs font-semibold text-[#eeeef8] leading-tight truncate max-w-[140px]">{userName}</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-[#7b61ff]">{user?.role}</div>
                        </div>
                        {/* Avatar compact lg → xl */}
                        <div className="xl:hidden w-7 h-7 rounded-full bg-[#7b61ff]/20 border border-[#7b61ff]/40 flex items-center justify-center text-[10px] font-bold text-[#a78bfa]" title={`${userName} · ${user?.role}`}>
                            {userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <button
                            onClick={() => { useAuthStore.getState().logout?.(); router.push('/login') }}
                            className="text-[10px] font-bold text-[#55557a] border border-[#2e2e44] px-2.5 xl:px-3 py-1.5 rounded-lg hover:text-[#eeeef8] hover:border-[#3a3a55] transition-colors whitespace-nowrap"
                            title="Déconnexion">
                            <span className="hidden xl:inline">Déconnexion</span>
                            <svg className="xl:hidden" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>

                    {/* Hamburger button — MOBILE uniquement */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="lg:hidden text-[#9898b8] hover:text-[#eeeef8] p-1.5 rounded-lg hover:bg-[#1f1f2a] transition-colors"
                        aria-label="Menu"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            {mobileOpen ? (
                                <>
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </>
                            ) : (
                                <>
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </>
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile menu drawer — accordéon compact, visible uniquement sur mobile */}
                {mobileOpen && (
                    <div className="lg:hidden border-t border-[#2e2e44] bg-[#18181f] max-h-[calc(100vh-49px)] overflow-y-auto">
                        {/* User info */}
                        <div className="px-4 py-3 border-b border-[#2e2e44] flex items-center justify-between">
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#eeeef8] truncate">{userName}</div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-[#7b61ff] mt-0.5">{user?.role}</div>
                            </div>
                            <button
                                onClick={() => { useAuthStore.getState().logout?.(); router.push('/login') }}
                                className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 rounded-lg hover:bg-rose-400/20 transition-colors flex-shrink-0">
                                Déconnexion
                            </button>
                        </div>

                        {/* Groupes accordéon */}
                        <div className="py-1">
                            {NAV_GROUPS.map(group => {
                                // Lien simple (Vue globale)
                                if (group.single) {
                                    const isActive = activeGroup?.label === group.label
                                    return (
                                        <button key={group.label}
                                            onClick={() => router.push(group.href!)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#2e2e44]/50
                                                ${isActive ? 'bg-[#7b61ff]/10 text-[#eeeef8]' : 'text-[#9898b8] hover:bg-[#1f1f2a]'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[#7b61ff]' : 'bg-[#3a3a55]'}`}
                                                style={isActive ? { boxShadow: '0 0 6px #7b61ff' } : {}} />
                                            <span className="text-xs font-bold uppercase tracking-wider flex-1">{group.label}</span>
                                        </button>
                                    )
                                }

                                // Groupe accordéon — titre cliquable, items nestés
                                const expanded  = mobileExpandedGroup === group.label
                                const groupActive = activeGroup?.label === group.label
                                const activeItem  = group.items?.find(i => pathname.startsWith(i.href))

                                return (
                                    <div key={group.label} className="border-b border-[#2e2e44]/50">
                                        <button
                                            onClick={() => setMobileExpandedGroup(expanded ? null : group.label)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                                                ${groupActive ? 'bg-[#7b61ff]/10' : 'hover:bg-[#1f1f2a]'}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${groupActive ? 'bg-[#7b61ff]' : 'bg-[#3a3a55]'}`}
                                                style={groupActive ? { boxShadow: '0 0 6px #7b61ff' } : {}} />
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                <span className={`text-xs font-bold uppercase tracking-wider ${groupActive ? 'text-[#eeeef8]' : 'text-[#9898b8]'}`}>
                                                    {group.label}
                                                </span>
                                                {groupActive && activeItem && !expanded && (
                                                    <span className="text-[9px] font-bold text-[#7b61ff] bg-[#7b61ff]/10 px-1.5 py-0.5 rounded normal-case tracking-normal truncate">
                                                        {activeItem.label}
                                                    </span>
                                                )}
                                            </div>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                                className={`text-[#55557a] transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
                                            >
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>

                                        {/* Items expandés — compact, sans descriptions */}
                                        {expanded && (
                                            <div className="bg-[#111118]/50 border-t border-[#2e2e44]/50">
                                                {group.items?.map(item => {
                                                    const active = pathname.startsWith(item.href)
                                                    return (
                                                        <button key={item.href}
                                                            onClick={() => router.push(item.href)}
                                                            className={`w-full flex items-center gap-3 pl-10 pr-4 py-2.5 text-left transition-colors border-b border-[#2e2e44]/30 last:border-0
                                                                ${active ? 'bg-[#7b61ff]/10 text-[#eeeef8]' : 'text-[#9898b8] hover:bg-[#1f1f2a]'}`}>
                                                            <div className={`w-1 h-1 rounded-full flex-shrink-0 ${active ? 'bg-[#7b61ff]' : 'bg-[#3a3a55]'}`} />
                                                            <span className="text-xs font-medium flex-1 truncate">{item.label}</span>
                                                            {active && (
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                                                                    <polyline points="20 6 9 17 4 12" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </nav>

            <DialerSidebar />
            <TrialBanner />
            <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
    )
}
