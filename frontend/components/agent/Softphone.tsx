"use client"

import { useState, useEffect, useRef } from "react"
import { useCallStore } from "@/store/callStore"
import { useAuthStore } from "@/store/authStore"
import { agentApi } from "@/lib/agentApi"

interface Props {
  onCallStart?: (call: any) => void
  onCallEnd?:   (call: any) => void
}

export default function Softphone({ onCallStart, onCallEnd }: Props) {
  const { accessToken } = useAuthStore()
  const {
    callState, agentStatus, activeCall, isMuted, isOnHold, duration,
    setCallState, setAgentStatus, setActiveCall, setMuted, setOnHold,
    incrementDuration, reset
  } = useCallStore()

  const [dialNumber, setDialNumber] = useState("")
  const [device,     setDevice]     = useState<any>(null)
  const [deviceReady, setDeviceReady] = useState(false)
  const [simulated,  setSimulated]   = useState(false)
  const durationTimer = useRef<any>(null)

  // Initialiser le device Twilio
  useEffect(() => {
    if (!accessToken) return
    initDevice()
    return () => {
      if (durationTimer.current) clearInterval(durationTimer.current)
    }
  }, [accessToken])

  const initDevice = async () => {
    try {
      const res = await agentApi.getToken(accessToken!)
      if (!res.success) return

      if (res.data.simulated) {
        setSimulated(true)
        setDeviceReady(true)
        return
      }

      // Vrai device Twilio WebRTC
      const { Device } = await import("@twilio/voice-sdk")
      const dev = new Device(res.data.token, {
        logLevel: 1,
        codecPreferences: ["opus", "pcmu"] as any,
      })

      dev.on("ready",       () => setDeviceReady(true))
      dev.on("error",       (err: any) => console.error("Twilio error:", err))
      dev.on("disconnect",  () => handleCallEnd())
      dev.on("incoming",    (conn: any) => handleIncomingCall(conn))
      dev.register()
      setDevice(dev)
    } catch (err) {
      console.error("Erreur init device:", err)
      setSimulated(true)
      setDeviceReady(true)
    }
  }

  const handleIncomingCall = (conn: any) => {
    const call: any = {
      id:        "call_" + Date.now(),
      from:      conn.parameters?.From || "Inconnu",
      to:        "Moi",
      direction: "INBOUND",
      startedAt: new Date(),
      duration:  0,
    }
    setActiveCall(call)
    setCallState("ringing")
    if (onCallStart) onCallStart(call)
  }

  const handleCallEnd = () => {
    if (durationTimer.current) clearInterval(durationTimer.current)
    setCallState("wrap_up")
    setTimeout(() => {
      if (onCallEnd) onCallEnd(activeCall)
      reset()
    }, 500)
  }

  const startDurationTimer = () => {
    durationTimer.current = setInterval(() => incrementDuration(), 1000)
  }

  const handleAnswer = () => {
    setCallState("in_call")
    setAgentStatus("ON_CALL")
    startDurationTimer()
  }

  const handleHangup = () => {
    if (durationTimer.current) clearInterval(durationTimer.current)
    if (device && !simulated) {
      device.disconnectAll()
    }
    handleCallEnd()
  }

  const handleDial = async () => {
    if (!dialNumber.trim()) return
    try {
      const res = await agentApi.makeCall(accessToken!, dialNumber)
      if (res.success) {
        const call: any = {
          id:        res.data.call?.id || "out_" + Date.now(),
          from:      "Moi",
          to:        dialNumber,
          direction: "OUTBOUND",
          startedAt: new Date(),
          duration:  0,
        }
        setActiveCall(call)
        setCallState("in_call")
        setAgentStatus("ON_CALL")
        startDurationTimer()
        if (onCallStart) onCallStart(call)
      }
    } catch (err) { console.error(err) }
  }

  const handleMute = () => setMuted(!isMuted)
  const handleHold = () => setOnHold(!isOnHold)

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0")
  }

  const DIAL_KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#"]

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden w-full">

      {/* Header statut */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={"w-2 h-2 rounded-full " + (
            agentStatus === "ONLINE"  ? "bg-green-400" :
            agentStatus === "ON_CALL" ? "bg-blue-400 animate-pulse" :
            agentStatus === "BREAK"   ? "bg-amber-400" : "bg-gray-500"
          )}></div>
          <span className="text-white text-sm font-medium">Softphone VoxFlow</span>
          {simulated && <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full">Demo</span>}
        </div>
        <span className="text-gray-400 text-xs">
          {deviceReady ? "Connecte" : "Connexion..."}
        </span>
      </div>

      <div className="p-4">

        {/* En appel */}
        {(callState === "in_call" || callState === "ringing") && activeCall && (
          <div className="mb-4">
            <div className="bg-gray-800 rounded-xl p-4 text-center mb-3">
              <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <p className="text-white font-medium">
                {activeCall.direction === "INBOUND" ? activeCall.from : activeCall.to}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                {activeCall.direction === "INBOUND" ? "Appel entrant" : "Appel sortant"}
              </p>
              {callState === "in_call" && (
                <p className="text-blue-400 font-mono text-lg mt-2">{formatDuration(duration)}</p>
              )}
              {callState === "ringing" && (
                <p className="text-amber-400 text-sm mt-2 animate-pulse">Sonnerie...</p>
              )}
            </div>

            {/* Controles appel */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={handleMute}
                className={"flex flex-col items-center gap-1 p-3 rounded-xl text-xs transition-colors " + (
                  isMuted ? "bg-red-900 text-red-300" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                )}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={isMuted
                    ? "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                    : "M15.536 8.464a5 5 0 010 7.072M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  }/>
                </svg>
                {isMuted ? "Reactivate" : "Mute"}
              </button>

              <button
                onClick={handleHold}
                className={"flex flex-col items-center gap-1 p-3 rounded-xl text-xs transition-colors " + (
                  isOnHold ? "bg-amber-900 text-amber-300" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                )}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isOnHold ? "Reprendre" : "Attente"}
              </button>

              <button className="flex flex-col items-center gap-1 p-3 rounded-xl text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Transferer
              </button>
            </div>

            <div className="flex gap-2">
              {callState === "ringing" && activeCall.direction === "INBOUND" && (
                <button
                  onClick={handleAnswer}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium text-sm"
                >
                  Decrocher
                </button>
              )}
              <button
                onClick={handleHangup}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-medium text-sm"
              >
                Raccrocher
              </button>
            </div>
          </div>
        )}

        {/* Idle — clavier numerique */}
        {callState === "idle" && (
          <>
            <div className="mb-3">
              <input
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                placeholder="Entrer un numero..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-lg font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {DIAL_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setDialNumber((prev) => prev + key)}
                  className="bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-lg font-medium transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDialNumber((prev) => prev.slice(0, -1))}
                className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-4 py-3 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                </svg>
              </button>
              <button
                onClick={handleDial}
                disabled={!dialNumber.trim() || !deviceReady}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Appeler
              </button>
            </div>
          </>
        )}

        {/* Wrap-up */}
        {callState === "wrap_up" && (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">Appel termine</p>
            <p className="text-gray-500 text-xs mt-1">Ajoutez vos notes avant de continuer</p>
          </div>
        )}
      </div>
    </div>
  )
}
