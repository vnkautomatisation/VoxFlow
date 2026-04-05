"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { telephonyApi } from "@/lib/telephonyApi"
import { Phone, Voicemail, Play, CheckCircle, Clock, User } from "lucide-react"

export default function VoicemailsPage() {
  const { accessToken } = useAuthStore()
  const [vms,     setVms]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    load()
  }, [accessToken])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/telephony/voicemails", {
        headers: { Authorization: "Bearer " + accessToken }
      })
      const data = await res.json()
      if (data.success) setVms(data.data || [])
    } catch {}
    finally { setLoading(false) }
  }

  const handlePlay = async (vm: any) => {
    if (playing === vm.id) {
      setPlaying(null)
      return
    }
    setPlaying(vm.id)

    // Marquer comme ecouté
    if (vm.status === "NEW") {
      await fetch("/api/v1/telephony/voicemail/" + vm.id + "/listen", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + accessToken }
      })
      setVms(prev => prev.map(v => v.id === vm.id ? { ...v, status: "LISTENED" } : v))
    }

    // Jouer l audio
    if (vm.recording_url) {
      const audio = new Audio(vm.recording_url)
      audio.play().catch(() => {})
      audio.onended = () => setPlaying(null)
    }
  }

  const fmt = (dt: string) => new Date(dt).toLocaleString("fr-CA", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  })

  const newCount = vms.filter(v => v.status === "NEW").length

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a18", padding: "24px" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Voicemail size={24} color="#a78bfa" />
            <h1 style={{ color: "#fff", fontSize: "20px", fontWeight: 600, margin: 0 }}>
              Messagerie vocale
            </h1>
            {newCount > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", fontSize: "12px", padding: "2px 8px", borderRadius: "20px" }}>
                {newCount} nouveaux
              </span>
            )}
          </div>
          <button onClick={load} style={{ background: "#1f2937", border: "1px solid #374151", color: "#9ca3af", padding: "6px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
            Actualiser
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#6b7280", textAlign: "center", padding: "48px" }}>Chargement...</p>
        ) : vms.length === 0 ? (
          <div style={{ background: "#1a1a2e", border: "1px solid #1f2937", borderRadius: "12px", padding: "48px", textAlign: "center" }}>
            <Voicemail size={40} color="#374151" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#6b7280", fontSize: "14px" }}>Aucun message vocal</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {vms.map(vm => (
              <div key={vm.id} style={{
                background:   "#1a1a2e",
                border:       "1px solid " + (vm.status === "NEW" ? "#4f46e5" : "#1f2937"),
                borderRadius: "12px",
                padding:      "16px",
                display:      "flex",
                alignItems:   "flex-start",
                gap:          "14px",
              }}>
                <div style={{ width: "40px", height: "40px", background: vm.status === "NEW" ? "#312e81" : "#1f2937", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User size={18} color={vm.status === "NEW" ? "#a78bfa" : "#6b7280"} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <p style={{ color: "#fff", fontWeight: 600, fontSize: "14px", margin: 0 }}>
                      {vm.contact ? vm.contact.first_name + " " + vm.contact.last_name : vm.from_number}
                    </p>
                    {vm.status === "NEW" && (
                      <span style={{ background: "#4f46e5", color: "#c7d2fe", fontSize: "10px", padding: "1px 6px", borderRadius: "10px" }}>
                        Nouveau
                      </span>
                    )}
                  </div>

                  <p style={{ color: "#6b7280", fontSize: "12px", margin: "0 0 6px" }}>
                    {vm.from_number}
                  </p>

                  {vm.transcription && (
                    <p style={{ color: "#9ca3af", fontSize: "13px", margin: "0 0 8px", fontStyle: "italic", borderLeft: "2px solid #4f46e5", paddingLeft: "8px" }}>
                      "{vm.transcription.substring(0, 200)}{vm.transcription.length > 200 ? "..." : ""}"
                    </p>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {vm.recording_url && (
                      <button
                        onClick={() => handlePlay(vm)}
                        style={{
                          background:   playing === vm.id ? "#4f46e5" : "#1f2937",
                          border:       "none",
                          borderRadius: "8px",
                          padding:      "6px 12px",
                          color:        playing === vm.id ? "#fff" : "#9ca3af",
                          cursor:       "pointer",
                          display:      "flex",
                          alignItems:   "center",
                          gap:          "6px",
                          fontSize:     "12px",
                        }}
                      >
                        <Play size={12} />
                        {playing === vm.id ? "En lecture..." : "Ecouter"}
                      </button>
                    )}
                    {vm.status === "LISTENED" && (
                      <CheckCircle size={14} color="#4ade80" />
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ color: "#6b7280", fontSize: "11px", margin: 0 }}>{fmt(vm.created_at)}</p>
                  {vm.duration > 0 && (
                    <p style={{ color: "#4b5563", fontSize: "11px", margin: "2px 0 0", display: "flex", alignItems: "center", gap: "3px", justifyContent: "flex-end" }}>
                      <Clock size={10} />
                      {vm.duration}s
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
