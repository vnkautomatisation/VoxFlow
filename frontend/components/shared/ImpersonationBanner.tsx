'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ImpersonationData {
  originalToken: string
  impersonatingOrgId: string
  impersonatingOrgName: string
}

export default function ImpersonationBanner() {
  const [data, setData] = useState<ImpersonationData | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('vf_impersonate')
      if (raw) setData(JSON.parse(raw))
    } catch {}
  }, [])

  if (!data) return null

  const handleQuit = () => {
    if (typeof window === 'undefined') return
    // Restore original owner token
    localStorage.setItem('vf_tok', data.originalToken)
    localStorage.removeItem('vf_impersonate')
    router.push('/owner/admins')
    // Force full reload to reset all state
    setTimeout(() => window.location.href = '/owner/admins', 100)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(90deg, #f59e0b, #d97706)',
      color: '#000', padding: '8px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
    }}>
      <span>Mode impersonation — connecte comme {data.impersonatingOrgName}</span>
      <button
        onClick={handleQuit}
        style={{
          background: '#000', color: '#f59e0b', border: 'none',
          padding: '4px 14px', borderRadius: 6, fontSize: 12,
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        Quitter
      </button>
    </div>
  )
}
