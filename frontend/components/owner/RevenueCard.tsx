"use client"

interface Props {
  revenue: {
    mrr:      number
    breakdown: { starter: number; pro: number; enterprise: number }
    simulated?: boolean
  }
}

export default function RevenueCard({ revenue }: Props) {
  const arr = revenue.mrr * 12

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Revenus</h3>
        {revenue.simulated && (
          <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full">Mode test</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-gray-500 text-xs mb-1">MRR</p>
          <p className="text-green-400 text-xl font-bold">{revenue.mrr.toFixed(0)} $</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">ARR</p>
          <p className="text-green-300 text-xl font-bold">{arr.toFixed(0)} $</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-800 pt-4">
        {[
          { label: "Starter (99$/mois)",    value: revenue.breakdown.starter,    color: "bg-gray-600" },
          { label: "Pro (299$/mois)",       value: revenue.breakdown.pro,        color: "bg-blue-600" },
          { label: "Enterprise (799$/mois)", value: revenue.breakdown.enterprise, color: "bg-purple-600" },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={"w-2 h-2 rounded-full " + item.color}></div>
              <span className="text-gray-400 text-xs">{item.label}</span>
            </div>
            <span className="text-white text-sm font-medium">{item.value.toFixed(0)} $</span>
          </div>
        ))}
      </div>
    </div>
  )
}
