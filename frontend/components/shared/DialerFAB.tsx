"use client"
import { useEffect, useCallback, useState, useRef } from "react"
import { useAuthStore } from "@/store/authStore"

const W = 360
const H = 700

export default function DialerFAB() {
  const [isOpen, setIsOpen] = useState(false)
  const [tip,    setTip   ] = useState(false)
  const winRef              = useRef<Window | null>(null)
  const { isAuth, accessToken } = useAuthStore()

  const getUrl = () => {
    try { return localStorage.getItem("vf_url") || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000" } catch { return "http://localhost:4000" }
  }

  // Quand déconnexion dans Chrome → fermer le dialer
  useEffect(() => {
    if (!isAuth) {
      if (winRef.current && !winRef.current.closed) {
        try { winRef.current.postMessage({ type: "VOXFLOW_LOGOUT" }, "*") } catch {}
        setTimeout(() => {
          if (winRef.current && !winRef.current.closed) winRef.current.close()
          setIsOpen(false); winRef.current = null
        }, 400)
      }
    }
  }, [isAuth])

  // Quand token change → mettre à jour le dialer
  useEffect(() => {
    if (isAuth && accessToken && winRef.current && !winRef.current.closed) {
      try {
        winRef.current.postMessage({ type: "VOXFLOW_TOKEN", tok: accessToken, url: getUrl() }, "*")
      } catch {}
    }
  }, [isAuth, accessToken])

  const openDialer = useCallback(() => {
    if (!isAuth || !accessToken) return

    const tok = accessToken
    const url = getUrl()

    // Si déjà ouvert → focus + refresh token
    if (winRef.current && !winRef.current.closed) {
      winRef.current.focus()
      try { winRef.current.postMessage({ type: "VOXFLOW_TOKEN", tok, url }, "*") } catch {}
      return
    }

    // Tenter Electron via protocole voxflow://
    window.location.href = `voxflow://open?tok=${encodeURIComponent(tok)}&url=${encodeURIComponent(url)}`

    // Fallback popup HTML après 1.5s
    setTimeout(() => {
      if (winRef.current && !winRef.current.closed) return
      const left = window.screen.availWidth  - W - 24
      const top  = window.screen.availHeight - H - 48
      const feat = `width=${W},height=${H},left=${left},top=${top},resizable=no,scrollbars=no,menubar=no,toolbar=no,location=no`
      const dialerUrl = `/VoxFlow-Dialer.html?tok=${encodeURIComponent(tok)}&url=${encodeURIComponent(url)}`
      const w = window.open(dialerUrl, "VoxFlowDialer", feat)
      if (w) { winRef.current = w; setIsOpen(true); w.focus() }
    }, 1500)
  }, [isAuth, accessToken])

  // Détecter fermeture popup
  useEffect(() => {
    const id = setInterval(() => {
      if (winRef.current?.closed) { setIsOpen(false); winRef.current = null }
    }, 800)
    return () => clearInterval(id)
  }, [])

  // Shift+D
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === "D") {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
        e.preventDefault(); openDialer()
      }
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [openDialer])

  if (!isAuth) return null

  return (
    <>
      <button
        onClick={openDialer}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        aria-label="Ouvrir le Dialer VoxFlow"
        style={{
          position:"fixed", bottom:"24px", right:"24px", zIndex:9999,
          width:"56px", height:"56px", borderRadius:"50%",
          border:"none", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          background: isOpen
            ? "linear-gradient(135deg,#00d4aa,#00a884)"
            : "linear-gradient(135deg,#7b61ff,#6145ff)",
          boxShadow: isOpen
            ? "0 4px 24px rgba(0,212,170,.65)"
            : "0 4px 24px rgba(123,97,255,.65)",
          transition:"background .3s,box-shadow .3s",
          animation: isOpen ? "none" : "vfFAB 3s ease-in-out infinite",
        }}
      >
        <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
        </svg>
      </button>

      {isOpen && (
        <span style={{
          position:"fixed", bottom:"18px", right:"18px", zIndex:10000,
          width:"16px", height:"16px", borderRadius:"50%",
          background:"#00d4aa", border:"2.5px solid #111118",
          boxShadow:"0 0 8px rgba(0,212,170,.9)", pointerEvents:"none",
          animation:"vfLive 2s ease-in-out infinite",
        }} />
      )}

      {tip && (
        <div style={{
          position:"fixed", bottom:"92px", right:"14px", zIndex:9998,
          background:"#18181f", border:"1px solid #2e2e44",
          borderRadius:"10px", padding:"7px 13px", fontSize:"12px",
          color:"#9898b8", fontFamily:"'DM Sans',system-ui,sans-serif",
          fontWeight:600, whiteSpace:"nowrap", pointerEvents:"none",
          boxShadow:"0 8px 24px rgba(0,0,0,.6)",
        }}>
          {isOpen ? "Dialer actif" : "Dialer VoxFlow"}&nbsp;&nbsp;
          <kbd style={{
            background:"#2e2e44", border:"1px solid #3a3a55",
            padding:"2px 7px", borderRadius:"5px",
            fontSize:"11px", color:"#eeeef8",
          }}>Shift+D</kbd>
        </div>
      )}

      <style>{`
        @keyframes vfFAB {
          0%,100%{box-shadow:0 4px 24px rgba(123,97,255,.65),0 0 0 0 rgba(123,97,255,.4)}
          50%    {box-shadow:0 4px 24px rgba(123,97,255,.65),0 0 0 14px rgba(123,97,255,0)}
        }
        @keyframes vfLive {
          0%,100%{transform:scale(1);opacity:1}
          50%    {transform:scale(1.4);opacity:.5}
        }
      `}</style>
    </>
  )
}