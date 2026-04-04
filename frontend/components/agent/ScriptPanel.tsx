"use client"

import { useState } from "react"

interface Script {
  id:      string
  name:    string
  content: string
}

interface Props {
  scripts: Script[]
}

export default function ScriptPanel({ scripts }: Props) {
  const [selected, setSelected] = useState<Script | null>(null)

  if (scripts.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
        <p className="text-gray-500 text-sm">Aucun script disponible</p>
        <p className="text-gray-600 text-xs mt-1">L admin peut en creer dans le dashboard</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex gap-2 overflow-x-auto">
        {scripts.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(selected?.id === s.id ? null : s)}
            className={"px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-colors " + (
              selected?.id === s.id
                ? "bg-teal-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
      {selected && (
        <div className="p-4">
          <p className="text-white text-sm font-medium mb-2">{selected.name}</p>
          <div className="bg-gray-800 rounded-lg p-3 text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {selected.content}
          </div>
        </div>
      )}
    </div>
  )
}
