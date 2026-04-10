"use client"

import ChannelIcon from "./ChannelIcon"

const STATUS_META: Record<string, { label: string; tw: string }> = {
  OPEN:     { label: "Ouvert",    tw: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" },
  PENDING:  { label: "Attente",   tw: "bg-amber-400/10 text-amber-400 border-amber-400/30" },
  RESOLVED: { label: "Résolu",    tw: "bg-sky-400/10 text-sky-400 border-sky-400/30" },
  CLOSED:   { label: "Fermé",     tw: "bg-zinc-400/10 text-zinc-400 border-zinc-400/30" },
}

const PRIORITY_DOT: Record<string, { color: string; glow: string }> = {
  URGENT: { color: "bg-rose-400",  glow: "#fb7185" },
  HIGH:   { color: "bg-amber-400", glow: "#fbbf24" },
}

// Gradient pour les avatars agents (palette violette)
const AGENT_GRADIENTS = [
  "linear-gradient(135deg, #7b61ff, #6145ff)",
  "linear-gradient(135deg, #a78bfa, #7b61ff)",
  "linear-gradient(135deg, #38b6ff, #7b61ff)",
  "linear-gradient(135deg, #00d4aa, #38b6ff)",
  "linear-gradient(135deg, #ffb547, #ff4d6d)",
]

const hashStr = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const fmtD = (dt: string) => {
  if (!dt) return ""
  const d  = new Date(dt)
  const df = (Date.now() - d.getTime()) / 1000
  if (df < 60)    return "À l'instant"
  if (df < 3600)  return `${Math.floor(df / 60)}min`
  if (df < 86400) return `${Math.floor(df / 3600)}h`
  if (df < 604800) return `${Math.floor(df / 86400)}j`
  return d.toLocaleDateString("fr-CA", { day: "2-digit", month: "short" })
}

interface Props {
  conversations: any[]
  loading:       boolean
  selectedId?:   string
  onSelect:      (c: any) => void
}

export default function ConversationList({ conversations, loading, selectedId, onSelect }: Props) {
  if (loading) return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-3 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#1f1f2a]" />
            <div className="h-3 bg-[#1f1f2a] rounded w-3/4" />
          </div>
          <div className="h-2 bg-[#1f1f2a] rounded w-1/2" />
        </div>
      ))}
    </div>
  )

  if (!conversations || conversations.length === 0) return (
    <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-8 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#2e2e44] mx-auto mb-2">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
      <p className="text-[#55557a] text-sm font-medium">Aucune conversation</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {conversations.map((conv) => {
        const contact = conv.contact
        const name    = contact
          ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Contact"
          : conv.metadata?.visitorName || conv.metadata?.fromName || conv.metadata?.phone || "Visiteur"

        const subtitle = contact?.company || conv.subject || ""
        const tags     = conv.tags ?? []
        const status   = STATUS_META[conv.status] ?? STATUS_META.OPEN
        const prio     = PRIORITY_DOT[conv.priority]
        const agent    = conv.agent
        const isSel    = selectedId === conv.id

        const agentInitials = agent?.name
          ? agent.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
          : ""
        const agentGradient = agent?.id ? AGENT_GRADIENTS[hashStr(agent.id) % AGENT_GRADIENTS.length] : AGENT_GRADIENTS[0]

        return (
          <div key={conv.id} onClick={() => onSelect(conv)}
            className={`relative bg-[#18181f] border rounded-xl p-3 cursor-pointer transition-all ${
              isSel
                ? "border-[#7b61ff]/40 bg-[#7b61ff]/5"
                : "border-[#2e2e44] hover:border-[#3a3a55] hover:bg-[#1f1f2a]/40"
            }`}
          >
            {/* Dot priorité (URGENT / HIGH) */}
            {prio && (
              <div
                className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full ${prio.color}`}
                style={{ boxShadow: `0 0 8px ${prio.glow}` }}
                title={conv.priority}
              />
            )}

            {/* Row 1 — canal + nom + status/time */}
            <div className="flex items-start gap-2 mb-1">
              <ChannelIcon channel={conv.channel} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#eeeef8] truncate">{name}</p>
                  <span className="text-[10px] text-[#55557a] font-mono flex-shrink-0">{fmtD(conv.last_message_at)}</span>
                </div>
                {subtitle && (
                  <p className="text-[11px] text-[#9898b8] truncate mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>

            {/* Row 2 — status badge + tags + agent */}
            <div className="flex items-center gap-2 mt-2 pl-8">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${status.tw}`}>
                {status.label}
              </span>

              {/* Tags (max 3 + +N) */}
              {tags.slice(0, 3).map((t: string) => (
                <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2e2e44] text-[#9898b8] truncate max-w-[80px]">
                  {t}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2e2e44] text-[#55557a]">
                  +{tags.length - 3}
                </span>
              )}

              {/* Avatar agent assigné */}
              {agent && (
                <div
                  className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ background: agentGradient }}
                  title={agent.name}
                >
                  {agentInitials}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
