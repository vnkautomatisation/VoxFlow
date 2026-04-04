"use client"

import { useState, useEffect } from "react"
import { queuesApi } from "@/lib/queuesApi"

interface Props {
  token:  string
  queues: any[]
}

export default function RoutingRules({ token, queues }: Props) {
  const [rules,   setRules]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", priority: "1", action: "QUEUE", action_value: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    queuesApi.getRules(token).then((r) => {
      if (r.success) setRules(r.data || [])
    }).finally(() => setLoading(false))
  }, [token])

  const handleCreate = async () => {
    if (!form.name || !form.action_value) return
    setSaving(true)
    try {
      const res = await queuesApi.createRule(token, { ...form, priority: parseInt(form.priority) })
      if (res.success) { setRules((prev) => [res.data, ...prev]); setShowForm(false) }
    } catch {}
    finally { setSaving(false) }
  }

  const ACTION_LABELS: Record<string, string> = {
    QUEUE:   "Router vers file",
    AGENT:   "Router vers agent",
    IVR:     "Router vers IVR",
    VOICEMAIL: "Vers messagerie",
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Regles de routage</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
        >+ Nouvelle regle</button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom de la regle</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VIP vers file prioritaire"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Action</label>
              <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">
                {form.action === "QUEUE" ? "File cible" : "Valeur"}
              </label>
              {form.action === "QUEUE" ? (
                <select value={form.action_value} onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                >
                  <option value="">Choisir...</option>
                  {queues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              ) : (
                <input value={form.action_value} onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                  placeholder="ID ou valeur..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.name || !form.action_value}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm"
            >{saving ? "..." : "Creer"}</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm animate-pulse text-center py-8">Chargement...</p>
      ) : rules.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">Aucune regle de routage</p>
          <p className="text-gray-600 text-xs mt-1">Les regles permettent de router automatiquement les appels selon des conditions</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
              <div>
                <p className="text-white text-sm font-medium">{r.name}</p>
                <p className="text-gray-500 text-xs">{ACTION_LABELS[r.action] || r.action} · Priorite {r.priority}</p>
              </div>
              <span className={"text-xs px-2 py-1 rounded-full " + (r.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500")}>
                {r.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
