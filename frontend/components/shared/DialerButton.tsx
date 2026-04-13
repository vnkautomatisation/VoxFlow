"use client"

import { useEffect, useCallback, useState } from "react"
import { Phone } from "lucide-react"

const W = 380
const H = 720

export default function DialerButton() {
  const [tip, setTip]     = useState(false)
  const [win, setWin]     = useState<Window | null>(null)
  const [open2, setOpen2] = useState(false)

  const openDialer = useCallback(() => {
    if (win && !win.closed) { win.focus(); return }

    const left = window.screen.availWidth  - W - 24
    const top  = window.screen.availHeight - H - 48
    const feat = [
      `width=${W}`, `height=${H}`,
      `left=${left}`, `top=${top}`,
      `resizable=no`, `scrollbars=no`,
      `menubar=no`, `toolbar=no`,
      `location=no`, `status=no`,
    ].join(",")

    const w = window.open('/dialer', '_blank', feat)
    if (w) { setWin(w); setOpen2(true); w.focus() }
  }, [win])

  useEffect(() => {
    if (!win) return
    const id = setInterval(() => {
      if (win.closed) { setWin(null); setOpen2(false) }
    }, 1000)
    return () => clearInterval(id)
  }, [win])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault(); openDialer()
      }
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [openDialer])

  return (
    <>
      <button
        onClick={openDialer}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        aria-label="VoxFlow Dialer"
        style={{
          position:       "fixed",
          bottom:         "24px",
          right:          "90px",
          zIndex:         9998,
          width:          "52px",
          height:         "52px",
          borderRadius:   "50%",
          background:     open2
            ? "linear-gradient(135deg,#00d4aa,#00a884)"
            : "linear-gradient(135deg,#7b61ff,#6145ff)",
          border:         "none",
          cursor:         "pointer",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          boxShadow:      open2
            ? "0 4px 20px rgba(0,212,170,.6)"
            : "0 4px 20px rgba(123,97,255,.6)",
          transition:     "all .3s ease",
          animation:      open2 ? "none" : "vfp 3s ease-in-out infinite",
        }}
      >
        <Phone size={20} color="#fff" strokeWidth={2.2} />
      </button>

      {open2 && (
        <div style={{
          position:      "fixed",
          bottom:        "62px",
          right:         "112px",
          zIndex:        9999,
          width:         "10px",
          height:        "10px",
          borderRadius:  "50%",
          background:    "#00d4aa",
          border:        "2px solid #111118",
          boxShadow:     "0 0 6px #00d4aa",
          pointerEvents: "none",
          animation:     "vflive 2s ease-in-out infinite",
        }} />
      )}

      {tip && (
        <div style={{
          position:      "fixed",
          bottom:        "86px",
          right:         "82px",
          zIndex:        9998,
          background:    "#18181f",
          border:        "1px solid #2e2e44",
          borderRadius:  "8px",
          padding:       "5px 10px",
          fontSize:      "11px",
          color:         "#9898b8",
          fontFamily:    "DM Sans, sans-serif",
          fontWeight:    600,
          whiteSpace:    "nowrap",
          pointerEvents: "none",
          boxShadow:     "0 4px 16px rgba(0,0,0,.5)",
        }}>
          {open2 ? "Dialer ouvert" : "Dialer"}&nbsp;
          <kbd style={{
            background:   "#2e2e44",
            padding:      "2px 6px",
            borderRadius: "4px",
            fontSize:     "10px",
            color:        "#eeeef8",
          }}>Ctrl+D</kbd>
        </div>
      )}

      <style>{`
        @keyframes vfp {
          0%,100% { box-shadow: 0 4px 20px rgba(123,97,255,.6), 0 0 0 0 rgba(123,97,255,.3); }
          50%      { box-shadow: 0 4px 20px rgba(123,97,255,.6), 0 0 0 10px rgba(123,97,255,0); }
        }
        @keyframes vflive {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(1.3); }
        }
      `}</style>
    </>
  )
}
