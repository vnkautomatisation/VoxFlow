"use client"

interface Props {
  data: Record<number, number>
}

export default function HeatmapChart({ data }: Props) {
  const max   = Math.max(...Object.values(data), 1)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getColor = (count: number) => {
    const intensity = count / max
    if (intensity === 0) return "bg-gray-800"
    if (intensity < 0.25) return "bg-teal-900"
    if (intensity < 0.5)  return "bg-teal-700"
    if (intensity < 0.75) return "bg-teal-500"
    return "bg-teal-400"
  }

  return (
    <div>
      <h3 className="text-white font-medium text-sm mb-3">Volume par heure</h3>
      <div className="flex gap-1 items-end mb-1">
        {hours.map((h) => (
          <div key={h} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={"rounded-sm " + getColor(data[h] || 0)}
              style={{ height: Math.max(8, ((data[h] || 0) / max) * 60) + "px" }}
              title={h + "h: " + (data[h] || 0) + " appels"}
            ></div>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {[0, 6, 12, 18, 23].map((h) => (
          <div key={h} className="text-gray-600 text-xs" style={{ marginLeft: h === 0 ? 0 : (h / 23) * 100 + "%" }}>
            {h}h
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-gray-500 text-xs">Faible</span>
        {["bg-gray-800", "bg-teal-900", "bg-teal-700", "bg-teal-500", "bg-teal-400"].map((c) => (
          <div key={c} className={"w-4 h-4 rounded " + c}></div>
        ))}
        <span className="text-gray-500 text-xs">Eleve</span>
      </div>
    </div>
  )
}
