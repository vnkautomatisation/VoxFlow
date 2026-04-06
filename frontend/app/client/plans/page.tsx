'use client'

import { useState, useEffect } from 'react'

interface Plan {
  id: string; name: string; price: number; features: string[]
  limits: { agents: number; dids: number; recording: boolean; ai: boolean; robot: boolean }
}

const PLANS: Plan[] = [
  { id: 'basic',   name: 'Basic',   price: 29, features: ['3 numéros DID', '5 agents max', 'Appels entrants/sortants', 'Historique 30 jours', 'Support par email'], limits: { agents: 5,  dids: 3,  recording: false, ai: false, robot: false } },
  { id: 'confort', name: 'Confort', price: 59, features: ['10 numéros DID', '25 agents max', 'Enregistrement appels', 'Transcription IA', 'Supervision live', 'Historique 1 an', 'Support prioritaire'], limits: { agents: 25, dids: 10, recording: true,  ai: true,  robot: false } },
  { id: 'premium', name: 'Premium', price: 99, features: ['Numéros illimités', 'Agents illimités', 'Robot dialer 150k/h', 'API publique', 'SLA 99.9%', 'Support dédié 24/7'], limits: { agents: -1, dids: -1, recording: true,  ai: true,  robot: true  } },
]

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

// ── Modal paiement ──────────────────────────────────────────────────────────
function PaymentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (card: CardInfo) => void }) {
  const [num,   setNum]   = useState('')
  const [exp,   setExp]   = useState('')
  const [cvc,   setCvc]   = useState('')
  const [name,  setName]  = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const [err,   setErr]   = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const formatNum = (v: string) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim()
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g,'').slice(0,4)
    return d.length > 2 ? d.slice(0,2) + ' / ' + d.slice(2) : d
  }

  const brand = () => {
    const n = num.replace(/\s/g,'')
    if (n.startsWith('4')) return 'VISA'
    if (n.startsWith('5') || n.startsWith('2')) return 'MC'
    if (n.startsWith('3')) return 'AMEX'
    return ''
  }

  const submit = async () => {
    setErr(null)
    const n = num.replace(/\s/g,'')
    if (n.length < 16) return setErr('Numéro de carte invalide')
    const [mm, yy] = exp.replace(/\s/g,'').split('/')
    if (!mm || !yy || parseInt(mm) > 12) return setErr('Date d\'expiration invalide')
    if (cvc.length < 3) return setErr('Code de sécurité invalide')
    if (!name.trim()) return setErr('Nom du titulaire requis')
    setSaving(true)
    // Simuler appel API
    await new Promise(r => setTimeout(r, 900))
    onSuccess({ last4: n.slice(-4), brand: brand() || 'VISA', expMonth: mm, expYear: yy, name })
    setSaving(false)
  }

  const inp = (focused: boolean): React.CSSProperties => ({
    width: '100%', background: focused ? '#0d0d1e' : '#080810',
    border: `1px solid ${focused ? '#7b61ff' : '#2a2a4a'}`,
    borderRadius: 10, padding: '12px 14px', color: '#e8e8f8', fontSize: 15,
    outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s',
    fontFamily: 'inherit', letterSpacing: focused ? '.06em' : 'normal',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c1a', border: '1px solid #2a2a4a', borderRadius: 20, padding: 36, width: 460, maxWidth: '95vw' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#e8e8f8' }}>Ajouter une carte</div>
            <div style={{ fontSize: 12, color: '#4a4a6a', marginTop: 3 }}>Paiement sécurisé · Crypté TLS 256-bit</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a5a7a', cursor: 'pointer', fontSize: 22 }}>×</button>
        </div>

        {/* Carte visuelle */}
        <div style={{ background: 'linear-gradient(135deg, #1a1a3a 0%, #0e0e2a 100%)', border: '1px solid #2a2a5a', borderRadius: 14, padding: '20px 24px', marginBottom: 24, minHeight: 80, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: '#7b61ff11', border: '1px solid #7b61ff22' }} />
          <div style={{ position: 'absolute', top: 10, right: -20, width: 80, height: 80, borderRadius: '50%', background: '#7b61ff08' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#5a5a8a', letterSpacing: '.1em', textTransform: 'uppercase' }}>VoxFlow Pay</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: brand() === 'VISA' ? '#1a73e8' : brand() === 'MC' ? '#eb001b' : '#7b61ff', letterSpacing: '.05em' }}>{brand()}</div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 16, color: num ? '#c8c8e8' : '#3a3a5a', letterSpacing: '.2em', marginBottom: 10 }}>
            {num || '•••• •••• •••• ••••'}
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
            <div><span style={{ color: '#4a4a6a', fontSize: 9, display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Titulaire</span><span style={{ color: name ? '#a8a8c8' : '#3a3a5a' }}>{name || 'NOM PRÉNOM'}</span></div>
            <div><span style={{ color: '#4a4a6a', fontSize: 9, display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Expiration</span><span style={{ color: exp ? '#a8a8c8' : '#3a3a5a' }}>{exp || 'MM / AA'}</span></div>
          </div>
        </div>

        {/* Champs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Numéro de carte</label>
            <input value={num} onChange={e => setNum(formatNum(e.target.value))} onFocus={() => setFocus('num')} onBlur={() => setFocus(null)}
              placeholder="1234 5678 9012 3456" maxLength={19} style={inp(focus === 'num')} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Nom du titulaire</label>
            <input value={name} onChange={e => setName(e.target.value.toUpperCase())} onFocus={() => setFocus('name')} onBlur={() => setFocus(null)}
              placeholder="NOM PRÉNOM" style={inp(focus === 'name')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Expiration</label>
              <input value={exp} onChange={e => setExp(formatExp(e.target.value))} onFocus={() => setFocus('exp')} onBlur={() => setFocus(null)}
                placeholder="MM / AA" maxLength={7} style={inp(focus === 'exp')} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Code CVC</label>
              <input value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g,'').slice(0,4))} onFocus={() => setFocus('cvc')} onBlur={() => setFocus(null)}
                placeholder="•••" maxLength={4} style={{ ...inp(focus === 'cvc'), letterSpacing: '.3em' }} />
            </div>
          </div>
        </div>

        {err && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#ff4d6d18', border: '1px solid #ff4d6d33', fontSize: 12, color: '#ff4d6d' }}>{err}</div>}

        {/* Bouton */}
        <button onClick={submit} disabled={saving} style={{ width: '100%', marginTop: 20, padding: '13px', background: saving ? '#5a4abf' : '#7b61ff', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', transition: 'background .15s' }}>
          {saving ? 'Vérification…' : '🔒 Enregistrer la carte'}
        </button>

        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: '#3a3a5a' }}>
          Vos données de paiement sont chiffrées et sécurisées
        </div>
      </div>
    </div>
  )
}

interface CardInfo { last4: string; brand: string; expMonth: string; expYear: string; name: string }

// ── Page principale ─────────────────────────────────────────────────────────
export default function PlansPage() {
  const api = useApi()
  const [currentPlan, setCurrentPlan] = useState('basic')
  const [seats,       setSeats]       = useState(4)
  const [renewal,     setRenewal]     = useState('05 mai')
  const [card,        setCard]        = useState<CardInfo | null>(null)
  const [showPayModal,setShowPayModal]= useState(false)
  const [changingTo,  setChangingTo]  = useState<string | null>(null)
  const [msg,         setMsg]         = useState<string | null>(null)

  const plan = PLANS.find(p => p.id === currentPlan)!
  const total = plan.price * seats

  const changePlan = async (planId: string) => {
    setChangingTo(planId)
    try {
      await api('/api/v1/billing/subscription/change', { method: 'POST', body: JSON.stringify({ plan: planId, seats }) })
    } catch {}
    setCurrentPlan(planId)
    setMsg('✓ Forfait mis à jour avec succès')
    setTimeout(() => setMsg(null), 3000)
    setChangingTo(null)
  }

  const removeCard = () => { setCard(null); setMsg('Carte supprimée') ; setTimeout(() => setMsg(null), 2500) }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0, marginBottom: 6 }}>Mes forfaits</h1>
        <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Gérez votre abonnement et votre méthode de paiement.</p>
      </div>

      {msg && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#00d4aa18', border: '1px solid #00d4aa33', fontSize: 13, color: '#00d4aa' }}>{msg}</div>}

      {/* Plan actuel */}
      <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Plan actuel</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#7b61ff' }}>{plan.name}</span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#00d4aa18', color: '#00d4aa', border: '1px solid #00d4aa33' }}>Actif</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                ['Agents', plan.limits.agents === -1 ? '∞' : plan.limits.agents],
                ['DID', plan.limits.dids === -1 ? '∞' : plan.limits.dids],
                ['Enregistrement', plan.limits.recording ? '✓' : '✗'],
                ['IA', plan.limits.ai ? '✓' : '✗'],
                ['Robot', plan.limits.robot ? '✓' : '✗'],
              ].map(([k,v]) => (
                <div key={k as string} style={{ fontSize: 12, color: v === '✓' ? '#00d4aa' : v === '✗' ? '#3a3a5a' : '#7b61ff' }}>
                  <span style={{ color: '#4a4a6a', marginRight: 4 }}>{k}</span>{v}
                </div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#6a6a8a' }}>Sièges</span>
              <button onClick={() => setSeats(s => Math.max(1,s-1))} style={{ width: 28, height: 28, borderRadius: 6, background: '#1a1a3a', border: '1px solid #2a2a4a', color: '#a8a8c8', cursor: 'pointer', fontSize: 16 }}>−</button>
              <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, color: '#e8e8f8' }}>{seats}</span>
              <button onClick={() => setSeats(s => s+1)} style={{ width: 28, height: 28, borderRadius: 6, background: '#1a1a3a', border: '1px solid #2a2a4a', color: '#a8a8c8', cursor: 'pointer', fontSize: 16 }}>+</button>
              <span style={{ fontSize: 12, color: '#6a6a8a' }}>agents</span>
            </div>
            <div style={{ fontSize: 12, color: '#5a5a7a', marginBottom: 2 }}>Renouvellement · {renewal}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#7b61ff' }}>{total.toFixed(2)} CAD/mois</div>
          </div>
        </div>
      </div>

      {/* Méthode de paiement */}
      <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#c8c8e8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>💳</span> Méthode de paiement
          </div>
          {!card && (
            <button onClick={() => setShowPayModal(true)} style={{ padding: '7px 16px', background: '#7b61ff18', border: '1px solid #7b61ff44', borderRadius: 8, color: '#a695ff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + Ajouter une carte
            </button>
          )}
        </div>
        {card ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#13131f', border: '1px solid #2a2a4a', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 30, background: 'linear-gradient(135deg, #1a1a3a, #0e0e2a)', border: '1px solid #3a3a5a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#7b61ff', letterSpacing: '.05em' }}>{card.brand}</div>
              <div>
                <div style={{ fontSize: 14, color: '#c8c8e8', fontFamily: 'monospace', letterSpacing: '.1em' }}>•••• •••• •••• {card.last4}</div>
                <div style={{ fontSize: 11, color: '#5a5a7a', marginTop: 2 }}>{card.name} · Exp. {card.expMonth}/{card.expYear}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowPayModal(true)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 7, color: '#6a6a8a', fontSize: 11, cursor: 'pointer' }}>Modifier</button>
              <button onClick={removeCard} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #ff4d6d33', borderRadius: 7, color: '#ff4d6d77', fontSize: 11, cursor: 'pointer' }}>Retirer</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#3a3a5a', fontSize: 13, fontStyle: 'italic' }}>
            Aucune carte enregistrée — ajoutez une carte pour activer la facturation automatique.
          </div>
        )}
      </div>

      {/* Changer de plan */}
      <div style={{ fontSize: 16, fontWeight: 700, color: '#c8c8e8', marginBottom: 14 }}>Changer de plan</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
        {PLANS.map(p => {
          const isCurrent = p.id === currentPlan
          return (
            <div key={p.id} style={{ background: '#0e0e1c', border: `1px solid ${isCurrent ? '#7b61ff55' : '#1e1e3a'}`, borderRadius: 12, padding: 22, position: 'relative', boxShadow: isCurrent ? '0 0 0 1px #7b61ff22' : 'none' }}>
              {p.id === 'confort' && !isCurrent && <div style={{ position: 'absolute', top: -1, right: 14, background: '#7b61ff', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '.05em' }}>POPULAIRE</div>}
              {isCurrent && <div style={{ position: 'absolute', top: -1, left: 14, background: '#00d4aa', color: '#000', fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '.05em' }}>MON PLAN</div>}
              <div style={{ fontSize: 18, fontWeight: 800, color: '#7b61ff', marginBottom: 4, marginTop: 8 }}>{p.name}</div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#e8e8f8' }}>{p.price}</span>
                <span style={{ fontSize: 11, color: '#5a5a7a' }}> CAD/utilisateur/mois</span>
              </div>
              <div style={{ fontSize: 12, color: '#00d4aa', marginBottom: 16 }}>= {(p.price * seats).toFixed(2)} CAD/mois pour {seats} sièges</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20 }}>
                {p.features.map(f => <div key={f} style={{ fontSize: 12, color: '#8888a8', display: 'flex', gap: 8 }}><span style={{ color: '#00d4aa' }}>✓</span>{f}</div>)}
              </div>
              {isCurrent ? (
                <div style={{ padding: '9px', textAlign: 'center', background: '#7b61ff18', border: '1px solid #7b61ff33', borderRadius: 8, fontSize: 12, color: '#a695ff' }}>✓ Plan actuel</div>
              ) : (
                <button onClick={() => changePlan(p.id)} disabled={changingTo === p.id} style={{ width: '100%', padding: '10px', background: changingTo === p.id ? '#3a3a6a' : '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {changingTo === p.id ? 'Changement…' : `Passer à ${p.name}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px', background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 8, fontSize: 12, color: '#5a5a7a' }}>
        ℹ Les changements de plan prennent effet immédiatement avec facturation au prorata. Essai gratuit 14 jours — aucune carte de crédit requise pour commencer.
      </div>

      {showPayModal && <PaymentModal onClose={() => setShowPayModal(false)} onSuccess={c => { setCard(c); setShowPayModal(false); setMsg('✓ Carte enregistrée avec succès') ; setTimeout(() => setMsg(null), 3000) }} />}
    </div>
  )
}
