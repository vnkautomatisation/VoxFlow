"use client"

import { useState } from "react"
import { ai2Api } from "@/lib/ai2Api"

interface Props {
  token:     string
  coaching:  any[]
  onRefresh: () => void
}

const PERIOD_OPTIONS = [
  { value: "DAILY",   label: "Quotidien" },
  { value: "WEEKLY",  label: "Hebdomadaire" },
  { value: "MONTHLY", label: "Mensuel" },
]

export default function CoachingDashboard({ token, coaching, onRefresh }: Props) {
  const [generating, setGenerating] = useState<string | null>(null)
  const [selected,   setSelected]   = useState<any>(coaching[0] || null)

  const handleGenerate = async (agentId: string, period: string) => {
    setGenerating(agentId)
    try {
      await ai2Api.generateCoaching(token, agentId, period)
      onRefresh()
    } catch {}
    finally { setGenerating(null) }
  }

  const getScoreColor = (score: number) =>
    score >= 85 ? "text-green-400" : score >= 70 ? "text-amber-400" : "text-red-400"

  const getScoreBg = (score: number) =>
    score >= 85 ? "bg-green-900/30 border-green-800" : score >= 70 ? "bg-amber-900/30 border-amber-800" : "bg-red-900/30 border-red-800"

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Coaching IA agents</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
          Propulse par GPT-4o mini
        </div>
      </div>

      {coaching.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-gray-400 font-medium mb-2">Aucun rapport de coaching</p>
          <p className="text-gray-500 text-sm mb-4">Les rapports sont generes automatiquement ou manuellement par agent</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 space-y-2">
            {coaching.map((c) => (
              <div key={c.id} onClick={() => setSelected(c)}
                className={"border rounded-xl p-4 cursor-pointer transition-colors " + (selected?.id === c.id ? "border-purple-600 bg-purple-900/10" : "bg-gray-900 border-gray-800 hover:border-gray-600")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-900 rounded-full flex items-center justify-center text-purple-300 font-bold text-sm">
                    {(c.agent?.name || "A").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{c.agent?.name || "Agent"}</p>
                    <p className="text-gray-500 text-xs">{c.period}</p>
                  </div>
                  <span className={"text-lg font-bold " + getScoreColor(c.score)}>{c.score}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="col-span-2">
            {selected ? (
              <div className={"bg-gray-900 border rounded-xl p-5 " + getScoreBg(selected.score)}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{selected.agent?.name || "Agent"}</h3>
                    <p className="text-gray-400 text-sm">{selected.period} · {new Date(selected.created_at).toLocaleDateString("fr-CA")}</p>
                  </div>
                  <div className="text-center">
                    <p className={"text-4xl font-bold " + getScoreColor(selected.score)}>{selected.score}</p>
                    <p className="text-gray-500 text-xs">/ 100</p>
                  </div>
                </div>

                {selected.metrics && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Appels total",  value: selected.metrics.totalCalls },
                      { label: "Completes",     value: selected.metrics.completedCalls },
                      { label: "Taux resolution", value: selected.metrics.resolutionRate + "%" },
                    ].map((m) => (
                      <div key={m.label} className="bg-gray-800 rounded-lg p-2 text-center">
                        <p className="text-white font-bold">{m.value}</p>
                        <p className="text-gray-500 text-xs">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selected.strengths?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-green-400 text-xs font-medium uppercase mb-1">Points forts</p>
                    {selected.strengths.map((s: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-gray-300 text-sm mb-1">
                        <span className="text-green-400">✓</span> {s}
                      </div>
                    ))}
                  </div>
                )}

                {selected.improvements?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-amber-400 text-xs font-medium uppercase mb-1">Points a ameliorer</p>
                    {selected.improvements.map((s: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-gray-300 text-sm mb-1">
                        <span className="text-amber-400">!</span> {s}
                      </div>
                    ))}
                  </div>
                )}

                {selected.recommendations?.length > 0 && (
                  <div>
                    <p className="text-blue-400 text-xs font-medium uppercase mb-1">Recommandations IA</p>
                    {selected.recommendations.map((s: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-gray-300 text-sm mb-1">
                        <span className="text-blue-400">→</span> {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <p className="text-gray-500 text-sm">Selectionnez un rapport</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
