'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { VoxFlowLogo } from '@/components/shared/VoxFlowLogo'
import TrialBanner from '@/components/shared/TrialBanner'
import { usePlanPoller } from '@/hooks/usePlanPoller'



const NAV = [
  { href: '/client',         label: 'Mon compte',        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { href: '/client/plans',   label: 'Mes forfaits',      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
  { href: '/client/numbers', label: 'Mes numeros',       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6.29 6.29l1.86-1.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
  { href: '/client/invoices',label: 'Factures',          icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { href: '/client/robot',   label: "Robot d'appel",     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="2"/><path d="M12 2v2M12 10v12M8 14H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4"/></svg> },
  { href: '/client/support', label: 'Support',           icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
]

function useAuth() {
  const [user, setUser] = useState<{name:string;email:string;org:string;role:string} | null>(null)
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

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const user     = useAuth()
  const userRole = user?.role?.toUpperCase() || ''
  const [collapsed, setCollapsed] = useState(false)
  // Poller /auth/me toutes les 2 min pour détecter les changements de plan
  usePlanPoller()


  const [status, setStatus] = useState<'online'|'away'|'offline'>('online')

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vf_tok')
      localStorage.removeItem('vf_url')
    }
    router.push('/login')
  }

  const statusColor = status === 'online' ? '#00d4aa' : status === 'away' ? '#ffb547' : '#5a5a7a'

  return (
    <div style={{ display:'flex', height:'100vh', background:'#080810', fontFamily:"'DM Sans',ui-sans-serif,system-ui,sans-serif", overflow:'hidden' }}>

      {/* Sidebar */}
      <aside style={{ width: collapsed ? 60 : 200, flexShrink:0, background:'#0c0c1a', borderRight:'1px solid #1e1e3a', display:'flex', flexDirection:'column', transition:'width .2s', overflow:'hidden' }}>

        {/* Logo */}
        <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom:'1px solid #1a1a2e', display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight:60 }}>
          {collapsed ? (
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <defs><linearGradient id="vfG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7b61ff"/><stop offset="100%" stopColor="#00d4aa"/></linearGradient></defs>
              <rect width="64" height="64" rx="14" fill="#0e0e1c"/>
              <rect x="29.5" y="12" width="5" height="22" rx="2.5" fill="url(#vfG2)"/>
              <rect x="20"   y="20" width="5" height="14" rx="2.5" fill="#7b61ff" opacity="0.7"/>
              <rect x="39"   y="20" width="5" height="14" rx="2.5" fill="#00d4aa" opacity="0.7"/>
              <rect x="10.5" y="27" width="5" height="7"  rx="2.5" fill="#7b61ff" opacity="0.35"/>
              <rect x="48.5" y="27" width="5" height="7"  rx="2.5" fill="#00d4aa" opacity="0.35"/>
            </svg>
          ) : (
            <Link href="/client/plans" style={{ textDecoration:'none' }}>
              <VoxFlowLogo size="md" />
            </Link>
          )}
          {!collapsed && (
            <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:'#7b61ff22', color:'#7b61ff', border:'1px solid #7b61ff33', fontWeight:700, letterSpacing:'.06em' }}>CLIENT</span>
          )}
        </div>

        {/* Organisation */}
        {!collapsed && user && (
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #1a1a2e' }}>
            <div style={{ fontSize:9, color:'#3a3a5a', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Organisation</div>
            <div style={{ fontSize:12, fontWeight:600, color:'#8888a8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user.org}</div>
            <div style={{ fontSize:11, color:'#4a4a6a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1 }}>{user.email}</div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex:1, padding:'8px 0', overflowY:'auto' }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:10, padding: collapsed ? '10px 0' : '9px 16px', justifyContent: collapsed ? 'center' : 'flex-start', color: active ? '#a695ff' : '#5a5a7a', background: active ? '#7b61ff12' : 'transparent', borderLeft: active ? '2px solid #7b61ff' : '2px solid transparent', textDecoration:'none', fontSize:13, fontWeight: active ? 600 : 400, transition:'all .12s', position:'relative', whiteSpace:'nowrap' }}
                onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.color='#8888a8'}}
                onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.color='#5a5a7a'}}
              >
                <span style={{ flexShrink:0, opacity: active ? 1 : 0.65 }}>{item.icon}</span>
                {!collapsed && <span style={{ flex:1 }}>{item.label}</span>}
                {!collapsed && item.badge && <span style={{ fontSize:8, padding:'1px 5px', borderRadius:3, background:'#00d4aa22', color:'#00d4aa', border:'1px solid #00d4aa33', fontWeight:700 }}>{item.badge}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Statut + Déconnexion */}
        <div style={{ padding: collapsed ? '8px 0' : '12px 16px', borderTop:'1px solid #1a1a2e' }}>
          {!collapsed && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, cursor:'pointer' }} onClick={() => setStatus(s => s==='online'?'away':s==='away'?'offline':'online')}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:statusColor, display:'inline-block', flexShrink:0 }}/>
              <span style={{ fontSize:11, color:'#5a5a7a' }}>{status==='online'?'En ligne':status==='away'?'Absent':'Hors ligne'}</span>
            </div>
          )}
          {!collapsed && userRole === 'ADMIN' && (
            <Link href="/admin/dashboard" style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 0', color:'#7b61ff', textDecoration:'none', fontSize:11, fontWeight:600, marginBottom:6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Retour portail admin
            </Link>
          )}
          <button onClick={() => setCollapsed(c=>!c)} style={{ display:'block', width:'100%', padding: collapsed?'6px 0':'6px 0', background:'transparent', border:'none', color:'#3a3a5a', cursor:'pointer', fontSize:11, textAlign:'center', marginBottom:4 }}>
            {collapsed ? '→' : '← Réduire'}
          </button>
          <button onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding: collapsed?'7px 0':'7px 0', background:'transparent', border:'none', color:'#3a3a5a', cursor:'pointer', fontSize:11, justifyContent: collapsed?'center':'flex-start' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {!collapsed && 'Déconnexion'}
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Topbar */}
        <header style={{ height:48, background:'#0c0c1a', borderBottom:'1px solid #1a1a2e', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', flexShrink:0 }}>
          <div style={{ fontSize:13, color:'#4a4a6a', fontWeight:500 }}>
            {NAV.find(n=>n.href===pathname)?.label || 'Portail client'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color: statusColor }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:statusColor, display:'inline-block' }}/>
              En ligne
            </span>
            <span style={{ fontSize:12, fontWeight:600, color:'#7b61ff', padding:'4px 10px', background:'#7b61ff18', border:'1px solid #7b61ff33', borderRadius:6 }}>
              {user?.name?.toUpperCase() || 'ADMIN'}
            </span>
          </div>
        </header>

        {/* Main */}
        <main style={{ flex:1, overflowY:'auto', padding:24 }}>
          <TrialBanner />
          {children}
        </main>
      </div>

    </div>
  )
}
