"use client"

import { useState } from "react"
import { queuesApi } from "@/lib/queuesApi"

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-amber-900 text-amber-300",
  COMPLETED: "bg-green-900 text-green-300",
  FAILED:    "bg-red-900 text-red-300",
}

interface Props {
  token:     string
  callbacks: any[]
  onRefresh: () => void
}

export default function CallbacksList({ token, callbacks, onRefresh }: Props) {
  const [completing, setCompleting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ phoneNumber: "", callerName: "" })
  const [saving, setSaving] = useState(false)

  const handleComplete = async (id: string) => {
    setCompleting(id)
    try {
      await queuesApi.completeCallback(token, id)
      onRefresh()
    } catch {}
    finally { setCompleting(null) }
  }

  const handleCreate = async () => {
    if (!form.phoneNumber) return
    setSaving(true)
    try {
      await queuesApi.createCallback(token, form)
      setShowForm(false)
      setForm({ phoneNumber: "", callerName: "" })
      onRefresh()
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Rappels automatiques</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
        >+ Nouveau callback</button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Numero</label>
              <input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="+15141234567"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom (optionnel)</label>
              <input value={form.callerName} onChange={(e) => setForm({ ...form, callerName: e.target.value })}
                placeholder="Jean Tremblay"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.phoneNumber}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm"
            >{saving ? "..." : "Creer"}</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </div>
      )}

      {callbacks.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">Aucun callback en attente</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {callbacks.map((cb) => (
            <div key={cb.id} className="flex items-center gap-4 px-4 py-3 border-b border-gray-800 last:border-0">
              <div className="flex-1">
                <p className="text-white text-sm font-medium font-mono">{cb.phone_number}</p>
                <p className="text-gray-500 text-xs">{cb.caller_name || "Inconnu"} · {new Date(cb.created_at).toLocaleString("fr-CA")}</p>
              </div>
              <span className={"text-xs px-2 py-1 rounded-full " + (STATUS_COLORS[cb.status] || "bg-gray-800 text-gray-400")}>
                {cb.status}
              </span>
              {cb.status === "PENDING" && (
                <button onClick={() => handleComplete(cb.id)} disabled={completing === cb.id}
                  className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg"
                >{completing === cb.id ? "..." : "Completer"}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
