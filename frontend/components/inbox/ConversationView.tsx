"use client"

import { useState, useRef, useEffect } from "react"
import { omniApi } from "@/lib/omniApi"

const CHANNEL_ICONS: Record<string, string> = {
  WHATSAPP: "📱", CHAT: "💬", EMAIL: "✉️", SMS: "💌", CALL: "📞",
}

interface Props {
  conversation: any
  token:        string
  onSendMessage:(content: string) => void
  onUpdateStatus:(status: string) => void
  onRefresh:    () => void
}

export default function ConversationView({ conversation, token, onSendMessage, onUpdateStatus, onRefresh }: Props) {
  const [message,  setMessage]  = useState("")
  const [sending,  setSending]  = useState(false)
  const [canned,   setCanned]   = useState<any[]>([])
  const [showCanned, setShowCanned] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation.messages])

  useEffect(() => {
    omniApi.getCanned(token, conversation.channel).then((r) => {
      if (r.success) setCanned(r.data || [])
    })
  }, [token, conversation.channel])

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      await onSendMessage(message)
      setMessage("")
    } finally { setSending(false) }
  }

  const contact = conversation.contact
  const name = contact
    ? contact.first_name + " " + contact.last_name
    : conversation.metadata?.visitorName || conversation.metadata?.phone || "Visiteur"

  const STATUS_OPTIONS = ["OPEN", "PENDING", "RESOLVED", "CLOSED"]

  return (
    <div className="h-full bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden">

      {/* Header conversation */}
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{CHANNEL_ICONS[conversation.channel] || "📬"}</span>
          <div>
            <p className="text-white font-semibold">{name}</p>
            <p className="text-gray-500 text-xs">
              {conversation.channel}
              {contact?.company ? " · " + contact.company : ""}
              {conversation.subject ? " · " + conversation.subject : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={conversation.status}
            onChange={(e) => onUpdateStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={onRefresh} className="text-gray-500 hover:text-white text-lg">↻</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(conversation.messages || []).length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">Aucun message</p>
        ) : (
          (conversation.messages || []).map((msg: any) => (
            <div key={msg.id} className={"flex " + (msg.sender_type === "AGENT" ? "justify-end" : "justify-start")}>
              <div className={"max-w-md px-4 py-2.5 rounded-2xl " + (
                msg.sender_type === "AGENT"
                  ? "bg-teal-700 text-white rounded-br-sm"
                  : msg.sender_type === "SYSTEM"
                  ? "bg-gray-800 text-gray-400 text-xs italic"
                  : "bg-gray-800 text-gray-200 rounded-bl-sm"
              )}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className={"text-xs mt-1 opacity-60"}>
                  {new Date(msg.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                  {msg.sender_type === "AGENT" ? " · Agent" : ""}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div className="border-t border-gray-800 p-4 flex-shrink-0">
        {/* Reponses predefinies */}
        {showCanned && canned.length > 0 && (
          <div className="mb-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
            {canned.map((c: any) => (
              <button key={c.id} onClick={() => { setMessage(c.content); setShowCanned(false) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0"
              >
                <p className="text-white text-xs font-medium">{c.name}</p>
                <p className="text-gray-500 text-xs truncate">{c.content}</p>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {canned.length > 0 && (
            <button onClick={() => setShowCanned(!showCanned)}
              title="Reponses predefinies"
              className={"border rounded-lg px-3 py-2 text-sm transition-colors " + (showCanned ? "border-teal-600 text-teal-400 bg-teal-900/20" : "border-gray-700 text-gray-500 hover:text-white")}
            >⚡</button>
          )}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={"Repondre via " + conversation.channel + "..."}
            rows={2}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500 resize-none"
          />
          <button onClick={handleSend} disabled={sending || !message.trim()}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-4 rounded-xl transition-colors flex items-center"
          >
            {sending ? "..." : "→"}
          </button>
        </div>
        <p className="text-gray-700 text-xs mt-1.5">Entree pour envoyer · Shift+Entree pour saut de ligne</p>
      </div>
    </div>
  )
}
