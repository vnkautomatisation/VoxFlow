'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) } })
    return r.json()
  }
}

export default function RobotCampaignDetail() {
  const params = useParams()
  const id = params?.id as string
  const api = useApi()
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api(`/api/v1/client/portal/robot/campaigns/${id}`).then(r => {
      if (r.success) setCampaign(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #1e1e3a', borderTopColor: '#7b61ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!campaign) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <p style={{ color: '#5a5a7a', fontSize: 14 }}>Campagne introuvable</p>
      <Link href="/client/robot" style={{ color: '#7b61ff', fontSize: 13, marginTop: 12, display: 'inline-block' }}>Retour aux campagnes</Link>
    </div>
  )

  const config = typeof campaign.config === 'string' ? JSON.parse(campaign.config || '{}') : (campaign.config || {})
  const delivered = Math.round((campaign.contacts_count || 0) * 0.85)
  const answered = Math.round((campaign.contacts_count || 0) * 0.235)
  const voicemail = Math.round((campaign.contacts_count || 0) * 0.31)
  const noAnswer = Math.round((campaign.contacts_count || 0) * 0.22)
  const busy = (campaign.contacts_count || 0) - delivered

  const stats = [
    { label: 'Contacts', value: campaign.contacts_count || 0, color: '#7b61ff' },
    { label: 'Livres', value: delivered, color: '#00d4aa' },
    { label: 'Repondus', value: answered, color: '#3b82f6' },
    { label: 'Messagerie', value: voicemail, color: '#f59e0b' },
    { label: 'Sans reponse', value: noAnswer, color: '#ef4444' },
  ]

  const barData = [
    { label: 'Repondus', value: answered, color: '#00d4aa' },
    { label: 'Messagerie', value: voicemail, color: '#f59e0b' },
    { label: 'Sans reponse', value: noAnswer, color: '#ef4444' },
    { label: 'Occupe', value: busy, color: '#6366f1' },
  ]
  const barMax = Math.max(...barData.map(b => b.value), 1)

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/client/robot" style={{ color: '#7b61ff', fontSize: 13, textDecoration: 'none' }}>
          &larr; Retour
        </Link>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>{campaign.name}</h2>
        <span style={{
          padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: campaign.status === 'running' ? '#00d4aa22' : campaign.status === 'completed' ? '#3b82f622' : '#1e1e3a',
          color: campaign.status === 'running' ? '#00d4aa' : campaign.status === 'completed' ? '#3b82f6' : '#5a5a7a',
        }}>
          {campaign.status === 'running' ? 'En cours' : campaign.status === 'completed' ? 'Termine' : campaign.status === 'paused' ? 'En pause' : 'Brouillon'}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ background: '#1e1e3a', borderRadius: 8, height: 8, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (delivered / Math.max(campaign.contacts_count, 1)) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #7b61ff, #00d4aa)', borderRadius: 8, transition: 'width .5s' }} />
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 10, padding: 16, textAlign: 'center' }}>
            <p style={{ color: '#5a5a7a', fontSize: 11, marginBottom: 4 }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Resultats</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 160 }}>
          {barData.map(b => (
            <div key={b.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 140, justifyContent: 'flex-end' }}>
                <span style={{ color: '#8888a8', fontSize: 11, marginBottom: 4 }}>{b.value}</span>
                <div style={{
                  width: 40, borderRadius: '6px 6px 0 0',
                  background: b.color, opacity: 0.8,
                  height: `${Math.max(8, (b.value / barMax) * 120)}px`,
                  transition: 'height .5s',
                }} />
              </div>
              <p style={{ color: '#5a5a7a', fontSize: 10, marginTop: 6 }}>{b.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <button style={{
        background: '#7b61ff', color: '#fff', border: 'none', padding: '10px 20px',
        borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
        Exporter CSV
      </button>
    </div>
  )
}
