"use client"
import { useEffect, useState } from "react"

const C = {
    bg2: "#18181f", bg3: "#1f1f2a", bg4: "#27273a", line: "#2e2e44",
    violet: "#7b61ff", mint: "#00d4aa", sky: "#38b6ff", tx2: "#9898b8", tx3: "#55557a",
}

interface GoalData {
    goals: { daily_calls_target: number; daily_answer_rate: number; daily_talk_time: number }
    stats: { total_calls: number; answered_calls: number; total_talk_time: number }
}

export default function GoalsBar({ token }: { token: string }) {
    const [data, setData] = useState<GoalData | null>(null)

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
        fetch(`${apiUrl}/api/v1/agent/goals`, {
            headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(d => { if (d.success) setData(d.data) }).catch(() => { })
    }, [token])

    // Données simulées si pas d'API
    const display = data || {
        goals: { daily_calls_target: 50, daily_answer_rate: 80, daily_talk_time: 14400 },
        stats: { total_calls: 7, answered_calls: 6, total_talk_time: 8640 }
    }

    const { goals, stats } = display
    const callPct = Math.min(100, Math.round((stats.total_calls / goals.daily_calls_target) * 100))
    const answerPct = stats.total_calls > 0 ? Math.round((stats.answered_calls / stats.total_calls) * 100) : 0
    const talkPct = Math.min(100, Math.round((stats.total_talk_time / goals.daily_talk_time) * 100))
    const fmtTime = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`

    const bars = [
        { label: "Appels", value: stats.total_calls, target: goals.daily_calls_target, pct: callPct, color: C.violet, display: `${stats.total_calls} / ${goals.daily_calls_target}` },
        { label: "Taux réponse", value: answerPct, target: goals.daily_answer_rate, pct: Math.min(100, Math.round(answerPct / goals.daily_answer_rate * 100)), color: C.mint, display: `${answerPct}% / ${goals.daily_answer_rate}%` },
        { label: "Temps de parole", value: stats.total_talk_time, target: goals.daily_talk_time, pct: talkPct, color: C.sky, display: `${fmtTime(stats.total_talk_time)} / 4:00` },
    ]

    return (
        <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                🎯 Objectifs du jour
                <div style={{ flex: 1, height: 1, background: C.line }} />
                <span style={{ fontSize: 10, color: C.tx2, textTransform: "none", fontWeight: 600, fontFamily: "monospace" }}>
                    {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {bars.map(bar => (
                    <div key={bar.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, color: C.tx2, fontWeight: 600 }}>{bar.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: bar.color, fontFamily: "monospace" }}>{bar.display}</span>
                        </div>
                        <div style={{ height: 6, background: C.bg4, borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${bar.pct}%`, background: bar.color, borderRadius: 4, transition: "width .6s ease", boxShadow: `0 0 10px ${bar.color}55` }} />
                        </div>
                        <div style={{ fontSize: 10, color: bar.pct >= 100 ? bar.color : C.tx3, marginTop: 4, textAlign: "right" }}>
                            {bar.pct >= 100 ? "✓ Objectif atteint" : `${bar.pct}% complété`}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}