'use client'
import { useState } from 'react'

type RStatus = 'active' | 'paused' | 'done' | 'scheduled'

interface RobotCampaign {
  id: string; name: string; status: RStatus; message: string
  total: number; sent: number; answered: number; duration: number
  created: string; scheduledAt?: string; ttsVoice: string
}

const MOCK: RobotCampaign[] = [
  { id:'1', name:'Rappel rendez-vous Q2', status:'active', message:'Bonjour, nous vous rappelons votre rendez-vous du…', total:1200, sent:430, answered:312, duration:18, created:'2026-04-05', scheduledAt:'2026-04-06 09:00', ttsVoice:'fr-CA-Sylvie' },
  { id:'2', name:'Promotion printemps',   status:'done',   message:'Enregistrement audio — 16 secondes', total:3500, sent:3500, answered:2100, duration:16, created:'2026-03-15', ttsVoice:'fr-CA-Antoine' },
]

const VOICES = ['fr-CA-Sylvie', 'fr-CA-Antoine', 'fr-FR-Denise', 'en-CA-Clara', 'en-US-Jenny']

const IS: React.CSSProperties = {
  width:'100%', background:'#080810', border:'1px solid #2a2a4a', borderRadius:9,
  padding:'10px 13px', color:'#e8e8f8', fontSize:13, outline:'none',
  boxSizing:'border-box', fontFamily:'inherit',
}

function NewRobotModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: RobotCampaign) => void }) {
  const [name,    setName]    = useState('')
  const [message, setMessage] = useState('')
  const [total,   setTotal]   = useState('500')
  const [voice,   setVoice]   = useState('fr-CA-Sylvie')
  const [sched,   setSched]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim())    return setErr('Nom requis')
    if (!message.trim()) return setErr('Message TTS requis')
    if (!total || +total < 1) return setErr('Nombre de destinataires invalide')
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    const wordCount = message.trim().split(/\s+/).length
    const estDuration = Math.round(wordCount / 2.5)
    onCreate({ id: Date.now().toString(), name, status: sched ? 'scheduled' : 'paused', message, total: +total, sent: 0, answered: 0, duration: estDuration, created: new Date().toISOString().slice(0,10), scheduledAt: sched || undefined, ttsVoice: voice })
    setSaving(false)
    onClose()
  }

  const words = message.trim().split(/\s+/).filter(Boolean).length
  const estSec = Math.round(words / 2.5)

  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0c0c1a', border:'1px solid #2a2a4a', borderRadius:16, padding:28, width:540, maxWidth:'98vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700, color:'#e8e8f8' }}>Nouvelle campagne robot</div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#5a5a7a', cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Nom de la campagne</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Rappel rendez-vous mai" style={IS} />
          </div>
          <div>
            <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Message vocal (TTS)</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Bonjour, ceci est un message automatisé de VoxFlow…" style={{ ...IS, resize:'vertical', lineHeight:1.6 }} />
            {words > 0 && <div style={{ fontSize:11, color:'#5a5a7a', marginTop:4 }}>{words} mots · ~{estSec}s de lecture</div>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Voix TTS</label>
              <select value={voice} onChange={e=>setVoice(e.target.value)} style={IS}>
                {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Destinataires</label>
              <input type="number" min="1" value={total} onChange={e=>setTotal(e.target.value)} style={IS} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:10, color:'#6a6a8a', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:4 }}>Planifier (optionnel)</label>
            <input type="datetime-local" value={sched} onChange={e=>setSched(e.target.value)} style={IS} />
          </div>
          <div style={{ padding:'10px 14px', background:'#0a0a18', border:'1px solid #1e1e3a', borderRadius:9, fontSize:12, color:'#5a5a7a' }}>
            Capacité : <strong style={{ color:'#ff4d6d' }}>150 000 appels/heure</strong> · Tarif : 0.015 CAD/appel répondu
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

function RobotReportModal({ campaign, onClose }: { campaign: RobotCampaign; onClose: () => void }) {
  const pct = campaign.total > 0 ? Math.round(campaign.sent / campaign.total * 100) : 0
  const rRate = campaign.sent > 0 ? Math.round(campaign.answered / campaign.sent * 100) : 0
  return (
    <div style={{ position:'fixed', inset:0, background:'#000000cc', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#0c0c1a', border:'1px solid #2a2a4a', borderRadius:16, padding:28, width:540, maxWidth:'95vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#e8e8f8' }}>{campaign.name}</div>
            <div style={{ fontSize:11, color:'#5a5a7a', marginTop:2 }}>Rapport robot d'appel · {campaign.created}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#5a5a7a', cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ marginBottom:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6a6a8a', marginBottom:5 }}>
            <span>Envois</span><span style={{ color:'#7b61ff', fontWeight:700 }}>{pct}%</span>
          </div>
          <div style={{ height:8, background:'#1a1a2e', borderRadius:4, overflow:'hidden' }}>
            <div style={{ height:'100%', width:pct+'%', background:'linear-gradient(90deg,#7b61ff,#ff4d6d)', borderRadius:4 }} />
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
          {[
            { l:'Total',    v: campaign.total,    c:'#7b61ff' },
            { l:'Envoyés',  v: campaign.sent,     c:'#38b6ff' },
            { l:'Réponses', v: campaign.answered, c:'#00d4aa' },
            { l:'Taux rép.',v: rRate+'%',          c:'#ffb547' },
          ].map(k => (
            <div key={k.l} style={{ background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:10, color:'#4a4a6a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{k.l}</div>
              <div style={{ fontSize:20, fontWeight:700, color:k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#080810', border:'1px solid #1e1e3a', borderRadius:10, padding:'14px 16px' }}>
          <div style={{ fontSize:11, color:'#4a4a6a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Détails</div>
          {[
            ['Message',      campaign.message.slice(0,60) + (campaign.message.length>60?'…':'')],
            ['Voix TTS',     campaign.ttsVoice],
            ['Durée message',campaign.duration + ' secondes'],
            ['Non répondus', campaign.sent - campaign.answered],
            ['Restants',     campaign.total - campaign.sent],
          ].map(([k,v]) => (
            <div key={k as string} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #1a1a2e', fontSize:12 }}>
              <span style={{ color:'#6a6a8a' }}>{k}</span>
              <span style={{ color:'#c8c8e8', fontWeight:500, maxWidth:260, textAlign:'right' }}>{v}</span>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ width:'100%', marginTop:16, padding:10, background:'transparent', border:'1px solid #2a2a4a', borderRadius:9, color:'#5a5a7a', fontSize:13, cursor:'pointer' }}>Fermer</button>
      </div>
    </div>
  )
}

export default function RobotPage() {
  const [campaigns, setCampaigns] = useState<RobotCampaign[]>(MOCK)
  const [showNew,   setShowNew]   = useState(false)
  const [report,    setReport]    = useState<RobotCampaign | null>(null)

  const toggle = (id: string) => setCampaigns(prev => prev.map(c => c.id !== id ? c : { ...c, status: c.status === 'active' ? 'paused' : 'active' }))

  const totalSent = campaigns.reduce((s,c) => s+c.sent, 0)
  const inProgress = campaigns.filter(c => c.status === 'active').length

  const scColor = (s: RStatus) => s==='active'?'#00d4aa':s==='paused'?'#ffb547':s==='scheduled'?'#38b6ff':'#7b61ff'
  const scLabel = (s: RStatus) => s==='active'?'En cours':s==='paused'?'Pausé':s==='scheduled'?'Planifié':'Terminé'

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#e8e8f8', margin:0, marginBottom:6 }}>Robot d'appel</h1>
          <p style={{ fontSize:13, color:'#6a6a8a', margin:0 }}>Diffusez des messages vocaux automatisés à grande échelle.</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ padding:'6px 12px', background:'#ff4d6d18', border:'1px solid #ff4d6d33', borderRadius:8, fontSize:11, fontWeight:700, color:'#ff8888' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight:5 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            150 000 appels/heure
          </div>
          <button onClick={() => setShowNew(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', background:'#7b61ff', border:'none', borderRadius:9, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Créer campagne
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Total envoyés', totalSent, '#7b61ff'], ['En cours', inProgress, '#00d4aa'], ['Appels/heure max', '150 000', '#ff4d6d']].map(([l,v,c]) => (
          <div key={l as string} style={{ background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:10, color:'#4a4a6a', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{l}</div>
            <div style={{ fontSize:20, fontWeight:700, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Campagnes */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {campaigns.map(c => {
          const pct = c.total > 0 ? Math.round(c.sent / c.total * 100) : 0
          return (
            <div key={c.id} style={{ background:'#0e0e1c', border:'1px solid #1e1e3a', borderRadius:12, padding:'18px 22px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:12 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <span style={{ fontSize:15, fontWeight:700, color:'#c8c8e8' }}>{c.name}</span>
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background: scColor(c.status)+'18', color: scColor(c.status), border:`1px solid ${scColor(c.status)}33`, fontWeight:600 }}>{scLabel(c.status)}</span>
                    {c.ttsVoice && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'#38b6ff18', color:'#38b6ff', border:'1px solid #38b6ff33' }}>{c.ttsVoice}</span>}
                  </div>
                  <div style={{ fontSize:11, color:'#5a5a7a', fontStyle:'italic' }}>"{c.message}"</div>
                  {c.scheduledAt && <div style={{ fontSize:11, color:'#7b61ff', marginTop:3 }}>Planifié : {c.scheduledAt}</div>}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {c.status !== 'done' && (
                    <button onClick={() => toggle(c.id)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', background: c.status==='active'?'#ffb54718':'#00d4aa18', border:`1px solid ${c.status==='active'?'#ffb54744':'#00d4aa44'}`, borderRadius:8, color: c.status==='active'?'#ffb547':'#00d4aa', fontSize:12, fontWeight:600, cursor:'pointer' }}>
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

              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6a6a8a', marginBottom:5 }}>
                  <span>{c.sent} / {c.total} envoyés</span>
                  <span style={{ color: scColor(c.status), fontWeight:600 }}>{pct}%</span>
                </div>
                <div style={{ height:6, background:'#1a1a2e', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:pct+'%', background:`linear-gradient(90deg, ${scColor(c.status)}, ${scColor(c.status)}99)`, borderRadius:3 }} />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                {[['Total',c.total,'#7b61ff'],['Envoyés',c.sent,'#38b6ff'],['Réponses',c.answered,'#00d4aa'],['Durée',c.duration+'s','#ffb547']].map(([l,v,col]) => (
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

      {showNew && <NewRobotModal onClose={() => setShowNew(false)} onCreate={c => { setCampaigns(prev => [c, ...prev]); setShowNew(false) }} />}
      {report  && <RobotReportModal campaign={report} onClose={() => setReport(null)} />}
    </div>
  )
}
