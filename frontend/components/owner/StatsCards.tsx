"use client"

interface Stats {
  totalOrganizations: number
  activeOrgs:         number
  totalAgents:        number
  totalCalls:         number
  totalMinutes:       number
  mrr:                number
  planBreakdown:      { starter: number; pro: number; enterprise: number }
}

export default function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      label: "Admins actifs",
      value: stats.activeOrgs + "/" + stats.totalOrganizations,
      color: "text-purple-400",
      bg:    "border-purple-800",
    },
    {
      label: "Agents total",
      value: stats.totalAgents.toString(),
      color: "text-blue-400",
      bg:    "border-blue-800",
    },
    {
      label: "MRR (CAD)",
      value: stats.mrr > 0 ? stats.mrr.toFixed(0) + " $" : "0 $",
      color: "text-green-400",
      bg:    "border-green-800",
    },
    {
      label: "Appels total",
      value: stats.totalCalls.toString(),
      color: "text-amber-400",
      bg:    "border-amber-800",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={"bg-gray-900 border rounded-xl p-5 " + c.bg}>
          <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">{c.label}</p>
          <p className={"text-2xl font-bold " + c.color}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}
