"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useCallStore } from "@/store/callStore"
import { telephonyApi } from "@/lib/telephonyApi"
import CRMPopup from "./CRMPopup"
import TransferModal from "./TransferModal"
import WrapUpPanel from "./WrapUpPanel"

interface Props {
  accessToken: string
}

const DIAL_KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#"]

const STATUS_OPTIONS = [
  { value: "ONLINE",  label: "Disponible",  dot: "#4ade80" },
  { value: "BREAK",   label: "Pause",        dot: "#fbbf24" },
  { value: "OFFLINE", label: "Hors ligne",   dot: "#6b7280" },
]

export default function FloatingPhone({ accessToken }: Props) {
  const {
    callState, agentStatus, activeCall, isMuted, isOnHold,
    isMinimized, notes, duration,
    setCallState, setAgentStatus, setActiveCall,
    setMuted, setOnHold, setNotes, setMinimized,
    setDevice, setContact, incrementDuration, reset
  } = useCallStore()

  const [dialNumber,   setDialNumber]   = useState("")
  const [deviceReady,  setDeviceReady]  = useState(false)
  const [simulated,    setSimulated]    = useState(false)
  const [showStatus,   setShowStatus]   = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showCRM,      setShowCRM]      = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)

  const timerRef = useRef<any>(null)
  const deviceRef = useRef<any>(null)

  // ── Initialisation device Twilio ────────────────────────────
  useEffect(() => {
    if (!accessToken) return
    initDevice()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [accessToken])

  const initDevice = async () => {
    try {
      const res = await telephonyApi.getToken(accessToken)
      if (!res.success) return

      if (res.data.simulated) {
        setSimulated(true)
        setDeviceReady(true)
        return
      }

      const { Device } = await import("@twilio/voice-sdk")
      const dev = new Device(res.data.token, { logLevel: 1 })

      dev.on("ready",    () => setDeviceReady(true))
      dev.on("error",    (e: any) => console.error("Twilio:", e))
      dev.on("incoming", (conn: any) => handleIncomingCall(conn))
      dev.register()

      deviceRef.current = dev
      setDevice(dev)
    } catch {
      setSimulated(true)
      setDeviceReady(true)
    }
  }

  // ── Appel entrant ────────────────────────────────────────────
  const handleIncomingCall = useCallback(async (conn: any) => {
    const from = conn.parameters?.From || "Inconnu"

    // Lookup CRM
    let contact = null
    try {
      const lookup = await telephonyApi.lookup(accessToken, from)
      if (lookup.success) contact = lookup.data.contact
    } catch {}

    setActiveCall({
      id:        "in_" + Date.now(),
      from,
      to:        "Moi",
      direction: "INBOUND",
      startedAt: new Date(),
      duration:  0,
      contact,
    })

    setCallState("ringing_in")
    if (contact) setShowCRM(true)
    setMinimized(false)

    // Jouer sonnerie (si possible)
    try {
      const audio = new Audio("/ring.mp3")
      audio.loop  = true
      audio.play().catch(() => {})
      conn.on("cancel", () => audio.pause())
      conn.on("accept", () => audio.pause())
    } catch {}
  }, [accessToken])

  // ── Decrocher ────────────────────────────────────────────────
  const handleAnswer = () => {
    if (deviceRef.current) {
      const conn = deviceRef.current.activeConnection?.()
      if (conn) conn.accept()
    }
    setCallState("in_call")
    setAgentStatus("ON_CALL")
    startTimer()
  }

  // ── Appel sortant ────────────────────────────────────────────
  const handleDial = async () => {
    if (!dialNumber.trim() || !deviceReady) return
    try {
      const res = await telephonyApi.startCall(accessToken, dialNumber)
      if (res.success) {
        setCurrentCallId(res.data.call?.id || null)
        setActiveCall({
          id:        res.data.call?.id || "out_" + Date.now(),
          from:      "Moi",
          to:        dialNumber,
          direction: "OUTBOUND",
          startedAt: new Date(),
          duration:  0,
          contact:   res.data.contact || null,
        })
        setCallState("ringing_out")
        setAgentStatus("ON_CALL")
        if (res.data.contact) setShowCRM(true)

        // Twilio reel
        if (!simulated && deviceRef.current) {
          deviceRef.current.connect({ params: { To: dialNumber } })
        }

        // Simule connexion apres 2s en mode demo
        if (simulated) {
          setTimeout(() => {
            setCallState("in_call")
            startTimer()
          }, 2000)
        }
      }
    } catch (err) { console.error(err) }
  }

  // ── Raccrocher ───────────────────────────────────────────────
  const handleHangup = async () => {
    stopTimer()
    if (deviceRef.current) deviceRef.current.disconnectAll()

    if (currentCallId) {
      await telephonyApi.endCall(accessToken, currentCallId, duration)
    }

    setCallState("wrap_up")
    setAgentStatus("ONLINE")
    setShowCRM(false)
  }

  // ── Timer durée appel ────────────────────────────────────────
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      useCallStore.getState().incrementDuration()
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // ── Wrap-up termine ─────────────────────────────────────────
  const handleWrapUpDone = async (wrapNotes: string) => {
    if (currentCallId && wrapNotes) {
      await telephonyApi.saveNotes(accessToken, currentCallId, wrapNotes)
    }
    setCurrentCallId(null)
    reset()
    setShowCRM(false)
  }

  const handleStatusChange = async (status: string) => {
    setShowStatus(false)
    setAgentStatus(status as any)
    await telephonyApi.setStatus(accessToken, status)
  }

  const fmt = (s: number) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0")

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === agentStatus) || STATUS_OPTIONS[2]

  // ── RENDU MINIMISE ───────────────────────────────────────────
  if (isMinimized) {
    return (
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>
        <button
          onClick={() => setMinimized(false)}
          style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: callState === "in_call" ? "#2563eb" :
                        callState === "ringing_in" ? "#16a34a" : "#1a1a2e",
            border: "2px solid " + (callState !== "idle" && callState !== "wrap_up" ? "#4ade80" : "#374151"),
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
          {callState === "ringing_in" && (
            <span style={{
              position: "absolute", top: "-4px", right: "-4px",
              width: "14px", height: "14px", background: "#4ade80",
              borderRadius: "50%", animation: "pulse 1s infinite"
            }}></span>
          )}
        </button>
        {callState === "in_call" && (
          <div style={{ background: "#1a1a2e", borderRadius: "20px", padding: "4px 10px", marginTop: "4px", textAlign: "center" }}>
            <span style={{ color: "#60a5fa", fontSize: "12px", fontFamily: "monospace" }}>{fmt(duration)}</span>
          </div>
        )}
      </div>
    )
  }

  // ── RENDU COMPLET ─────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999, display: "flex", gap: "12px", alignItems: "flex-end" }}>

      {/* CRM Popup (a gauche du phone) */}
      {showCRM && activeCall?.contact && (
        <CRMPopup contact={activeCall.contact} onClose={() => setShowCRM(false)} />
      )}

      {/* Wrap-up panel */}
      {callState === "wrap_up" && (
        <WrapUpPanel
          callId={currentCallId}
          contact={activeCall?.contact}
          duration={duration}
          onDone={handleWrapUpDone}
        />
      )}

      {/* Transfert modal */}
      {showTransfer && (
        <TransferModal
          callId={currentCallId || ""}
          accessToken={accessToken}
          onClose={() => setShowTransfer(false)}
        />
      )}

      {/* LE PHONE POPUP */}
      <div style={{
        width: "260px", background: "#0f0f1e",
        borderRadius: "16px", overflow: "hidden",
        border: "1px solid #374151",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      }}>

        {/* Header */}
        <div style={{
          background: "#1a1a2e", padding: "10px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: currentStatus.dot }}></div>
            <span style={{ color: "#fff", fontSize: "13px", fontWeight: 500 }}>VoxFlow</span>
            {simulated && <span style={{ fontSize: "10px", background: "#854F0B", color: "#fbbf24", padding: "1px 5px", borderRadius: "10px" }}>Demo</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Statut dropdown */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowStatus(!showStatus)}
                style={{ background: "none", border: "1px solid #374151", borderRadius: "6px", padding: "2px 8px", cursor: "pointer", color: "#9ca3af", fontSize: "11px" }}
              >
                {currentStatus.label} ▾
              </button>
              {showStatus && (
                <div style={{ position: "absolute", bottom: "28px", right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", overflow: "hidden", zIndex: 10 }}>
                  {STATUS_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                      style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "#e5e7eb", fontSize: "12px", whiteSpace: "nowrap" }}
                    >
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: opt.dot }}></div>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setMinimized(true)}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}
            >—</button>
          </div>
        </div>

        {/* IDLE — Clavier */}
        {callState === "idle" && (
          <div>
            <div style={{ padding: "10px 12px 6px", background: "#0a0a18" }}>
              <input
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleDial() }}
                placeholder="Entrer un numero..."
                style={{
                  width: "100%", background: "transparent", border: "none",
                  color: "#fff", fontSize: "18px", textAlign: "center",
                  fontFamily: "monospace", letterSpacing: "2px", outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: "#1f2937" }}>
              {DIAL_KEYS.map((k) => (
                <button key={k} onClick={() => setDialNumber((p) => p + k)}
                  style={{ padding: "11px", background: "#1a1a2e", border: "none", color: "#fff", fontSize: "16px", fontWeight: 500, cursor: "pointer" }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "#252540")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "#1a1a2e")}
                >
                  {k}
                </button>
              ))}
            </div>
            <div style={{ padding: "8px 12px", background: "#0a0a18", display: "flex", gap: "6px" }}>
              <button
                onClick={() => setDialNumber((p) => p.slice(0, -1))}
                style={{ background: "#1a1a2e", border: "none", color: "#6b7280", padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}
              >⌫</button>
              <button
                onClick={handleDial}
                disabled={!dialNumber.trim() || !deviceReady}
                style={{
                  flex: 1, background: "#16a34a", border: "none", color: "#fff",
                  padding: "10px", borderRadius: "8px", cursor: "pointer",
                  fontSize: "13px", fontWeight: 500,
                  opacity: !dialNumber.trim() ? 0.5 : 1
                }}
              >
                Appeler
              </button>
            </div>
          </div>
        )}

        {/* RINGING IN — Appel entrant */}
        {callState === "ringing_in" && activeCall && (
          <div style={{ padding: "16px", textAlign: "center" }}>
            <div style={{ width: "52px", height: "52px", background: "#14532d", borderRadius: "50%", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: "15px", marginBottom: "2px" }}>
              {activeCall.contact ? activeCall.contact.firstName + " " + activeCall.contact.lastName : activeCall.from}
            </p>
            {activeCall.contact?.company && <p style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "2px" }}>{activeCall.contact.company}</p>}
            <p style={{ color: "#4ade80", fontSize: "12px", marginBottom: "12px" }}>Appel entrant...</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => { setCallState("idle"); reset() }}
                style={{ flex: 1, background: "#dc2626", border: "none", color: "#fff", padding: "12px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
              >Refuser</button>
              <button onClick={handleAnswer}
                style={{ flex: 1, background: "#16a34a", border: "none", color: "#fff", padding: "12px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
              >Decrocher</button>
            </div>
          </div>
        )}

        {/* RINGING OUT — Appel sortant en cours */}
        {callState === "ringing_out" && activeCall && (
          <div style={{ padding: "16px", textAlign: "center" }}>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>{activeCall.to}</p>
            <p style={{ color: "#fbbf24", fontSize: "12px", marginBottom: "12px" }}>Appel en cours...</p>
            <button onClick={handleHangup}
              style={{ width: "100%", background: "#dc2626", border: "none", color: "#fff", padding: "12px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
            >Annuler</button>
          </div>
        )}

        {/* IN CALL — En communication */}
        {callState === "in_call" && activeCall && (
          <div>
            <div style={{ padding: "12px", background: "#0a0a18", textAlign: "center" }}>
              <div style={{ width: "44px", height: "44px", background: "#1e3a5f", borderRadius: "50%", margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: "16px" }}>
                  {(activeCall.contact?.firstName || activeCall.from || "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <p style={{ color: "#fff", fontWeight: 600, fontSize: "14px", margin: "0 0 2px" }}>
                {activeCall.contact ? activeCall.contact.firstName + " " + activeCall.contact.lastName : (activeCall.direction === "INBOUND" ? activeCall.from : activeCall.to)}
              </p>
              {activeCall.contact?.company && <p style={{ color: "#6b7280", fontSize: "11px", margin: "0 0 4px" }}>{activeCall.contact.company}</p>}
              <p style={{ color: "#60a5fa", fontFamily: "monospace", fontSize: "18px", fontWeight: 600, margin: 0 }}>{fmt(duration)}</p>
            </div>

            {/* Controles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: "#1f2937" }}>
              {[
                { label: isMuted ? "Activer" : "Muet", active: isMuted, color: "#ef4444", onClick: () => setMuted(!isMuted) },
                { label: isOnHold ? "Reprendre" : "Attente", active: isOnHold, color: "#fbbf24", onClick: () => setOnHold(!isOnHold) },
                { label: "Transferer", active: false, color: "#60a5fa", onClick: () => setShowTransfer(true) },
              ].map((btn) => (
                <button key={btn.label} onClick={btn.onClick}
                  style={{
                    padding: "10px 4px", background: btn.active ? btn.color + "33" : "#1a1a2e",
                    border: "none", color: btn.active ? btn.color : "#9ca3af",
                    fontSize: "11px", cursor: "pointer", textAlign: "center"
                  }}
                >{btn.label}</button>
              ))}
            </div>

            {/* Bouton CRM + Raccrocher */}
            <div style={{ padding: "8px 12px", background: "#0a0a18", display: "flex", gap: "6px" }}>
              {activeCall.contact && (
                <button onClick={() => setShowCRM(!showCRM)}
                  style={{ background: "#1e3a5f", border: "none", color: "#60a5fa", padding: "10px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "11px" }}
                >
                  CRM
                </button>
              )}
              <button onClick={handleHangup}
                style={{ flex: 1, background: "#dc2626", border: "none", color: "#fff", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500 }}
              >
                Raccrocher
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
