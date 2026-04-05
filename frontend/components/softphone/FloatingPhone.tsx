"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useCallStore } from "@/store/callStore"
import { telephonyApi } from "@/lib/telephonyApi"
import CRMPopup from "./CRMPopup"
import TransferModal from "./TransferModal"
import WrapUpPanel from "./WrapUpPanel"
import {
  Phone, PhoneOff, PhoneIncoming, PhoneMissed,
  Mic, MicOff, PauseCircle, PlayCircle,
  ArrowRightLeft, Users, ChevronDown, Minimize2,
  Volume2, Clock
} from "lucide-react"

interface Props { accessToken: string }

const DIAL_KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#","+","←","","+" ]

const STATUS_CONFIG = [
  { value: "ONLINE",  label: "Disponible",  color: "#4ade80" },
  { value: "BREAK",   label: "Pause",        color: "#fbbf24" },
  { value: "OFFLINE", label: "Hors ligne",   color: "#6b7280" },
]

export default function FloatingPhone({ accessToken }: Props) {
  const {
    callState, agentStatus, activeCall, isMuted, isOnHold,
    isMinimized, duration,
    setCallState, setAgentStatus, setActiveCall,
    setMuted, setOnHold, setMinimized,
    incrementDuration, reset
  } = useCallStore()

  const [dialNumber,    setDialNumber]    = useState("")
  const [deviceReady,   setDeviceReady]   = useState(false)
  const [isConfigured,  setIsConfigured]  = useState(false)
  const [showStatus,    setShowStatus]    = useState(false)
  const [showTransfer,  setShowTransfer]  = useState(false)
  const [showCRM,       setShowCRM]       = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [twilioCallSid, setTwilioCallSid] = useState<string | null>(null)
  const [incomingConn,  setIncomingConn]  = useState<any>(null)

  const timerRef  = useRef<any>(null)
  const deviceRef = useRef<any>(null)
  const audioRef  = useRef<HTMLAudioElement | null>(null)

  // Init SDK Twilio
  useEffect(() => {
    if (!accessToken) return
    initDevice()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [accessToken])

  const initDevice = async () => {
    try {
      const res = await telephonyApi.getToken(accessToken)
      if (!res.success) return

      setIsConfigured(res.data.configured !== false)

      if (!res.data.configured) {
        setDeviceReady(true)
        return
      }

      const { Device } = await import("@twilio/voice-sdk")
      const dev = new Device(res.data.token, {
        logLevel:       1,
        codecPreferences: ["opus", "pcmu"] as any,
        allowIncomingWhileBusy: false,
      })

      dev.on("ready",    () => setDeviceReady(true))
      dev.on("error",    (e: any) => console.error("[Twilio Device]", e))
      dev.on("incoming", handleIncomingCall)
      dev.on("connect",  (conn: any) => {
        setTwilioCallSid(conn.parameters?.CallSid || null)
      })
      dev.on("disconnect", () => {
        stopTimer()
        setCallState("wrap_up")
        setAgentStatus("ONLINE")
      })

      dev.register()
      deviceRef.current = dev
      setDeviceReady(true)

      // Definir statut ONLINE
      await telephonyApi.setStatus(accessToken, "ONLINE")
      setAgentStatus("ONLINE")

    } catch (err) {
      console.error("Device init error:", err)
      setDeviceReady(true)
    }
  }

  const handleIncomingCall = useCallback(async (conn: any) => {
    const from = conn.parameters?.From || "Inconnu"
    setIncomingConn(conn)

    // Lookup CRM
    let contact = null
    try {
      const res = await telephonyApi.lookup(accessToken, from)
      if (res.success) contact = res.data.contact
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

    // Sonnerie
    try {
      audioRef.current = new Audio("/ring.mp3")
      audioRef.current.loop = true
      audioRef.current.play().catch(() => {})
    } catch {}

    conn.on("cancel", () => {
      audioRef.current?.pause()
      reset()
    })
  }, [accessToken])

  const handleAnswer = () => {
    audioRef.current?.pause()
    if (incomingConn) incomingConn.accept()
    setCallState("in_call")
    setAgentStatus("ON_CALL" as any)
    startTimer()
    setIncomingConn(null)
  }

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
        setAgentStatus("ON_CALL" as any)
        if (res.data.contact) setShowCRM(true)

        // Vrai appel Twilio
        if (isConfigured && deviceRef.current) {
          const conn = await deviceRef.current.connect({
            params: { To: dialNumber }
          })
          setTwilioCallSid(conn.parameters?.CallSid || null)
          conn.on("accept",     () => { setCallState("in_call"); startTimer() })
          conn.on("disconnect", () => { handleHangup() })
        } else {
          // Mode demo
          setTimeout(() => { setCallState("in_call"); startTimer() }, 2000)
        }
      }
    } catch (err) { console.error(err) }
  }

  const handleHangup = async () => {
    audioRef.current?.pause()
    stopTimer()

    if (deviceRef.current) deviceRef.current.disconnectAll()

    if (currentCallId) {
      await telephonyApi.endCall(accessToken, currentCallId, useCallStore.getState().duration, undefined, twilioCallSid || undefined)
    }

    setCallState("wrap_up")
    setAgentStatus("ONLINE")
    setShowCRM(false)
    setTwilioCallSid(null)
  }

  const handleRefuse = () => {
    audioRef.current?.pause()
    if (incomingConn) incomingConn.reject()
    setIncomingConn(null)
    reset()
  }

  const handleMute = async () => {
    const newMuted = !isMuted
    setMuted(newMuted)
    if (deviceRef.current) {
      const conn = deviceRef.current.activeConnection?.()
      if (conn) conn.mute(newMuted)
    }
    if (currentCallId && twilioCallSid) {
      await telephonyApi.muteCall(accessToken, currentCallId, newMuted, twilioCallSid)
    }
  }

  const handleHold = async () => {
    const newHold = !isOnHold
    setOnHold(newHold)
    if (currentCallId && twilioCallSid) {
      await telephonyApi.holdCall(accessToken, currentCallId, newHold, twilioCallSid)
    }
  }

  const handleStatusChange = async (status: string) => {
    setShowStatus(false)
    setAgentStatus(status as any)
    await telephonyApi.setStatus(accessToken, status)
  }

  const handleWrapUpDone = async (notes: string) => {
    if (currentCallId && notes) {
      await telephonyApi.saveNotes(accessToken, currentCallId, notes)
    }
    setCurrentCallId(null)
    reset()
    setShowCRM(false)
    setShowTransfer(false)
  }

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      useCallStore.getState().incrementDuration()
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const fmt = (s: number) =>
    String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0")

  const currentStatus = STATUS_CONFIG.find(s => s.value === agentStatus) || STATUS_CONFIG[2]

  // ── MINIMISE ──────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999 }}>
        <button
          onClick={() => setMinimized(false)}
          style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: callState === "in_call"     ? "#2563eb" :
                        callState === "ringing_in"  ? "#16a34a" : "#0f0f1e",
            border: "2px solid " + (callState !== "idle" ? "#4ade80" : "#374151"),
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <Phone size={20} color="white" />
          {callState === "ringing_in" && (
            <span style={{
              position: "absolute", top: "-4px", right: "-4px",
              width: "14px", height: "14px", background: "#4ade80",
              borderRadius: "50%", border: "2px solid #0f0f1e",
            }}/>
          )}
        </button>
        {callState === "in_call" && (
          <div style={{ marginTop: "4px", textAlign: "center" }}>
            <span style={{ color: "#60a5fa", fontSize: "11px", fontFamily: "monospace" }}>
              {fmt(duration)}
            </span>
          </div>
        )}
      </div>
    )
  }

  // ── RENDU COMPLET ─────────────────────────────────────────
  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999, display: "flex", gap: "12px", alignItems: "flex-end" }}>

      {showCRM && activeCall?.contact && (
        <CRMPopup contact={activeCall.contact} onClose={() => setShowCRM(false)} />
      )}

      {callState === "wrap_up" && (
        <WrapUpPanel
          callId={currentCallId}
          contact={activeCall?.contact}
          duration={duration}
          onDone={handleWrapUpDone}
        />
      )}

      {showTransfer && (
        <TransferModal
          callId={currentCallId || ""}
          accessToken={accessToken}
          twilioSid={twilioCallSid || ""}
          onClose={() => setShowTransfer(false)}
        />
      )}

      <div style={{
        width: "260px", background: "#0f0f1e",
        borderRadius: "16px", overflow: "hidden",
        border: "1px solid #1f2937",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ background: "#1a1a2e", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: currentStatus.color }} />
            <span style={{ color: "#fff", fontSize: "13px", fontWeight: 500 }}>VoxFlow</span>
            {!isConfigured && (
              <span style={{ fontSize: "10px", background: "#854F0B", color: "#fbbf24", padding: "1px 6px", borderRadius: "10px" }}>
                Demo
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowStatus(!showStatus)}
                style={{ background: "none", border: "1px solid #374151", borderRadius: "6px", padding: "2px 8px", cursor: "pointer", color: "#9ca3af", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}
              >
                {currentStatus.label}
                <ChevronDown size={10} />
              </button>
              {showStatus && (
                <div style={{ position: "absolute", bottom: "28px", right: 0, background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", overflow: "hidden", zIndex: 10, minWidth: "130px" }}>
                  {STATUS_CONFIG.map(opt => (
                    <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                      style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "#e5e7eb", fontSize: "12px" }}
                    >
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setMinimized(true)}
              style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <Minimize2 size={14} />
            </button>
          </div>
        </div>

        {/* IDLE — Clavier */}
        {callState === "idle" && (
          <div>
            <div style={{ padding: "10px 12px 6px", background: "#0a0a18" }}>
              <input
                value={dialNumber}
                onChange={e => setDialNumber(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleDial() }}
                placeholder="+1 (514) 000-0000"
                style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: "18px", textAlign: "center", fontFamily: "monospace", letterSpacing: "2px", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: "#1f2937" }}>
              {DIAL_KEYS.map(k => (
                <button key={k} onClick={() => setDialNumber(p => p + k)}
                  style={{ padding: "11px", background: "#1a1a2e", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer" }}
                >{k}</button>
              ))}
            </div>
            <div style={{ padding: "8px 12px", background: "#0a0a18", display: "flex", gap: "6px" }}>
              <button onClick={() => setDialNumber(p => p.slice(0, -1))}
                style={{ background: "#1a1a2e", border: "none", color: "#6b7280", padding: "10px 12px", borderRadius: "8px", cursor: "pointer" }}
              >⌫</button>
              <button onClick={handleDial} disabled={!dialNumber.trim() || !deviceReady}
                style={{ flex: 1, background: "#16a34a", border: "none", color: "#fff", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500, opacity: !dialNumber.trim() ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <Phone size={16} />
                Appeler
              </button>
            </div>
          </div>
        )}

        {/* RINGING IN */}
        {callState === "ringing_in" && activeCall && (
          <div style={{ padding: "16px", textAlign: "center" }}>
            <div style={{ width: "52px", height: "52px", background: "#14532d", borderRadius: "50%", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PhoneIncoming size={24} color="#4ade80" />
            </div>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: "15px", margin: "0 0 2px" }}>
              {activeCall.contact ? activeCall.contact.firstName + " " + activeCall.contact.lastName : activeCall.from}
            </p>
            {activeCall.contact?.company && <p style={{ color: "#9ca3af", fontSize: "12px", margin: "0 0 4px" }}>{activeCall.contact.company}</p>}
            <p style={{ color: "#4ade80", fontSize: "12px", marginBottom: "12px" }}>Appel entrant...</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleRefuse}
                style={{ flex: 1, background: "#dc2626", border: "none", color: "#fff", padding: "12px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <PhoneOff size={16} /> Refuser
              </button>
              <button onClick={handleAnswer}
                style={{ flex: 1, background: "#16a34a", border: "none", color: "#fff", padding: "12px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <Phone size={16} /> Decrocher
              </button>
            </div>
          </div>
        )}

        {/* RINGING OUT */}
        {callState === "ringing_out" && activeCall && (
          <div style={{ padding: "16px", textAlign: "center" }}>
            <div style={{ width: "52px", height: "52px", background: "#1e3a5f", borderRadius: "50%", margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Phone size={24} color="#60a5fa" />
            </div>
            <p style={{ color: "#fff", fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>{activeCall.to}</p>
            <p style={{ color: "#fbbf24", fontSize: "12px", marginBottom: "12px" }}>Appel en cours...</p>
            <button onClick={handleHangup}
              style={{ width: "100%", background: "#dc2626", border: "none", color: "#fff", padding: "12px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <PhoneOff size={16} /> Annuler
            </button>
          </div>
        )}

        {/* IN CALL */}
        {callState === "in_call" && activeCall && (
          <div>
            <div style={{ padding: "12px", background: "#0a0a18", textAlign: "center" }}>
              <div style={{ width: "44px", height: "44px", background: "#1e3a5f", borderRadius: "50%", margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: "16px" }}>
                  {(activeCall.contact?.firstName || activeCall.from || "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <p style={{ color: "#fff", fontWeight: 600, fontSize: "14px", margin: "0 0 2px" }}>
                {activeCall.contact
                  ? activeCall.contact.firstName + " " + activeCall.contact.lastName
                  : activeCall.direction === "INBOUND" ? activeCall.from : activeCall.to}
              </p>
              {activeCall.contact?.company && (
                <p style={{ color: "#6b7280", fontSize: "11px", margin: "0 0 4px" }}>{activeCall.contact.company}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                <Clock size={12} color="#60a5fa" />
                <p style={{ color: "#60a5fa", fontFamily: "monospace", fontSize: "18px", fontWeight: 600, margin: 0 }}>
                  {fmt(duration)}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: "#1f2937" }}>
              {[
                {
                  icon: isMuted ? <MicOff size={14}/> : <Mic size={14}/>,
                  label: isMuted ? "Activer" : "Muet",
                  active: isMuted, color: "#ef4444",
                  onClick: handleMute
                },
                {
                  icon: isOnHold ? <PlayCircle size={14}/> : <PauseCircle size={14}/>,
                  label: isOnHold ? "Reprendre" : "Attente",
                  active: isOnHold, color: "#fbbf24",
                  onClick: handleHold
                },
                {
                  icon: <ArrowRightLeft size={14}/>,
                  label: "Transferer", active: false, color: "#60a5fa",
                  onClick: () => setShowTransfer(true)
                },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick}
                  style={{ padding: "10px 4px", background: btn.active ? btn.color + "22" : "#1a1a2e", border: "none", color: btn.active ? btn.color : "#9ca3af", fontSize: "11px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}
                >
                  {btn.icon}
                  {btn.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "8px 12px", background: "#0a0a18", display: "flex", gap: "6px" }}>
              {activeCall.contact && (
                <button onClick={() => setShowCRM(!showCRM)}
                  style={{ background: "#1e3a5f", border: "none", color: "#60a5fa", padding: "10px 10px", borderRadius: "8px", cursor: "pointer", fontSize: "11px" }}
                >
                  CRM
                </button>
              )}
              <button onClick={handleHangup}
                style={{ flex: 1, background: "#dc2626", border: "none", color: "#fff", padding: "10px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <PhoneOff size={16} /> Raccrocher
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



