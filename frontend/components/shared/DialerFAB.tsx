"use client"
import { useEffect, useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { useFeatures } from "@/hooks/useFeatures"

export default function DialerFAB() {
  const router = useRouter()
  const [tip,    setTip   ] = useState(false)
  const { isAuth, accessToken } = useAuthStore()
  const { has, isTrialExpired, trialDaysLeft, planName } = useFeatures()

  const getUrl = () => {
    try { return localStorage.getItem("vf_url") || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000" } catch { return "http://localhost:4000" }
  }

  // Quand déconnexion dans le portail → sync logout vers Electron
  useEffect(() => {
    if (!isAuth) {
      setIsOpen(false)
      // Notifier Electron via HTTP local (s'il tourne)
      fetch('http://127.0.0.1:9876/auth-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      }).catch(() => {}) // ignore si Electron pas lancé
    }
  }, [isAuth])

  // Quand token change → mettre à jour Electron via HTTP local
  useEffect(() => {
    if (isAuth && accessToken) {
      fetch('http://127.0.0.1:9876/auth-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', token: accessToken, url: getUrl() }),
      }).catch(() => {}) // ignore si Electron pas lancé
    }
  }, [isAuth, accessToken])

  // ── Gating forfait ───────────────────────────────────────────
  // Le dialer est inutile si la feature `inbound_calls` ET
  // `outbound_calls` sont fausses. Dans ce cas, on cache la FAB.
  const canUseDialer = has('inbound_calls') || has('outbound_calls')

  const openDialer = useCallback(() => {
    if (!isAuth || !accessToken) return

    // Si trial expiré → rediriger vers plans au lieu d'ouvrir le dialer
    if (isTrialExpired) {
      router.push('/client/plans')
      return
    }

    // Si pas de features dialer du tout → plans
    if (!canUseDialer) {
      router.push('/client/plans')
      return
    }

    const tok = accessToken
    const url = getUrl()

    // ── Toujours lancer Electron via protocole custom ──────────
    // On n'ouvre JAMAIS de popup web. Le dialer doit apparaître dans
    // Electron, pas dans un onglet navigateur. Si Electron n'est pas
    // installé, le protocol handler échoue silencieusement et c'est
    // normal — l'utilisateur doit installer l'app Electron.
    //
    // Sync du token vers Electron via HTTP local :9876 (le serveur
    // HTTP interne d'Electron créé dans main.js:startLocalServer).
    // Si Electron tourne, /auth-sync accepte le token et reload le
    // dialer. Si Electron ne tourne pas, le fetch échoue silencieusement
    // et on tente le protocol handler en fallback.
    const syncAndLaunch = async () => {
      try {
        // 1. D'abord essayer le sync HTTP (Electron déjà ouvert)
        const res = await fetch('http://127.0.0.1:9876/auth-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', token: tok, role: 'ADMIN', url }),
        })
        if (res.ok) {
          // Electron est ouvert et a reçu le token → focus
          await fetch('http://127.0.0.1:9876/ping').catch(() => {})
          return
        }
      } catch {
        // Electron pas lancé → fallback protocol handler
      }

      // 2. Protocol handler pour lancer Electron (s'il est installé)
      try {
        window.location.href = `voxflow://open?tok=${encodeURIComponent(tok)}&url=${encodeURIComponent(url)}`
      } catch {}
    }

    syncAndLaunch()
    // NE PAS setIsOpen(true) ici — on ne contrôle pas si Electron
    // s'est réellement ouvert. Le FAB garde sa couleur violette.
  }, [isAuth, accessToken, isTrialExpired, canUseDialer, router])

  // Détecter si Electron tourne (ping :9876) pour afficher le badge live
  const [isOpen, setIsOpen] = useState(false)
  useEffect(() => {
    if (!isAuth) return
    const check = () => {
      fetch('http://127.0.0.1:9876/ping', { mode: 'cors' })
        .then(r => r.ok ? r.json() : null)
        .then(d => setIsOpen(!!d?.ok))
        .catch(() => setIsOpen(false))
    }
    check()
    const id = setInterval(check, 5000) // poll toutes les 5s
    return () => clearInterval(id)
  }, [isAuth])

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

  // Pas authentifié → rien
  if (!isAuth) return null
  // Pas de features dialer du tout (inbound + outbound false) → rien
  if (!canUseDialer && !isTrialExpired) return null

  // Style adaptatif selon l'état (disabled pour trial expiré)
  const disabled = isTrialExpired
  const bg = disabled
    ? "linear-gradient(135deg,#55557a,#35355a)"
    : isOpen
      ? "linear-gradient(135deg,#00d4aa,#00a884)"
      : "linear-gradient(135deg,#7b61ff,#6145ff)"
  const shadow = disabled
    ? "0 4px 20px rgba(85,85,122,.4)"
    : isOpen
      ? "0 4px 20px rgba(0,212,170,.6)"
      : "0 4px 20px rgba(123,97,255,.6)"

  const tooltipText = disabled
    ? "Essai expiré — passez à un forfait"
    : isOpen
      ? "Dialer actif"
      : `Dialer VoxFlow${planName ? ` · ${planName}` : ''}`

  return (
    <>
      <button
        onClick={openDialer}
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        aria-label={disabled ? "Essai expiré" : "Ouvrir le Dialer VoxFlow"}
        className="vf-fab-button"
        style={{
          background: bg,
          boxShadow:  shadow,
          animation:  isOpen || disabled ? "none" : "vfFAB 3s ease-in-out infinite",
          opacity:    disabled ? 0.7 : 1,
        }}
      >
        <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
        </svg>
        {/* Badge trial compteur */}
        {!disabled && trialDaysLeft !== null && trialDaysLeft !== undefined && trialDaysLeft <= 7 && (
          <span style={{
            position: 'absolute',
            top: -4, right: -4,
            background: trialDaysLeft <= 1 ? '#ff4d6d' : '#ffb547',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: '999px',
            border: '2px solid #111118',
            fontFamily: "'DM Sans',system-ui,sans-serif",
            lineHeight: 1,
          }}>
            {trialDaysLeft}j
          </span>
        )}
      </button>

      {isOpen && <span className="vf-fab-live" />}

      {tip && (
        <div className="hidden sm:block" style={{
          position:"fixed", bottom:"92px", right:"14px", zIndex:9998,
          background:"#18181f", border:"1px solid #2e2e44",
          borderRadius:"10px", padding:"7px 13px", fontSize:"12px",
          color:"#9898b8", fontFamily:"'DM Sans',system-ui,sans-serif",
          fontWeight:600, whiteSpace:"nowrap", pointerEvents:"none",
          boxShadow:"0 8px 24px rgba(0,0,0,.6)",
        }}>
          {tooltipText}
          {!disabled && (
            <>
              &nbsp;&nbsp;
              <kbd style={{
                background:"#2e2e44", border:"1px solid #3a3a55",
                padding:"2px 7px", borderRadius:"5px",
                fontSize:"11px", color:"#eeeef8",
              }}>Shift+D</kbd>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes vfFAB {
          0%,100%{box-shadow:0 4px 20px rgba(123,97,255,.6),0 0 0 0 rgba(123,97,255,.4)}
          50%    {box-shadow:0 4px 20px rgba(123,97,255,.6),0 0 0 10px rgba(123,97,255,0)}
        }
        @keyframes vfLive {
          0%,100%{transform:scale(1);opacity:1}
          50%    {transform:scale(1.4);opacity:.5}
        }
      `}</style>
    </>
  )
}
