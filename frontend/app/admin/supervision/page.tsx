"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supervisionApi } from "@/lib/supervisionApi"
import AgentCard from "@/components/supervision/AgentCard"
import KPIBar from "@/components/supervision/KPIBar"
import ActiveCallsTable from "@/components/supervision/ActiveCallsTable"
import AlertsPanel from "@/components/supervision/AlertsPanel"

export default function SupervisionPage() {
  const router     = useRouter()
  const [token,    setToken]    = useState<string | null>(null)
  const [mounted,  setMounted]  = useState(false)
  const [snapshot, setSnapshot] = useState<any>(null)
  const [alerts,   setAlerts]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const wsRef  = useRef<WebSocket | null>(null)
  const pollRef = useRef<any>(null)

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

  // Charger via polling (fallback si WebSocket indisponible)
  const loadSnapshot = useCallback(async () => {
    if (!token) return
    try {
      const [snapRes, alertRes] = await Promise.all([
        supervisionApi.getSnapshot(token),
        supervisionApi.getAlerts(token),
      ])
      if (snapRes.success)  { setSnapshot(snapRes.data);  setLastUpdate(new Date()) }
      if (alertRes.success) setAlerts(alertRes.data || [])
    } catch {}
    finally { setLoading(false) }
  }, [token])

  useEffect(() => {
    if (!token) return
    loadSnapshot()
    // Polling toutes les 5 secondes
    pollRef.current = setInterval(loadSnapshot, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [token, loadSnapshot])

  const handleForceStatus = async (agentId: string, status: string) => {
    if (!token) return
    await supervisionApi.forceStatus(token, agentId, status)
    loadSnapshot()
  }

  const handleJoinCall = async (callId: string, mode: "listen" | "whisper" | "barge") => {
    if (!token) return
    const res = await supervisionApi.joinCall(token, callId, mode)
    if (res.success) {
      alert("Mode " + mode.toUpperCase() + " active pour cet appel.\n\n" + res.data.message)
    }
  }

  if (!mounted || !token) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 animate-pulse text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin/dashboard")} className="text-gray-400 hover:text-white text-sm">
              Dashboard
            </button>
            <h1 className="text-xl font-bold text-white">
              VoxFlow <span className="text-gray-500 text-sm font-normal">Supervision</span>
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-gray-400 text-xs">
                Temps reel · {lastUpdate ? lastUpdate.toLocaleTimeString("fr-CA") : "..."}
              </span>
            </div>
          </div>
          <button onClick={() => router.push("/admin/dashboard")}
            className="border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-800"
          >
            Fermer wallboard
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <p className="text-gray-500 animate-pulse">Chargement supervision...</p>
        </div>
      ) : snapshot ? (
        <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">

          {/* KPI Bar */}
          <KPIBar kpis={snapshot.kpis} />

          {/* Alertes */}
          {alerts.length > 0 && <AlertsPanel alerts={alerts} />}

          {/* Agents en temps reel */}
          <div>
            <h2 className="text-white font-semibold mb-3">
              Agents ({snapshot.kpis.onlineAgents}/{snapshot.kpis.totalAgents} en ligne)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {snapshot.agents.map((agent: any) => (
                <AgentCard
                  key={agent.agentId}
                  agent={agent}
                  onForceStatus={(status: string) => handleForceStatus(agent.agentId, status)}
                  onJoinCall={(mode: any) => agent.callId && handleJoinCall(agent.callId, mode)}
                />
              ))}
            </div>
          </div>

          {/* Appels actifs */}
          {snapshot.activeCalls.length > 0 && (
            <div>
              <h2 className="text-white font-semibold mb-3">
                Appels actifs ({snapshot.activeCalls.length})
              </h2>
              <ActiveCallsTable
                calls={snapshot.activeCalls}
                onJoinCall={handleJoinCall}
              />
            </div>
          )}

          {/* Stats files */}
          {snapshot.queues.length > 0 && (
            <div>
              <h2 className="text-white font-semibold mb-3">Files actives</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {snapshot.queues.map((q: any) => (
                  <div key={q.id} className={"bg-gray-900 border rounded-xl p-4 " + (q.is_vip ? "border-purple-700" : "border-gray-800")}>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white text-sm font-medium">{q.name}</p>
                      {q.is_vip && <span className="text-xs bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded">VIP</span>}
                    </div>
                    <p className="text-gray-500 text-xs">{q.strategy}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="flex items-center justify-center py-32">
          <p className="text-gray-500">Aucune donnee disponible</p>
        </div>
      )}
    </div>
  )
}
