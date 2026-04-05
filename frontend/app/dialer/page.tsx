"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuthStore } from "@/store/authStore"
import { telephonyApi } from "@/lib/telephonyApi"
import {
  Phone, PhoneOff, PhoneIncoming, Mic, MicOff,
  PauseCircle, PlayCircle, ArrowRightLeft, Users,
  Clock, ChevronDown, History, Voicemail,
  Search, X, User, Volume2, Settings
} from "lucide-react"

const KEYS = [
  ["+",""],["1",""],["2","ABC"],["3","DEF"],
  ["4","GHI"],["5","JKL"],["6","MNO"],
  ["7","PQRS"],["8","TUV"],["9","WXYZ"],
  ["*",""],["0","+"],["#",""],["⌫",""],
]

type Tab = "dialer" | "history" | "voicemails" | "search"
type View = "idle" | "calling" | "incoming" | "wrap"

function fmtTimer(s: number) {
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0")
}

function fmtDate(dt: string) {
  const d = new Date(dt), now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60)    return "A l instant"
  if (diff < 3600)  return Math.floor(diff / 60) + "min"
  if (diff < 86400) return Math.floor(diff / 3600) + "h"
  return d.toLocaleDateString("fr-CA", { day: "2-digit", month: "short" })
}

export default function DialerPage() {
  const { accessToken, user, isAuth } = useAuthStore()
  const [mounted,   setMounted]   = useState(false)
  const [tab,       setTab]       = useState<Tab>("dialer")
  const [view,      setView]      = useState<View>("idle")
  const [dialNum,   setDialNum]   = useState("")
  const [status,    setStatus]    = useState("ONLINE")
  const [isMuted,   setMuted]     = useState(false)
  const [isOnHold,  setOnHold]    = useState(false)
  const [timer,     setTimer]     = useState(0)
  const [callId,    setCallId]    = useState<string|null>(null)
  const [contact,   setContact]   = useState<any>(null)
  const [calls,     setCalls]     = useState<any[]>([])
  const [vms,       setVms]       = useState<any[]>([])
  const [searchQ,   setSearchQ]   = useState("")
  const [searchRes, setSearchRes] = useState<any[]>([])
  const [xferNum,   setXferNum]   = useState("")
  const [showXfer,  setShowXfer]  = useState(false)
  const [notes,     setNotes]     = useState("")
  const [showNotes, setShowNotes] = useState(false)
  const timerRef = useRef<any>(null)

  useEffect(() => {
    setMounted(true)
    // Fermer le menu standard de Chrome pour faire un vrai popup
    if (typeof window !== "undefined") {
      document.title = "VoxFlow Dialer"
    }
  }, [])

  useEffect(() => {
    if (!isAuth || !accessToken) return
    loadData()
  }, [isAuth, accessToken])

  const loadData = useCallback(async () => {
    if (!accessToken) return
    try {
      const [cr, vr] = await Promise.all([
        telephonyApi.getCalls(accessToken, 20),
        fetch("/api/v1/telephony/voicemails", {
          headers: { Authorization: "Bearer " + accessToken }
        }).then(r => r.json()),
      ])
      if (cr.success)  setCalls(cr.data || [])
      if (vr.success)  setVms(vr.data || [])
    } catch {}
  }, [accessToken])

  const startTimer = () => {
    setTimer(0)
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
  }

  const stopTimer = () => {
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  const makeCall = async (to?: string) => {
    const num = to || dialNum.trim()
    if (!num || !accessToken) return
    try {
      const res = await telephonyApi.startCall(accessToken, num)
      if (res.success) {
        setCallId(res.data.call?.id || null)
        setContact(res.data.contact || null)
        setView("calling")
        setMuted(false)
        setOnHold(false)
        setNotes("")
        setShowXfer(false)
        setShowNotes(false)
        startTimer()
      }
    } catch {}
  }

  const hangup = async () => {
    stopTimer()
    if (callId && accessToken) {
      await telephonyApi.endCall(accessToken, callId, timer, notes || undefined)
    }
    setView("wrap")
    setTimeout(() => {
      setView("idle")
      setCallId(null)
      setContact(null)
      setDialNum("")
      loadData()
    }, 2000)
  }

  const toggleMute = async () => {
    const next = !isMuted
    setMuted(next)
    if (callId && accessToken) await telephonyApi.muteCall(accessToken, callId, next)
  }

  const toggleHold = async () => {
    const next = !isOnHold
    setOnHold(next)
    if (callId && accessToken) await telephonyApi.holdCall(accessToken, callId, next)
  }

  const transfer = async () => {
    if (!xferNum || !callId || !accessToken) return
    await telephonyApi.transfer(accessToken, callId, xferNum, "blind")
    hangup()
  }

  const changeStatus = async (s: string) => {
    setStatus(s)
    if (accessToken) await telephonyApi.setStatus(accessToken, s)
  }

  const search = async (q: string) => {
    setSearchQ(q)
    if (!q || q.length < 2 || !accessToken) { setSearchRes([]); return }
    try {
      const res = await fetch("/api/v1/crm/contacts?search=" + encodeURIComponent(q) + "&limit=6", {
        headers: { Authorization: "Bearer " + accessToken }
      }).then(r => r.json())
      if (res.success) setSearchRes(res.data || [])
    } catch {}
  }

  const vmNew = vms.filter(v => v.status === "NEW").length

  if (!mounted) return null

  if (!isAuth) {
    return (
      <div style={{ height:"100vh", background:"#0f0f1e", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center", color:"#6b7280" }}>
          <p style={{ color:"#a78bfa", fontSize:"20px", fontWeight:700, marginBottom:"8px" }}>VoxFlow</p>
          <p style={{ fontSize:"13px" }}>Connectez-vous sur VoxFlow pour utiliser le dialer</p>
          <button
            onClick={() => window.location.href = "/login"}
            style={{ marginTop:"16px", background:"#7c3aed", border:"none", color:"#fff", padding:"8px 20px", borderRadius:"8px", cursor:"pointer" }}
          >
            Se connecter
          </button>
        </div>
      </div>
    )
  }

  const statusColor = status === "ONLINE" ? "#4ade80" : status === "BREAK" ? "#fbbf24" : "#6b7280"
  const initials = contact
    ? (contact.first_name?.[0] || "") + (contact.last_name?.[0] || "")
    : dialNum[0] || "?"

  return (
    <div style={{ height:"100vh", background:"#0f0f1e", display:"flex", flexDirection:"column", maxWidth:"320px", margin:"0 auto", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ background:"#1a1a2e", padding:"8px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #2d2d4e", flexShrink:0 }}>
        <span style={{ color:"#a78bfa", fontWeight:700, fontSize:"14px" }}>VoxFlow</span>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:statusColor }} />
          <select
            value={status}
            onChange={e => changeStatus(e.target.value)}
            style={{ background:"#2d2d4e", border:"1px solid #374151", color:"#e5e7eb", fontSize:"11px", padding:"2px 6px", borderRadius:"4px", cursor:"pointer", outline:"none" }}
          >
            <option value="ONLINE">Disponible</option>
            <option value="BREAK">Pause</option>
            <option value="OFFLINE">Hors ligne</option>
          </select>
        </div>
      </div>

      {/* INCOMING */}
      {view === "incoming" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", textAlign:"center" }}>
          <p style={{ color:"#4ade80", fontSize:"12px", marginBottom:"12px", animation:"pulse 1s infinite" }}>Appel entrant...</p>
          <div style={{ width:"60px", height:"60px", background:"#312e81", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", fontWeight:700, color:"#a78bfa", margin:"0 auto 12px" }}>
            {initials.toUpperCase()}
          </div>
          <p style={{ fontSize:"16px", fontWeight:600, marginBottom:"4px" }}>
            {contact ? contact.first_name + " " + contact.last_name : "Inconnu"}
          </p>
          {contact?.company && <p style={{ color:"#6b7280", fontSize:"12px", marginBottom:"4px" }}>{contact.company}</p>}
          <div style={{ display:"flex", gap:"10px", marginTop:"20px" }}>
            <button onClick={hangup} style={{ flex:1, background:"#dc2626", border:"none", color:"#fff", padding:"12px 20px", borderRadius:"10px", cursor:"pointer", fontSize:"13px", fontWeight:500 }}>
              Refuser
            </button>
            <button onClick={() => { setView("calling"); startTimer() }} style={{ flex:1, background:"#16a34a", border:"none", color:"#fff", padding:"12px 20px", borderRadius:"10px", cursor:"pointer", fontSize:"13px", fontWeight:500 }}>
              Decrocher
            </button>
          </div>
        </div>
      )}

      {/* CALLING */}
      {view === "calling" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"auto" }}>
          {/* Contact */}
          <div style={{ padding:"16px", textAlign:"center", background:"#0a0a18" }}>
            <div style={{ width:"52px", height:"52px", background:"#312e81", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", fontWeight:700, color:"#a78bfa", margin:"0 auto 10px" }}>
              {initials.toUpperCase()}
            </div>
            <p style={{ fontSize:"15px", fontWeight:600 }}>
              {contact ? contact.first_name + " " + contact.last_name : dialNum}
            </p>
            {contact?.company && <p style={{ color:"#6b7280", fontSize:"12px", margin:"2px 0" }}>{contact.company}</p>}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"4px", marginTop:"6px" }}>
              <Clock size={12} color="#60a5fa" />
              <span style={{ color:"#60a5fa", fontFamily:"monospace", fontSize:"20px", fontWeight:600 }}>{fmtTimer(timer)}</span>
            </div>
          </div>

          {/* Boutons */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1px", background:"#374151" }}>
            {[
              { icon:<Mic size={16}/>, label:isMuted?"Activer":"Muet", active:isMuted, color:"#ef4444", onClick:toggleMute },
              { icon:<PauseCircle size={16}/>, label:isOnHold?"Reprendre":"Attente", active:isOnHold, color:"#fbbf24", onClick:toggleHold },
              { icon:<ArrowRightLeft size={16}/>, label:"Transferer", active:showXfer, color:"#60a5fa", onClick:()=>setShowXfer(!showXfer) },
              { icon:<Users size={16}/>, label:"Conference", active:false, color:"#a78bfa", onClick:()=>{} },
              { icon:<Volume2 size={16}/>, label:"Notes", active:showNotes, color:"#4ade80", onClick:()=>setShowNotes(!showNotes) },
              { icon:<Settings size={16}/>, label:"Options", active:false, color:"#6b7280", onClick:()=>{} },
            ].map((b, i) => (
              <button key={i} onClick={b.onClick} style={{
                padding:"10px 4px", background:b.active ? b.color+"22" : "#1a1a2e",
                border:"none", color:b.active ? b.color : "#9ca3af",
                fontSize:"10px", cursor:"pointer",
                display:"flex", flexDirection:"column", alignItems:"center", gap:"3px"
              }}>
                {b.icon}{b.label}
              </button>
            ))}
          </div>

          {/* Raccrocher */}
          <div style={{ padding:"8px 12px" }}>
            <button onClick={hangup} style={{ width:"100%", background:"#dc2626", border:"none", color:"#fff", padding:"10px", borderRadius:"8px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", fontSize:"13px", fontWeight:500 }}>
              <PhoneOff size={16} /> Raccrocher
            </button>
          </div>

          {/* Transfer */}
          {showXfer && (
            <div style={{ padding:"8px 12px", borderTop:"1px solid #1f2937" }}>
              <p style={{ fontSize:"11px", color:"#6b7280", marginBottom:"5px" }}>Transferer vers</p>
              <div style={{ display:"flex", gap:"6px" }}>
                <input value={xferNum} onChange={e => setXferNum(e.target.value)} placeholder="+1 514..."
                  style={{ flex:1, background:"#1f2937", border:"1px solid #374151", borderRadius:"6px", color:"#fff", padding:"7px 10px", fontSize:"13px", outline:"none" }} />
                <button onClick={transfer} style={{ background:"#2563eb", border:"none", color:"#fff", padding:"7px 12px", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>OK</button>
              </div>
            </div>
          )}

          {/* Notes */}
          {showNotes && (
            <div style={{ padding:"8px 12px", borderTop:"1px solid #1f2937" }}>
              <p style={{ fontSize:"11px", color:"#6b7280", marginBottom:"5px" }}>Notes</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Vos notes..."
                style={{ width:"100%", background:"#1f2937", border:"1px solid #374151", borderRadius:"6px", color:"#fff", padding:"8px", fontSize:"12px", resize:"none", outline:"none" }} />
            </div>
          )}

          {/* Caller Insights */}
          {contact && (
            <div style={{ margin:"8px 12px", background:"#1a1a2e", border:"1px solid #2d2d4e", borderRadius:"10px", padding:"10px" }}>
              <p style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", letterSpacing:".06em", marginBottom:"8px", display:"flex", alignItems:"center", gap:"5px" }}>
                <User size={10} /> Caller Insights
              </p>
              {contact.email         && <InsightRow label="Email"      val={contact.email}          />}
              {contact.phone         && <InsightRow label="Tel"        val={contact.phone}          />}
              {contact.pipeline_stage&& <InsightRow label="Pipeline"   val={contact.pipeline_stage} purple />}
              {contact.company       && <InsightRow label="Entreprise" val={contact.company}        />}
              <button onClick={() => window.open("/admin/crm", "_blank")}
                style={{ width:"100%", background:"#2d2d4e", border:"1px solid #374151", color:"#a78bfa", padding:"5px", borderRadius:"6px", fontSize:"11px", cursor:"pointer", marginTop:"6px" }}>
                Voir la fiche complète →
              </button>
            </div>
          )}
        </div>
      )}

      {/* WRAP UP */}
      {view === "wrap" && (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"8px" }}>
          <PhoneOff size={32} color="#4ade80" />
          <p style={{ color:"#4ade80", fontSize:"14px", fontWeight:500 }}>Appel terminé</p>
          <p style={{ color:"#6b7280", fontSize:"12px" }}>Durée : {fmtTimer(timer)}</p>
        </div>
      )}

      {/* IDLE — Tabs + content */}
      {view === "idle" && (
        <>
          {/* Tabs */}
          <div style={{ display:"flex", background:"#111827", borderBottom:"1px solid #2d2d4e", flexShrink:0 }}>
            {([
              { id:"dialer",     label:"Dialer"     },
              { id:"history",    label:"Historique" },
              { id:"voicemails", label:"Messages",  badge:vmNew },
              { id:"search",     label:"Recherche"  },
            ] as {id:Tab, label:string, badge?:number}[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex:1, padding:"7px 4px", background:tab===t.id?"#1f2937":"transparent",
                border:"none", borderBottom:`2px solid ${tab===t.id?"#7c3aed":"transparent"}`,
                color:tab===t.id?"#fff":"#6b7280", fontSize:"10px", cursor:"pointer", position:"relative"
              }}>
                {t.label}
                {t.badge ? <span style={{ position:"absolute", top:"3px", right:"3px", background:"#ef4444", color:"#fff", fontSize:"9px", borderRadius:"50%", width:"13px", height:"13px", display:"flex", alignItems:"center", justifyContent:"center" }}>{t.badge}</span> : null}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex:1, overflow:"auto", padding:"10px" }}>

            {/* DIALER */}
            {tab === "dialer" && (
              <div>
                <input value={dialNum} onChange={e => setDialNum(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") makeCall() }}
                  placeholder="+1 (514) 000-0000"
                  style={{ width:"100%", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#fff", fontSize:"18px", textAlign:"center", fontFamily:"monospace", padding:"9px", letterSpacing:"2px", marginBottom:"8px", outline:"none", boxSizing:"border-box" }}
                />
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1px", background:"#374151", borderRadius:"8px", overflow:"hidden", marginBottom:"8px" }}>
                  {KEYS.map(([k, s], i) => (
                    <button key={i} onClick={() => {
                      if (k === "⌫") setDialNum(p => p.slice(0,-1))
                      else setDialNum(p => p + k)
                    }} style={{ background:"#1a1a2e", border:"none", color:"#e5e7eb", padding:"10px 4px", fontSize:"15px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"1px" }}>
                      <span style={{ color: k==="+"||k==="⌫" ? "#a78bfa" : "#e5e7eb" }}>{k}</span>
                      {s && <span style={{ fontSize:"8px", color:"#6b7280" }}>{s}</span>}
                    </button>
                  ))}
                </div>
                <button onClick={() => makeCall()} disabled={!dialNum.trim()}
                  style={{ width:"100%", background:dialNum?"#16a34a":"#374151", border:"none", color:dialNum?"#fff":"#6b7280", padding:"10px", borderRadius:"8px", cursor:dialNum?"pointer":"not-allowed", fontSize:"13px", fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                  <Phone size={16} /> Appeler
                </button>

                {calls.slice(0,3).length > 0 && (
                  <div style={{ marginTop:"12px" }}>
                    <p style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", letterSpacing:".06em", marginBottom:"7px" }}>Récents</p>
                    {calls.slice(0,3).map(c => {
                      const name = c.contact ? c.contact.first_name+" "+c.contact.last_name : c.direction==="INBOUND"?c.from_number:c.to_number
                      const num  = c.direction==="INBOUND"?c.from_number:c.to_number
                      const col  = c.status==="COMPLETED"?"#4ade80":c.status==="NO_ANSWER"?"#ef4444":"#fbbf24"
                      return (
                        <div key={c.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #1f2937" }}>
                          <div>
                            <p style={{ fontSize:"12px", fontWeight:500 }}>{name}</p>
                            <p style={{ fontSize:"10px", color:col }}>{c.direction==="INBOUND"?"↓":"↑"} {fmtDate(c.started_at)}</p>
                          </div>
                          <button onClick={() => makeCall(num)} style={{ background:"#16a34a22", border:"1px solid #16a34a55", color:"#4ade80", padding:"3px 8px", borderRadius:"5px", fontSize:"10px", cursor:"pointer" }}>
                            Rappeler
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* HISTORY */}
            {tab === "history" && (
              <div>
                {calls.length === 0
                  ? <p style={{ textAlign:"center", color:"#6b7280", padding:"32px 0", fontSize:"13px" }}>Aucun appel</p>
                  : calls.map(c => {
                    const name = c.contact ? c.contact.first_name+" "+c.contact.last_name : c.direction==="INBOUND"?c.from_number:c.to_number
                    const num  = c.direction==="INBOUND"?c.from_number:c.to_number
                    const col  = c.status==="COMPLETED"?"#4ade80":c.status==="NO_ANSWER"?"#ef4444":"#fbbf24"
                    return (
                      <div key={c.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px 0", borderBottom:"1px solid #1f2937" }}>
                        <div style={{ width:"30px", height:"30px", background:"#1f2937", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:col, fontSize:"13px", flexShrink:0 }}>
                          {c.direction==="INBOUND"?"↓":"↑"}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:"12px", fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</p>
                          <p style={{ fontSize:"10px", color:"#6b7280" }}>{fmtDate(c.started_at)}{c.duration?" · "+fmtTimer(c.duration):""}</p>
                          {c.notes && <p style={{ fontSize:"10px", color:"#9ca3af", fontStyle:"italic", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>"{c.notes}"</p>}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                          <button onClick={() => makeCall(num)} style={{ background:"#16a34a22", border:"1px solid #16a34a55", color:"#4ade80", padding:"3px 7px", borderRadius:"5px", fontSize:"10px", cursor:"pointer" }}>Rappeler</button>
                          {c.recording_url && <button onClick={() => new Audio(c.recording_url).play()} style={{ background:"#1e3a5f", border:"1px solid #3b82f644", color:"#60a5fa", padding:"3px 7px", borderRadius:"5px", fontSize:"10px", cursor:"pointer" }}>Ecouter</button>}
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            )}

            {/* VOICEMAILS */}
            {tab === "voicemails" && (
              <div>
                {vms.length === 0
                  ? <p style={{ textAlign:"center", color:"#6b7280", padding:"32px 0", fontSize:"13px" }}>Aucun message vocal</p>
                  : vms.map(vm => (
                    <div key={vm.id} style={{ padding:"8px 0", borderBottom:"1px solid #1f2937" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                        <p style={{ fontSize:"13px", fontWeight:500, display:"flex", alignItems:"center", gap:"5px" }}>
                          {vm.contact ? vm.contact.first_name+" "+vm.contact.last_name : vm.from_number}
                          {vm.status==="NEW" && <span style={{ background:"#4f46e5", color:"#c7d2fe", fontSize:"9px", padding:"1px 5px", borderRadius:"10px" }}>Nouveau</span>}
                        </p>
                        {vm.recording_url && (
                          <button onClick={() => new Audio(vm.recording_url).play()}
                            style={{ background:"#312e81", border:"none", color:"#a78bfa", padding:"3px 8px", borderRadius:"5px", fontSize:"10px", cursor:"pointer" }}>
                            ▶ Ecouter
                          </button>
                        )}
                      </div>
                      {vm.transcription && <p style={{ fontSize:"11px", color:"#9ca3af", fontStyle:"italic", borderLeft:"2px solid #4f46e5", paddingLeft:"7px" }}>"{vm.transcription.substring(0,100)}..."</p>}
                    </div>
                  ))
                }
              </div>
            )}

            {/* SEARCH */}
            {tab === "search" && (
              <div>
                <input value={searchQ} onChange={e => search(e.target.value)} placeholder="Rechercher un contact..."
                  style={{ width:"100%", background:"#1f2937", border:"1px solid #374151", borderRadius:"8px", color:"#fff", fontSize:"13px", padding:"8px 12px", marginBottom:"10px", outline:"none", boxSizing:"border-box" }}
                />
                {searchQ.length < 2
                  ? <p style={{ textAlign:"center", color:"#6b7280", fontSize:"12px", padding:"20px 0" }}>Tapez pour rechercher</p>
                  : searchRes.length === 0
                  ? <p style={{ textAlign:"center", color:"#6b7280", fontSize:"12px", padding:"20px 0" }}>Aucun résultat</p>
                  : searchRes.map(c => (
                    <div key={c.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #1f2937" }}>
                      <div>
                        <p style={{ fontSize:"13px", fontWeight:500 }}>{c.first_name} {c.last_name}</p>
                        {c.company && <p style={{ fontSize:"11px", color:"#6b7280" }}>{c.company}</p>}
                        {c.phone   && <p style={{ fontSize:"11px", color:"#9ca3af" }}>{c.phone}</p>}
                      </div>
                      {c.phone && <button onClick={() => makeCall(c.phone)} style={{ background:"#16a34a22", border:"1px solid #16a34a55", color:"#4ade80", padding:"5px 10px", borderRadius:"6px", fontSize:"11px", cursor:"pointer" }}>Appeler</button>}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f0f1e; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
        button:hover { opacity: .9; }
      `}</style>
    </div>
  )
}

function InsightRow({ label, val, purple }: { label:string, val:string, purple?:boolean }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"#9ca3af", marginBottom:"4px" }}>
      <span>{label}</span>
      <span style={{ color: purple ? "#a78bfa" : "#e5e7eb", fontWeight:500 }}>{val}</span>
    </div>
  )
}

