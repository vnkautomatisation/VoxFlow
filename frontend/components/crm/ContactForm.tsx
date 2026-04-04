"use client"

import { useState } from "react"
import { crmApi } from "@/lib/crmApi"

interface Props {
  token:     string
  tags:      any[]
  contact?:  any
  onSave:    () => void
  onCancel:  () => void
}

export default function ContactForm({ token, tags, contact, onSave, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [form, setForm] = useState({
    first_name:     contact?.first_name     || "",
    last_name:      contact?.last_name      || "",
    email:          contact?.email          || "",
    phone:          contact?.phone          || "",
    phone_2:        contact?.phone_2        || "",
    company:        contact?.company        || "",
    job_title:      contact?.job_title      || "",
    website:        contact?.website        || "",
    city:           contact?.city           || "",
    status:         contact?.status         || "LEAD",
    pipeline_stage: contact?.pipeline_stage || "NEW",
    deal_value:     contact?.deal_value     || "",
    notes:          contact?.notes          || "",
    tags:           contact?.tags           || [] as string[],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      if (contact?.id) {
        await crmApi.updateContact(token, contact.id, form)
      } else {
        await crmApi.createContact(token, form)
      }
      onSave()
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t: string) => t !== tag) : [...f.tags, tag]
    }))
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">{contact ? "Modifier le contact" : "Nouveau contact"}</h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-white text-sm">Annuler</button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-3 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Prenom</label>
            <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              placeholder="Jean" required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Nom</label>
            <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              placeholder="Tremblay"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Telephone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+15141234567"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jean@acme.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Entreprise</label>
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Acme Inc."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Poste</label>
            <input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              placeholder="Directeur TI"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Statut</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
            >
              {["LEAD", "PROSPECT", "CLIENT", "INACTIVE"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Pipeline</label>
            <select value={form.pipeline_stage} onChange={(e) => setForm({ ...form, pipeline_stage: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
            >
              {["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Valeur deal ($)</label>
            <input type="number" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
          </div>
        </div>

        {tags.length > 0 && (
          <div>
            <label className="text-gray-400 text-xs mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((t: any) => (
                <button key={t.id} type="button" onClick={() => toggleTag(t.name)}
                  className={"text-xs px-2 py-1 rounded-full border transition-colors " + (
                    form.tags.includes(t.name)
                      ? "border-teal-600 bg-teal-900/30 text-teal-300"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-gray-400 text-xs mb-1 block">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2} placeholder="Notes sur ce contact..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 resize-none" />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={loading}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 text-white py-2 rounded-lg text-sm font-medium"
          >
            {loading ? "Sauvegarde..." : contact ? "Mettre a jour" : "Creer le contact"}
          </button>
        </div>
      </form>
    </div>
  )
}
