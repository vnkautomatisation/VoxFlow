"use client"

import { useState } from "react"
import { omniApi } from "@/lib/omniApi"
import ChannelIcon, { CHANNELS, CHANNEL_META, ChannelKey } from "./ChannelIcon"
import ContactPicker, { PickedContact } from "./ContactPicker"

const PRIORITY_OPTIONS = [
  { value: "LOW",    label: "Basse" },
  { value: "NORMAL", label: "Normale" },
  { value: "HIGH",   label: "Haute" },
  { value: "URGENT", label: "Urgent" },
]

interface Props {
  token:     string
  onClose:   () => void
  onCreated: () => void
}

export default function NewConversationModal({ token, onClose, onCreated }: Props) {
  const [channel,  setChannel]  = useState<ChannelKey>("EMAIL")
  const [subject,  setSubject]  = useState("")
  const [priority, setPriority] = useState("NORMAL")
  const [initialMessage, setInitialMessage] = useState("")
  const [contact,  setContact]  = useState<PickedContact | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState("")

  const needsEmail = channel === "EMAIL"
  const needsPhone = channel === "WHATSAPP" || channel === "SMS"
  const needsName  = channel === "CHAT"

  const canCreate = (() => {
    if (!contact) return false
    if (needsEmail && !contact.email) return false
    if (needsPhone && !contact.phone) return false
    if (needsName  && !contact.first_name) return false
    return true
  })()

  const handleCreate = async () => {
    if (!contact) { setErr("Sélectionnez ou créez un contact"); return }

    setSaving(true)
    setErr("")
    try {
      const metadata: any = {}
      if (channel === "EMAIL")    metadata.email       = contact.email
      if (channel === "WHATSAPP") metadata.phone       = contact.phone
      if (channel === "SMS")      metadata.phone       = contact.phone
      if (channel === "CHAT") {
        metadata.visitorName  = `${contact.first_name} ${contact.last_name || ""}`.trim()
        if (contact.email) metadata.visitorEmail = contact.email
      }

      if (channel === "EMAIL") {
        const res = await omniApi.createEmailTicket(token, {
          fromEmail: contact.email!,
          fromName:  `${contact.first_name} ${contact.last_name || ""}`.trim(),
          subject,
          bodyText:  initialMessage,
        })
        // Link the created conversation to the contact
        if (res.success && res.data?.conversation?.id && contact.id) {
          await omniApi.updateConversation(token, res.data.conversation.id, { contactId: contact.id })
        }
      } else {
        const convRes = await omniApi.createConversation(token, {
          channel,
          subject:   subject || null,
          priority,
          contactId: contact.id || undefined,
          metadata,
        })
        if (convRes.success && initialMessage) {
          await omniApi.sendMessage(token, convRes.data.id, initialMessage)
        }
      }
      onCreated()
    } catch (e: any) {
      setErr(e?.message || "Erreur lors de la création")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] sticky top-0 bg-[#18181f] z-10">
          <h2 className="text-[#eeeef8] font-bold">Nouvelle conversation</h2>
          <button onClick={onClose} className="text-[#55557a] hover:text-[#eeeef8] transition-colors p-1 rounded-lg hover:bg-[#1f1f2a]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18" />
              <line x1="6"  y1="6"  x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {err && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg px-3 py-2 text-xs flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9"  x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{err}</span>
            </div>
          )}

          {/* Canal */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Canal</label>
            <div className="flex items-center gap-2">
              <ChannelIcon channel={channel} size="sm" />
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as ChannelKey)}
                className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm focus:outline-none focus:border-[#7b61ff] transition-colors"
              >
                {CHANNELS.filter((ch) => ch !== "CALL").map((ch) => (
                  <option key={ch} value={ch}>{CHANNEL_META[ch].labelFR}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact picker */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">
              Contact {needsEmail ? "· email requis" : needsPhone ? "· téléphone requis" : ""}
            </label>
            <ContactPicker
              token={token}
              value={contact}
              onChange={setContact}
              requireEmail={needsEmail}
              requirePhone={needsPhone}
            />
            {contact && needsEmail && !contact.email && (
              <p className="text-rose-400 text-[10px] mt-1">Ce contact n'a pas d'email — créez-en un ou choisissez un autre contact.</p>
            )}
            {contact && needsPhone && !contact.phone && (
              <p className="text-rose-400 text-[10px] mt-1">Ce contact n'a pas de téléphone — créez-en un ou choisissez un autre contact.</p>
            )}
          </div>

          {/* Sujet + Priorité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Sujet</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Sujet..."
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm focus:outline-none focus:border-[#7b61ff] transition-colors"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Message initial */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Message initial</label>
            <textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              rows={3}
              placeholder="Message..."
              className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] resize-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2 rounded-lg text-sm font-bold hover:text-[#eeeef8] transition-colors"
            >
              Annuler
            </button>
            <button onClick={handleCreate} disabled={saving || !canCreate}
              className="flex-1 bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? "Création..." : "Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
