"use client"

interface Props {
  token:     string
  stats:     any
  onRefresh: () => void
}

export default function QualityScores({ token, stats, onRefresh }: Props) {
  if (!stats) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <p className="text-gray-500 text-sm">Aucune donnee de scoring</p>
    </div>
  )

  const scoreBar = (value: number, label: string, color: string) => (
    <div key={label} className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className={"font-bold text-sm " + color}>{value}%</span>
      </div>
      <div className="bg-gray-800 rounded-full h-2">
        <div className={"h-2 rounded-full transition-all " + color.replace("text-", "bg-")}
          style={{ width: value + "%" }}
        ></div>
      </div>
    </div>
  )

  const getColor = (v: number) => v >= 85 ? "text-green-400" : v >= 70 ? "text-amber-400" : "text-red-400"

  return (
    <div>
      <h2 className="text-white font-semibold mb-4">Scores qualite des appels</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Moyennes par critere</h3>
          {scoreBar(stats.avgOverallScore, "Score global",  getColor(stats.avgOverallScore))}
          {scoreBar(stats.avgGreeting,     "Accueil",       getColor(stats.avgGreeting))}
          {scoreBar(stats.avgEmpathy,      "Empathie",      getColor(stats.avgEmpathy))}
          {scoreBar(stats.avgResolution,   "Resolution",    getColor(stats.avgResolution))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Distribution qualite</h3>
          <div className="space-y-3">
            {[
              { label: "Excellent (85+)",    value: stats.excellentCalls,       color: "bg-green-600" },
              { label: "Bon (70-84)",        value: stats.totalScored - stats.excellentCalls - stats.needsImprovement, color: "bg-amber-600" },
              { label: "A ameliorer (<70)",  value: stats.needsImprovement,     color: "bg-red-600" },
            ].map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <div className={"w-3 h-3 rounded-full flex-shrink-0 " + d.color}></div>
                <p className="text-gray-300 text-sm flex-1">{d.label}</p>
                <p className="text-white font-bold">{Math.max(0, d.value)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">Total analyses</p>
              <p className="text-white font-bold text-lg">{stats.totalScored}</p>
            </div>
          </div>
        </div>

        {stats.coachingReports?.length > 0 && (
          <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">Derniers rapports coaching</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["Agent", "Periode", "Score", "Date"].map((h) => (
                      <th key={h} className="text-left text-gray-500 text-xs uppercase px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.coachingReports.slice(0, 10).map((r: any) => (
                    <tr key={r.id} className="border-b border-gray-800/50">
                      <td className="px-3 py-2 text-gray-300 text-sm">{r.agent_id.slice(0, 8)}...</td>
                      <td className="px-3 py-2 text-gray-400 text-sm">{r.period}</td>
                      <td className="px-3 py-2">
                        <span className={"font-bold text-sm " + getColor(r.score)}>{r.score}%</span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {new Date(r.created_at || Date.now()).toLocaleDateString("fr-CA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
