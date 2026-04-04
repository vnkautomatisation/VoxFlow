"use client"

import { useState } from "react"

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  ONLINE:  { label: "En ligne",    dot: "bg-green-500",  bg: "border-green-800" },
  OFFLINE: { label: "Hors ligne",  dot: "bg-gray-500",   bg: "border-gray-800" },
  BREAK:   { label: "Pause",       dot: "bg-amber-500",  bg: "border-amber-800" },
  BUSY:    { label: "Occupe",      dot: "bg-blue-500",   bg: "border-blue-800" },
  ON_CALL: { label: "En appel",    dot: "bg-blue-500 animate-pulse", bg: "border-blue-700" },
}

interface Props {
  agent:          any
  onForceStatus:  (status: string) => void
  onJoinCall:     (mode: "listen" | "whisper" | "barge") => void
}

export default function AgentCard({ agent, onForceStatus, onJoinCall }: Props) {
  const [showMenu,  setShowMenu]  = useState(false)
  const [showJoin,  setShowJoin]  = useState(false)

  const isInCall   = !!agent.callId
  const statusKey  = isInCall ? "ON_CALL" : (agent.status || "OFFLINE")
  const cfg        = STATUS_CONFIG[statusKey] || STATUS_CONFIG.OFFLINE

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0")
  }

  return (
    <div className={"bg-gray-900 border rounded-xl p-4 relative " + cfg.bg}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div className={"w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-gray-900 " + cfg.dot}></div>
          </div>
          <div>
            <p className="text-white text-sm font-medium">{agent.name}</p>
            <p className="text-gray-500 text-xs">{cfg.label}</p>
          </div>
        </div>

        {/* Menu superviseur */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}
            className="text-gray-500 hover:text-white text-lg w-6 h-6 flex items-center justify-center"
          >⋯</button>
          {showMenu && (
            <div className="absolute right-0 top-7 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden min-w-36">
              <p className="text-gray-500 text-xs px-3 py-2 border-b border-gray-700">Forcer statut</p>
              {["ONLINE", "BREAK", "OFFLINE"].map((s) => (
                <button key={s} onClick={() => { onForceStatus(s); setShowMenu(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >{s === "ONLINE" ? "En ligne" : s === "BREAK" ? "Pause" : "Hors ligne"}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info appel actif */}
      {isInCall && (
        <div className="bg-gray-800 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className={"text-xs font-medium " + (agent.callDirection === "INBOUND" ? "text-green-400" : "text-blue-400")}>
              {agent.callDirection === "INBOUND" ? "Entrant" : "Sortant"}
            </span>
            <span className="text-blue-400 font-mono text-sm font-bold">{fmt(agent.callDuration || 0)}</span>
          </div>
          {agent.contactName && (
            <p className="text-white text-xs font-medium">{agent.contactName}</p>
          )}
          <p className="text-gray-500 text-xs font-mono">
            {agent.callDirection === "INBOUND" ? agent.callFrom : agent.callTo}
          </p>

          {/* Boutons Listen/Whisper/Barge */}
          <div className="flex gap-1 mt-2">
            {[
              { mode: "listen",  label: "Ecouter",    color: "bg-blue-900 text-blue-300 hover:bg-blue-800" },
              { mode: "whisper", label: "Chuchoter",  color: "bg-purple-900 text-purple-300 hover:bg-purple-800" },
              { mode: "barge",   label: "Intervenir", color: "bg-red-900 text-red-300 hover:bg-red-800" },
            ].map((btn) => (
              <button key={btn.mode}
                onClick={() => onJoinCall(btn.mode as any)}
                className={"flex-1 text-xs py-1.5 rounded-lg transition-colors font-medium " + btn.color}
              >{btn.label}</button>
            ))}
          </div>
        </div>
      )}

      {!isInCall && agent.status === "ONLINE" && (
        <div className="flex items-center gap-1.5 text-gray-500">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <span className="text-xs">Disponible pour appels</span>
        </div>
      )}

      {agent.status === "BREAK" && (
        <div className="flex items-center gap-1.5 text-amber-500">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
          <span className="text-xs">En pause</span>
        </div>
      )}
    </div>
  )
}
