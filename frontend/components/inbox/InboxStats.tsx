"use client"

const CHANNEL_ICONS: Record<string, string> = {
  WHATSAPP: "📱",
  CHAT:     "💬",
  EMAIL:    "✉️",
  SMS:      "💌",
  CALL:     "📞",
}

interface Props { stats: any }

export default function InboxStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {[
        { label: "Total",    value: stats.total,    color: "text-white" },
        { label: "Ouverts",  value: stats.open,     color: "text-teal-400" },
        { label: "En attente", value: stats.pending, color: "text-amber-400" },
        { label: "Resolus",  value: stats.resolved, color: "text-green-400" },
        { label: "Urgents",  value: stats.urgent,   color: stats.urgent > 0 ? "text-red-400" : "text-gray-500" },
      ].map((s) => (
        <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className={"text-2xl font-bold " + s.color}>{s.value}</p>
          <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  )
}
