"use client"

interface DataPoint {
  date:  string
  count: number
}

interface Props {
  data: DataPoint[]
}

export default function TrendChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-20">
        <p className="text-gray-500 text-sm">Pas encore de donnees</p>
      </div>
    )
  }

  const max    = Math.max(...data.map((d) => d.count), 1)
  const height = 80

  return (
    <div>
      <h3 className="text-white font-medium text-sm mb-3">Tendance quotidienne</h3>
      <div className="flex items-end gap-1" style={{ height: height + "px" }}>
        {data.slice(-14).map((point, i) => {
          const barH = Math.max(4, (point.count / max) * height)
          return (
            <div key={i} className="flex-1 flex flex-col justify-end" title={point.date + ": " + point.count + " appels"}>
              <div
                className="bg-teal-600 hover:bg-teal-500 rounded-t transition-colors"
                style={{ height: barH + "px" }}
              ></div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-gray-600 text-xs">{data.slice(-14)[0]?.date?.slice(5) || ""}</span>
        <span className="text-gray-600 text-xs">{data.slice(-1)[0]?.date?.slice(5) || "Aujourd hui"}</span>
      </div>
    </div>
  )
}
