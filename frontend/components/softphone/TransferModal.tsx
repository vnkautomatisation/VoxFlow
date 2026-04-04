"use client"

import { useState } from "react"
import { telephonyApi } from "@/lib/telephonyApi"

interface Props {
  callId:      string
  accessToken: string
  onClose:     () => void
}

export default function TransferModal({ callId, accessToken, onClose }: Props) {
  const [to,      setTo]      = useState("")
  const [type,    setType]    = useState<"blind"|"attended">("blind")
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  const handleTransfer = async () => {
    if (!to.trim()) return
    setLoading(true)
    try {
      await telephonyApi.transfer(accessToken, callId, to, type)
      setDone(true)
      setTimeout(onClose, 1500)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
    }}>
      <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: "14px", padding: "20px", width: "280px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3 style={{ color: "#fff", margin: 0, fontSize: "15px" }}>Transferer l appel</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "18px" }}>x</button>
        </div>

        {done ? (
          <p style={{ color: "#4ade80", textAlign: "center", fontSize: "14px" }}>Transfert effectue !</p>
        ) : (
          <>
            <input value={to} onChange={(e) => setTo(e.target.value)}
              placeholder="Numero ou extension..."
              style={{ width: "100%", background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", padding: "8px 10px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "10px" }}
            />
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              {(["blind", "attended"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  style={{
                    flex: 1, padding: "7px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 500,
                    background: type === t ? "#1e3a5f" : "#1f2937",
                    border: "1px solid " + (type === t ? "#3b82f6" : "#374151"),
                    color: type === t ? "#60a5fa" : "#9ca3af"
                  }}
                >
                  {t === "blind" ? "Aveugle" : "Assiste"}
                </button>
              ))}
            </div>
            <button onClick={handleTransfer} disabled={loading || !to.trim()}
              style={{ width: "100%", background: "#2563eb", border: "none", color: "#fff", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500, opacity: !to.trim() ? 0.5 : 1 }}
            >
              {loading ? "Transfert..." : "Transferer"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
