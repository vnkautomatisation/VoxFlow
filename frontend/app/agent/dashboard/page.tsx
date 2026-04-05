"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { agentApi } from "@/lib/agentApi"
import CallHistory from "@/components/agent/CallHistory"
import ScriptPanel from "@/components/agent/ScriptPanel"

type Tab = "history" | "scripts"

const STATUS_OPTIONS = [
  { value: "ONLINE",  label: "Disponible",  color: "bg-green-500" },
  { value: "BREAK",   label: "Pause",        color: "bg-amber-500" },
  { value: "OFFLINE", label: "Hors ligne",   color: "bg-gray-500" },
]

export default function AgentDashboard() {
  const { user, isAuth, accessToken, logout } = useAuthStore()
  const router = useRouter()

  const [calls,       setCalls]       = useState<any[]>([])
  const [scripts,     setScripts]     = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<Tab>("history")
  const [agentStatus, setAgentStatus] = useState("ONLINE")
  const [showStatus,  setShowStatus]  = useState(false)

  useEffect(() => {
    if (!isAuth || !user) { router.push("/login"); return }
    loadData()
  }, [isAuth, user])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const [callsRes, scriptsRes] = await Promise.all([
        agentApi.getCalls(accessToken, 20),
        agentApi.getScripts(accessToken),
      ])
      if (callsRes.success)   setCalls(callsRes.data || [])
      if (scriptsRes.success) setScripts(scriptsRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const handleStatusChange = async (status: string) => {
    setShowStatus(false)
    setAgentStatus(status)
    try { await agentApi.setStatus(accessToken!, status) } catch {}
  }

  if (!user) return null

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === agentStatus) || STATUS_OPTIONS[2]

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-white">
              Vox<span className="text-blue-500">Flow</span>
              <span className="text-gray-500 text-sm font-normal ml-2">Agent</span>
            </h1>
            <div className="flex gap-1">
              {[
                { id: "history", label: "Historique (" + calls.length + ")" },
                { id: "scripts", label: "Scripts (" + scripts.length + ")" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (
                    activeTab === tab.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowStatus(!showStatus)}
                className="flex items-center gap-2 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 transition-colors"
              >
                <div className={"w-2 h-2 rounded-full " + currentStatus.color}></div>
                <span className="text-white text-sm">{currentStatus.label}</span>
              </button>
              {showStatus && (
                <div className="absolute right-0 top-10 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-700 transition-colors"
                    >
                      <div className={"w-2 h-2 rounded-full " + opt.color}></div>
                      <span className="text-white text-sm whitespace-nowrap">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-white text-sm font-medium">{user.name}</p>
              <p className="text-blue-400 text-xs">{user.role}</p>
            </div>
            <button
              onClick={() => { logout(); router.push("/login") }}
              className="border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg text-sm hover:text-white transition-colors"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "history" && (
          <div className="max-w-2xl">
            <h2 className="text-white font-semibold text-lg mb-4">Historique des appels</h2>
            <CallHistory calls={calls} />
          </div>
        )}
        {activeTab === "scripts" && (
          <div className="max-w-2xl">
            <h2 className="text-white font-semibold text-lg mb-4">Scripts d appel</h2>
            <ScriptPanel scripts={scripts} />
          </div>
        )}
      </div>
    </div>
  )
}