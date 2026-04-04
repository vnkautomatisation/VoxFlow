"use client"

interface Call {
  id:          string
  from_number: string
  to_number:   string
  duration:    number
  status:      string
  direction:   string
  started_at:  string
  notes:       string
}

interface Props {
  calls: Call[]
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "text-green-400",
  FAILED:    "text-red-400",
  RINGING:   "text-amber-400",
  NO_ANSWER: "text-gray-400",
  CANCELLED: "text-gray-500",
}

const DIR_ICONS: Record<string, string> = {
  INBOUND:  "↙",
  OUTBOUND: "↗",
}

export default function CallHistory({ calls }: Props) {
  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m + ":" + String(s).padStart(2, "0")
  }

  if (calls.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-500 text-sm">Aucun appel dans l historique</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-white font-medium text-sm">Historique recent</h3>
      </div>
      <div className="divide-y divide-gray-800">
        {calls.map((call) => (
          <div key={call.id} className="px-4 py-3 hover:bg-gray-800/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={"text-lg " + (call.direction === "INBOUND" ? "text-green-400" : "text-blue-400")}>
                  {DIR_ICONS[call.direction] || "↔"}
                </span>
                <div>
                  <p className="text-white text-sm font-medium font-mono">
                    {call.direction === "INBOUND" ? call.from_number : call.to_number}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {new Date(call.started_at).toLocaleString("fr-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={"text-xs font-medium " + (STATUS_COLORS[call.status] || "text-gray-400")}>
                  {call.status}
                </p>
                <p className="text-gray-500 text-xs">{fmt(call.duration || 0)}</p>
              </div>
            </div>
            {call.notes && (
              <p className="text-gray-500 text-xs mt-1 ml-8 italic">{call.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
