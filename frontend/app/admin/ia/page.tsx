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

  useEffect(() => {
    setMounted(true)
    try {
      const raw    = localStorage.getItem("voxflow-auth")
      if (!raw) { window.location.href = "/login"; return }
      const parsed = JSON.parse(raw)
      const state  = parsed.state || parsed
      if (!state.accessToken) { window.location.href = "/login"; return }
      setToken(state.accessToken)
    } catch { window.location.href = "/login" }
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 animate-pulse text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push("/admin/dashboard")} className="text-gray-400 hover:text-white text-sm">Dashboard</button>
            <h1 className="text-xl font-bold text-white">
              VoxFlow <span className="text-gray-500 text-sm font-normal">IA + Power Dialer</span>
            </h1>
            <div className="flex gap-1">
              {[
                { id: "coaching", label: "Coaching IA" },
                { id: "dialer",   label: "Power Dialer (" + campaigns.length + ")" },
                { id: "quality",  label: "Scores qualite" },
              ].map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
                  className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (activeTab === t.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >{t.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Stats globales IA */}
        {stats && (
          <div className="grid grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label: "Appels scores",    value: stats.totalScored,       color: "text-white" },
              { label: "Score moyen",      value: stats.avgOverallScore + "%", color: stats.avgOverallScore >= 80 ? "text-green-400" : stats.avgOverallScore >= 65 ? "text-amber-400" : "text-red-400" },
              { label: "Accueil",          value: stats.avgGreeting + "%",    color: "text-blue-400" },
              { label: "Empathie",         value: stats.avgEmpathy + "%",     color: "text-purple-400" },
              { label: "Resolution",       value: stats.avgResolution + "%",  color: "text-teal-400" },
              { label: "Excellents",       value: stats.excellentCalls,       color: "text-green-400" },
              { label: "A ameliorer",      value: stats.needsImprovement,     color: stats.needsImprovement > 0 ? "text-red-400" : "text-gray-500" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                <p className={"text-xl font-bold " + s.color}>{s.value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 animate-pulse text-center py-12">Chargement...</p>
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
    </div>
  )
}
