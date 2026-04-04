"use client"

import { useState } from "react"
import { ai2Api } from "@/lib/ai2Api"

interface Props {
  token:     string
  campaigns: any[]
  onRefresh: () => void
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     "bg-gray-800 text-gray-400",
  ACTIVE:    "bg-green-900 text-green-300",
  PAUSED:    "bg-amber-900 text-amber-300",
  COMPLETED: "bg-blue-900 text-blue-300",
}

const TYPE_LABELS: Record<string, string> = {
  POWER:      "Power Dialer",
  PREDICTIVE: "Predictive Dialer",
  AUTO:       "Auto Dialer",
}

export default function PowerDialer({ token, campaigns, onRefresh }: Props) {
  const [showForm,  setShowForm]  = useState(false)
  const [selected,  setSelected]  = useState<any>(null)
  const [stats,     setStats]     = useState<any>(null)
  const [form, setForm] = useState({
    name: "", type: "POWER", maxAttempts: "3", dialRatio: "1.0"
  })
  const [saving,  setSaving]  = useState(false)
  const [contacts, setContacts] = useState("")
  const [addingContacts, setAddingContacts] = useState(false)

  const handleCreate = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      await ai2Api.createCampaign(token, {
        name:        form.name,
        type:        form.type,
        maxAttempts: parseInt(form.maxAttempts),
        dialRatio:   parseFloat(form.dialRatio),
      })
      setShowForm(false)
      setForm({ name: "", type: "POWER", maxAttempts: "3", dialRatio: "1.0" })
      onRefresh()
    } catch {}
    finally { setSaving(false) }
  }

  const handleSelectCampaign = async (camp: any) => {
    setSelected(camp)
    const res = await ai2Api.getCampaignStats(token, camp.id)
    if (res.success) setStats(res.data)
  }

  const handleAddContacts = async () => {
    if (!contacts.trim() || !selected) return
    setAddingContacts(true)
    try {
      const lines = contacts.trim().split("\n").filter(Boolean)
      const parsed = lines.map((line) => {
        const parts = line.split(",")
        return { phoneNumber: parts[0]?.trim(), name: parts[1]?.trim() || null }
      }).filter((c) => c.phoneNumber)

      await ai2Api.addContacts(token, selected.id, parsed)
      setContacts("")
      handleSelectCampaign(selected)
      onRefresh()
    } catch {}
    finally { setAddingContacts(false) }
  }

  const handleStatusChange = async (id: string, status: string) => {
    await ai2Api.setCampaignStatus(token, id, status)
    onRefresh()
    if (selected?.id === id) setSelected({ ...selected, status })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Power Dialer — Campagnes</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
        >+ Nouvelle campagne</button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom campagne</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Campagne relance"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Tentatives max</label>
              <input type="number" min="1" max="10" value={form.maxAttempts}
                onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Ratio appels/agent</label>
              <input type="number" min="1" max="5" step="0.1" value={form.dialRatio}
                onChange={(e) => setForm({ ...form, dialRatio: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.name}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >{saving ? "Creation..." : "Creer campagne"}</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-2">
          {campaigns.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm">Aucune campagne</p>
            </div>
          ) : campaigns.map((c) => (
            <div key={c.id} onClick={() => handleSelectCampaign(c)}
              className={"border rounded-xl p-4 cursor-pointer transition-colors " + (selected?.id === c.id ? "border-teal-600 bg-teal-900/10" : "bg-gray-900 border-gray-800 hover:border-gray-600")}
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-white text-sm font-medium">{c.name}</p>
                <span className={"text-xs px-1.5 py-0.5 rounded-full " + (STATUS_COLORS[c.status] || "bg-gray-800 text-gray-400")}>
                  {c.status}
                </span>
              </div>
              <p className="text-gray-500 text-xs mb-2">{TYPE_LABELS[c.type] || c.type}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{c.dialed_count}/{c.total_contacts} appeles</span>
                {c.total_contacts > 0 && (
                  <span>{Math.round((c.dialed_count / c.total_contacts) * 100)}%</span>
                )}
              </div>
              {c.total_contacts > 0 && (
                <div className="mt-1 bg-gray-700 rounded-full h-1">
                  <div className="bg-teal-500 h-1 rounded-full"
                    style={{ width: Math.round((c.dialed_count / c.total_contacts) * 100) + "%" }}
                  ></div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="col-span-2">
          {selected ? (
            <div className="space-y-3">
              {/* Actions campagne */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">{selected.name}</h3>
                  <div className="flex gap-2">
                    {selected.status === "DRAFT" && (
                      <button onClick={() => handleStatusChange(selected.id, "ACTIVE")}
                        className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg"
                      >Lancer</button>
                    )}
                    {selected.status === "ACTIVE" && (
                      <button onClick={() => handleStatusChange(selected.id, "PAUSED")}
                        className="bg-amber-700 hover:bg-amber-600 text-white text-xs px-3 py-1.5 rounded-lg"
                      >Mettre en pause</button>
                    )}
                    {selected.status === "PAUSED" && (
                      <button onClick={() => handleStatusChange(selected.id, "ACTIVE")}
                        className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg"
                      >Reprendre</button>
                    )}
                  </div>
                </div>

                {/* Stats campagne */}
                {stats && (
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: "Total",     value: stats.total,       color: "text-white" },
                      { label: "En attente", value: stats.pending,    color: "text-gray-400" },
                      { label: "Repondus",  value: stats.answered,    color: "text-green-400" },
                      { label: "Sans rep.", value: stats.noAnswer,    color: "text-amber-400" },
                      { label: "Taux contact", value: stats.contactRate + "%", color: stats.contactRate >= 30 ? "text-green-400" : "text-red-400" },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-800 rounded-lg p-2 text-center">
                        <p className={"font-bold " + s.color}>{s.value}</p>
                        <p className="text-gray-600 text-xs">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ajouter contacts */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h4 className="text-white text-sm font-medium mb-2">Ajouter des contacts</h4>
                <p className="text-gray-500 text-xs mb-2">Format: +15141234567, Nom (un par ligne)</p>
                <textarea value={contacts} onChange={(e) => setContacts(e.target.value)}
                  rows={4} placeholder="+15141234567, Jean Tremblay&#10;+15149876543, Marie Gagnon"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 resize-none font-mono text-xs mb-2"
                />
                <button onClick={handleAddContacts} disabled={addingContacts || !contacts.trim()}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
                >{addingContacts ? "Ajout..." : "Ajouter contacts"}</button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">📞</div>
              <p className="text-gray-500 text-sm">Selectionnez une campagne</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
