'use client'
import { useState, useEffect, useCallback } from 'react'

type CStatus = 'active' | 'paused' | 'done'

interface Campaign {
  id: string; name: string; status: CStatus; agents: number
  total: number; called: number; contacts: number; rate: number
  created: string; scheduledAt?: string
}

// API helper — lit token + url depuis localStorage
function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) },
      body: opts.body,
    })
    return r.json()
  }
}

// Mapper dialer_campaigns (migration 008) → forme du composant.
// Le predictive/power dialer utilise dialer_campaigns alors que le robot
// dialer (/client/robot) utilise robot_campaigns (migration 015). Les deux
// sont exposes via le meme router /api/v1/billing/campaigns existant.
function mapCampaign(row: any): Campaign {
  const total  = Number(row.total_contacts || 0)
  const called = Number(row.dialed_count   || row.called_count || 0)
  const answered = Number(row.answered_count || 0)
  const status: CStatus =
    row.status === 'ACTIVE'    ? 'active' :
    row.status === 'COMPLETED' ? 'done'   : 'paused'
  return {
    id:        row.id,
    name:      row.name,
    status,
    agents:    0, // dialer_campaigns ne tracke pas un nombre d'agents fixe
    total,
    called,
    contacts:  answered,
    rate:      total > 0 ? Math.round((answered / total) * 100) : 0,
    created:   row.created_at ? String(row.created_at).slice(0, 10) : '',
  }
}

const IS: React.CSSProperties = {
  width: '100%', background: '#080810', border: '1px solid #2a2a4a', borderRadius: 9,
  padding: '10px 13px', color: '#e8e8f8', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

function NewCampaignModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Campaign) => void }) {
  const [name,    setName]    = useState('')
  const [agents,  setAgents]  = useState('2')
  const [total,   setTotal]   = useState('100')
  const [sched,   setSched]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim())        return setErr('Nom requis')
    if (!total || +total < 1) return setErr('Nombre de contacts invalide')
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    onCreate({ id: Date.now().toString(), name, status: 'paused', agents: +agents || 1, total: +total, called: 0, contacts: 0, rate: 0, created: new Date().toISOString().slice(0,10), scheduledAt: sched || undefined })
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0c0c1a', border:'1px solid #2a2a4a', borderRadius:16, padding:28, width:480, maxWidth:'95vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#e8e8f8' }}>Nouvelle campagne</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#5a5a7a', cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Nom de la campagne</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex : Prospection mai 2026" style={IS} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Nombre d'agents</label>
              <input type="number" min="1" value={agents} onChange={e=>setAgents(e.target.value)} style={IS} />
            </div>
            <div>
              <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Total contacts</label>
              <input type="number" min="1" value={total} onChange={e=>setTotal(e.target.value)} style={IS} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Planifier le démarrage (optionnel)</label>
            <input type="datetime-local" value={sched} onChange={e=>setSched(e.target.value)} style={IS} />
          </div>
          <div style={{ padding:'12px 14px', background:'#0a0a18', border:'1px solid #1e1e3a', borderRadius:9, fontSize:12, color:'#5a5a7a' }}>
            La campagne sera créée en mode <strong style={{ color:'#7b61ff' }}>Pausée</strong>. Vous pourrez importer vos contacts et la démarrer manuellement.
          </div>
        </div>
        {err && <div style={{ marginTop:10, padding:'7px 12px', borderRadius:7, background:'#ff4d6d18', border:'1px solid #ff4d6d33', fontSize:12, color:'#ff4d6d' }}>{err}</div>}
        <div style={{ display:'flex', gap:8, marginTop:18 }}>
          <button onClick={submit} disabled={saving} style={{ flex:1, padding:11, background: saving?'#5a4abf':'#7b61ff', border:'none', borderRadius:9, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {saving ? 'Création…' : 'Créer la campagne'}
          </button>
          <button onClick={onClose} style={{ padding:'11px 16px', background:'transparent', border:'1px solid #2a2a4a', borderRadius:9, color:'#5a5a7a', fontSize:13, cursor:'pointer' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

function ReportModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const pct = campaign.total > 0 ? Math.round(campaign.called / campaign.total * 100) : 0
  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0c0c1a', border:'1px solid #2a2a4a', borderRadius:16, padding:28, width:540, maxWidth:'95vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#e8e8f8' }}>{campaign.name}</div>
            <div style={{ fontSize:11, color:'#5a5a7a', marginTop:2 }}>Rapport de campagne · Créée le {campaign.created}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#5a5a7a', cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Barre progression */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6a6a8a', marginBottom:6 }}>
            <span>Progression</span><span style={{ color:'#7b61ff', fontWeight:700 }}>{pct}%</span>
          </div>
          <div style={{ height:8, background:'#1a1a2e', borderRadius:4, overflow:'hidden' }}>
            <div style={{ height:'100%', width: pct+'%', background:'linear-gradient(90deg,#7b61ff,#00d4aa)', borderRadius:4, transition:'width .4s' }} />
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
          {[
            { label:'Total',     value: campaign.total,    color:'#7b61ff' },
            { label:'Appelés',   value: campaign.called,   color:'#38b6ff' },
            { label:'Contacts',  value: campaign.contacts, color:'#00d4aa' },
            { label:'Taux',      value: campaign.rate+'%', color:'#ffb547' },
          ].map(k => (
            <div key={k.label} style={{ background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'#4a4a6a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Stats détail */}
        <div style={{ background:'#080810', border:'1px solid #1e1e3a', borderRadius:10, padding:'14px 16px' }}>
          <div style={{ fontSize:11, color:'#4a4a6a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>Détails</div>
          {[
            ['Agents assignés', campaign.agents],
            ['Non répondus',    campaign.called - campaign.contacts],
            ['Taux de réponse', campaign.rate + '%'],
            ['Restants',        campaign.total - campaign.called],
          ].map(([k,v]) => (
            <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #1a1a2e', fontSize:13 }}>
              <span style={{ color:'#6a6a8a' }}>{k}</span>
              <span style={{ color:'#c8c8e8', fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width:'100%', marginTop:16, padding:10, background:'transparent', border:'1px solid #2a2a4a', borderRadius:9, color:'#5a5a7a', fontSize:13, cursor:'pointer' }}>Fermer</button>
      </div>
    </div>
  )
}

const scBar = (s: CStatus) => s === 'active' ? '#00d4aa' : s === 'paused' ? '#ffb547' : '#7b61ff'

export default function DialerPage() {
  const api = useApi()
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showNew,    setShowNew]    = useState(false)
  const [report,     setReport]     = useState<Campaign | null>(null)
  const [activeTab,  setActiveTab]  = useState<'list' | 'new'>('list')

  const loadCampaigns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api('/api/v1/billing/campaigns')
      if (r.success && Array.isArray(r.data)) {
        setCampaigns(r.data.map(mapCampaign))
      } else {
        setCampaigns([])
        if (r.error || r.message) setError(r.error || r.message)
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les campagnes')
      setCampaigns([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  const toggle = async (id: string) => {
    const c = campaigns.find(x => x.id === id)
    if (!c) return
    const newStatus = c.status === 'active' ? 'PAUSED' : 'ACTIVE'
    try {
      const r = await api(`/api/v1/billing/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      if (r.success) await loadCampaigns()
    } catch (e: any) {
      console.error('[toggle]', e)
    }
  }

  const createCampaign = async (c: Campaign) => {
    try {
      const r = await api('/api/v1/billing/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name:          c.name,
          total_contacts: c.total,
          type:          'POWER',
          status:        'DRAFT',
        }),
      })
      if (r.success) await loadCampaigns()
    } catch (e: any) {
      console.error('[createCampaign]', e)
    }
  }

  const active   = campaigns.filter(c => c.status === 'active').length
  const totalCtc = campaigns.reduce((s, c) => s + c.total, 0)
  const avgRate  = campaigns.length ? Math.round(campaigns.reduce((s, c) => s + c.rate, 0) / campaigns.length) : 0

  const scLabel = (s: CStatus) => s === 'active' ? 'Actif' : s === 'paused' ? 'Pausé' : 'Terminé'
  const scColor = (s: CStatus) => s === 'active' ? '#00d4aa' : s === 'paused' ? '#ffb547' : '#7b61ff'

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#e8e8f8', margin:0, marginBottom:6 }}>Predictive Dialer</h1>
          <p style={{ fontSize:13, color:'#6a6a8a', margin:0 }}>Gérez vos campagnes d'appels automatisées.</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', background:'#7b61ff', border:'none', borderRadius:9, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouvelle campagne
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Campagnes actives', active, '#00d4aa'], ['Total contacts', totalCtc, '#7b61ff'], ['Taux de contact moy.', avgRate+'%', '#38b6ff']].map(([l,v,c]) => (
          <div key={l as string} style={{ background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:10, color:'#4a4a6a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:20, fontWeight:700, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Campagnes */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {loading && (
          <div style={{ padding:20, textAlign:'center', color:'#4a4a6a', fontSize:13 }}>Chargement des campagnes…</div>
        )}
        {!loading && error && (
          <div style={{ padding:16, background:'#ff4d6d10', border:'1px solid #ff4d6d33', borderRadius:10, color:'#ff4d6d', fontSize:13 }}>{error}</div>
        )}
        {!loading && !error && campaigns.length === 0 && (
          <div style={{ padding:32, textAlign:'center', background:'#0e0e1c', border:'1px dashed #2a2a4a', borderRadius:10, color:'#4a4a6a' }}>
            <div style={{ fontSize:14, marginBottom:6 }}>Aucune campagne predictive dialer</div>
            <div style={{ fontSize:12, color:'#3a3a5a' }}>Cliquez sur "Nouvelle campagne" pour en creer une.</div>
          </div>
        )}
        {campaigns.map(c => {
          const pct = c.total > 0 ? Math.round(c.called / c.total * 100) : 0
          return (
            <div key={c.id} style={{ background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:12, padding:'18px 22px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:14 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:'#c8c8e8' }}>{c.name}</span>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background: scColor(c.status)+'18', color: scColor(c.status), border:`1px solid ${scColor(c.status)}33`, fontWeight:600 }}>{scLabel(c.status)}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#5a5a7a' }}>Créée le {c.created} · {c.agents} agents</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {c.status !== 'done' && (
                    <button onClick={() => toggle(c.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background: c.status === 'active' ? '#ffb54718' : '#00d4aa18', border:`1px solid ${c.status === 'active' ? '#ffb54744' : '#00d4aa44'}`, borderRadius:8, color: c.status === 'active' ? '#ffb547' : '#00d4aa', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      {c.status === 'active' ? (
                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>
                      ) : (
                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Reprendre</>
                      )}
                    </button>
                  )}
                  <button onClick={() => setReport(c)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background:'#7b61ff18', border:'1px solid #7b61ff33', borderRadius:8, color:'#a695ff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    Rapport
                  </button>
                </div>
              </div>

              {/* Barre */}
              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6a6a8a', marginBottom:5 }}>
                  <span>{c.called} / {c.total} appelés</span>
                  <span style={{ color: scColor(c.status), fontWeight:600 }}>{pct}%</span>
                </div>
                <div style={{ height:6, background:'#1a1a2e', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:pct+'%', background:`linear-gradient(90deg, ${scBar(c.status)}, ${scBar(c.status)}aa)`, borderRadius:3 }} />
                </div>
              </div>

              {/* KPIs inline */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {[['Total',c.total,'#7b61ff'],['Appelés',c.called,'#38b6ff'],['Contacts',c.contacts,'#00d4aa'],['Taux',c.rate+'%','#ffb547']].map(([l,v,col]) => (
                  <div key={l as string} style={{ background:'#0a0a18', borderRadius:8, padding:'8px 12px' }}>
                    <div style={{ fontSize:10, color:'#4a4a6a', marginBottom:3 }}>{l}</div>
                    <div style={{ fontSize:16, fontWeight:700, color: col as string }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onCreate={async c => { await createCampaign(c); setShowNew(false) }} />}
      {report  && <ReportModal campaign={report} onClose={() => setReport(null)} />}
    </div>
  )
}
