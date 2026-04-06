"use client"
// ============================================================
//  VoxFlow — frontend/app/agent/dashboard/page.tsx
//  Version LIVE — branché sur useAgentDashboard
//  Remplace les constantes CALLS/QUEUE/VMS/SCRIPTS/CONTACTS
//  par de vraies données depuis l'API backend
// ============================================================
import { useState, useEffect, useRef } from "react"
import { useAgentDashboard } from "@/hooks/useAgentDashboard"
import type { ApiCall, Voicemail, Script, Contact } from "@/hooks/useAgentDashboard"

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg:"#111118", bg2:"#18181f", bg3:"#1f1f2a", bg4:"#27273a",
  line:"#2e2e44", violet:"#7b61ff", mint:"#00d4aa", rose:"#ff4d6d",
  sky:"#38b6ff", amber:"#ffb547", txt:"#eeeef8", tx2:"#9898b8", tx3:"#55557a",
}

// ── Icônes inline (identiques à l'original) ──────────────────
const Ico = {
  phone:     (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 1.18 2 2 0 012.12 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/></svg>,
  phoneOff:  (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.07 9.12 19.79 19.79 0 01.12 0 2 2 0 012.12 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>,
  mic:       (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  micOff:    (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  pause:     (p:any) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  play:      (p:any) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>,
  transfer:  (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>,
  del:       (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>,
  user:      (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  userPlus:  (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
  headphones:(p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>,
  arrowDown: (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  arrowUp:   (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  check:     (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x:         (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  mail:      (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  clock:     (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  voicemail: (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="11.5" r="4.5"/><circle cx="18.5" cy="11.5" r="4.5"/><line x1="5.5" y1="16" x2="18.5" y2="16"/></svg>,
  script:    (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  logout:    (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  queue:     (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  star:      (p:any) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  refresh:   (p:any) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
}

// ── Helpers ───────────────────────────────────────────────────
type Tab = "dashboard" | "historique" | "contacts" | "scripts" | "voicemails"
type AgentStatus = "ONLINE" | "PAUSE" | "OFFLINE"

const fmtDur = (s?: number) => s ? `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}` : "--"
const fmtTimer = (s: number) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`
const fmtDate = (d: string) => {
  const dt = new Date(d), now = new Date()
  return dt.toDateString() === now.toDateString()
    ? `Aujourd'hui ${dt.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"})}`
    : `Hier ${dt.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"})}`
}
const fmtSec = (s: number) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}`
const sColor = (s: string) => ({COMPLETED:C.mint,NO_ANSWER:C.rose,MISSED:C.rose,IN_PROGRESS:C.amber,FAILED:C.rose,CANCELLED:C.tx3}[s] || C.tx3)
const sLabel = (s: string) => ({COMPLETED:"Terminé",NO_ANSWER:"Manqué",MISSED:"Manqué",IN_PROGRESS:"En cours",FAILED:"Échoué",CANCELLED:"Annulé"}[s] || s)
const contactName = (c: ApiCall) => {
  if (c.contact) return `${c.contact.first_name || ""} ${c.contact.last_name || ""}`.trim() || c.from_number
  return c.direction === "INBOUND" ? c.from_number : c.to_number
}
const vmName = (v: Voicemail) => v.contact ? `${v.contact.first_name || ""} ${v.contact.last_name || ""}`.trim() || v.from_number : v.from_number

// ── Composant principal ───────────────────────────────────────
export default function AgentDashboard() {
  // ── API live via le hook ───────────────────────────────────
  const {
    calls, queue, voicemails, scripts, contacts,
    stats, goals, loading, lastRefresh,
    refresh, markVoicemailListened, saveContactToApi, updateAgentStatus,
  } = useAgentDashboard()

  // ── État UI ────────────────────────────────────────────────
  const [tab,             setTab]             = useState<Tab>("dashboard")
  const [agentStatus,     setAgentStatus]     = useState<AgentStatus>("ONLINE")
  const [showDialer,      setShowDialer]      = useState(true)
  const [showStatusMenu,  setShowStatusMenu]  = useState(false)
  const [showAudioModal,  setShowAudioModal]  = useState(false)
  const [showContactModal,setShowContactModal]= useState(false)
  const [dialInput,       setDialInput]       = useState("")
  const [callActive,      setCallActive]      = useState(false)
  const [callTimer,       setCallTimer]       = useState(0)
  const [callContact,     setCallContact]     = useState("")
  const [incomingCall,    setIncomingCall]    = useState<{from:string;name?:string}|null>(null)
  const [isMuted,         setIsMuted]         = useState(false)
  const [isHold,          setIsHold]          = useState(false)
  const [callNotes,       setCallNotes]       = useState("")
  const [showWrapUp,      setShowWrapUp]      = useState(false)
  const [wrapRating,      setWrapRating]      = useState(0)
  const [wrapTag,         setWrapTag]         = useState("")
  const [activeScript,    setActiveScript]    = useState<Script|null>(null)
  const [contactSearch,   setContactSearch]   = useState("")
  const [contactForm,     setContactForm]     = useState({first_name:"",last_name:"",phone:"",email:"",company:"",notes:""})
  const [contactSaved,    setContactSaved]    = useState(false)
  const [audioDevices,    setAudioDevices]    = useState<{id:string;label:string;kind:string}[]>([])
  const [audioIn,         setAudioIn]         = useState("default")
  const [audioOut,        setAudioOut]        = useState("default")
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const token     = typeof window !== "undefined" ? localStorage.getItem("vf_tok") || "" : ""
  const agentName = typeof window !== "undefined" ? localStorage.getItem("vf_name") || "Agent" : "Agent"
  const agentExt  = typeof window !== "undefined" ? localStorage.getItem("vf_ext")  || "—"    : "—"
  const unreadVm  = voicemails.filter(v => v.status === "NEW").length

  // ── Écoute devices audio ───────────────────────────────────
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(d =>
      setAudioDevices(d.filter(x => x.kind==="audioinput"||x.kind==="audiooutput").map(x => ({id:x.deviceId,label:x.label||x.kind,kind:x.kind})))
    ).catch(() => {})
  }, [])

  // ── Raccourci clavier Maj+D ────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "D") { e.preventDefault(); window.location.href = "voxflow://open" }
      if (e.key === "Escape") { setShowAudioModal(false); setShowContactModal(false); setShowStatusMenu(false) }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  // ── Timer appel ────────────────────────────────────────────
  useEffect(() => {
    if (callActive) { timerRef.current = setInterval(() => setCallTimer(t => t+1), 1000) }
    else { if (timerRef.current) clearInterval(timerRef.current); setCallTimer(0) }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [callActive])

  // ── Notifier le dashboard depuis cet onglet après un appel ─
  const notifyDialer = (type: string, extra: any = {}) => {
    try {
      const bc = new BroadcastChannel("voxflow_calls")
      bc.postMessage({ type, ...extra })
      bc.close()
    } catch {}
  }

  // ── Actions appel ──────────────────────────────────────────
  const simIncoming = () => {
    const names = ["Marie Tremblay","Robert Martin","Sophie Côté","Jean Gagnon"]
    setIncomingCall({ from: "+1 (514) 555-"+Math.floor(1000+Math.random()*9000), name: names[Math.floor(Math.random()*names.length)] })
  }

  const doCall = (num?: string) => {
    const t = num || dialInput; if (!t) return
    setCallContact(t); setCallActive(true); setDialInput(""); setCallNotes(""); setIsMuted(false); setIsHold(false); setShowWrapUp(false)
    notifyDialer("CALL_STARTED", { to: t })
  }

  const doHangup = () => {
    setCallActive(false); setIncomingCall(null); setShowWrapUp(true)
    notifyDialer("CALL_ENDED", { duration: callTimer })
    setTimeout(refresh, 1000)
  }

  const doAnswer = () => {
    if (!incomingCall) return
    setContactForm(f => ({...f, phone: incomingCall.from}))
    setCallContact(incomingCall.name || incomingCall.from); setCallActive(true); setIncomingCall(null)
  }

  const doWrapSave = () => {
    setShowWrapUp(false); setWrapRating(0); setWrapTag(""); setCallNotes(""); setActiveScript(null)
    refresh()
  }

  const doSaveContact = async () => {
    const ok = await saveContactToApi(contactForm)
    if (ok) {
      setContactSaved(true)
      setTimeout(() => { setShowContactModal(false); setContactSaved(false); setContactForm({first_name:"",last_name:"",phone:"",email:"",company:"",notes:""}) }, 1500)
    }
  }

  const handleStatusChange = (v: AgentStatus) => {
    setAgentStatus(v); setShowStatusMenu(false)
    updateAgentStatus(v === "ONLINE" ? "ONLINE" : v === "PAUSE" ? "BREAK" : "OFFLINE")
  }

  // ── Filtres ────────────────────────────────────────────────
  const filteredContacts = (Array.isArray(contacts) ? contacts : []).filter(c =>
    [c.first_name, c.last_name, c.phone, c.email, c.company].some(f => f?.toLowerCase().includes(contactSearch.toLowerCase()))
  )

  const statusOpts = [{v:"ONLINE",l:"Disponible",c:C.mint},{v:"PAUSE",l:"En pause",c:C.amber},{v:"OFFLINE",l:"Hors ligne",c:C.tx3}] as const
  const curSt = statusOpts.find(s => s.v === agentStatus) || statusOpts[0]

  // ── Goals calculés ─────────────────────────────────────────
  const callPct   = Math.min(100, goals.daily_calls_target ? Math.round(stats.calls_total / goals.daily_calls_target * 100) : 0)
  const answerRate = stats.calls_total > 0 ? Math.round(stats.calls_answered / stats.calls_total * 100) : 0
  const answerPct  = Math.min(100, goals.daily_answer_rate ? Math.round(answerRate / goals.daily_answer_rate * 100) : 0)
  const talkPct    = Math.min(100, goals.daily_talk_time ? Math.round(stats.talk_seconds / goals.daily_talk_time * 100) : 0)

  // ╔══════════════════════════════════════════════════════════╗
  // ║  DIALER PANEL (identique à l'original)                  ║
  // ╚══════════════════════════════════════════════════════════╝
  const DialerPanel = () => (
    <div style={{width:240,minWidth:240,background:C.bg2,borderRight:`1px solid ${C.line}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
      <div style={{padding:"9px 12px",borderBottom:`1px solid ${C.line}`,background:C.bg3,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:10,fontWeight:800,color:C.tx3,textTransform:"uppercase" as const,letterSpacing:"0.1em"}}>
          {callActive?"En communication":incomingCall?"Appel entrant":"Composer"}
        </span>
        <button onClick={()=>setShowAudioModal(true)} style={{background:"none",border:`1px solid ${C.line}`,borderRadius:6,color:C.tx3,cursor:"pointer",padding:"2px 6px",display:"flex",alignItems:"center"}}>
          <Ico.headphones width={11} height={11}/>
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"10px"}}>
        {/* Appel entrant */}
        {incomingCall && !callActive && (
          <div style={{background:"#0d1f0d",border:`1px solid ${C.mint}44`,borderRadius:12,padding:14,textAlign:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginBottom:8}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:C.mint,animation:"pulse 1s infinite"}}/>
              <span style={{fontSize:9,fontWeight:800,color:C.mint,textTransform:"uppercase" as const,letterSpacing:"0.12em"}}>Appel entrant</span>
            </div>
            <div style={{width:44,height:44,borderRadius:"50%",background:`${C.violet}22`,border:`2px solid ${C.violet}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",fontSize:16,fontWeight:700,color:C.violet}}>
              {(incomingCall.name||incomingCall.from).charAt(0).toUpperCase()}
            </div>
            <div style={{fontSize:13,fontWeight:700,color:C.txt,marginBottom:2}}>{incomingCall.name||"Inconnu"}</div>
            <div style={{fontSize:11,color:C.tx3,fontFamily:"monospace",marginBottom:10}}>{incomingCall.from}</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setIncomingCall(null)} style={{flex:1,background:`${C.rose}22`,border:`1px solid ${C.rose}44`,color:C.rose,borderRadius:8,padding:"8px 0",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontSize:11,fontWeight:700}}>
                <Ico.x width={12} height={12}/> Refuser
              </button>
              <button onClick={doAnswer} style={{flex:1,background:C.mint,border:"none",color:"#001a14",borderRadius:8,padding:"8px 0",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontSize:11,fontWeight:700}}>
                <Ico.phone width={12} height={12}/> Décrocher
              </button>
            </div>
          </div>
        )}

        {/* En appel */}
        {callActive && (
          <div style={{background:"#0d0d1e",border:`1px solid ${C.violet}33`,borderRadius:12,padding:12,marginBottom:10}}>
            <div style={{textAlign:"center",marginBottom:10}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:`${C.violet}22`,border:`2px solid ${C.violet}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 6px",fontSize:16,fontWeight:700,color:C.violet}}>
                {callContact.charAt(0).toUpperCase()}
              </div>
              <div style={{fontSize:12,fontWeight:700,color:C.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{callContact}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:C.sky,letterSpacing:3,marginTop:4}}>{fmtTimer(callTimer)}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:C.line,borderRadius:8,overflow:"hidden",marginBottom:8}}>
              {[
                {label:"Muet",ico:isMuted?<Ico.micOff width={15} height={15}/>:<Ico.mic width={15} height={15}/>,active:isMuted,color:C.rose,onClick:()=>setIsMuted(m=>!m)},
                {label:"Attente",ico:isHold?<Ico.play width={15} height={15}/>:<Ico.pause width={15} height={15}/>,active:isHold,color:C.amber,onClick:()=>setIsHold(h=>!h)},
                {label:"Transfert",ico:<Ico.transfer width={15} height={15}/>,active:false,color:C.violet,onClick:()=>{}},
              ].map(btn=>(
                <button key={btn.label} onClick={btn.onClick} style={{background:btn.active?`${btn.color}22`:C.bg3,border:"none",color:btn.active?btn.color:C.tx2,padding:"10px 4px",fontSize:9,fontWeight:700,textTransform:"uppercase" as const,cursor:"pointer",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:3,fontFamily:"inherit",letterSpacing:"0.06em"}}>
                  {btn.ico}{btn.label}
                </button>
              ))}
            </div>
            <textarea value={callNotes} onChange={e=>setCallNotes(e.target.value)} placeholder="Notes d'appel..."
              style={{width:"100%",background:C.bg3,border:`1px solid ${C.line}`,borderRadius:6,color:C.txt,fontSize:10,padding:"6px 8px",resize:"none",height:48,boxSizing:"border-box" as const,fontFamily:"inherit",outline:"none",marginBottom:6}}/>
            <button onClick={()=>{setContactForm(f=>({...f,phone:callContact}));setShowContactModal(true)}}
              style={{width:"100%",background:`${C.violet}18`,border:`1px solid ${C.violet}33`,color:C.violet,borderRadius:6,padding:"5px 0",fontSize:10,cursor:"pointer",fontWeight:600,marginBottom:5,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <Ico.userPlus width={11} height={11}/> Créer fiche contact
            </button>
            <button onClick={doHangup} style={{width:"100%",background:C.rose,border:"none",color:"#fff",borderRadius:8,padding:"9px 0",fontSize:12,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Ico.phoneOff width={14} height={14}/> Raccrocher
            </button>
          </div>
        )}

        {/* Wrap-up */}
        {showWrapUp && !callActive && !incomingCall && (
          <div style={{background:"#1a140a",border:`1px solid ${C.amber}33`,borderRadius:12,padding:14,marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:800,color:C.amber,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
              <Ico.check width={12} height={12}/> Wrap-up
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:4,marginBottom:10}}>
              {[1,2,3,4,5].map(n=>(
                <span key={n} onClick={()=>setWrapRating(n)} style={{cursor:"pointer"}}>
                  <Ico.star width={20} height={20} style={{color:n<=wrapRating?C.amber:C.tx3}}/>
                </span>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:10}}>
              {["Résolu","Rappel","Vente","Escalade"].map(t=>(
                <button key={t} onClick={()=>setWrapTag(t)} style={{background:wrapTag===t?`${C.violet}33`:C.bg3,color:wrapTag===t?C.violet:C.tx2,border:`1px solid ${wrapTag===t?C.violet:C.line}`,borderRadius:6,padding:"6px 0",fontSize:11,cursor:"pointer",fontWeight:600}}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={doWrapSave} style={{width:"100%",background:C.violet,border:"none",color:"#fff",borderRadius:8,padding:"9px 0",fontSize:12,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <Ico.check width={13} height={13}/> Terminer
            </button>
          </div>
        )}

        {/* Clavier idle */}
        {!callActive && !incomingCall && !showWrapUp && (
          <div>
            <div style={{background:"#0d1a0d",border:"1px solid #1a3a1a",borderRadius:8,padding:"7px 10px",marginBottom:10}}>
              <div style={{fontSize:9,color:"#3a8a3a",fontWeight:800,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:5}}>Mode simulation</div>
              <button onClick={simIncoming} style={{width:"100%",background:"#1a3a1a",color:"#4aff4a",border:"none",borderRadius:6,padding:"6px 0",fontSize:11,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                <Ico.phone width={11} height={11}/> Simuler appel entrant
              </button>
            </div>
            <div style={{position:"relative" as const,marginBottom:8}}>
              <input value={dialInput} onChange={e=>setDialInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doCall()}}
                placeholder="+1 (514) 000-0000"
                style={{width:"100%",background:C.bg3,border:`1px solid ${C.line}`,borderRadius:8,color:C.txt,fontSize:17,textAlign:"center",padding:"9px 36px 9px 12px",fontFamily:"'JetBrains Mono',monospace",outline:"none",letterSpacing:2,boxSizing:"border-box" as const}}/>
              {dialInput && (
                <button onClick={()=>setDialInput(p=>p.slice(0,-1))} style={{position:"absolute" as const,right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.tx3,cursor:"pointer",padding:2}}>
                  <Ico.del width={15} height={15}/>
                </button>
              )}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:C.line,borderRadius:10,overflow:"hidden",marginBottom:8}}>
              {[{k:"1",s:""},{k:"2",s:"ABC"},{k:"3",s:"DEF"},{k:"4",s:"GHI"},{k:"5",s:"JKL"},{k:"6",s:"MNO"},{k:"7",s:"PQRS"},{k:"8",s:"TUV"},{k:"9",s:"WXYZ"},{k:"*",s:""},{k:"0",s:"+"},{k:"#",s:""}].map(({k,s})=>(
                <button key={k} onClick={()=>setDialInput(p=>p+k)}
                  style={{background:C.bg3,border:"none",color:k==="*"||k==="#"?C.violet:C.txt,padding:"11px 4px",fontSize:16,cursor:"pointer",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:1,fontFamily:"inherit",fontWeight:600}}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.bg4)}
                  onMouseLeave={e=>(e.currentTarget.style.background=C.bg3)}>
                  {k}{s && <span style={{fontSize:7,color:C.tx3,letterSpacing:"0.1em"}}>{s}</span>}
                </button>
              ))}
            </div>
            <button onClick={()=>doCall()} disabled={!dialInput}
              style={{width:"100%",background:dialInput?C.mint:"#1a2a1a",border:"none",color:dialInput?"#001a14":C.tx3,borderRadius:10,padding:"11px 0",fontSize:13,cursor:dialInput?"pointer":"default",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7,boxShadow:dialInput?`0 4px 20px ${C.mint}33`:"none"}}>
              <Ico.phone width={14} height={14}/> Appeler
            </button>
          </div>
        )}

        {/* Récents — données LIVE */}
        {!callActive && !incomingCall && (Array.isArray(calls) ? calls : []).length > 0 && (
          <div style={{marginTop:12}}>
            <div style={{fontSize:9,fontWeight:800,color:C.tx3,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
              <Ico.clock width={10} height={10}/> Récents <div style={{flex:1,height:1,background:C.line}}/>
            </div>
            {(Array.isArray(calls) ? calls : []).slice(0,3).map(c=>(
              <div key={c.id} onClick={()=>doCall(c.direction==="INBOUND"?c.from_number:c.to_number)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"6px 4px",borderRadius:6,cursor:"pointer",marginBottom:2}}
                onMouseEnter={e=>(e.currentTarget.style.background=C.bg3)}
                onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                <span style={{color:sColor(c.status)}}>{c.direction==="INBOUND"?<Ico.arrowDown width={12} height={12}/>:<Ico.arrowUp width={12} height={12}/>}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:C.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{contactName(c)}</div>
                  <div style={{fontSize:9,color:C.tx3}}>{fmtDur(c.duration)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ╔══════════════════════════════════════════════════════════╗
  // ║  RENDER PRINCIPAL                                       ║
  // ╚══════════════════════════════════════════════════════════╝
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,color:C.txt,fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav style={{display:"flex",alignItems:"center",gap:2,padding:"0 14px",height:46,borderBottom:`1px solid ${C.line}`,background:C.bg2,flexShrink:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginRight:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.violet,boxShadow:`0 0 8px ${C.violet}`}}/>
          <span style={{fontWeight:900,fontSize:16}}><span style={{color:C.violet}}>Vox</span><span style={{color:C.mint}}>Flow</span></span>
          <span style={{background:`${C.sky}18`,color:C.sky,fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:4,letterSpacing:"0.08em",border:`1px solid ${C.sky}33`}}>AGENT</span>
        </div>

        {([
          {id:"dashboard",  l:"Dashboard",  ico:<Ico.queue    width={12} height={12}/>},
          {id:"historique", l:"Historique", ico:<Ico.clock    width={12} height={12}/>, b:(Array.isArray(calls) ? calls : []).length},
          {id:"contacts",   l:"Contacts",   ico:<Ico.user     width={12} height={12}/>, b:contacts.length},
          {id:"scripts",    l:"Scripts",    ico:<Ico.script   width={12} height={12}/>, b:(Array.isArray(scripts) ? scripts : []).length},
        ] as any[]).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:tab===t.id?`${C.violet}18`:"none",color:tab===t.id?C.violet:C.tx2,border:"none",borderBottom:tab===t.id?`2px solid ${C.violet}`:"2px solid transparent",borderTop:"2px solid transparent",padding:"0 12px",height:"100%",fontSize:12,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5,fontFamily:"inherit"}}>
            {t.ico}{t.l}
            {t.b !== undefined && <span style={{background:C.bg4,color:C.tx2,fontSize:9,fontWeight:800,borderRadius:10,padding:"1px 5px"}}>{t.b}</span>}
          </button>
        ))}

        <button onClick={()=>setTab("voicemails")}
          style={{background:tab==="voicemails"?`${C.amber}18`:"none",color:tab==="voicemails"?C.amber:C.tx2,border:"none",borderBottom:tab==="voicemails"?`2px solid ${C.amber}`:"2px solid transparent",borderTop:"2px solid transparent",padding:"0 12px",height:"100%",fontSize:12,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5,fontFamily:"inherit"}}>
          <Ico.voicemail width={12} height={12}/> Voicemails
          {unreadVm > 0 && <span style={{background:C.rose,color:"#fff",fontSize:9,fontWeight:800,borderRadius:10,padding:"1px 5px"}}>{unreadVm}</span>}
        </button>

        <div style={{flex:1}}/>

        {/* Indicateur de refresh */}
        {lastRefresh && (
          <button onClick={refresh} title="Rafraîchir" style={{background:"none",border:"none",color:C.tx3,cursor:"pointer",padding:"4px 6px",display:"flex",alignItems:"center",gap:4,fontSize:10}}>
            <Ico.refresh width={11} height={11}/>
            <span style={{fontFamily:"monospace"}}>{lastRefresh.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"})}</span>
          </button>
        )}

        <button onClick={()=>setShowAudioModal(true)} style={{background:"none",border:`1px solid ${C.line}`,borderRadius:7,color:C.tx2,cursor:"pointer",padding:"5px 10px",display:"flex",alignItems:"center",gap:5,fontSize:11,marginRight:4}}>
          <Ico.headphones width={13} height={13}/> Audio
        </button>

        <button onClick={()=>setShowDialer(s=>!s)} title="Dialer (Maj+D)"
          style={{background:showDialer?`${C.violet}22`:"none",border:`1px solid ${showDialer?C.violet:C.line}`,borderRadius:7,color:showDialer?C.violet:C.tx2,cursor:"pointer",padding:"5px 10px",display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,marginRight:8}}>
          <Ico.phone width={13} height={13}/> Dialer <span style={{fontSize:9,color:C.tx3}}>⇧D</span>
        </button>

        <div style={{position:"relative" as const}}>
          <button onClick={()=>setShowStatusMenu(s=>!s)}
            style={{display:"flex",alignItems:"center",gap:6,background:`${curSt.c}18`,border:`1px solid ${curSt.c}44`,borderRadius:20,padding:"4px 10px 4px 8px",cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:curSt.c,boxShadow:`0 0 5px ${curSt.c}`}}/>
            <span style={{fontSize:11,fontWeight:600,color:C.txt}}>{curSt.l}</span>
          </button>
          {showStatusMenu && (
            <div style={{position:"absolute" as const,right:0,top:36,background:C.bg3,border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,.7)",zIndex:200,minWidth:130}}>
              {statusOpts.map(o=>(
                <button key={o.v} onClick={()=>handleStatusChange(o.v as AgentStatus)}
                  style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 14px",background:"none",border:"none",color:C.txt,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.bg4)}
                  onMouseLeave={e=>(e.currentTarget.style.background="none")}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:o.c}}/>{o.l}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:7,marginLeft:8,padding:"3px 10px",background:C.bg3,borderRadius:8,border:`1px solid ${C.line}`}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:`${C.violet}33`,border:`2px solid ${C.violet}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.violet}}>
            {agentName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:C.txt}}>{agentName}</div>
            <div style={{fontSize:9,color:C.tx3,fontFamily:"monospace"}}>EXT {agentExt}</div>
          </div>
        </div>
        <button onClick={()=>{localStorage.clear();window.location.href="/login"}} style={{background:"none",border:"none",color:C.tx3,cursor:"pointer",padding:"5px 8px",borderRadius:6,marginLeft:4}}>
          <Ico.logout width={15} height={15}/>
        </button>
      </nav>

      {/* ── BODY ────────────────────────────────────────────── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {showDialer && <DialerPanel/>}

        <main style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

          {/* Loading skeleton */}
          {loading && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:C.tx3,gap:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.violet,animation:"pulse 1s infinite"}}/>
              Chargement des données…
            </div>
          )}

          {/* ── DASHBOARD ─────────────────────────────────── */}
          {!loading && tab==="dashboard" && (
            <div>
              <h1 style={{fontSize:20,fontWeight:900,marginBottom:18}}>Tableau de bord</h1>

              {/* Goals — données LIVE */}
              <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"14px 18px",marginBottom:18}}>
                <div style={{fontSize:10,fontWeight:800,color:C.tx3,textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                  Objectifs du jour <div style={{flex:1,height:1,background:C.line}}/>
                  <span style={{fontSize:10,color:C.tx2,textTransform:"none" as const,fontWeight:500}}>
                    {new Date().toLocaleDateString("fr-CA",{weekday:"long",day:"numeric",month:"long"})}
                  </span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                  {[
                    {l:"Appels",       v:`${stats.calls_total} / ${goals.daily_calls_target}`,   p:callPct,   c:C.violet},
                    {l:"Taux réponse", v:`${answerRate}% / ${goals.daily_answer_rate}%`,          p:answerPct, c:C.mint},
                    {l:"Temps de parole",v:`${fmtSec(stats.talk_seconds)} / ${fmtSec(goals.daily_talk_time)}`, p:talkPct, c:C.sky},
                  ].map(b=>(
                    <div key={b.l}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:11,color:C.tx2,fontWeight:600}}>{b.l}</span>
                        <span style={{fontSize:11,fontWeight:700,color:b.c,fontFamily:"monospace"}}>{b.v}</span>
                      </div>
                      <div style={{height:5,background:C.bg4,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${b.p}%`,background:b.c,borderRadius:3,boxShadow:`0 0 8px ${b.c}55`,transition:"width .6s ease"}}/>
                      </div>
                      <div style={{fontSize:9,color:b.p>=100?b.c:C.tx3,marginTop:3,textAlign:"right" as const}}>
                        {b.p>=100?"✓ Objectif atteint":`${b.p}% complété`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPIs — données LIVE */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
                {[
                  {l:"Appels aujourd'hui",  v:stats.calls_total,                          c:C.violet},
                  {l:"Répondus",            v:stats.calls_answered,                       c:C.mint},
                  {l:"Durée moyenne",       v:fmtDur(stats.avg_duration),                 c:C.sky},
                  {l:"Talk time",           v:fmtSec(stats.talk_seconds),                 c:C.amber},
                ].map(s=>(
                  <div key={s.l} style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:10,color:C.tx3,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:6}}>{s.l}</div>
                    <div style={{fontSize:24,fontWeight:900,color:s.c,fontFamily:"'JetBrains Mono',monospace"}}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Queue + Script actif */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
                <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <span style={{fontSize:12,fontWeight:800,color:C.txt,display:"flex",alignItems:"center",gap:6}}>
                      <Ico.queue width={13} height={13} style={{color:C.violet}}/> File d'attente
                    </span>
                    <span style={{background:`${(Array.isArray(queue) ? queue : []).length?C.rose:C.mint}18`,color:(Array.isArray(queue) ? queue : []).length?C.rose:C.mint,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 8px"}}>
                      {(Array.isArray(queue) ? queue : []).length ? `${(Array.isArray(queue) ? queue : []).length} en attente` : "Vide"}
                    </span>
                  </div>
                  {(Array.isArray(queue) ? queue : []).length === 0 && (
                    <div style={{color:C.tx3,fontSize:12,textAlign:"center" as const,padding:"16px 0"}}>Aucun appel en attente</div>
                  )}
                  {(Array.isArray(queue) ? queue : []).map(q=>(
                    <div key={q.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${C.line}`}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:q.priority===1?C.rose:q.priority===2?C.amber:C.tx3}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:C.txt,fontWeight:600}}>{q.caller_name||q.from_number}</div>
                        {q.caller_name && <div style={{fontSize:10,color:C.tx3}}>{q.from_number}</div>}
                      </div>
                      <span style={{fontSize:10,color:C.tx3,fontFamily:"monospace"}}>{fmtDur(q.wait_seconds)}</span>
                      <button onClick={()=>doCall(q.from_number)} style={{background:`${C.mint}18`,color:C.mint,border:`1px solid ${C.mint}33`,borderRadius:5,padding:"3px 8px",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                        <Ico.phone width={10} height={10}/> Décrocher
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"14px 16px"}}>
                  <div style={{fontSize:12,fontWeight:800,color:C.txt,marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                    <Ico.script width={13} height={13} style={{color:C.mint}}/>{activeScript?activeScript.name:"Script actif"}
                  </div>
                  {activeScript ? (
                    <div>
                      <div style={{fontSize:12,color:C.tx2,lineHeight:1.65,background:C.bg3,borderRadius:8,padding:10,marginBottom:8}}>{activeScript.content}</div>
                      <button onClick={()=>setActiveScript(null)} style={{background:"none",border:`1px solid ${C.line}`,color:C.tx3,borderRadius:6,padding:"4px 10px",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                        <Ico.x width={10} height={10}/> Fermer
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{color:C.tx3,fontSize:12,marginBottom:10}}>Aucun script sélectionné</div>
                      {(Array.isArray(scripts) ? scripts : []).slice(0,2).map(s=>(
                        <div key={s.id} onClick={()=>setActiveScript(s)}
                          style={{padding:"8px 10px",background:C.bg3,borderRadius:8,marginBottom:6,cursor:"pointer",border:`1px solid ${C.line}`}}
                          onMouseEnter={e=>(e.currentTarget.style.borderColor=C.violet)}
                          onMouseLeave={e=>(e.currentTarget.style.borderColor=C.line)}>
                          <div style={{fontSize:12,fontWeight:700,color:C.txt}}>{s.name}</div>
                        </div>
                      ))}
                      {(Array.isArray(scripts) ? scripts : []).length === 0 && <div style={{color:C.tx3,fontSize:11}}>Aucun script disponible</div>}
                    </div>
                  )}
                </div>
              </div>

              {/* Derniers appels — données LIVE */}
              <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"14px 16px"}}>
                <div style={{fontSize:12,fontWeight:800,color:C.txt,marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
                  <Ico.clock width={13} height={13} style={{color:C.sky}}/> Derniers appels
                </div>
                {(Array.isArray(calls) ? calls : []).length === 0 && <div style={{color:C.tx3,fontSize:12,textAlign:"center" as const,padding:"16px 0"}}>Aucun appel enregistré</div>}
                {(Array.isArray(calls) ? calls : []).slice(0,5).map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:`1px solid ${C.line}`}}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:`${sColor(c.status)}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:sColor(c.status)}}>
                      {c.direction==="INBOUND"?<Ico.arrowDown width={13} height={13}/>:<Ico.arrowUp width={13} height={13}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{contactName(c)}</div>
                      {c.contact && <div style={{fontSize:10,color:C.tx3}}>{c.from_number}</div>}
                    </div>
                    <span style={{fontSize:10,color:sColor(c.status),fontWeight:600,background:`${sColor(c.status)}14`,padding:"2px 7px",borderRadius:5}}>{sLabel(c.status)}</span>
                    <span style={{fontSize:11,color:C.tx3,fontFamily:"monospace",minWidth:32,textAlign:"right" as const}}>{fmtDur(c.duration)}</span>
                    <span style={{fontSize:10,color:C.tx3,minWidth:90,textAlign:"right" as const}}>{fmtDate(c.started_at)}</span>
                    <button onClick={()=>doCall(c.direction==="INBOUND"?c.from_number:c.to_number)} style={{background:`${C.sky}18`,color:C.sky,border:`1px solid ${C.sky}33`,borderRadius:6,padding:"4px 9px",fontSize:10,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                      <Ico.phone width={10} height={10}/> Rappeler
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── HISTORIQUE — données LIVE ────────────────── */}
          {!loading && tab==="historique" && (
            <div>
              <h1 style={{fontSize:20,fontWeight:900,marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
                <Ico.clock width={18} height={18} style={{color:C.sky}}/> Historique
                <span style={{fontSize:13,color:C.tx3,fontWeight:500}}>({(Array.isArray(calls) ? calls : []).length} appels)</span>
              </h1>
              <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"8px 16px"}}>
                {(Array.isArray(calls) ? calls : []).length === 0 && <div style={{color:C.tx3,fontSize:12,textAlign:"center" as const,padding:"24px 0"}}>Aucun appel dans l'historique</div>}
                {(Array.isArray(calls) ? calls : []).map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:`1px solid ${C.line}`}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:`${sColor(c.status)}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:sColor(c.status)}}>
                      {c.direction==="INBOUND"?<Ico.arrowDown width={14} height={14}/>:<Ico.arrowUp width={14} height={14}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{contactName(c)}</div>
                      {c.contact && <div style={{fontSize:11,color:C.tx3}}>{c.from_number}</div>}
                      {c.notes && <div style={{fontSize:10,color:C.tx3,fontStyle:"italic",marginTop:2}}>{c.notes}</div>}
                    </div>
                    <span style={{fontSize:11,color:sColor(c.status),fontWeight:700}}>{sLabel(c.status)}</span>
                    <span style={{fontSize:11,color:C.tx3,fontFamily:"monospace"}}>{fmtDur(c.duration)}</span>
                    <span style={{fontSize:11,color:C.tx3,minWidth:110,textAlign:"right" as const}}>{fmtDate(c.started_at)}</span>
                    <button onClick={()=>doCall(c.direction==="INBOUND"?c.from_number:c.to_number)} style={{background:`${C.mint}18`,color:C.mint,border:`1px solid ${C.mint}33`,borderRadius:7,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                      <Ico.phone width={11} height={11}/> Rappeler
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CONTACTS — données LIVE ──────────────────── */}
          {!loading && tab==="contacts" && (
            <div>
              <h1 style={{fontSize:20,fontWeight:900,marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
                <Ico.user width={18} height={18} style={{color:C.violet}}/> Contacts
                <span style={{fontSize:13,color:C.tx3,fontWeight:500}}>({contacts.length})</span>
              </h1>
              <input value={contactSearch} onChange={e=>setContactSearch(e.target.value)} placeholder="Rechercher…"
                style={{width:"100%",background:C.bg2,border:`1px solid ${C.line}`,borderRadius:10,color:C.txt,fontSize:13,padding:"9px 14px",marginBottom:14,boxSizing:"border-box" as const,outline:"none"}}/>
              <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"6px 16px"}}>
                {filteredContacts.length === 0 && (
                  <div style={{color:C.tx3,fontSize:12,textAlign:"center" as const,padding:"24px 0"}}>
                    {contacts.length === 0 ? "Aucun contact dans le CRM" : "Aucun résultat"}
                  </div>
                )}
                {filteredContacts.map(c=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:`1px solid ${C.line}`}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:`${C.violet}22`,border:`2px solid ${C.violet}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.violet,flexShrink:0}}>
                      {(c.first_name||"?").charAt(0)}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.txt}}>{c.first_name} {c.last_name}</div>
                      <div style={{fontSize:11,color:C.tx3}}>{[c.company,c.email].filter(Boolean).join(" · ")}</div>
                    </div>
                    <span style={{fontSize:12,color:C.sky,fontFamily:"monospace"}}>{c.phone}</span>
                    <button onClick={()=>doCall(c.phone||"")} style={{background:`${C.mint}18`,color:C.mint,border:`1px solid ${C.mint}33`,borderRadius:7,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                      <Ico.phone width={11} height={11}/> Appeler
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SCRIPTS — données LIVE ───────────────────── */}
          {!loading && tab==="scripts" && (
            <div>
              <h1 style={{fontSize:20,fontWeight:900,marginBottom:18,display:"flex",alignItems:"center",gap:8}}>
                <Ico.script width={18} height={18} style={{color:C.mint}}/> Scripts d'appel
              </h1>
              {(Array.isArray(scripts) ? scripts : []).length === 0 && (
                <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"32px",textAlign:"center" as const,color:C.tx3}}>
                  Aucun script disponible — l'admin peut en créer dans le dashboard.
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {(Array.isArray(scripts) ? scripts : []).map(s=>(
                  <div key={s.id} style={{background:C.bg2,border:`1px solid ${activeScript?.id===s.id?C.violet:C.line}`,borderRadius:14,padding:"14px 16px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{fontSize:13,fontWeight:800,color:C.txt}}>{s.name}</div>
                      <button onClick={()=>{setActiveScript(s);setTab("dashboard")}} style={{background:`${C.violet}18`,color:C.violet,border:`1px solid ${C.violet}44`,borderRadius:7,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",gap:5,flexShrink:0,marginLeft:8}}>
                        <Ico.check width={11} height={11}/> Utiliser
                      </button>
                    </div>
                    <p style={{fontSize:12,color:C.tx2,lineHeight:1.65,margin:0}}>{s.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VOICEMAILS — données LIVE ────────────────── */}
          {!loading && tab==="voicemails" && (
            <div>
              <h1 style={{fontSize:20,fontWeight:900,marginBottom:18,display:"flex",alignItems:"center",gap:10}}>
                <Ico.voicemail width={18} height={18} style={{color:C.amber}}/> Messages vocaux
                {unreadVm > 0 && <span style={{background:C.rose,color:"#fff",fontSize:11,fontWeight:800,borderRadius:10,padding:"2px 9px"}}>{unreadVm} non lus</span>}
              </h1>
              {(Array.isArray(voicemails) ? voicemails : []).length === 0 && (
                <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"32px",textAlign:"center" as const,color:C.tx3}}>Aucun message vocal</div>
              )}
              <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:14,padding:"6px 16px"}}>
                {(Array.isArray(voicemails) ? voicemails : []).map(vm=>(
                  <div key={vm.id} style={{padding:"13px 0",borderBottom:`1px solid ${C.line}`,opacity:vm.status==="LISTENED"?0.6:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:vm.transcription?8:0}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:`${C.amber}18`,border:`2px solid ${vm.status==="NEW"?C.amber:C.tx3}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:C.amber}}>
                        <Ico.voicemail width={16} height={16}/>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.txt,display:"flex",alignItems:"center",gap:6}}>
                          {vmName(vm)}
                          {vm.status==="NEW" && <span style={{background:`${C.violet}22`,color:C.violet,fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:8}}>Nouveau</span>}
                        </div>
                        {vm.contact && <div style={{fontSize:10,color:C.tx3}}>{vm.from_number}</div>}
                      </div>
                      <span style={{fontSize:11,color:C.tx3,fontFamily:"monospace"}}>{fmtDur(vm.duration)}</span>
                      <span style={{fontSize:10,color:C.tx3}}>{fmtDate(vm.created_at)}</span>
                      <button onClick={()=>{markVoicemailListened(vm.id);doCall(vm.from_number)}}
                        style={{background:`${C.sky}18`,color:C.sky,border:`1px solid ${C.sky}33`,borderRadius:7,padding:"5px 10px",fontSize:11,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                        <Ico.phone width={11} height={11}/> Rappeler
                      </button>
                    </div>
                    {vm.transcription && (
                      <div style={{marginLeft:46,background:C.bg3,borderRadius:7,padding:"7px 10px",fontSize:11,color:C.tx2,fontStyle:"italic",lineHeight:1.55,borderLeft:`2px solid ${C.violet}44`}}>
                        "{vm.transcription}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── FAB Electron ─────────────────────────────────────── */}
      <button onClick={()=>{window.location.href="voxflow://open"}} title="VoxFlow Dialer (Maj+D)"
        style={{position:"fixed",bottom:20,right:20,width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${C.violet},${C.mint})`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 8px 32px ${C.violet}66`,zIndex:999}}
        onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.1)"}}
        onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)"}}>
        <Ico.phone width={22} height={22} style={{color:"#fff"}}/>
      </button>

      {/* ── MODAL AUDIO ──────────────────────────────────────── */}
      {showAudioModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowAudioModal(false)}}>
          <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:16,padding:24,width:380,boxShadow:"0 32px 80px rgba(0,0,0,.8)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <span style={{fontSize:15,fontWeight:800,color:C.txt,display:"flex",alignItems:"center",gap:8}}>
                <Ico.headphones width={16} height={16} style={{color:C.violet}}/> Périphériques audio
              </span>
              <button onClick={()=>setShowAudioModal(false)} style={{background:"none",border:"none",color:C.tx3,cursor:"pointer"}}><Ico.x width={18} height={18}/></button>
            </div>
            {[{label:"Microphone",kind:"audioinput",val:audioIn,set:setAudioIn},{label:"Casque / sortie",kind:"audiooutput",val:audioOut,set:setAudioOut}].map(f=>(
              <div key={f.kind} style={{marginBottom:14}}>
                <label style={{fontSize:11,color:C.tx3,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.08em",display:"block",marginBottom:6}}>{f.label}</label>
                <select value={f.val} onChange={e=>f.set(e.target.value)}
                  style={{width:"100%",background:C.bg3,border:`1px solid ${C.line}`,borderRadius:8,color:C.txt,padding:"9px 12px",fontSize:13,outline:"none",cursor:"pointer"}}>
                  <option value="default">Périphérique par défaut</option>
                  {audioDevices.filter(d=>d.kind===f.kind).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
            ))}
            <button onClick={()=>setShowAudioModal(false)} style={{width:"100%",background:C.violet,border:"none",color:"#fff",borderRadius:8,padding:"10px 0",fontSize:13,fontWeight:700,cursor:"pointer",marginTop:6}}>
              Appliquer
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL CRÉER CONTACT ───────────────────────────────── */}
      {showContactModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setShowContactModal(false)}}>
          <div style={{background:C.bg2,border:`1px solid ${C.line}`,borderRadius:16,padding:24,width:420,boxShadow:"0 32px 80px rgba(0,0,0,.8)",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <span style={{fontSize:15,fontWeight:800,color:C.txt,display:"flex",alignItems:"center",gap:8}}>
                <Ico.userPlus width={16} height={16} style={{color:C.mint}}/> Nouveau contact
              </span>
              <button onClick={()=>setShowContactModal(false)} style={{background:"none",border:"none",color:C.tx3,cursor:"pointer"}}><Ico.x width={18} height={18}/></button>
            </div>
            {contactSaved ? (
              <div style={{textAlign:"center",padding:"30px 0",color:C.mint}}>
                <div style={{fontSize:40,marginBottom:8}}>✓</div>
                <div style={{fontSize:16,fontWeight:700}}>Contact sauvegardé !</div>
              </div>
            ) : (
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  {[{f:"first_name",l:"Prénom"},{f:"last_name",l:"Nom"}].map(x=>(
                    <div key={x.f}>
                      <label style={{fontSize:11,color:C.tx3,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em",display:"block",marginBottom:4}}>{x.l}</label>
                      <input value={(contactForm as any)[x.f]} onChange={e=>setContactForm(p=>({...p,[x.f]:e.target.value}))}
                        style={{width:"100%",background:C.bg3,border:`1px solid ${C.line}`,borderRadius:8,color:C.txt,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box" as const}}/>
                    </div>
                  ))}
                </div>
                {[{f:"phone",l:"Téléphone"},{f:"email",l:"Email"},{f:"company",l:"Entreprise"}].map(x=>(
                  <div key={x.f} style={{marginBottom:10}}>
                    <label style={{fontSize:11,color:C.tx3,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em",display:"block",marginBottom:4}}>{x.l}</label>
                    <input value={(contactForm as any)[x.f]} onChange={e=>setContactForm(p=>({...p,[x.f]:e.target.value}))}
                      style={{width:"100%",background:C.bg3,border:`1px solid ${C.line}`,borderRadius:8,color:C.txt,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box" as const}}/>
                  </div>
                ))}
                <div style={{display:"flex",gap:8,marginTop:6}}>
                  <button onClick={()=>setShowContactModal(false)} style={{flex:1,background:C.bg3,border:`1px solid ${C.line}`,color:C.tx2,borderRadius:8,padding:"10px 0",fontSize:13,cursor:"pointer"}}>Annuler</button>
                  <button onClick={doSaveContact} style={{flex:2,background:C.mint,border:"none",color:"#001a14",borderRadius:8,padding:"10px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                    Créer le contact
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:#2e2e44;border-radius:2px}
        select option{background:#1f1f2a}
      `}</style>
    </div>
  )
}

