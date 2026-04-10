"use client"

import ChannelIcon, { CHANNELS, CHANNEL_META } from "./ChannelIcon"

interface Props { stats: any }

const KPI_CONFIG = [
  { key: "total",    label: "Total",      color: "text-violet-400" },
  { key: "open",     label: "Ouverts",    color: "text-emerald-400" },
  { key: "pending",  label: "En attente", color: "text-amber-400" },
  { key: "resolved", label: "Résolus",    color: "text-sky-400" },
  { key: "urgent",   label: "Urgents",    color: "text-rose-400", zeroColor: "text-[#55557a]" },
]

export default function InboxStats({ stats }: Props) {
  const s = stats || {}

  return (
    <div className="space-y-3">
      {/* Rangée 1 — 5 KPI globaux */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPI_CONFIG.map((k) => {
          const val = s[k.key] ?? 0
          const col = k.zeroColor && val === 0 ? k.zeroColor : k.color
          return (
            <div key={k.key} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-1">{k.label}</div>
              <div className={`text-2xl font-bold font-mono ${col}`}>{val}</div>
            </div>
          )
        })}
      </div>

      {/* Rangée 2 — 5 mini-cartes par canal */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {CHANNELS.map((ch) => {
          const cs   = s.byChannel?.[ch] ?? { total: 0, open: 0, pending: 0, resolved: 0 }
          const meta = CHANNEL_META[ch]
          const dim  = cs.total === 0 ? "opacity-40" : ""
          return (
            <div key={ch} className={`bg-[#18181f] border border-[#2e2e44] rounded-xl p-3 flex items-center gap-3 transition-opacity ${dim}`}>
              <ChannelIcon channel={ch} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] truncate">{meta.labelFR}</div>
                <div className="text-sm font-mono text-[#eeeef8]">
                  <span className={meta.tw.text}>{cs.open}</span>
                  <span className="text-[#55557a]">/{cs.total}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
