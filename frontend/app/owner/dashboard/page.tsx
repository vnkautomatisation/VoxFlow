"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { ownerApi } from "@/lib/ownerApi"
import StatsCards from "@/components/owner/StatsCards"
import OrgsTable from "@/components/owner/OrgsTable"
import CreateAdminModal from "@/components/owner/CreateAdminModal"
import RevenueCard from "@/components/owner/RevenueCard"

const API_URL = typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'

export default function OwnerDashboard() {
  const { user, isAuth, accessToken, logout } = useAuthStore()
  const router = useRouter()

  const [stats,   setStats]   = useState<any>(null)
  const [orgs,    setOrgs]    = useState<any[]>([])
  const [revenue, setRevenue] = useState<any>(null)
  const [billingStats, setBillingStats] = useState<any>(null)
  const [topClients, setTopClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab]   = useState<"dashboard" | "admins" | "numbers" | "revenue">("dashboard")
  const [mounted, setMounted]       = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isAuth || !user) { router.push("/login"); return }
    if (user.role !== "OWNER" && user.role !== "OWNER_STAFF") { router.push("/login"); return }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuth, user])

  const apiFetch = useCallback(async (path: string) => {
    const r = await fetch(API_URL + path, {
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) },
    })
    return r.json()
  }, [accessToken])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const [statsRes, orgsRes, revRes, bsRes, tcRes] = await Promise.all([
        ownerApi.getStats(accessToken),
        ownerApi.getOrganizations(accessToken),
        ownerApi.getRevenue(accessToken),
        apiFetch('/api/v1/owner/billing-stats'),
        apiFetch('/api/v1/owner/billing-stats/top-clients'),
      ])
      if (statsRes.success)   setStats(statsRes.data)
      if (orgsRes.success)    setOrgs(orgsRes.data.organizations || [])
      if (revRes.success)     setRevenue(revRes.data)
      if (bsRes.success)      setBillingStats(bsRes.data)
      if (tcRes.success)      setTopClients(tcRes.data || [])
    } catch (err) {
      console.error("Erreur chargement data:", err)
    } finally {
      setLoading(false)
    }
  }, [accessToken, apiFetch])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white">
              Vox<span className="text-purple-500">Flow</span>
            </h1>
            <div className="flex gap-1">
              {[
                { id: "dashboard", label: "Vue globale" },
                { id: "admins",    label: "Admins" },
                { id: "numbers",   label: "Numeros" },
                { id: "revenue",   label: "Revenus" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (
                    activeTab === tab.id
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
              {/* Liens vers les pages owner */}
              {[
                { href: '/owner/admins',         label: 'Clients' },
                { href: '/owner/billing',        label: 'Revenus' },
                { href: '/owner/plans',          label: 'Forfaits' },
                { href: '/owner/features',       label: 'Features' },
                { href: '/owner/products',       label: 'Catalogue' },
                { href: '/owner/extension-pool', label: 'Pool ext.' },
                { href: '/owner/twilio-config',  label: 'Twilio' },
              ].map(l => (
                <button key={l.href}
                  onClick={() => router.push(l.href)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#7b61ff] hover:text-white hover:bg-[#7b61ff]/20 transition-colors font-bold"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white text-sm font-medium">{user.name}</p>
              <p className="text-purple-400 text-xs">OWNER</p>
            </div>
            <button
              onClick={handleLogout}
              className="border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg text-sm hover:border-gray-500 hover:text-white transition-colors"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-6 py-6">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500 animate-pulse">Chargement...</p>
          </div>
        ) : (
          <>
            {/* Tab : Dashboard */}
            {activeTab === "dashboard" && (
              <>
                {/* MRR / ARR / Churn / New clients cards */}
                {billingStats && (
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'MRR', value: `${billingStats.mrr?.toFixed(2) || '0.00'} CAD$`, color: '#7b61ff' },
                      { label: 'ARR', value: `${billingStats.arr?.toFixed(2) || '0.00'} CAD$`, color: '#00d4aa' },
                      { label: 'Taux de churn', value: `${billingStats.churn_rate || 0}%`, color: billingStats.churn_rate > 5 ? '#ef4444' : '#00d4aa' },
                      { label: 'Nouveaux clients ce mois', value: String(billingStats.new_clients || 0), color: '#7b61ff' },
                    ].map(card => (
                      <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{card.label}</p>
                        <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* MRR Line Chart (SVG) */}
                {billingStats?.mrr_history && billingStats.mrr_history.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
                    <h3 className="text-white font-semibold mb-4">MRR 12 mois</h3>
                    <div style={{ position: 'relative', height: 200, width: '100%' }}>
                      <svg width="100%" height="200" viewBox="0 0 800 200" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#7b61ff" stopOpacity="0.3"/>
                            <stop offset="100%" stopColor="#7b61ff" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        {(() => {
                          const hist = billingStats.mrr_history
                          const max = Math.max(...hist.map((h: any) => h.mrr), 1)
                          const points = hist.map((h: any, i: number) => {
                            const x = (i / (hist.length - 1)) * 780 + 10
                            const y = 190 - (h.mrr / max) * 170
                            return `${x},${y}`
                          }).join(' ')
                          const areaPoints = points + ` 790,190 10,190`
                          return (
                            <>
                              <polygon points={areaPoints} fill="url(#mrrGrad)" />
                              <polyline points={points} fill="none" stroke="#7b61ff" strokeWidth="2.5" />
                              {hist.map((h: any, i: number) => {
                                const x = (i / (hist.length - 1)) * 780 + 10
                                const y = 190 - (h.mrr / max) * 170
                                return <circle key={i} cx={x} cy={y} r="3" fill="#7b61ff" />
                              })}
                            </>
                          )
                        })()}
                      </svg>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px 0' }}>
                        {billingStats.mrr_history.map((h: any, i: number) => (
                          <span key={i} className="text-gray-600 text-[9px]">{h.month}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {stats && <StatsCards stats={stats} />}

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    {/* Top 10 Clients */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-semibold">Top 10 clients</h3>
                        <button onClick={() => router.push('/owner/admins')} className="text-purple-400 text-sm hover:text-purple-300">Voir tous</button>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                            <th className="text-left py-2 font-medium">Organisation</th>
                            <th className="text-left py-2 font-medium">Plan</th>
                            <th className="text-right py-2 font-medium">Users</th>
                            <th className="text-right py-2 font-medium">MRR CAD$</th>
                            <th className="text-center py-2 font-medium">Statut</th>
                            <th className="text-right py-2 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {topClients.map((c: any) => (
                            <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                              <td className="py-2 text-white text-sm">{c.name}</td>
                              <td className="py-2 text-gray-400 text-xs">{c.plans}</td>
                              <td className="py-2 text-gray-400 text-sm text-right">{c.users}</td>
                              <td className="py-2 text-green-400 text-sm font-medium text-right">{c.mrr?.toFixed(2)}</td>
                              <td className="py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' : c.status === 'TRIAL' ? 'bg-blue-900/30 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="py-2 text-right">
                                <button onClick={() => router.push('/owner/admins')} className="text-purple-400 text-xs hover:text-purple-300">Login as</button>
                              </td>
                            </tr>
                          ))}
                          {topClients.length === 0 && (
                            <tr><td colSpan={6} className="py-8 text-center text-gray-600 text-sm">Aucun client actif</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <OrgsTable orgs={orgs.slice(0, 5)} onRefresh={loadData} />
                  </div>
                  <div>
                    {revenue && <RevenueCard revenue={revenue} />}

                    {/* Alerts */}
                    {billingStats && (
                      <div className="mt-4 space-y-3">
                        {(billingStats.past_due || []).length > 0 && (
                          <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4">
                            <p className="text-red-400 text-xs font-bold uppercase mb-2">Paiements en retard</p>
                            {billingStats.past_due.map((o: any) => (
                              <div key={o.id} className="flex items-center justify-between py-1">
                                <span className="text-red-300 text-sm">{o.name}</span>
                                <button onClick={() => router.push('/owner/admins')} className="text-red-400 text-xs hover:text-red-300">Voir</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {(billingStats.expiring_trials || []).length > 0 && (
                          <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl p-4">
                            <p className="text-orange-400 text-xs font-bold uppercase mb-2">Essais expirant dans 3 jours</p>
                            {billingStats.expiring_trials.map((o: any) => (
                              <div key={o.id} className="flex items-center justify-between py-1">
                                <span className="text-orange-300 text-sm">{o.name}</span>
                                <span className="text-orange-500 text-xs">{o.trial_ends_at ? new Date(o.trial_ends_at).toLocaleDateString('fr-CA') : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Tab : Admins */}
            {activeTab === "admins" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold text-lg">Comptes administrateurs</h2>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    + Nouvel admin
                  </button>
                </div>
                <OrgsTable orgs={orgs} onRefresh={loadData} />
              </>
            )}

            {/* Tab : Numeros */}
            {activeTab === "numbers" && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-white font-semibold mb-2">Gestion des numeros Twilio</h2>
                <p className="text-gray-400 text-sm mb-4">
                  Configure tes cles Twilio dans le .env pour activer l achat de numeros.
                </p>
                <div className="bg-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-xs font-mono">TWILIO_ACCOUNT_SID=ACxxxxxx</p>
                  <p className="text-gray-400 text-xs font-mono">TWILIO_AUTH_TOKEN=xxxxxxxx</p>
                  <p className="text-gray-400 text-xs font-mono">TWILIO_API_KEY=SKxxxxxx</p>
                  <p className="text-gray-400 text-xs font-mono">TWILIO_API_SECRET=xxxxxxxx</p>
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  Phase 2 — Module numeros complet disponible avec les cles Twilio configurees.
                </p>
              </div>
            )}

            {/* Tab : Revenus */}
            {activeTab === "revenue" && (
              <div className="grid grid-cols-2 gap-4">
                {revenue && (
                  <>
                    <RevenueCard revenue={revenue} />
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                      <h3 className="text-white font-semibold mb-4">Simulation croissance</h3>
                      <div className="space-y-3">
                        {[
                          { clients: 5,   plan: "Starter",    mrr: 5 * 99 },
                          { clients: 10,  plan: "Pro",        mrr: 10 * 299 },
                          { clients: 20,  plan: "Pro",        mrr: 20 * 299 },
                          { clients: 50,  plan: "Enterprise", mrr: 50 * 799 },
                        ].map((s) => (
                          <div key={s.clients} className="flex justify-between items-center py-2 border-b border-gray-800">
                            <span className="text-gray-400 text-sm">{s.clients} clients {s.plan}</span>
                            <span className="text-green-400 font-medium">{s.mrr.toLocaleString()} $/mois</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal creation admin */}
      {showCreate && (
        <CreateAdminModal
          onClose={() => setShowCreate(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}
