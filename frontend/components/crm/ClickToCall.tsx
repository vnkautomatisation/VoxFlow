"use client"

import { useState } from "react"
import { Phone, Loader2 } from "lucide-react"
import { telephonyApi } from "@/lib/telephonyApi"

interface Props {
  phone:       string
  contactId?:  string
  accessToken: string
  size?:       "sm" | "md"
}

export default function ClickToCall({ phone, contactId, accessToken, size = "sm" }: Props) {
  const [calling, setCalling] = useState(false)
  const [error,   setError]   = useState("")

  const handleCall = async () => {
    if (!phone || calling) return
    setCalling(true)
    setError("")

    try {
      const res = await telephonyApi.startCall(accessToken, phone, contactId)
      if (!res.success) setError("Erreur: " + (res.error || "Inconnue"))
    } catch (err: any) {
      setError("Erreur appel")
    } finally {
      setTimeout(() => setCalling(false), 3000)
    }
  }

  const s = size === "sm" ? 14 : 16

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <button
        onClick={handleCall}
        disabled={calling}
        title={"Appeler " + phone}
        style={{
          background:    calling ? "#1e3a5f" : "#16a34a22",
          border:        "1px solid " + (calling ? "#3b82f6" : "#16a34a"),
          borderRadius:  "6px",
          padding:       size === "sm" ? "3px 8px" : "5px 12px",
          cursor:        calling ? "not-allowed" : "pointer",
          display:       "flex",
          alignItems:    "center",
          gap:           "4px",
          color:         calling ? "#60a5fa" : "#4ade80",
          fontSize:      size === "sm" ? "11px" : "13px",
          transition:    "all .15s",
        }}
      >
        {calling
          ? <Loader2 size={s} style={{ animation: "spin 1s linear infinite" }} />
          : <Phone size={s} />
        }
        {calling ? "Appel..." : phone}
      </button>
      {error && (
        <span style={{ fontSize: "11px", color: "#ef4444" }}>{error}</span>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
