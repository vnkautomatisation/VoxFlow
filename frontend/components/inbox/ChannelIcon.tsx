"use client"

export type ChannelKey = "CHAT" | "EMAIL" | "WHATSAPP" | "SMS" | "CALL"

export const CHANNELS: ChannelKey[] = ["CHAT", "EMAIL", "WHATSAPP", "SMS", "CALL"]

export interface ChannelMeta {
  label:   string
  labelFR: string
  tw: { bg: string; text: string; border: string }
}

export const CHANNEL_META: Record<ChannelKey, ChannelMeta> = {
  CHAT: {
    label:   "Chat",
    labelFR: "Chat",
    tw: { bg: "bg-violet-400/10", text: "text-violet-400", border: "border-violet-400/30" },
  },
  EMAIL: {
    label:   "Email",
    labelFR: "Email",
    tw: { bg: "bg-sky-400/10", text: "text-sky-400", border: "border-sky-400/30" },
  },
  WHATSAPP: {
    label:   "WhatsApp",
    labelFR: "WhatsApp",
    tw: { bg: "bg-emerald-400/10", text: "text-emerald-400", border: "border-emerald-400/30" },
  },
  SMS: {
    label:   "SMS",
    labelFR: "SMS",
    tw: { bg: "bg-amber-400/10", text: "text-amber-400", border: "border-amber-400/30" },
  },
  CALL: {
    label:   "Appel",
    labelFR: "Appel",
    tw: { bg: "bg-rose-400/10", text: "text-rose-400", border: "border-rose-400/30" },
  },
}

type Size = "sm" | "md" | "lg"

const SIZE_MAP: Record<Size, { pill: string; icon: number }> = {
  sm: { pill: "w-6 h-6",   icon: 14 },
  md: { pill: "w-8 h-8",   icon: 16 },
  lg: { pill: "w-10 h-10", icon: 20 },
}

interface Props {
  channel:   string
  size?:     Size
  className?: string
}

export default function ChannelIcon({ channel, size = "md", className = "" }: Props) {
  const meta = CHANNEL_META[channel as ChannelKey]
  const dim  = SIZE_MAP[size]

  // Fallback générique si canal inconnu
  if (!meta) {
    return (
      <div className={`${dim.pill} rounded-lg bg-zinc-400/10 border border-zinc-400/30 flex items-center justify-center flex-shrink-0 ${className}`}>
        <svg width={dim.icon} height={dim.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      </div>
    )
  }

  const Icon = () => {
    const common = { width: dim.icon, height: dim.icon, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
    switch (channel) {
      case "CHAT":
        return (
          <svg {...common}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )
      case "EMAIL":
        return (
          <svg {...common}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        )
      case "WHATSAPP":
        return (
          <svg {...common}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )
      case "SMS":
        return (
          <svg {...common}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <circle cx="8"  cy="10" r="0.6" fill="currentColor" />
            <circle cx="12" cy="10" r="0.6" fill="currentColor" />
            <circle cx="16" cy="10" r="0.6" fill="currentColor" />
          </svg>
        )
      case "CALL":
        return (
          <svg {...common}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className={`${dim.pill} rounded-lg ${meta.tw.bg} border ${meta.tw.border} ${meta.tw.text} flex items-center justify-center flex-shrink-0 ${className}`}>
      <Icon />
    </div>
  )
}
