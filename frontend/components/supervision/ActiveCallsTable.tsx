"use client"

interface Props {
  calls:      any[]
  onJoinCall: (callId: string, mode: "listen" | "whisper" | "barge") => void
}

export default function ActiveCallsTable({ calls, onJoinCall }: Props) {
  const fmt = (started: string) => {
    const sec = Math.floor((Date.now() - new Date(started).getTime()) / 1000)
    const m   = Math.floor(sec / 60)
    const s   = sec % 60
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            {["Direction", "Numero", "Contact", "Agent", "Duree", "Actions"].map((h) => (
              <th key={h} className="text-left text-gray-500 text-xs uppercase px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr key={call.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="px-4 py-3">
                <span className={"text-xs px-2 py-1 rounded-full font-medium " + (call.direction === "INBOUND" ? "bg-green-900 text-green-300" : "bg-blue-900 text-blue-300")}>
                  {call.direction === "INBOUND" ? "Entrant" : "Sortant"}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-300 text-sm font-mono">
                {call.direction === "INBOUND" ? call.from_number : call.to_number}
              </td>
              <td className="px-4 py-3 text-gray-300 text-sm">
                {call.contacts ? call.contacts.first_name + " " + call.contacts.last_name : "—"}
              </td>
              <td className="px-4 py-3 text-gray-400 text-sm">
                {call.agent_id ? call.agent_id.slice(0, 8) + "..." : "—"}
              </td>
              <td className="px-4 py-3 text-blue-400 font-mono text-sm font-bold">
                {fmt(call.started_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {[
                    { mode: "listen",  label: "Ecouter",   color: "bg-blue-900/50 text-blue-400 hover:bg-blue-900" },
                    { mode: "whisper", label: "Whisper",   color: "bg-purple-900/50 text-purple-400 hover:bg-purple-900" },
                    { mode: "barge",   label: "Barge",     color: "bg-red-900/50 text-red-400 hover:bg-red-900" },
                  ].map((btn) => (
                    <button key={btn.mode}
                      onClick={() => onJoinCall(call.id, btn.mode as any)}
                      className={"text-xs px-2 py-1 rounded-lg transition-colors " + btn.color}
                    >{btn.label}</button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
