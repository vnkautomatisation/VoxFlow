'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const LS_KEY = 'vf_dialer_open'

export default function DialerSidebar() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved === 'true') setOpen(true)
    } catch {}
  }, [])

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

  // Click-to-call depuis d'autres pages
  const dial = useCallback((phone: string) => {
    if (!iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({ type: 'vf:dial', phone }, '*')
    if (!open) setOpen(true)
  }, [open])

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
      {/* ── Bouton FAB — toujours visible en bas a droite ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9998,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7b61ff, #6145ff)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(123,97,255,.5), 0 0 0 0 rgba(123,97,255,.3)',
            animation: 'vfPulse 3s ease-in-out infinite',
            transition: 'transform 0.2s',
          }}
          title="Dialer (Ctrl+D)"
        >
          <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
          <kbd style={{
            position: 'absolute', bottom: -8, right: -4,
            fontSize: 8, color: '#9898b8', background: '#18181f',
            border: '1px solid #2e2e44', borderRadius: 4,
            padding: '1px 5px', fontFamily: 'monospace',
          }}>Ctrl+D</kbd>
        </button>
      )}

      {/* ── Widget flottant — popup au-dessus du contenu ── */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 380,
          height: 'calc(100vh - 48px)',
          maxHeight: 920,
          zIndex: 9999,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(123,97,255,.15)',
          border: '1px solid #2e2e44',
          background: '#111118',
          animation: 'vfSlideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Barre du haut avec bouton fermer */}
          <div style={{
            height: 36,
            background: '#18181f',
            borderBottom: '1px solid #2e2e44',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            cursor: 'grab',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d4aa', boxShadow: '0 0 6px #00d4aa' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#eeeef8', fontFamily: "'DM Sans',sans-serif" }}>VoxFlow Dialer</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <kbd style={{ fontSize: 8, color: '#55557a', background: '#1f1f2a', border: '1px solid #2e2e44', borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace' }}>Ctrl+D</kbd>
              <button onClick={() => setOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#55557a', display: 'flex', alignItems: 'center',
                padding: 2, borderRadius: 4,
              }}
                onMouseEnter={e => (e.currentTarget.style.color = '#eeeef8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#55557a')}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* iframe */}
          <iframe
            ref={iframeRef}
            src="/dialer?embedded=true"
            style={{
              width: '100%',
              height: 'calc(100% - 36px)',
              border: 'none',
              background: '#111118',
            }}
            allow="microphone; camera"
            title="VoxFlow Dialer"
          />
        </div>
      )}

      <style>{`
        @keyframes vfPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(123,97,255,.5), 0 0 0 0 rgba(123,97,255,.3); }
          50% { box-shadow: 0 4px 20px rgba(123,97,255,.5), 0 0 0 10px rgba(123,97,255,0); }
        }
        @keyframes vfSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 480px) {
          /* Mobile : plein ecran */
          div[style*="width: 380"] {
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            bottom: 0 !important;
            right: 0 !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </>
  )
}
