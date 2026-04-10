"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { analyticsApi, aiApi, smsApi } from "@/lib/aiApi"
import HeatmapChart from "@/components/analytics/HeatmapChart"
import TrendChart from "@/components/analytics/TrendChart"
import AISummaryCard from "@/components/ai/AISummaryCard"
import SMSInbox from "@/components/sms/SMSInbox"

type Tab = "analytics" | "ai" | "sms"

export default function AnalyticsPage() {
  const { user, isAuth, accessToken, logout } = useAuthStore()
  const router = useRouter()
  const [stats,       setStats]       = useState<any>(null)
  const [sla,         setSla]         = useState<any>(null)
  const [summaries,   setSummaries]   = useState<any[]>([])
  const [smsMessages, setSmsMessages] = useState<any[]>([])
  const [period,      setPeriod]      = useState("30d")
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<Tab>("analytics")

  useEffect(() => {
    if (!isAuth || !user) { router.push("/login"); return }
    loadData()
  }, [isAuth, user])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const [statsRes, slaRes, sumRes, smsRes] = await Promise.all([
        analyticsApi.getAdvanced(accessToken, period),
        analyticsApi.getSLA(accessToken),
        aiApi.getSummaries(accessToken),
        smsApi.getConversations(accessToken),
      ])
      if (statsRes.success)  setStats(statsRes.data)
      if (slaRes.success)    setSla(slaRes.data)
      if (sumRes.success)    setSummaries(sumRes.data || [])
      if (smsRes.success)    setSmsMessages(smsRes.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [accessToken, period])

  useEffect(() => { if (accessToken) loadData() }, [period])

  if (!user) return null

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#eeeef8]">IA + Analytics</h1>
          <div className="text-xs text-[#55557a] mt-0.5">Statistiques avancées et IA</div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[#2e2e44] mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: "analytics", label: "Analytics" },
          { id: "ai",        label: "IA" },
          { id: "sms",       label: "SMS (" + smsMessages.length + ")" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0
              ${activeTab === tab.id ? "text-[#eeeef8] border-[#7b61ff]" : "text-[#55557a] border-transparent hover:text-[#9898b8]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {loading ? (
          <p className="text-[#55557a] animate-pulse text-center py-20">Chargement...</p>
        ) : (
          <div>
            {activeTab === "analytics" && stats && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[#9898b8]">Analytics avancés</div>
                  <div className="flex gap-2">
                    {["7d", "30d", "90d"].map((p) => (
                      <button key={p} onClick={() => setPeriod(p)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                          period === p ? "bg-[#7b61ff] text-white" : "bg-[#1f1f2a] text-[#9898b8] border border-[#2e2e44] hover:text-[#eeeef8]"
                        }`}
                      >{p}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Appels total",    value: stats.summary.totalCalls.toString(),         color: "text-[#eeeef8]" },
                    { label: "Taux résolution", value: stats.summary.resolutionRate + "%",           color: "text-emerald-400" },
                    { label: "Durée moyenne",   value: Math.round(stats.summary.avgDuration) + "s", color: "text-sky-400" },
                    { label: "Minutes total",   value: stats.summary.totalMinutes + "min",           color: "text-violet-400" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-1">{s.label}</div>
                      <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {sla && (
                  <div className={`bg-[#18181f] border rounded-xl p-4 ${sla.slaAchieved ? "border-emerald-400/30" : "border-rose-400/30"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#eeeef8] font-medium">SLA 24h</p>
                        <p className="text-[#55557a] text-xs">Objectif : {sla.slaTarget}%</p>
                      </div>
                      <p className={`text-3xl font-bold font-mono ${sla.slaAchieved ? "text-emerald-400" : "text-rose-400"}`}>{sla.answerRate}%</p>
                    </div>
                    <div className="mt-3 bg-[#1f1f2a] rounded-full h-2">
                      <div className={`h-2 rounded-full ${sla.slaAchieved ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: Math.min(sla.answerRate, 100) + "%" }}></div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
                    <HeatmapChart data={stats.heatmap} />
                  </div>
                  <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
                    <TrendChart data={stats.dailyTrend} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ai" && (
              <div>
                <h2 className="text-[#eeeef8] font-semibold mb-4">IA et Transcription</h2>
                {summaries.length === 0 ? (
                  <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-8 text-center">
                    <p className="text-[#9898b8] mb-2">Aucun appel traité par IA</p>
                    <p className="text-[#55557a] text-sm">Les appels peuvent être analysés automatiquement avec OpenAI.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {summaries.map((call: any) => (
                      <AISummaryCard key={call.id} call={call} onProcessed={loadData} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "sms" && (
              <div>
                <h2 className="text-[#eeeef8] font-semibold mb-4">Canal SMS</h2>
                <SMSInbox messages={smsMessages} onRefresh={loadData} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
