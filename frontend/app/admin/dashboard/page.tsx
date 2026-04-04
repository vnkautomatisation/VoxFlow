"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { adminApi } from "@/lib/adminApi"
import AgentsTab from "@/components/admin/AgentsTab"
import QueuesTab from "@/components/admin/QueuesTab"
import IVRBuilder from "@/components/admin/IVRBuilder"
import ReportsTab from "@/components/admin/ReportsTab"

type Tab = "dashboard" | "agents" | "queues" | "ivr" | "reports"

export default function AdminDashboard() {
  const { user, isAuth, accessToken, logout } = useAuthStore()
  const router = useRouter()
  const [stats,     setStats]     = useState<any>(null)
  const [agents,    setAgents]    = useState<any[]>([])
  const [queues,    setQueues]    = useState<any[]>([])
  const [ivr,       setIvr]       = useState<any[]>([])
  const [reports,   setReports]   = useState<any>(null)
  const [period,    setPeriod]    = useState("30d")
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("dashboard")

  useEffect(() => {
    if (!isAuth || !user) { router.push("/login"); return }
    if (user.role === "OWNER") { router.push("/owner/dashboard"); return }
    loadData()
  }, [isAuth, user])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const [statsRes, agentsRes, queuesRes, ivrRes, reportsRes] = await Promise.all([
        adminApi.getStats(accessToken),
        adminApi.getAgents(accessToken),
        adminApi.getQueues(accessToken),
        adminApi.getIVR(accessToken),
        adminApi.getReports(accessToken, period),
      ])
      if (statsRes.success)   setStats(statsRes.data)
      if (agentsRes.success)  setAgents(agentsRes.data || [])
      if (queuesRes.success)  setQueues(queuesRes.data || [])
      if (ivrRes.success)     setIvr(ivrRes.data || [])
      if (reportsRes.success) setReports(reportsRes.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [accessToken, period])

  useEffect(() => { if (accessToken) loadData() }, [period])

  if (!user) return null

  const TABS = [
    { id: "dashboard", label: "Vue globale" },
    { id: "agents",    label: "Agents (" + agents.length + ")" },
    { id: "queues",    label: "Files (" + queues.length + ")" },
    { id: "ivr",       label: "IVR" },
    { id: "reports",   label: "Rapports" },
  ]

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white">VoxFlow</h1>
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
                  className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (activeTab === tab.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >
                  {tab.label}
                </button>
              ))}
              <button onClick={() => router.push("/admin/analytics")}
                className="px-3 py-1.5 rounded-lg text-sm bg-teal-700 text-white hover:bg-teal-600 transition-colors"
              >
                IA + Analytics
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-white text-sm font-medium">{user.name}</p>
              <p className="text-teal-400 text-xs">{user.role}</p>
            </div>
            <button onClick={() => { logout(); router.push("/login") }}
              className="border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg text-sm hover:border-gray-500 hover:text-white transition-colors"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <p className="text-gray-500 animate-pulse text-center py-20">Chargement...</p>
        ) : (
          <div>
            {activeTab === "dashboard" && stats && (
              <div>
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                  {[
                    { label: "Agents en ligne",  value: stats.onlineAgents + "/" + stats.totalAgents, color: "text-green-400" },
                    { label: "Files actives",    value: stats.totalQueues.toString(),                 color: "text-teal-400" },
                    { label: "Appels 30j",       value: stats.totalCalls30d.toString(),               color: "text-blue-400" },
                    { label: "Duree moyenne",    value: stats.avgDuration + "s",                      color: "text-purple-400" },
                    { label: "Resolus",          value: stats.resolvedCalls.toString(),               color: "text-green-400" },
                    { label: "IVR",              value: ivr.length.toString(),                        color: "text-amber-400" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                      <p className="text-gray-500 text-xs mb-1">{s.label}</p>
                      <p className={"text-xl font-bold " + s.color}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold">Agents recents</h3>
                      <button onClick={() => setActiveTab("agents")} className="text-teal-400 text-sm">Voir tout</button>
                    </div>
                    {agents.slice(0, 4).map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                        <div className="w-7 h-7 bg-teal-900 rounded-full flex items-center justify-center text-teal-300 text-xs font-bold">{a.name.charAt(0)}</div>
                        <div className="flex-1">
                          <p className="text-white text-sm">{a.name}</p>
                          <p className="text-gray-500 text-xs">{a.role}</p>
                        </div>
                      </div>
                    ))}
                    {agents.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Aucun agent</p>}
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-semibold">Files d attente</h3>
                      <button onClick={() => setActiveTab("queues")} className="text-teal-400 text-sm">Voir tout</button>
                    </div>
                    {queues.slice(0, 4).map((q: any) => (
                      <div key={q.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                        <div className="w-7 h-7 bg-blue-900 rounded-full flex items-center justify-center text-blue-300 text-xs">Q</div>
                        <div className="flex-1">
                          <p className="text-white text-sm">{q.name}</p>
                          <p className="text-gray-500 text-xs">{q.strategy}</p>
                        </div>
                      </div>
                    ))}
                    {queues.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Aucune file</p>}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "agents"  && <AgentsTab agents={agents} onRefresh={loadData} />}
            {activeTab === "queues"  && <QueuesTab queues={queues} onRefresh={loadData} />}
            {activeTab === "ivr"     && <IVRBuilder configs={ivr} onRefresh={loadData} />}
            {activeTab === "reports" && <ReportsTab reports={reports} period={period} onPeriod={setPeriod} />}
          </div>
        )}
      </div>
    </div>
  )
}


