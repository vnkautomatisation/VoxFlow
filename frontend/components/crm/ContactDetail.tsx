"use client"

import { useState } from "react"
import { crmApi } from "@/lib/crmApi"
import ContactForm from "./ContactForm"

const ACTIVITY_ICONS: Record<string, string> = {
  CALL:    "📞",
  SMS:     "💬",
  NOTE:    "📝",
  EMAIL:   "✉️",
  MEETING: "📅",
  TASK:    "✅",
}

const STATUS_COLORS: Record<string, string> = {
  CLIENT:   "bg-green-900 text-green-300",
  LEAD:     "bg-blue-900 text-blue-300",
  PROSPECT: "bg-purple-900 text-purple-300",
  INACTIVE: "bg-gray-800 text-gray-400",
}

interface Props {
  contact:  any
  token:    string
  tags:     any[]
  onUpdate: (c: any) => void
  onRefresh: () => void
  onBack:   () => void
}

export default function ContactDetail({ contact, token, tags, onUpdate, onRefresh, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<"info" | "history" | "edit">("info")
  const [noteText,  setNoteText]  = useState("")
  const [addingNote, setAddingNote] = useState(false)

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    try {
      await crmApi.addActivity(token, contact.id, { type: "NOTE", content: noteText })
      setNoteText("")
      onRefresh()
    } catch (err) { console.error(err) }
    finally { setAddingNote(false) }
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m + ":" + String(s).padStart(2, "0")
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

      {/* Header contact */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-teal-900 rounded-full flex items-center justify-center text-teal-300 text-2xl font-bold">
              {(contact.first_name?.charAt(0) || "?").toUpperCase()}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{contact.first_name} {contact.last_name}</h2>
              {contact.job_title && <p className="text-gray-400 text-sm">{contact.job_title}</p>}
              {contact.company   && <p className="text-teal-400 text-sm font-medium">{contact.company}</p>}
            </div>
          </div>
          <button onClick={onBack} className="text-gray-500 hover:text-white text-sm">Fermer</button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className={"text-xs px-2 py-1 rounded-full " + (STATUS_COLORS[contact.status] || "bg-gray-800 text-gray-400")}>
            {contact.status}
          </span>
          <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full">{contact.pipeline_stage}</span>
          {contact.score > 0 && (
            <span className="text-xs bg-amber-900 text-amber-300 px-2 py-1 rounded-full">Score: {contact.score}</span>
          )}
          {contact.tags?.map((t: string) => (
            <span key={t} className="text-xs bg-purple-900 text-purple-300 px-2 py-1 rounded-full">{t}</span>
          ))}
        </div>

        {/* Infos rapides */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          {contact.phone && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-gray-300 text-sm font-mono">{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-300 text-sm">{contact.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex border-b border-gray-800">
        {[
          { id: "info",    label: "Informations" },
          { id: "history", label: "Historique (" + ((contact.activities?.length || 0) + (contact.calls?.length || 0)) + ")" },
          { id: "edit",    label: "Modifier" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={"px-4 py-2.5 text-sm transition-colors border-b-2 " + (
              activeTab === tab.id
                ? "border-teal-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-h-96 overflow-y-auto">

        {/* Tab Info */}
        {activeTab === "info" && (
          <div className="space-y-3">
            {contact.deal_value > 0 && (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Valeur du deal</p>
                <p className="text-green-400 font-bold text-lg">{parseFloat(contact.deal_value).toFixed(2)} $ CAD</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Ville",       value: contact.city },
                { label: "Province",    value: contact.province },
                { label: "Tel 2",       value: contact.phone_2 },
                { label: "Site web",    value: contact.website },
              ].filter((r) => r.value).map((row) => (
                <div key={row.label}>
                  <p className="text-gray-500 text-xs">{row.label}</p>
                  <p className="text-gray-300">{row.value}</p>
                </div>
              ))}
            </div>
            {contact.notes && (
              <div>
                <p className="text-gray-500 text-xs mb-1">Notes</p>
                <p className="text-gray-300 text-sm bg-gray-800 rounded-lg p-3">{contact.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab Historique 360 */}
        {activeTab === "history" && (
          <div>
            <div className="flex gap-2 mb-4">
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
                placeholder="Ajouter une note..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote() } }}
              />
              <button onClick={handleAddNote} disabled={addingNote || !noteText.trim()}
                className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
              >
                +
              </button>
            </div>

            <div className="space-y-2">
              {/* Activites */}
              {(contact.activities || []).map((a: any) => (
                <div key={a.id} className="flex gap-3 py-2 border-b border-gray-800 last:border-0">
                  <span className="text-lg flex-shrink-0">{ACTIVITY_ICONS[a.type] || "📌"}</span>
                  <div className="flex-1">
                    <p className="text-gray-300 text-sm">{a.content || a.type}</p>
                    <div className="flex gap-2 mt-0.5">
                      <p className="text-gray-600 text-xs">{new Date(a.created_at).toLocaleString("fr-CA")}</p>
                      {a.agent && <p className="text-gray-600 text-xs">· {a.agent.name}</p>}
                    </div>
                  </div>
                </div>
              ))}
              {/* Appels */}
              {(contact.calls || []).map((c: any) => (
                <div key={c.id} className="flex gap-3 py-2 border-b border-gray-800 last:border-0">
                  <span className="text-lg flex-shrink-0">{c.direction === "INBOUND" ? "↙️" : "↗️"}</span>
                  <div className="flex-1">
                    <p className="text-gray-300 text-sm">{c.direction === "INBOUND" ? "Appel entrant" : "Appel sortant"} · {formatDuration(c.duration || 0)}</p>
                    {c.ai_summary && <p className="text-gray-500 text-xs mt-0.5 italic">{c.ai_summary}</p>}
                    <p className="text-gray-600 text-xs mt-0.5">{new Date(c.started_at).toLocaleString("fr-CA")}</p>
                  </div>
                </div>
              ))}
              {!contact.activities?.length && !contact.calls?.length && (
                <p className="text-gray-500 text-sm text-center py-4">Aucune activite pour ce contact</p>
              )}
            </div>
          </div>
        )}

        {/* Tab Modifier */}
        {activeTab === "edit" && (
          <ContactForm
            token={token}
            tags={tags}
            contact={contact}
            onSave={() => { onRefresh(); setActiveTab("info") }}
            onCancel={() => setActiveTab("info")}
          />
        )}
      </div>
    </div>
  )
}
