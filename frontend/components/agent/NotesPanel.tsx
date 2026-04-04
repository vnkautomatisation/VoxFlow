"use client"

import { useState } from "react"
import { useCallStore } from "@/store/callStore"
import { useAuthStore } from "@/store/authStore"
import { agentApi } from "@/lib/agentApi"

const TAGS = ["Resolu", "Rappel", "Escalade", "Info", "Plainte", "Vente"]

export default function NotesPanel() {
  const { activeCall, notes, setNotes, callState } = useCallStore()
  const { accessToken } = useAuthStore()
  const [saving,     setSaving]     = useState(false)
  const [savedMsg,   setSavedMsg]   = useState("")
  const [activeTags, setActiveTags] = useState<string[]>([])

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSave = async () => {
    if (!activeCall || !accessToken) return
    setSaving(true)
    try {
      const fullNotes = notes + (activeTags.length > 0 ? "\nTags: " + activeTags.join(", ") : "")
      await agentApi.addNotes(accessToken, activeCall.id, fullNotes)
      setSavedMsg("Sauvegarde !")
      setTimeout(() => setSavedMsg(""), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-white font-medium text-sm mb-3">Notes post-appel</h3>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes sur cet appel..."
        rows={4}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 resize-none mb-3"
      />

      <div className="flex flex-wrap gap-2 mb-3">
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={"text-xs px-2 py-1 rounded-full border transition-colors " + (
              activeTags.includes(tag)
                ? "bg-teal-600 border-teal-600 text-white"
                : "border-gray-700 text-gray-400 hover:border-gray-500"
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={saving || !activeCall}
          className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
        {savedMsg && <p className="text-green-400 text-sm">{savedMsg}</p>}
      </div>
    </div>
  )
}
