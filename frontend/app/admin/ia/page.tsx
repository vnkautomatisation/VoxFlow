"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ai2Api } from "@/lib/ai2Api"
import PowerDialer from "@/components/dialer/PowerDialer"
import CoachingDashboard from "@/components/dialer/CoachingDashboard"
import QualityScores from "@/components/dialer/QualityScores"

type Tab = "coaching" | "dialer" | "quality"

export default function IAPage() {
  const router  = useRouter()
  const [token,     setToken]     = useState<string | null>(null)
  const [mounted,   setMounted]   = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("coaching")
  const [stats,     setStats]     = useState<any>(null)
  const [coaching,  setCoaching]  = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [iaModuleStatus, setIaModuleStatus] = useState<{ ia_basic: boolean; ia_coaching: boolean }>({ ia_basic: false, ia_coaching: false })

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem("voxflow-auth")
      if (!raw) { router.push("/login"); return }
      const parsed = JSON.parse(raw)
      const state  = parsed.state || parsed
      if (!state.accessToken) { router.push("/login"); return }
      setToken(state.accessToken)
    } catch { router.push("/login") }
  }, [router])

  // Check module status
  useEffect(() => {
    const tok = typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
    const url = typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
    if (!tok) return
    fetch(url + '/api/v1/billing/addons/summary', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    }).then(r => r.json()).then(res => {
      if (res.success && res.data?.activeModules) {
        const mods = res.data.activeModules as any[]
        setIaModuleStatus({
          ia_basic: mods.some((m: any) => m.module_type === 'ia_basic' && ['active', 'trialing'].includes(m.status)),
          ia_coaching: mods.some((m: any) => m.module_type === 'ia_coaching' && ['active', 'trialing'].includes(m.status)),
        })
      }
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [statsRes, coachRes, campRes] = await Promise.all([
        ai2Api.getStats(token),
        ai2Api.getCoaching(token),
        ai2Api.getCampaigns(token),
      ])
      if (statsRes.success)  setStats(statsRes.data)
      if (coachRes.success)  setCoaching(coachRes.data   || [])
      if (campRes.success)   setCampaigns(campRes.data   || [])
    } catch {}
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [token])

  if (!mounted || !token) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-[#55557a] animate-pulse text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Module banner */}
      {!iaModuleStatus.ia_basic && !iaModuleStatus.ia_coaching && (
        <div className="bg-orange-950/40 border border-orange-800/30 rounded-xl px-5 py-4 mb-5 flex items-center justify-between">
          <div className="text-[13px] text-orange-300">Module IA non active — Transcription, resume et coaching IA ne sont pas disponibles sur votre compte.</div>
          <a href="/client/plans" className="px-4 py-2 bg-[#7b61ff] text-white rounded-lg text-xs font-bold no-underline hover:bg-[#6145ff] whitespace-nowrap ml-4">Activer le module IA</a>
        </div>
      )}
      {iaModuleStatus.ia_basic && !iaModuleStatus.ia_coaching && (
        <div className="bg-blue-950/40 border border-blue-800/30 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
          <div className="text-[12px] text-blue-300">Coaching Live non active — Passez a IA Coaching Live pour le coaching en temps reel.</div>
          <a href="/client/plans" className="text-[11px] text-[#7b61ff] font-semibold no-underline hover:underline ml-4 whitespace-nowrap">Decouvrir</a>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#eeeef8]">IA + Power Dialer</h1>
          <div className="text-xs text-[#55557a] mt-0.5">Coaching automatique et campagnes</div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[#2e2e44] mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: "coaching", label: "Coaching IA" },
          { id: "dialer",   label: "Power Dialer (" + campaigns.length + ")" },
          { id: "quality",  label: "Scores qualité" },
        ].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0
              ${activeTab === t.id ? "text-[#eeeef8] border-[#7b61ff]" : "text-[#55557a] border-transparent hover:text-[#9898b8]"}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Stats globales IA */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {[
            { label: "Appels scorés",    value: stats.totalScored,              color: "text-[#eeeef8]" },
            { label: "Score moyen",      value: stats.avgOverallScore + "%",    color: stats.avgOverallScore >= 80 ? "text-emerald-400" : stats.avgOverallScore >= 65 ? "text-amber-400" : "text-rose-400" },
            { label: "Accueil",          value: stats.avgGreeting + "%",        color: "text-sky-400" },
            { label: "Empathie",         value: stats.avgEmpathy + "%",         color: "text-violet-400" },
            { label: "Résolution",       value: stats.avgResolution + "%",      color: "text-emerald-400" },
            { label: "Excellents",       value: stats.excellentCalls,           color: "text-emerald-400" },
            { label: "À améliorer",      value: stats.needsImprovement,         color: stats.needsImprovement > 0 ? "text-rose-400" : "text-[#55557a]" },
          ].map((s) => (
            <div key={s.label} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-1">{s.label}</div>
              <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-[#55557a] animate-pulse text-center py-12">Chargement...</p>
      ) : (
        <>
          {activeTab === "coaching" && (
            <CoachingDashboard token={token} coaching={coaching} onRefresh={load} />
          )}
          {activeTab === "dialer" && (
            <PowerDialer token={token} campaigns={campaigns} onRefresh={load} />
          )}
          {activeTab === "quality" && (
            <QualityScores token={token} stats={stats} onRefresh={load} />
          )}
        </>
      )}
    </div>
  )
}
