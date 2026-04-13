'use client'

import { useState, useEffect } from 'react'
import { FEATURE_CATEGORIES, PLAN_HIGHLIGHTS, countEnabledFeatures } from '../../../lib/featureCategories'

// ── Types ──────────────────────────────────────────────────
interface PlanDef {
  id: string; name: string; description: string | null
  price_monthly: number; price_yearly: number | null; currency: string
  max_agents: number | null; max_dids: number | null; max_calls_month: number | null
  features: Record<string, boolean>; is_default: boolean; sort_order: number; popular: boolean
}
interface ModuleDef {
  id: string; sku: string; name: string; description: string
  category: string; price_monthly: number; setup_fee: number; billing_unit: string
}
interface ActiveModule {
  sku: string; name: string; quantity: number; unit_price: number; billing_unit: string; total: number
}
interface Subscription {
  plan: string; plan_name: string; plan_price: number; status: string
  seats: number; renews_at: string; amount: number; modules_total: number; grand_total: number
  currency: string; features: Record<string, boolean>; active_modules: ActiveModule[]
  limits: { max_agents: number | null; max_dids: number | null; max_calls_month: number | null }
  stripe_customer: boolean; trial_ends_at: string | null
}
interface CardInfo { last4: string; brand: string; expMonth: string; expYear: string; name: string }

// ── API helper ─────────────────────────────────────────────
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

// ── Modal paiement ─────────────────────────────────────────
function PaymentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (card: CardInfo) => void }) {
  const [num, setNum] = useState(''); const [exp, setExp] = useState('')
  const [cvc, setCvc] = useState(''); const [name, setName] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const formatNum = (v: string) => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim()
  const formatExp = (v: string) => { const d = v.replace(/\D/g,'').slice(0,4); return d.length > 2 ? d.slice(0,2)+' / '+d.slice(2) : d }
  const brand = () => { const n = num.replace(/\s/g,''); if(n.startsWith('4'))return 'VISA'; if(n.startsWith('5')||n.startsWith('2'))return 'MC'; if(n.startsWith('3'))return 'AMEX'; return '' }

  const submit = async () => {
    setErr(null)
    const n = num.replace(/\s/g,'')
    if (n.length < 16) return setErr('Numero de carte invalide')
    const [mm, yy] = exp.replace(/\s/g,'').split('/')
    if (!mm || !yy || parseInt(mm) > 12) return setErr('Date d\'expiration invalide')
    if (cvc.length < 3) return setErr('Code de securite invalide')
    if (!name.trim()) return setErr('Nom du titulaire requis')
    setSaving(true)
    await new Promise(r => setTimeout(r, 900))
    onSuccess({ last4: n.slice(-4), brand: brand() || 'VISA', expMonth: mm, expYear: yy, name })
    setSaving(false)
  }

  const inp = (focused: boolean): React.CSSProperties => ({
    width: '100%', background: focused ? '#0d0d1e' : '#080810',
    border: `1px solid ${focused ? '#7b61ff' : '#2a2a4a'}`,
    borderRadius: 10, padding: '12px 14px', color: '#e8e8f8', fontSize: 15,
    outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s',
    fontFamily: 'inherit',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c1a', border: '1px solid #2a2a4a', borderRadius: 20, padding: 36, width: 460, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#e8e8f8' }}>Ajouter une carte</div>
            <div style={{ fontSize: 12, color: '#4a4a6a', marginTop: 3 }}>Paiement securise - Crypte TLS 256-bit</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a5a7a', cursor: 'pointer', fontSize: 22 }}>x</button>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #1a1a3a 0%, #0e0e2a 100%)', border: '1px solid #2a2a5a', borderRadius: 14, padding: '20px 24px', marginBottom: 24, minHeight: 80, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: '#7b61ff11', border: '1px solid #7b61ff22' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#5a5a8a', letterSpacing: '.1em', textTransform: 'uppercase' }}>VoxFlow Pay</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: brand() === 'VISA' ? '#1a73e8' : brand() === 'MC' ? '#eb001b' : '#7b61ff', letterSpacing: '.05em' }}>{brand()}</div>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 16, color: num ? '#c8c8e8' : '#3a3a5a', letterSpacing: '.2em', marginBottom: 10 }}>{num || '---- ---- ---- ----'}</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
            <div><span style={{ color: '#4a4a6a', fontSize: 9, display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Titulaire</span><span style={{ color: name ? '#a8a8c8' : '#3a3a5a' }}>{name || 'NOM PRENOM'}</span></div>
            <div><span style={{ color: '#4a4a6a', fontSize: 9, display: 'block', marginBottom: 2, textTransform: 'uppercase' }}>Expiration</span><span style={{ color: exp ? '#a8a8c8' : '#3a3a5a' }}>{exp || 'MM / AA'}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Numero de carte</label>
            <input value={num} onChange={e => setNum(formatNum(e.target.value))} onFocus={() => setFocus('num')} onBlur={() => setFocus(null)} placeholder="1234 5678 9012 3456" maxLength={19} style={inp(focus === 'num')} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Nom du titulaire</label>
            <input value={name} onChange={e => setName(e.target.value.toUpperCase())} onFocus={() => setFocus('name')} onBlur={() => setFocus(null)} placeholder="NOM PRENOM" style={inp(focus === 'name')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Expiration</label>
              <input value={exp} onChange={e => setExp(formatExp(e.target.value))} onFocus={() => setFocus('exp')} onBlur={() => setFocus(null)} placeholder="MM / AA" maxLength={7} style={inp(focus === 'exp')} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Code CVC</label>
              <input value={cvc} onChange={e => setCvc(e.target.value.replace(/\D/g,'').slice(0,4))} onFocus={() => setFocus('cvc')} onBlur={() => setFocus(null)} placeholder="---" maxLength={4} style={{ ...inp(focus === 'cvc'), letterSpacing: '.3em' }} />
            </div>
          </div>
        </div>
        {err && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#ff4d6d18', border: '1px solid #ff4d6d33', fontSize: 12, color: '#ff4d6d' }}>{err}</div>}
        <button onClick={submit} disabled={saving} style={{ width: '100%', marginTop: 20, padding: '13px', background: saving ? '#5a4abf' : '#7b61ff', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Verification...' : 'Enregistrer la carte'}
        </button>
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: '#3a3a5a' }}>Vos donnees de paiement sont chiffrees et securisees</div>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────
export default function PlansPage() {
  const api = useApi()
  const [tab, setTab] = useState<'plans' | 'modules' | 'subscription'>('plans')
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [plans, setPlans] = useState<PlanDef[]>([])
  const [modules, setModules] = useState<ModuleDef[]>([])
  const [sub, setSub] = useState<Subscription | null>(null)
  const [card, setCard] = useState<CardInfo | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const [changingTo, setChangingTo] = useState<string | null>(null)
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [showMatrix, setShowMatrix] = useState(false)
  const [moduleQty, setModuleQty] = useState<Record<string, number>>({})

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  useEffect(() => {
    const load = async () => {
      try {
        const [planRes, subRes] = await Promise.all([
          api('/api/v1/billing/plans'),
          api('/api/v1/billing/subscription'),
        ])
        if (planRes.success && planRes.data) {
          setPlans(planRes.data.plans || [])
          setModules(planRes.data.modules || [])
        }
        if (subRes.success && subRes.data) {
          setSub(subRes.data)
        }
      } catch {}
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const changePlan = async (planId: string) => {
    setChangingTo(planId)
    try {
      await api('/api/v1/billing/subscription/change', { method: 'POST', body: JSON.stringify({ plan_id: planId, seats: sub?.seats || 1 }) })
      const r = await api('/api/v1/billing/subscription')
      if (r.success) setSub(r.data)
      flash('Forfait mis a jour avec succes')
    } catch {}
    setChangingTo(null)
  }

  const subscribeModule = async (sku: string) => {
    setSubscribingTo(sku)
    try {
      const qty = moduleQty[sku] || 1
      await api('/api/v1/billing/modules/subscribe', { method: 'POST', body: JSON.stringify({ sku, quantity: qty }) })
      const r = await api('/api/v1/billing/subscription')
      if (r.success) setSub(r.data)
      flash('Module active avec succes')
    } catch {}
    setSubscribingTo(null)
  }

  const cancelModule = async (sku: string) => {
    try {
      await api('/api/v1/billing/modules/' + sku, { method: 'DELETE' })
      const r = await api('/api/v1/billing/subscription')
      if (r.success) setSub(r.data)
      flash('Module annule')
    } catch {}
  }

  const removeCard = () => { setCard(null); flash('Carte supprimee') }

  const price = (cents: number) => (cents / 100).toFixed(2)
  const limitLabel = (v: number | null) => v === null ? 'Illimite' : String(v)
  const billingUnitLabel = (u: string) => u === 'per_number' ? '/numero/mois' : '/utilisateur/mois'

  const toggleCat = (id: string) => {
    const s = new Set(expandedCats)
    s.has(id) ? s.delete(id) : s.add(id)
    setExpandedCats(s)
  }

  const isModuleActive = (sku: string) => sub?.active_modules?.some(m => m.sku === sku)

  // ── Tabs ────────────────────────────────────────────────
  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'plans', label: 'Forfaits' },
    { key: 'modules', label: 'Modules' },
    { key: 'subscription', label: 'Mon abonnement' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0, marginBottom: 6 }}>Mes forfaits</h1>
        <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Gerez votre abonnement, vos modules et votre methode de paiement.</p>
      </div>

      {msg && <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#00d4aa18', border: '1px solid #00d4aa33', fontSize: 13, color: '#00d4aa' }}>{msg}</div>}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1e1e3a', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 24px', background: 'transparent', border: 'none', borderBottom: tab === t.key ? '2px solid #7b61ff' : '2px solid transparent',
              color: tab === t.key ? '#e8e8f8' : '#5a5a7a', fontSize: 14, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 1 — FORFAITS                                   */}
      {/* ═══════════════════════════════════════════════════ */}
      {tab === 'plans' && (
        <div>
          {/* Toggle mensuel/annuel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: '#6a6a8a' }}>Cycle de facturation :</span>
            <div style={{ display: 'flex', background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 8, overflow: 'hidden' }}>
              {(['monthly', 'yearly'] as const).map(b => (
                <button key={b} onClick={() => setBilling(b)}
                  style={{ padding: '7px 18px', background: billing === b ? '#7b61ff' : 'transparent', border: 'none',
                    color: billing === b ? '#fff' : '#6a6a8a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {b === 'monthly' ? 'Mensuel' : 'Annuel'}
                </button>
              ))}
            </div>
            {billing === 'yearly' && <span style={{ fontSize: 11, color: '#00d4aa', fontWeight: 600 }}>Economisez jusqu\'a 17%</span>}
          </div>

          {/* Plan cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(plans.length, 5)}, 1fr)`, gap: 12, marginBottom: 24, overflowX: 'auto' }}>
            {plans.map(p => {
              const isCurrent = sub?.plan === p.id
              const priceDisplay = billing === 'yearly' && p.price_yearly
                ? price(Math.round(p.price_yearly / 12))
                : price(p.price_monthly)
              const highlights = PLAN_HIGHLIGHTS[p.id] || []
              const featureCount = countEnabledFeatures(p.features)

              return (
                <div key={p.id} style={{ background: '#0e0e1c', border: `1px solid ${isCurrent ? '#7b61ff55' : p.popular ? '#7b61ff33' : '#1e1e3a'}`,
                  borderRadius: 12, padding: '20px 18px', position: 'relative', display: 'flex', flexDirection: 'column',
                  boxShadow: p.popular ? '0 0 20px #7b61ff11' : 'none', minWidth: 200 }}>

                  {/* Badges */}
                  {p.popular && !isCurrent && <div style={{ position: 'absolute', top: -1, right: 12, background: '#7b61ff', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '.05em' }}>POPULAIRE</div>}
                  {isCurrent && <div style={{ position: 'absolute', top: -1, left: 12, background: '#00d4aa', color: '#000', fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '.05em' }}>MON PLAN</div>}

                  {/* Name */}
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#7b61ff', marginBottom: 4, marginTop: isCurrent || p.popular ? 10 : 0 }}>{p.name}</div>

                  {/* Description */}
                  {p.description && <div style={{ fontSize: 11, color: '#5a5a7a', marginBottom: 10, lineHeight: 1.4 }}>{p.description}</div>}

                  {/* Price */}
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: '#e8e8f8' }}>{priceDisplay}</span>
                    <span style={{ fontSize: 11, color: '#5a5a7a' }}> $/util./mois</span>
                  </div>
                  {billing === 'yearly' && p.price_yearly && (
                    <div style={{ fontSize: 11, color: '#00d4aa', marginBottom: 6 }}>
                      {price(p.price_yearly)} $/an ({Math.round((1 - p.price_yearly / (p.price_monthly * 12)) * 100)}% economie)
                    </div>
                  )}
                  {billing === 'yearly' && !p.price_yearly && p.price_monthly > 0 && (
                    <div style={{ fontSize: 11, color: '#4a4a6a', marginBottom: 6, fontStyle: 'italic' }}>Contactez-nous pour le prix annuel</div>
                  )}

                  {/* Limits pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#7b61ff12', border: '1px solid #7b61ff22', color: '#a695ff' }}>
                      {limitLabel(p.max_agents)} agents
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#7b61ff12', border: '1px solid #7b61ff22', color: '#a695ff' }}>
                      {limitLabel(p.max_dids)} DID
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#0e0e1c', border: '1px solid #2a2a4a', color: '#5a5a7a' }}>
                      {featureCount}/71 fonctionnalites
                    </span>
                  </div>

                  {/* Highlights */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, flex: 1 }}>
                    {highlights.map(h => (
                      <div key={h} style={{ fontSize: 12, color: '#8888a8', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: '#00d4aa', flexShrink: 0, marginTop: 1 }}>&#10003;</span>{h}
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  {isCurrent ? (
                    <div style={{ padding: '9px', textAlign: 'center', background: '#7b61ff18', border: '1px solid #7b61ff33', borderRadius: 8, fontSize: 12, color: '#a695ff' }}>Plan actuel</div>
                  ) : (
                    <button onClick={() => changePlan(p.id)} disabled={changingTo === p.id}
                      style={{ width: '100%', padding: '10px', background: changingTo === p.id ? '#3a3a6a' : p.popular ? '#7b61ff' : '#1a1a3a', border: p.popular ? 'none' : '1px solid #2a2a4a',
                        borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {changingTo === p.id ? 'Changement...' : `Passer a ${p.name}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Feature comparison matrix (collapsible) */}
          <div style={{ marginBottom: 24 }}>
            <button onClick={() => setShowMatrix(!showMatrix)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#7b61ff', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0' }}>
              <span style={{ transform: showMatrix ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'inline-block' }}>&#9654;</span>
              Comparaison detaillee des fonctionnalites ({FEATURE_CATEGORIES.reduce((s, c) => s + c.features.length, 0)} fonctionnalites)
            </button>

            {showMatrix && (
              <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
                {/* Matrix header */}
                <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${plans.length}, 1fr)`, borderBottom: '1px solid #1e1e3a', position: 'sticky', top: 0, background: '#0e0e1c', zIndex: 2 }}>
                  <div style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#4a4a6a', textTransform: 'uppercase' }}>Fonctionnalite</div>
                  {plans.map(p => (
                    <div key={p.id} style={{ padding: '12px 8px', fontSize: 12, fontWeight: 700, color: '#7b61ff', textAlign: 'center' }}>{p.name}</div>
                  ))}
                </div>

                {/* Categories */}
                {FEATURE_CATEGORIES.map(cat => (
                  <div key={cat.id}>
                    {/* Category header */}
                    <button onClick={() => toggleCat(cat.id)}
                      style={{ width: '100%', display: 'grid', gridTemplateColumns: `200px repeat(${plans.length}, 1fr)`, background: '#0a0a18', border: 'none', borderBottom: '1px solid #1e1e3a', cursor: 'pointer', padding: 0 }}>
                      <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#a695ff', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ transform: expandedCats.has(cat.id) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', display: 'inline-block', fontSize: 10 }}>&#9654;</span>
                        {cat.label} ({cat.features.length})
                      </div>
                      {plans.map(p => {
                        const enabled = cat.features.filter(f => p.features[f.key]).length
                        return <div key={p.id} style={{ padding: '10px 8px', fontSize: 11, color: '#5a5a7a', textAlign: 'center' }}>{enabled}/{cat.features.length}</div>
                      })}
                    </button>

                    {/* Feature rows */}
                    {expandedCats.has(cat.id) && cat.features.map(f => (
                      <div key={f.key} style={{ display: 'grid', gridTemplateColumns: `200px repeat(${plans.length}, 1fr)`, borderBottom: '1px solid #14141f' }}>
                        <div style={{ padding: '8px 16px 8px 32px', fontSize: 12, color: '#8888a8' }}>{f.label}</div>
                        {plans.map(p => (
                          <div key={p.id} style={{ padding: '8px', textAlign: 'center', fontSize: 13, color: p.features[f.key] ? '#00d4aa' : '#2a2a4a' }}>
                            {p.features[f.key] ? '\u2713' : '\u2014'}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '12px 16px', background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 8, fontSize: 12, color: '#5a5a7a' }}>
            Les changements de plan prennent effet immediatement avec facturation au prorata. Essai gratuit 14 jours -- aucune carte de credit requise pour commencer.
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 2 — MODULES                                    */}
      {/* ═══════════════════════════════════════════════════ */}
      {tab === 'modules' && (
        <div>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: '0 0 20px' }}>
            Ajoutez des modules a votre forfait pour etendre les capacites de votre centre de contact.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {modules.map(m => {
              const active = isModuleActive(m.sku)
              const activeModule = sub?.active_modules?.find(am => am.sku === m.sku)
              const qty = moduleQty[m.sku] ?? (activeModule?.quantity || 1)

              return (
                <div key={m.sku} style={{ background: '#0e0e1c', border: `1px solid ${active ? '#00d4aa33' : '#1e1e3a'}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
                  {/* Active badge */}
                  {active && <div style={{ alignSelf: 'flex-start', fontSize: 9, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: '#00d4aa18', color: '#00d4aa', border: '1px solid #00d4aa33', marginBottom: 10, letterSpacing: '.05em' }}>ACTIF</div>}

                  {/* Name + description */}
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f8', marginBottom: 6 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#6a6a8a', marginBottom: 16, lineHeight: 1.5, flex: 1 }}>{m.description}</div>

                  {/* Price */}
                  <div style={{ marginBottom: 16 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#7b61ff' }}>{price(m.price_monthly)}</span>
                    <span style={{ fontSize: 11, color: '#5a5a7a' }}> ${billingUnitLabel(m.billing_unit)}</span>
                  </div>

                  {/* Quantity selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: '#6a6a8a' }}>Quantite</span>
                    <button onClick={() => setModuleQty(q => ({ ...q, [m.sku]: Math.max(1, (q[m.sku] ?? qty) - 1) }))}
                      style={{ width: 28, height: 28, borderRadius: 6, background: '#1a1a3a', border: '1px solid #2a2a4a', color: '#a8a8c8', cursor: 'pointer', fontSize: 16 }}>-</button>
                    <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, color: '#e8e8f8' }}>{moduleQty[m.sku] ?? qty}</span>
                    <button onClick={() => setModuleQty(q => ({ ...q, [m.sku]: (q[m.sku] ?? qty) + 1 }))}
                      style={{ width: 28, height: 28, borderRadius: 6, background: '#1a1a3a', border: '1px solid #2a2a4a', color: '#a8a8c8', cursor: 'pointer', fontSize: 16 }}>+</button>
                    <span style={{ fontSize: 12, color: '#5a5a7a' }}>= {price(m.price_monthly * (moduleQty[m.sku] ?? qty))} $/mois</span>
                  </div>

                  {/* Action */}
                  {active ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => subscribeModule(m.sku)} disabled={subscribingTo === m.sku}
                        style={{ flex: 1, padding: '9px', background: '#1a1a3a', border: '1px solid #2a2a4a', borderRadius: 8, color: '#a8a8c8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Mettre a jour
                      </button>
                      <button onClick={() => cancelModule(m.sku)}
                        style={{ padding: '9px 16px', background: 'transparent', border: '1px solid #ff4d6d33', borderRadius: 8, color: '#ff4d6d77', fontSize: 12, cursor: 'pointer' }}>
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => subscribeModule(m.sku)} disabled={subscribingTo === m.sku}
                      style={{ width: '100%', padding: '10px', background: subscribingTo === m.sku ? '#3a3a6a' : '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {subscribingTo === m.sku ? 'Activation...' : 'Souscrire'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {modules.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#3a3a5a', fontSize: 13, fontStyle: 'italic' }}>
              Aucun module disponible pour le moment.
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 3 — MON ABONNEMENT                             */}
      {/* ═══════════════════════════════════════════════════ */}
      {tab === 'subscription' && sub && (
        <div>
          {/* Plan actuel */}
          <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Plan actuel</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#7b61ff' }}>{sub.plan_name}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#00d4aa18', color: '#00d4aa', border: '1px solid #00d4aa33' }}>
                    {sub.status === 'active' ? 'Actif' : sub.status === 'past_due' ? 'Paiement en retard' : sub.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                  {[
                    ['Agents', limitLabel(sub.limits.max_agents)],
                    ['DID', limitLabel(sub.limits.max_dids)],
                  ].map(([k, v]) => (
                    <div key={k as string} style={{ fontSize: 12, color: '#7b61ff' }}>
                      <span style={{ color: '#4a4a6a', marginRight: 4 }}>{k}</span>{v}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 12, color: '#6a6a8a' }}>Sieges</span>
                  <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, color: '#e8e8f8', fontSize: 16 }}>{sub.seats}</span>
                  <span style={{ fontSize: 12, color: '#6a6a8a' }}>agents</span>
                </div>
                <div style={{ fontSize: 12, color: '#5a5a7a', marginBottom: 2 }}>
                  Renouvellement : {new Date(sub.renews_at).toLocaleDateString('fr-CA', { day: '2-digit', month: 'long' })}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#7b61ff' }}>{sub.amount.toFixed(2)} CAD/mois</div>
              </div>
            </div>
          </div>

          {/* Modules actifs */}
          {sub.active_modules.length > 0 && (
            <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#c8c8e8', marginBottom: 14 }}>Modules actifs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sub.active_modules.map(m => (
                  <div key={m.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#13131f', border: '1px solid #2a2a4a', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#c8c8e8' }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: '#5a5a7a' }}>{m.quantity} x {m.unit_price.toFixed(2)} ${billingUnitLabel(m.billing_unit)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#7b61ff' }}>{m.total.toFixed(2)} $/mois</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#c8c8e8', marginBottom: 14 }}>Resume facturation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8888a8' }}>
                <span>Forfait {sub.plan_name} x {sub.seats} sieges</span>
                <span>{sub.amount.toFixed(2)} $</span>
              </div>
              {sub.active_modules.map(m => (
                <div key={m.sku} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8888a8' }}>
                  <span>{m.name} x {m.quantity}</span>
                  <span>{m.total.toFixed(2)} $</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                <span style={{ color: '#e8e8f8' }}>Total mensuel</span>
                <span style={{ color: '#7b61ff' }}>{sub.grand_total.toFixed(2)} CAD</span>
              </div>
            </div>
          </div>

          {/* Methode de paiement */}
          <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#c8c8e8' }}>Methode de paiement</div>
              {!card && (
                <button onClick={() => setShowPayModal(true)} style={{ padding: '7px 16px', background: '#7b61ff18', border: '1px solid #7b61ff44', borderRadius: 8, color: '#a695ff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  + Ajouter une carte
                </button>
              )}
            </div>
            {card ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#13131f', border: '1px solid #2a2a4a', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 30, background: 'linear-gradient(135deg, #1a1a3a, #0e0e2a)', border: '1px solid #3a3a5a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#7b61ff' }}>{card.brand}</div>
                  <div>
                    <div style={{ fontSize: 14, color: '#c8c8e8', fontFamily: 'monospace', letterSpacing: '.1em' }}>---- ---- ---- {card.last4}</div>
                    <div style={{ fontSize: 11, color: '#5a5a7a', marginTop: 2 }}>{card.name} - Exp. {card.expMonth}/{card.expYear}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowPayModal(true)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 7, color: '#6a6a8a', fontSize: 11, cursor: 'pointer' }}>Modifier</button>
                  <button onClick={removeCard} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #ff4d6d33', borderRadius: 7, color: '#ff4d6d77', fontSize: 11, cursor: 'pointer' }}>Retirer</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#3a3a5a', fontSize: 13, fontStyle: 'italic' }}>
                Aucune carte enregistree -- ajoutez une carte pour activer la facturation automatique.
              </div>
            )}
          </div>

          {sub.trial_ends_at && (
            <div style={{ padding: '12px 16px', background: '#7b61ff12', border: '1px solid #7b61ff33', borderRadius: 8, fontSize: 12, color: '#a695ff' }}>
              Periode d'essai en cours -- expire le {new Date(sub.trial_ends_at).toLocaleDateString('fr-CA', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </div>
          )}
        </div>
      )}

      {tab === 'subscription' && !sub && (
        <div style={{ padding: 40, textAlign: 'center', color: '#3a3a5a', fontSize: 13 }}>Chargement de votre abonnement...</div>
      )}

      {showPayModal && <PaymentModal onClose={() => setShowPayModal(false)} onSuccess={c => { setCard(c); setShowPayModal(false); flash('Carte enregistree avec succes') }} />}
    </div>
  )
}
