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
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push("/admin/dashboard")} className="text-gray-400 hover:text-white text-sm">
              Dashboard
            </button>
            <h1 className="text-xl font-bold text-white">
              VoxFlow <span className="text-gray-500 text-sm font-normal">IA + Analytics</span>
            </h1>
            <div className="flex gap-1">
              {[
                { id: "analytics", label: "Analytics" },
                { id: "ai",        label: "IA" },
                { id: "sms",       label: "SMS (" + smsMessages.length + ")" },
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
                  className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (activeTab === tab.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { logout(); router.push("/login") }} className="border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg text-sm">
            Deconnexion
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <p className="text-gray-500 animate-pulse text-center py-20">Chargement...</p>
        ) : (
          <div>
            {activeTab === "analytics" && stats && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold">Analytics avances</h2>
                  <div className="flex gap-2">
                    {["7d", "30d", "90d"].map((p) => (
                      <button key={p} onClick={() => setPeriod(p)}
                        className={"px-3 py-1 rounded-lg text-sm " + (period === p ? "bg-teal-600 text-white" : "border border-gray-700 text-gray-400")}
                      >{p}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Appels total",    value: stats.summary.totalCalls.toString(),                   color: "text-white" },
                    { label: "Taux resolution", value: stats.summary.resolutionRate + "%",                    color: "text-green-400" },
                    { label: "Duree moyenne",   value: Math.round(stats.summary.avgDuration) + "s",           color: "text-blue-400" },
                    { label: "Minutes total",   value: stats.summary.totalMinutes + "min",                    color: "text-purple-400" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                      <p className={"text-2xl font-bold " + s.color}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {sla && (
                  <div className={"bg-gray-900 border rounded-xl p-4 mb-6 " + (sla.slaAchieved ? "border-green-800" : "border-red-800")}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">SLA 24h</p>
                        <p className="text-gray-500 text-xs">Objectif : {sla.slaTarget}%</p>
                      </div>
                      <p className={"text-3xl font-bold " + (sla.slaAchieved ? "text-green-400" : "text-red-400")}>{sla.answerRate}%</p>
                    </div>
                    <div className="mt-3 bg-gray-800 rounded-full h-2">
                      <div className={"h-2 rounded-full " + (sla.slaAchieved ? "bg-green-500" : "bg-red-500")} style={{ width: Math.min(sla.answerRate, 100) + "%" }}></div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <HeatmapChart data={stats.heatmap} />
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <TrendChart data={stats.dailyTrend} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ai" && (
              <div>
                <h2 className="text-white font-semibold mb-4">IA et Transcription</h2>
                {summaries.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                    <p className="text-gray-400 mb-2">Aucun appel traite par IA</p>
                    <p className="text-gray-500 text-sm">Les appels peuvent etre analyses automatiquement avec OpenAI.</p>
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
                <h2 className="text-white font-semibold mb-4">Canal SMS</h2>
                <SMSInbox messages={smsMessages} onRefresh={loadData} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
