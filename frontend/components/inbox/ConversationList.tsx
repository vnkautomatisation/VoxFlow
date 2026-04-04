"use client"

const CHANNEL_ICONS: Record<string, string> = {
  WHATSAPP: "📱",
  CHAT:     "💬",
  EMAIL:    "✉️",
  SMS:      "💌",
  CALL:     "📞",
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:     "bg-teal-900 text-teal-300",
  PENDING:  "bg-amber-900 text-amber-300",
  RESOLVED: "bg-green-900 text-green-300",
  CLOSED:   "bg-gray-800 text-gray-500",
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "text-red-400",
  HIGH:   "text-amber-400",
  NORMAL: "",
  LOW:    "text-gray-600",
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
      {[1,2,3].map((i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-800 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  )

  if (conversations.length === 0) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
      <p className="text-gray-500 text-sm">Aucune conversation</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {conversations.map((conv) => {
        const contact = conv.contact
        const name    = contact
          ? contact.first_name + " " + contact.last_name
          : conv.metadata?.visitorName || conv.metadata?.fromName || conv.metadata?.phone || "Inconnu"

        return (
          <div key={conv.id} onClick={() => onSelect(conv)}
            className={"bg-gray-900 border rounded-xl p-4 cursor-pointer transition-colors hover:border-gray-600 " + (selectedId === conv.id ? "border-teal-600 bg-teal-900/10" : "border-gray-800")}
          >
            <div className="flex items-start justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">{CHANNEL_ICONS[conv.channel] || "📬"}</span>
                <p className={"text-sm font-medium truncate " + (PRIORITY_COLORS[conv.priority] || "text-white")}>
                  {name}
                </p>
              </div>
              <span className={"text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1 " + (STATUS_COLORS[conv.status] || "bg-gray-800 text-gray-500")}>
                {conv.status === "OPEN" ? "Ouvert" : conv.status === "PENDING" ? "Attente" : conv.status === "RESOLVED" ? "Resolu" : conv.status}
              </span>
            </div>
            {conv.subject && <p className="text-gray-400 text-xs truncate mb-1">{conv.subject}</p>}
            <div className="flex items-center justify-between">
              <p className="text-gray-600 text-xs">{conv.channel}</p>
              <p className="text-gray-600 text-xs">
                {new Date(conv.last_message_at).toLocaleString("fr-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            {conv.priority === "URGENT" && (
              <div className="mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                <span className="text-red-400 text-xs font-medium">Urgent</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
