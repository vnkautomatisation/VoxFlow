"use client"

import { useState } from "react"
import { omniApi } from "@/lib/omniApi"

interface Props {
  token:     string
  onClose:   () => void
  onCreated: () => void
}

export default function NewConversationModal({ token, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    channel: "EMAIL", subject: "", priority: "NORMAL",
    toEmail: "", toPhone: "", visitorName: "", initialMessage: ""
  })
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState("")

  const handleCreate = async () => {
    setSaving(true)
    setErr("")
    try {
      const metadata: any = {}
      if (form.channel === "EMAIL")     metadata.email = form.toEmail
      if (form.channel === "WHATSAPP")  metadata.phone = form.toPhone
      if (form.channel === "SMS")       metadata.phone = form.toPhone
      if (form.channel === "CHAT")      metadata.visitorName = form.visitorName

      if (form.channel === "EMAIL") {
        await omniApi.createEmailTicket(token, {
          fromEmail: form.toEmail,
          subject:   form.subject,
          bodyText:  form.initialMessage,
        })
      } else {
        const convRes = await omniApi.createConversation(token, {
          channel:  form.channel,
          subject:  form.subject || null,
          priority: form.priority,
          metadata,
        })
        if (convRes.success && form.initialMessage) {
          await omniApi.sendMessage(token, convRes.data.id, form.initialMessage)
        }
      }
      onCreated()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Nouvelle conversation</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">x</button>
        </div>

        {err && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-3 text-sm">{err}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Canal</label>
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
            >
              {[
                { v: "EMAIL",    l: "Email" },
                { v: "WHATSAPP", l: "WhatsApp" },
                { v: "SMS",      l: "SMS" },
                { v: "CHAT",     l: "Chat" },
              ].map((o) => <option key={o.v} value={o.v}>{l = o.l}</option>)}
            </select>
          </div>

          {(form.channel === "EMAIL") && (
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Email</label>
              <input value={form.toEmail} onChange={(e) => setForm({ ...form, toEmail: e.target.value })}
                placeholder="client@exemple.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
          )}

          {(form.channel === "WHATSAPP" || form.channel === "SMS") && (
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Numero</label>
              <input value={form.toPhone} onChange={(e) => setForm({ ...form, toPhone: e.target.value })}
                placeholder="+15141234567"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
          )}

          {form.channel === "CHAT" && (
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom visiteur</label>
              <input value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })}
                placeholder="Jean Tremblay"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Sujet</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Sujet..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Priorite</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {["LOW","NORMAL","HIGH","URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">Message initial</label>
            <textarea value={form.initialMessage} onChange={(e) => setForm({ ...form, initialMessage: e.target.value })}
              rows={3} placeholder="Message..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-lg text-sm">Annuler</button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium"
            >{saving ? "Creation..." : "Creer"}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
