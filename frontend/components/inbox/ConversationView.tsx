"use client"

import { useState, useRef, useEffect } from "react"
import { omniApi } from "@/lib/omniApi"
import ChannelIcon from "./ChannelIcon"

const STATUS_OPTIONS = [
  { value: "OPEN",     label: "Ouvert" },
  { value: "PENDING",  label: "En attente" },
  { value: "RESOLVED", label: "Résolu" },
  { value: "CLOSED",   label: "Fermé" },
]

// Delivery ticks inline (AGENT uniquement)
const DeliveryTicks = ({ status }: { status?: string }) => {
  const s = status || "SENT"

  if (s === "FAILED") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-rose-400" aria-label="Envoi échoué">
        <title>Envoi échoué</title>
        <line x1="18" y1="6"  x2="6"  y2="18" />
        <line x1="6"  y1="6"  x2="18" y2="18" />
      </svg>
    )
  }

  if (s === "SENT") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }

  // DELIVERED or READ — double check
  const color = s === "READ" ? "text-emerald-300" : "text-white/70"
  return (
    <div className={`flex items-center ${color}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="-ml-2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
}

interface Props {
  conversation:    any
  token:           string
  onSendMessage:   (content: string) => void
  onUpdateStatus:  (status: string) => void
  onRefresh:       () => void
  onOpenDetail:    () => void
}

export default function ConversationView({ conversation, token, onSendMessage, onUpdateStatus, onRefresh, onOpenDetail }: Props) {
  const [message,    setMessage]    = useState("")
  const [sending,    setSending]    = useState(false)
  const [canned,     setCanned]     = useState<any[]>([])
  const [showCanned, setShowCanned] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation.messages])

  useEffect(() => {
    omniApi.getCanned(token, conversation.channel).then((r) => {
      if (r.success) setCanned(r.data || [])
    }).catch(() => setCanned([]))
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
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Contact"
    : conversation.metadata?.visitorName || conversation.metadata?.phone || "Visiteur"

  const subtitle = [
    contact?.company,
    conversation.subject,
  ].filter(Boolean).join(" · ")

  return (
    <div className="h-full bg-[#18181f] border border-[#2e2e44] rounded-xl flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-[#2e2e44] flex items-center justify-between flex-shrink-0 bg-[#18181f]">
        <div className="flex items-center gap-3 min-w-0">
          <ChannelIcon channel={conversation.channel} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#eeeef8] truncate">{name}</p>
            <p className="text-[11px] text-[#55557a] truncate">
              {conversation.channel}
              {subtitle ? ` · ${subtitle}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={conversation.status}
            onChange={(e) => onUpdateStatus(e.target.value)}
            className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-1.5 text-[#eeeef8] text-xs focus:outline-none focus:border-[#7b61ff] transition-colors"
          >
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <button onClick={onOpenDetail}
            title="Détails de la conversation"
            className="text-[#55557a] hover:text-[#7b61ff] transition-colors p-1.5 rounded-lg hover:bg-[#1f1f2a]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8"  x2="12.01" y2="8" />
            </svg>
          </button>

          <button onClick={onRefresh}
            title="Rafraîchir"
            className="text-[#55557a] hover:text-[#eeeef8] transition-colors p-1.5 rounded-lg hover:bg-[#1f1f2a]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#111118]">
        {(conversation.messages || []).length === 0 ? (
          <p className="text-[#55557a] text-sm text-center py-8">Aucun message</p>
        ) : (
          (conversation.messages || []).map((msg: any) => {
            const isAgent  = msg.sender_type === "AGENT"
            const isSystem = msg.sender_type === "SYSTEM"
            const isBot    = msg.sender_type === "BOT"

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-[#2e2e44] text-[#9898b8] text-xs italic px-3 py-1.5 rounded-full">
                    {msg.content}
                  </div>
                </div>
              )
            }

            const alignR = isAgent || isBot
            const bubble = isAgent
              ? "bg-[#7b61ff] text-white rounded-2xl rounded-br-sm"
              : isBot
                ? "bg-emerald-500 text-white rounded-2xl rounded-br-sm"
                : "bg-[#1f1f2a] border border-[#2e2e44] text-[#eeeef8] rounded-2xl rounded-bl-sm"

            return (
              <div key={msg.id} className={`flex ${alignR ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-md px-4 py-2.5 ${bubble}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  <div className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${alignR ? "text-white/70" : "text-[#55557a]"}`}>
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isBot && <span>· Bot</span>}
                    {isAgent && <span>· Agent</span>}
                    {isAgent && <DeliveryTicks status={msg.status} />}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div className="border-t border-[#2e2e44] p-4 flex-shrink-0 bg-[#18181f]">
        {/* Réponses prédéfinies */}
        {showCanned && canned.length > 0 && (
          <div className="mb-2 bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden max-h-40 overflow-y-auto">
            {canned.map((c: any) => (
              <button key={c.id} onClick={() => { setMessage(c.content); setShowCanned(false) }}
                className="w-full text-left px-3 py-2 hover:bg-[#1f1f2a] transition-colors border-b border-[#2e2e44] last:border-0"
              >
                <p className="text-[#eeeef8] text-xs font-semibold">{c.name}</p>
                <p className="text-[#55557a] text-[11px] truncate">{c.content}</p>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {canned.length > 0 && (
            <button onClick={() => setShowCanned(!showCanned)}
              title="Réponses prédéfinies"
              className={`border rounded-lg px-3 py-2 transition-colors flex items-center ${
                showCanned
                  ? "border-[#7b61ff]/40 text-[#7b61ff] bg-[#7b61ff]/10"
                  : "border-[#2e2e44] text-[#9898b8] bg-[#1f1f2a] hover:text-[#eeeef8]"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={`Répondre via ${conversation.channel}...`}
            rows={2}
            className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-4 py-2.5 text-[#eeeef8] text-sm placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] resize-none transition-colors"
          />

          <button onClick={handleSend} disabled={sending || !message.trim()}
            className="bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-4 rounded-lg transition-colors flex items-center justify-center font-bold"
          >
            {sending ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[#55557a] text-[10px] mt-1.5">Entrée pour envoyer · Shift+Entrée pour saut de ligne</p>
      </div>
    </div>
  )
}
