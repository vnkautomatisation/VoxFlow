"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { queuesApi } from "@/lib/queuesApi"
import ScheduleEditor from "@/components/queues/ScheduleEditor"
import CallbacksList from "@/components/queues/CallbacksList"
import RoutingRules from "@/components/queues/RoutingRules"

type Tab = "queues" | "schedules" | "callbacks" | "rules"

const STRATEGY_LABELS: Record<string, string> = {
  ROUND_ROBIN:    "Tour de role",
  SKILLS_BASED:   "Competences",
  PRIORITY:       "Priorite",
  LEAST_BUSY:     "Moins occupe",
  RANDOM:         "Aleatoire",
}

export default function QueuesPage() {
  const router  = useRouter()
  const [token,     setToken]     = useState<string | null>(null)
  const [mounted,   setMounted]   = useState(false)
  const [queues,    setQueues]    = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [callbacks, setCallbacks] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("queues")
  const [showForm,  setShowForm]  = useState(false)
  const [editQ,     setEditQ]     = useState<any>(null)
  const [form, setForm] = useState({
    name: "", strategy: "ROUND_ROBIN", priority: "1",
    max_wait_time: "300", sla_threshold: "20",
    is_vip: false, callback_enabled: true,
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState("")

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
      const [qRes, sRes, cbRes] = await Promise.all([
        queuesApi.getQueues(token),
        queuesApi.getSchedules(token),
        queuesApi.getCallbacks(token),
      ])
      if (qRes.success)  setQueues(qRes.data   || [])
      if (sRes.success)  setSchedules(sRes.data || [])
      if (cbRes.success) setCallbacks(cbRes.data || [])
    } catch {}
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [token])

  const handleSaveQueue = async () => {
    if (!token || !form.name) return
    setSaving(true)
    setErr("")
    try {
      const body = {
        ...form,
        priority:       parseInt(form.priority),
        max_wait_time:  parseInt(form.max_wait_time),
        sla_threshold:  parseInt(form.sla_threshold),
      }
      if (editQ) {
        await queuesApi.updateQueue(token, editQ.id, body)
      } else {
        await queuesApi.createQueue(token, body)
      }
      setShowForm(false)
      setEditQ(null)
      setForm({ name: "", strategy: "ROUND_ROBIN", priority: "1", max_wait_time: "300", sla_threshold: "20", is_vip: false, callback_enabled: true })
      load()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  if (!mounted || !token) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 animate-pulse text-sm">Chargement...</p>
    </div>
  )

  const pendingCb = callbacks.filter((c) => c.status === "PENDING").length

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push("/admin/dashboard")} className="text-gray-400 hover:text-white text-sm">Dashboard</button>
            <h1 className="text-xl font-bold text-white">VoxFlow <span className="text-gray-500 text-sm font-normal">Routage ACD</span></h1>
            <div className="flex gap-1">
              {[
                { id: "queues",    label: "Files (" + queues.length + ")" },
                { id: "schedules", label: "Horaires" },
                { id: "callbacks", label: "Callbacks" + (pendingCb > 0 ? " (" + pendingCb + ")" : "") },
                { id: "rules",     label: "Regles" },
              ].map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
                  className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (activeTab === t.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >{t.label}</button>
              ))}
            </div>
          </div>
          {activeTab === "queues" && (
            <button onClick={() => { setShowForm(true); setEditQ(null) }}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
            >+ Nouvelle file</button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── ONGLET QUEUES ── */}
        {activeTab === "queues" && (
          <>
            {/* Formulaire */}
            {showForm && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
                <h3 className="text-white font-medium mb-4">{editQ ? "Modifier la file" : "Nouvelle file d attente"}</h3>
                {err && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-3 text-sm">{err}</div>}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nom</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Support technique"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Strategie</label>
                    <select value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                    >
                      {Object.entries(STRATEGY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Priorite (1-10)</label>
                    <input type="number" min="1" max="10" value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Attente max (sec)</label>
                    <input type="number" value={form.max_wait_time}
                      onChange={(e) => setForm({ ...form, max_wait_time: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">SLA cible (sec)</label>
                    <input type="number" value={form.sla_threshold}
                      onChange={(e) => setForm({ ...form, sla_threshold: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.is_vip} onChange={(e) => setForm({ ...form, is_vip: e.target.checked })}
                        className="rounded" />
                      <span className="text-gray-300 text-sm">File VIP</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.callback_enabled} onChange={(e) => setForm({ ...form, callback_enabled: e.target.checked })}
                        className="rounded" />
                      <span className="text-gray-300 text-sm">Callback</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSaveQueue} disabled={saving || !form.name}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
                  >{saving ? "Sauvegarde..." : editQ ? "Mettre a jour" : "Creer la file"}</button>
                  <button onClick={() => { setShowForm(false); setEditQ(null) }}
                    className="border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm"
                  >Annuler</button>
                </div>
              </div>
            )}

            {/* Liste des files */}
            {loading ? (
              <p className="text-gray-500 text-sm animate-pulse text-center py-12">Chargement...</p>
            ) : queues.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
                <p className="text-gray-400 mb-2">Aucune file d attente</p>
                <button onClick={() => setShowForm(true)} className="text-teal-400 text-sm hover:text-teal-300">Creer la premiere file</button>
              </div>
            ) : (
              <div className="space-y-3">
                {queues.map((q) => (
                  <div key={q.id} className={"bg-gray-900 border rounded-xl p-5 " + (q.is_vip ? "border-purple-700" : "border-gray-800")}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={"w-3 h-3 rounded-full flex-shrink-0 " + (q.status === "ACTIVE" ? "bg-green-500" : "bg-gray-500")}></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-semibold">{q.name}</h3>
                            {q.is_vip && <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full">VIP</span>}
                            {q.callback_enabled && <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">Callback</span>}
                          </div>
                          <p className="text-gray-400 text-xs">{STRATEGY_LABELS[q.strategy] || q.strategy}</p>
                        </div>
                      </div>
                      <button onClick={() => { setEditQ(q); setForm({ name: q.name, strategy: q.strategy, priority: String(q.priority || 1), max_wait_time: String(q.max_wait_time || 300), sla_threshold: String(q.sla_threshold || 20), is_vip: q.is_vip || false, callback_enabled: q.callback_enabled !== false }); setShowForm(true) }}
                        className="text-gray-500 hover:text-white text-xs border border-gray-700 px-3 py-1 rounded-lg"
                      >Modifier</button>
                    </div>

                    {/* Stats temps reel */}
                    {q.realtime && (
                      <div className="grid grid-cols-5 gap-3">
                        {[
                          { label: "En attente",    value: q.realtime.waiting,       color: q.realtime.waiting > 0 ? "text-amber-400" : "text-white" },
                          { label: "Agents dispo",  value: q.realtime.onlineAgents,  color: q.realtime.onlineAgents > 0 ? "text-green-400" : "text-red-400" },
                          { label: "Agents busy",   value: q.realtime.busyAgents,    color: "text-blue-400" },
                          { label: "SLA auj.",      value: q.realtime.slaRate + "%", color: q.realtime.slaRate >= 80 ? "text-green-400" : "text-red-400" },
                          { label: "Repondus auj.", value: q.realtime.todayAnswered, color: "text-teal-400" },
                        ].map((s) => (
                          <div key={s.label} className="bg-gray-800 rounded-lg p-2 text-center">
                            <p className={"text-lg font-bold " + s.color}>{s.value}</p>
                            <p className="text-gray-500 text-xs">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "schedules" && (
          <ScheduleEditor token={token} schedules={schedules} onRefresh={load} />
        )}

        {activeTab === "callbacks" && (
          <CallbacksList token={token} callbacks={callbacks} onRefresh={load} />
        )}

        {activeTab === "rules" && (
          <RoutingRules token={token} queues={queues} />
        )}
      </div>
    </div>
  )
}
