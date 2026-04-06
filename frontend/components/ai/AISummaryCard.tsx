"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { aiApi } from "@/lib/aiApi"

interface Props {
  call: {
    id:          string
    from_number: string
    to_number:   string
    duration:    number
    started_at:  string
    ai_summary:  string | null
    transcription: string | null
  }
  onProcessed: () => void
}

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIF: "text-green-400 bg-green-900/30",
  NEUTRE:  "text-gray-400 bg-gray-800",
  NEGATIF: "text-red-400 bg-red-900/30",
}

export default function AISummaryCard({ call, onProcessed }: Props) {
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleTranscribe = async () => {
    setLoading(true)
    try {
      await aiApi.transcribeCall(accessToken!, call.id)
      onProcessed()
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-white text-sm font-medium font-mono">{call.from_number}</p>
          <p className="text-gray-500 text-xs">
            {new Date(call.started_at).toLocaleString("fr-CA")} · {Math.round((call.duration || 0) / 60)}min
          </p>
        </div>
        {!call.ai_summary ? (
          <button
            onClick={handleTranscribe}
            disabled={loading}
            className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {loading ? "Analyse..." : "Analyser avec IA"}
          </button>
        ) : (
          <span className="text-xs bg-purple-900 text-purple-300 px-2 py-1 rounded-full">IA traite</span>
        )}
      </div>

      {call.ai_summary && !call.ai_summary.startsWith(`{`) && (
        <div className="mt-2">
          <p className="text-gray-300 text-sm">{call.ai_summary}</p>
          {call.transcription && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-purple-400 text-xs mt-2 hover:text-purple-300"
            >
              {expanded ? "Masquer transcription" : "Voir transcription"}
            </button>
          )}
          {expanded && call.transcription && (
            <div className="mt-2 bg-gray-800 rounded-lg p-3 text-gray-400 text-xs leading-relaxed">
              {!call.transcription.startsWith(`{`) ? call.transcription : "Transcription indisponible (clé OpenAI requise)"}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

