"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { ownerApi } from "@/lib/ownerApi"
import StatsCards from "@/components/owner/StatsCards"
import OrgsTable from "@/components/owner/OrgsTable"
import CreateAdminModal from "@/components/owner/CreateAdminModal"
import RevenueCard from "@/components/owner/RevenueCard"

export default function OwnerDashboard() {
  const { user, isAuth, accessToken, logout } = useAuthStore()
  const router = useRouter()

  const [stats,   setStats]   = useState<any>(null)
  const [orgs,    setOrgs]    = useState<any[]>([])
  const [revenue, setRevenue] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab]   = useState<"dashboard" | "admins" | "numbers" | "revenue">("dashboard")
  const [mounted, setMounted]       = useState(false)

  // Attendre la réhydratation de Zustand avant de vérifier isAuth.
  // Sinon on a une race : isAuth=false au premier render → redirect
  // /login → login voit isAuth=true → redirect /owner/dashboard → loop.
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isAuth || !user) { router.push("/login"); return }
    // OWNER + OWNER_STAFF partagent le portail owner
    if (user.role !== "OWNER" && user.role !== "OWNER_STAFF") { router.push("/login"); return }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuth, user])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const [statsRes, orgsRes, revRes] = await Promise.all([
        ownerApi.getStats(accessToken),
        ownerApi.getOrganizations(accessToken),
        ownerApi.getRevenue(accessToken),
      ])
      if (statsRes.success)   setStats(statsRes.data)
      if (orgsRes.success)    setOrgs(orgsRes.data.organizations || [])
      if (revRes.success)     setRevenue(revRes.data)
    } catch (err) {
      console.error("Erreur chargement data:", err)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

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
                {stats && <StatsCards stats={stats} />}

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-white font-semibold">Derniers admins</h2>
                      <button
                        onClick={() => setActiveTab("admins")}
                        className="text-purple-400 text-sm hover:text-purple-300"
                      >
                        Voir tout
                      </button>
                    </div>
                    <OrgsTable orgs={orgs.slice(0, 5)} onRefresh={loadData} />
                  </div>
                  <div>
                    {revenue && <RevenueCard revenue={revenue} />}
                  </div>
                </div>

                {/* Plans */}
                <div className="mt-6">
                  <h2 className="text-white font-semibold mb-3">Plans disponibles</h2>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { name: "Starter", price: "99 $", agents: "5", numbers: "1", color: "border-gray-700" },
                      { name: "Pro", price: "299 $", agents: "25", numbers: "5", color: "border-blue-700", popular: true },
                      { name: "Enterprise", price: "799 $", agents: "100", numbers: "20", color: "border-purple-700" },
                    ].map((plan) => (
                      <div key={plan.name} className={"bg-gray-900 border rounded-xl p-5 " + plan.color}>
                        {plan.popular && (
                          <p className="text-blue-400 text-xs font-medium mb-2">POPULAIRE</p>
                        )}
                        <h3 className="text-white font-semibold">{plan.name}</h3>
                        <p className="text-2xl font-bold text-white mt-1">{plan.price}<span className="text-gray-500 text-sm font-normal">/mois</span></p>
                        <div className="mt-3 space-y-1">
                          <p className="text-gray-400 text-sm">{plan.agents} agents</p>
                          <p className="text-gray-400 text-sm">{plan.numbers} numero(s)</p>
                        </div>
                      </div>
                    ))}
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
