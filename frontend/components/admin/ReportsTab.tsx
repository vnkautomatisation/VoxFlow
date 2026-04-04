"use client"

interface Props {
  reports: {
    totalCalls:     number
    completedCalls: number
    inboundCalls:   number
    outboundCalls:  number
    avgDuration:    number
    resolutionRate: number
    recentCalls:    any[]
  } | null
  period:    string
  onPeriod:  (p: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "text-green-400",
  FAILED:    "text-red-400",
  RINGING:   "text-amber-400",
  NO_ANSWER: "text-gray-400",
}

export default function ReportsTab({ reports, period, onPeriod }: Props) {
  if (!reports) return <p className="text-gray-500 text-sm">Chargement...</p>

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return m + ":" + String(s).padStart(2, "0")
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">Rapports</h2>
        <div className="flex gap-2">
          {["7d", "30d", "90d"].map((p) => (
            <button
              key={p}
              onClick={() => onPeriod(p)}
              className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (
                period === p ? "bg-teal-600 text-white" : "border border-gray-700 text-gray-400 hover:text-white"
              )}
            >
              {p === "7d" ? "7 jours" : p === "30d" ? "30 jours" : "90 jours"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Appels total",      value: reports.totalCalls.toString(),      color: "text-white" },
          { label: "Taux resolution",   value: reports.resolutionRate + "%",        color: "text-green-400" },
          { label: "Duree moyenne",     value: formatDuration(reports.avgDuration), color: "text-blue-400" },
          { label: "Appels entrants",   value: reports.inboundCalls.toString(),    color: "text-teal-400" },
          { label: "Appels sortants",   value: reports.outboundCalls.toString(),   color: "text-purple-400" },
          { label: "Completes",         value: reports.completedCalls.toString(),  color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">{s.label}</p>
            <p className={"text-xl font-bold " + s.color}>{s.value}</p>
          </div>
        ))}
      </div>

      {reports.recentCalls.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-white font-medium text-sm">Appels recents</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-2">De</th>
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-2">Vers</th>
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-2">Statut</th>
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-2">Duree</th>
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {reports.recentCalls.map((call: any) => (
                <tr key={call.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2 text-gray-300 text-sm font-mono">{call.from_number}</td>
                  <td className="px-4 py-2 text-gray-300 text-sm font-mono">{call.to_number}</td>
                  <td className="px-4 py-2">
                    <span className={"text-xs font-medium " + (STATUS_COLORS[call.status] || "text-gray-400")}>
                      {call.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-sm">{formatDuration(call.duration || 0)}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(call.started_at).toLocaleDateString("fr-CA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
