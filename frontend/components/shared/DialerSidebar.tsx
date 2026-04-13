'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const SIDEBAR_W = 380
const LS_KEY = 'vf_dialer_open'

export default function DialerSidebar() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Lire l'etat sauvegarde au mount
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved === 'true') setOpen(true)
    } catch {}
  }, [])

  // Persister l'etat
  useEffect(() => {
    if (!mounted) return
    try { localStorage.setItem(LS_KEY, String(open)) } catch {}
  }, [open, mounted])

  // Raccourci Ctrl+D
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        setOpen(p => !p)
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // Envoyer un numero a composer au dialer (click-to-call)
  const dial = useCallback((phone: string) => {
    if (!iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({ type: 'vf:dial', phone }, '*')
    if (!open) setOpen(true)
  }, [open])

  // Ecouter les demandes de dial depuis d'autres composants via window event
  useEffect(() => {
    const fn = (e: Event) => {
      const phone = (e as CustomEvent).detail?.phone
      if (phone) dial(phone)
    }
    window.addEventListener('vf:dial', fn)
    return () => window.removeEventListener('vf:dial', fn)
  }, [dial])

  if (!mounted) return null

  return (
    <>
      {/* Bouton toggle — toujours visible sur le bord */}
      <button
        onClick={() => setOpen(p => !p)}
        aria-label={open ? 'Fermer le dialer' : 'Ouvrir le dialer'}
        style={{
          position: 'fixed',
          right: open ? SIDEBAR_W : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 51,
          width: 28,
          height: 64,
          background: '#18181f',
          border: '1px solid #2e2e44',
          borderRight: open ? '1px solid #2e2e44' : 'none',
          borderTopLeftRadius: 10,
          borderBottomLeftRadius: 10,
          borderTopRightRadius: open ? 0 : 10,
          borderBottomRightRadius: open ? 0 : 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'right 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '-2px 0 12px rgba(0,0,0,.3)',
        }}
      >
        <svg width="14" height="14" fill="none" stroke={open ? '#55557a' : '#7b61ff'} strokeWidth="2.5" viewBox="0 0 24 24">
          {open
            ? <polyline points="9 18 15 12 9 6" />
            : <polyline points="15 18 9 12 15 6" />
          }
        </svg>
        {/* Indicateur telephone quand ferme */}
        {!open && (
          <div style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7b61ff, #6145ff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(123,97,255,.5)',
          }}>
            <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
          </div>
        )}
      </button>

      {/* Sidebar panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: SIDEBAR_W,
          height: '100vh',
          zIndex: 50,
          transform: open ? 'translateX(0)' : `translateX(${SIDEBAR_W}px)`,
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          borderLeft: '1px solid #2e2e44',
          boxShadow: open ? '-4px 0 24px rgba(0,0,0,.4)' : 'none',
          background: '#111118',
        }}
      >
        {/* iframe dialer — pleine hauteur, pas de header doublon */}
        <iframe
          ref={iframeRef}
          src="/dialer?embedded=true"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#111118',
          }}
          allow="microphone; camera"
          title="VoxFlow Dialer"
        />
      </div>
    </>
  )
}
