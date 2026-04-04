"use client"

import { useState } from "react"
import { integrationsApi } from "@/lib/integrationsApi"

const WEBHOOK_EVENTS = [
  "call.started", "call.completed", "call.missed",
  "contact.created", "contact.updated",
  "conversation.created", "conversation.resolved",
  "campaign.completed",
]

interface Props {
  token:     string
  webhooks:  any[]
  onRefresh: () => void
}

export default function WebhooksPanel({ token, webhooks, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[] })
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [logs,    setLogs]    = useState<Record<string, any[]>>({})
  const [showLogs, setShowLogs] = useState<string | null>(null)

  const toggleEvent = (ev: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev]
    }))
  }

  const handleCreate = async () => {
    if (!form.name || !form.url || form.events.length === 0) return
    setSaving(true)
    try {
      await integrationsApi.createWebhook(token, form)
      setShowForm(false)
      setForm({ name: "", url: "", events: [] })
      onRefresh()
    } catch {}
    finally { setSaving(false) }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      await integrationsApi.testWebhook(token, id)
    } catch {}
    finally { setTesting(null) }
  }

  const handleShowLogs = async (id: string) => {
    if (showLogs === id) { setShowLogs(null); return }
    const res = await integrationsApi.getWebhookLogs(token, id)
    if (res.success) setLogs((prev) => ({ ...prev, [id]: res.data }))
    setShowLogs(id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Webhooks sortants</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
        >+ Nouveau webhook</button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mon webhook Zapier"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">URL</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://hooks.zapier.com/..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-gray-400 text-xs mb-2 block">Evenements a ecouter</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <button key={ev} type="button" onClick={() => toggleEvent(ev)}
                  className={"text-xs px-2 py-1 rounded-full border transition-colors " + (
                    form.events.includes(ev)
                      ? "border-teal-600 bg-teal-900/30 text-teal-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  )}
                >{ev}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.name || !form.url || form.events.length === 0}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >{saving ? "Creation..." : "Creer webhook"}</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <p className="text-gray-400 text-sm">Aucun webhook configure</p>
          <p className="text-gray-500 text-xs mt-1">Les webhooks envoient des evenements vers Zapier, Make, ou votre serveur</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={"w-2 h-2 rounded-full " + (wh.is_active ? "bg-green-500" : "bg-gray-500")}></div>
                    <p className="text-white font-medium text-sm">{wh.name}</p>
                  </div>
                  <p className="text-gray-500 text-xs font-mono">{wh.url}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleTest(wh.id)} disabled={testing === wh.id}
                    className="text-xs border border-gray-700 text-gray-400 px-2 py-1 rounded hover:border-teal-600 hover:text-teal-400"
                  >{testing === wh.id ? "..." : "Tester"}</button>
                  <button onClick={() => handleShowLogs(wh.id)}
                    className={"text-xs border px-2 py-1 rounded transition-colors " + (showLogs === wh.id ? "border-teal-600 text-teal-400" : "border-gray-700 text-gray-400")}
                  >Logs</button>
                  <button onClick={async () => { await integrationsApi.deleteWebhook(token, wh.id); onRefresh() }}
                    className="text-xs text-red-500 hover:text-red-400"
                  >Supprimer</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {(wh.events || []).map((ev: string) => (
                  <span key={ev} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{ev}</span>
                ))}
              </div>

              {wh.last_triggered_at && (
                <p className="text-gray-600 text-xs">
                  Dernier envoi: {new Date(wh.last_triggered_at).toLocaleString("fr-CA")} ·
                  <span className={wh.last_status === "SUCCESS" ? "text-green-500" : "text-red-500"}> {wh.last_status}</span>
                </p>
              )}

              {showLogs === wh.id && logs[wh.id] && (
                <div className="mt-3 bg-gray-800 rounded-lg overflow-hidden">
                  {logs[wh.id].length === 0 ? (
                    <p className="text-gray-500 text-xs p-3">Aucun log</p>
                  ) : logs[wh.id].slice(0, 5).map((log: any) => (
                    <div key={log.id} className="px-3 py-2 border-b border-gray-700 last:border-0 flex items-center justify-between">
                      <div>
                        <p className="text-gray-300 text-xs">{log.event}</p>
                        <p className="text-gray-600 text-xs">{new Date(log.created_at).toLocaleString("fr-CA")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">{log.status_code}</span>
                        <span className={"text-xs " + (log.success ? "text-green-400" : "text-red-400")}>
                          {log.success ? "OK" : "FAIL"}
                        </span>
                        <span className="text-gray-600 text-xs">{log.duration_ms}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
