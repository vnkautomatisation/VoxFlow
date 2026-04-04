"use client"

interface Alert {
  type:    string
  message: string
  level:   "info" | "warning" | "critical"
}

interface Props { alerts: Alert[] }

const LEVEL_STYLES: Record<string, string> = {
  info:     "bg-blue-900/30 border-blue-800 text-blue-300",
  warning:  "bg-amber-900/30 border-amber-800 text-amber-300",
  critical: "bg-red-900/30 border-red-800 text-red-300",
}

export default function AlertsPanel({ alerts }: Props) {
  if (!alerts.length) return null
  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div key={i} className={"border rounded-lg px-4 py-2.5 flex items-center gap-3 " + (LEVEL_STYLES[alert.level] || LEVEL_STYLES.info)}>
          <span className="text-lg">
            {alert.level === "critical" ? "🚨" : alert.level === "warning" ? "⚠️" : "ℹ️"}
          </span>
          <p className="text-sm font-medium">{alert.message}</p>
        </div>
      ))}
    </div>
  )
}
