"use client"

import { useState } from "react"

const DISPOSITION_OPTIONS = [
  { value: "resolved",  label: "Resolu",    color: "#16a34a" },
  { value: "callback",  label: "Rappel",    color: "#2563eb" },
  { value: "escalate",  label: "Escalade",  color: "#dc2626" },
  { value: "info",      label: "Info",      color: "#9333ea" },
  { value: "voicemail", label: "Messagerie", color: "#6b7280" },
]

interface Props {
  callId:    string | null
  contact?:  any
  duration:  number
  onDone:    (notes: string) => void
}

export default function WrapUpPanel({ callId, contact, duration, onDone }: Props) {
  const [notes,       setNotes]       = useState("")
  const [disposition, setDisposition] = useState("resolved")

  const fmt = (s: number) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0")

  return (
    <div style={{
      width: "240px", background: "#111827",
      border: "1px solid #374151", borderRadius: "12px",
      padding: "14px", boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
    }}>
      <p style={{ color: "#fff", fontWeight: 600, fontSize: "13px", margin: "0 0 10px" }}>Notes post-appel</p>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", background: "#1f2937", borderRadius: "8px", padding: "8px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
        </svg>
        <div>
          <p style={{ color: "#e5e7eb", fontSize: "11px", margin: 0 }}>
            {contact ? contact.firstName + " " + contact.lastName : "Appel inconnu"}
          </p>
          <p style={{ color: "#6b7280", fontSize: "11px", margin: 0 }}>{fmt(duration)}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
        {DISPOSITION_OPTIONS.map((d) => (
          <button key={d.value} onClick={() => setDisposition(d.value)}
            style={{
              padding: "3px 8px", borderRadius: "12px", cursor: "pointer", fontSize: "11px", fontWeight: 500,
              background: disposition === d.value ? d.color + "33" : "transparent",
              border: "1px solid " + (disposition === d.value ? d.color : "#374151"),
              color: disposition === d.value ? d.color : "#9ca3af"
            }}
          >{d.label}</button>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes sur cet appel..."
        rows={3}
        style={{
          width: "100%", background: "#1f2937", border: "1px solid #374151",
          borderRadius: "8px", padding: "8px", color: "#fff", fontSize: "12px",
          outline: "none", resize: "none", boxSizing: "border-box", marginBottom: "8px"
        }}
      />

      <button onClick={() => onDone(disposition + (notes ? " - " + notes : ""))}
        style={{ width: "100%", background: "#7c3aed", border: "none", color: "#fff", padding: "9px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 500 }}
      >
        Terminer et sauvegarder
      </button>
    </div>
  )
}
