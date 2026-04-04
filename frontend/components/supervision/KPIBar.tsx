"use client"

interface Props { kpis: any }

export default function KPIBar({ kpis }: Props) {
  if (!kpis) return null

  const items = [
    { label: "Appels aujourd hui", value: kpis.totalToday,     color: "text-white",     bg: "bg-gray-800" },
    { label: "Completes",          value: kpis.completedToday, color: "text-green-400",  bg: "bg-green-900/20" },
    { label: "Manques",            value: kpis.missedToday,    color: kpis.missedToday > 0 ? "text-red-400" : "text-gray-400", bg: kpis.missedToday > 0 ? "bg-red-900/20" : "bg-gray-800" },
    { label: "Duree moy.",         value: kpis.avgDuration + "s", color: "text-blue-400", bg: "bg-blue-900/20" },
    { label: "SLA",                value: kpis.slaRate + "%",  color: kpis.slaRate >= 80 ? "text-green-400" : "text-red-400", bg: kpis.slaRate >= 80 ? "bg-green-900/20" : "bg-red-900/20" },
    { label: "Agents en ligne",    value: kpis.onlineAgents + "/" + kpis.totalAgents, color: "text-teal-400", bg: "bg-teal-900/20" },
    { label: "En appel",           value: kpis.busyAgents,     color: "text-purple-400", bg: "bg-purple-900/20" },
    { label: "Appels actifs",      value: kpis.activeCalls,    color: kpis.activeCalls > 0 ? "text-amber-400" : "text-gray-400", bg: kpis.activeCalls > 0 ? "bg-amber-900/20" : "bg-gray-800" },
  ]

  return (
    <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
      {items.map((item) => (
        <div key={item.label} className={"rounded-xl p-3 text-center " + item.bg}>
          <p className={"text-2xl font-bold " + item.color}>{item.value}</p>
          <p className="text-gray-500 text-xs mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
