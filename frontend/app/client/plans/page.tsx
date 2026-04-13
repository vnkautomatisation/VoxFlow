'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────
interface PlanDef {
  id: string
  name: string
  description: string | null
  price_monthly: number
  price_yearly: number | null
  features_list: string[]
  highlight: boolean
  service_type: string
}

interface AddonDef {
  sku: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number | null
  billing_unit: string
}

interface SubInfo {
  plan_id: string
  service_type: string
  quantity: number
  status: string
  unit_price: number
  billing_cycle: string
}

interface ChangeEntry {
  label: string
  oldQty: number
  newQty: number
  unitPrice: number
}

// ── API helper ─────────────────────────────────────────────
function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) },
    })
    return r.json()
  }
}

// ── Badge colors by plan id prefix ─────────────────────────
const PLAN_BADGE_COLORS: Record<string, string> = {
  TEL_BASIC: '#00d4aa',
  TEL_CONFORT: '#38b6ff',
  TEL_PREMIUM: '#7b61ff',
  TEL_PRO: '#ff8c42',
  DIALER_CA_US: '#7b61ff',
  DIALER_FR_MOBILE: '#ff8c42',
  ROBOT: '#00d4aa',
  ADDON_DID: '#38b6ff',
  ADDON_RECORDING: '#00d4aa',
  ADDON_AI_TRANSCRIPTION: '#ff8c42',
  ADDON_SMS: '#7b61ff',
  ADDON_CRM_INTEGRATIONS: '#ff4d6d',
}

function getBadgeColor(id: string): string {
  return PLAN_BADGE_COLORS[id] || '#7b61ff'
}

// ── Format price from cents ────────────────────────────────
function fmtPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

// ── Confirmation Modal ─────────────────────────────────────
function ConfirmModal({ title, message, onCancel, onConfirm, confirmLabel, danger }: {
  title: string; message: string; onCancel: () => void; onConfirm: () => void; confirmLabel?: string; danger?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',ui-sans-serif,system-ui,sans-serif" }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c1a', border: '1px solid #2a2a4a', borderRadius: 16, padding: 32, width: 460, maxWidth: '95vw' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#e8e8f8', marginBottom: 16 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#8888a8', lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 28 }}>{message}</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 24px', background: '#1a1a3a', border: '1px solid #2a2a4a', borderRadius: 8, color: '#8888a8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
          <button onClick={onConfirm} style={{ padding: '10px 24px', background: danger ? '#ff4d6d' : '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{confirmLabel || 'Confirmer'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Changes Recap Modal ────────────────────────────────────
function ChangesModal({ changes, newTotal, onCancel, onConfirm }: {
  changes: ChangeEntry[]; newTotal: number; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',ui-sans-serif,system-ui,sans-serif" }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c1a', border: '1px solid #2a2a4a', borderRadius: 16, padding: 32, width: 520, maxWidth: '95vw' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#e8e8f8', marginBottom: 20 }}>Recapitulatif des changements</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {changes.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#c8c8e8' }}>{c.label}</div>
                <div style={{ fontSize: 11, color: '#5a5a7a', marginTop: 2 }}>
                  {c.oldQty} {'->'} {c.newQty} {c.newQty > c.oldQty ? '(+' + (c.newQty - c.oldQty) + ')' : '(-' + (c.oldQty - c.newQty) + ')'}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.newQty > c.oldQty ? '#00d4aa' : '#ff4d6d' }}>
                {c.newQty > c.oldQty ? '+' : '-'}{fmtPrice(Math.abs(c.newQty - c.oldQty) * c.unitPrice)} CAD$/mois
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 16px', background: '#0e0e1c', border: '1px solid #7b61ff44', borderRadius: 10, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#c8c8e8' }}>Nouveau total mensuel</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#7b61ff' }}>{fmtPrice(newTotal)} CAD$/mois</span>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '10px 24px', background: '#1a1a3a', border: '1px solid #2a2a4a', borderRadius: 8, color: '#8888a8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
          <button onClick={onConfirm} style={{ padding: '10px 24px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Confirmer</button>
        </div>
      </div>
    </div>
  )
}

// ── Service tab config ─────────────────────────────────────
const TABS = [
  { key: 'TELEPHONY', label: "Telephonie d'entreprise" },
  { key: 'DIALER', label: 'Predictive Dialer' },
  { key: 'ROBOT', label: "Robot d'appel" },
  { key: 'ADDONS', label: 'Add-ons' },
] as const

type TabKey = typeof TABS[number]['key']

// ── Page principale ────────────────────────────────────────
export default function PlansPage() {
  const api = useApi()
  const [tab, setTab] = useState<TabKey>('TELEPHONY')
  const [plans, setPlans] = useState<Record<string, PlanDef[]>>({ TELEPHONY: [], DIALER: [], ROBOT: [] })
  const [addons, setAddons] = useState<AddonDef[]>([])
  const [subs, setSubs] = useState<SubInfo[]>([])
  const [editQty, setEditQty] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [showChangesModal, setShowChangesModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const loadData = useCallback(async () => {
    try {
      const [catalogRes, subsRes] = await Promise.all([
        api('/api/v1/client/portal/plans-catalog'),
        api('/api/v1/client/portal/subscriptions'),
      ])
      const cd = catalogRes.data || catalogRes
      if (cd.services) {
        setPlans({
          TELEPHONY: cd.services.TELEPHONY || [],
          DIALER: cd.services.DIALER || [],
          ROBOT: cd.services.ROBOT || [],
        })
      }
      if (cd.addons) setAddons(cd.addons)
      const sd = subsRes.data || subsRes
      if (Array.isArray(sd)) setSubs(sd)
    } catch { /* silent */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // Get current quantity for a plan/addon from subscriptions
  const getSubQty = (id: string): number => {
    const s = subs.find(s => s.plan_id === id)
    return s ? s.quantity : 0
  }

  // Get editable quantity (falls back to subscription qty)
  const getQty = (id: string): number => {
    return editQty[id] !== undefined ? editQty[id] : getSubQty(id)
  }

  const adjustQty = (id: string, delta: number) => {
    const current = getQty(id)
    const next = Math.max(0, current + delta)
    setEditQty(prev => ({ ...prev, [id]: next }))
  }

  // Check if there are pending changes
  const getChanges = (): ChangeEntry[] => {
    const changes: ChangeEntry[] = []
    // Check plans
    for (const serviceType of ['TELEPHONY', 'DIALER', 'ROBOT'] as const) {
      for (const p of plans[serviceType]) {
        const oldQty = getSubQty(p.id)
        const newQty = editQty[p.id]
        if (newQty !== undefined && newQty !== oldQty) {
          changes.push({ label: p.name, oldQty, newQty, unitPrice: p.price_monthly })
        }
      }
    }
    // Check addons
    for (const a of addons) {
      const oldQty = getSubQty(a.sku)
      const newQty = editQty[a.sku]
      if (newQty !== undefined && newQty !== oldQty) {
        changes.push({ label: a.name, oldQty, newQty, unitPrice: a.price_monthly })
      }
    }
    return changes
  }

  // Calculate new monthly total after changes
  const calcNewTotal = (): number => {
    let total = 0
    for (const serviceType of ['TELEPHONY', 'DIALER', 'ROBOT'] as const) {
      for (const p of plans[serviceType]) {
        total += p.price_monthly * getQty(p.id)
      }
    }
    for (const a of addons) {
      total += a.price_monthly * getQty(a.sku)
    }
    return total
  }

  // Calculate current recurring total from subs
  const currentTotal = (): number => {
    return subs.reduce((sum, s) => sum + s.unit_price * s.quantity, 0)
  }

  const handleConfirmChanges = () => {
    // In a real app, this would call a PATCH/POST endpoint
    flash('Modifications enregistrees avec succes')
    setShowChangesModal(false)
    setEditQty({})
    loadData()
  }

  const handleCancelSubscription = () => {
    flash('Demande d\'annulation envoyee. Notre equipe vous contactera sous 24h.')
    setShowCancelModal(false)
  }

  const hasChanges = getChanges().length > 0

  // Registration date from JWT
  const getRegDate = (): string => {
    if (typeof window === 'undefined') return '-'
    try {
      const tok = localStorage.getItem('vf_tok')
      if (!tok) return '-'
      const payload = JSON.parse(atob(tok.split('.')[1]))
      if (payload.iat) return new Date(payload.iat * 1000).toLocaleDateString('fr-CA', { day: '2-digit', month: 'long', year: 'numeric' })
      return '-'
    } catch { return '-' }
  }

  // Next payment date (first of next month)
  const getNextPayment = (): string => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return next.toLocaleDateString('fr-CA', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const activePlansCount = subs.filter(s => s.status === 'active' || s.status === 'ACTIVE').length

  // ── Render plan table rows ─────────────────────────────────
  const renderPlanRows = (planList: PlanDef[]) => {
    if (planList.length === 0) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#3a3a5a', fontSize: 13, fontStyle: 'italic' }}>
          Aucun forfait disponible dans cette categorie.
        </div>
      )
    }

    return planList.map(p => {
      const badgeColor = getBadgeColor(p.id)
      const subQty = getSubQty(p.id)
      const hasSub = subQty > 0
      const qty = getQty(p.id)

      return (
        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 160px 80px 140px', padding: '16px 20px', borderBottom: '1px solid #14141f', alignItems: 'center' }}>
          {/* Forfait badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'inline-block', background: `linear-gradient(135deg, ${badgeColor}, ${badgeColor}88)`, padding: '10px 18px', borderRadius: 8, minWidth: 100, textAlign: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.06em', textTransform: 'uppercase' }}>{p.name}</span>
            </div>
            {p.highlight && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: '#7b61ff22', color: '#a695ff', border: '1px solid #7b61ff44', whiteSpace: 'nowrap' }}>Populaire</span>
            )}
          </div>

          {/* Features */}
          <div style={{ paddingRight: 16 }}>
            <div style={{ fontSize: 12, color: '#6a6a8a', lineHeight: 1.5 }}>
              {p.features_list && p.features_list.length > 0
                ? p.features_list.join(', ')
                : (p.description || '-')}
            </div>
          </div>

          {/* Prix */}
          <div>
            <span style={{ fontSize: 20, fontWeight: 800, color: badgeColor }}>{(p.price_monthly / 100).toFixed(0)}</span>
            <span style={{ fontSize: 12, color: '#5a5a7a' }}> CAD$/mois</span>
          </div>

          {/* Actif */}
          <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: subQty > 0 ? '#e8e8f8' : '#3a3a5a' }}>
            {subQty > 0 ? subQty : '-'}
          </div>

          {/* Quantite +/- */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {hasSub ? (
              <>
                <button onClick={() => adjustQty(p.id, -1)}
                  style={{ width: 30, height: 30, borderRadius: 6, background: '#1a1a3a', border: '1px solid #2a2a4a', color: '#a8a8c8', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#e8e8f8' }}>{qty}</span>
                <button onClick={() => adjustQty(p.id, 1)}
                  style={{ width: 30, height: 30, borderRadius: 6, background: '#7b61ff22', border: '1px solid #7b61ff44', color: '#a695ff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: '#3a3a5a' }}>-</span>
            )}
          </div>
        </div>
      )
    })
  }

  // ── Render addon table rows ────────────────────────────────
  const renderAddonRows = () => {
    if (addons.length === 0) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#3a3a5a', fontSize: 13, fontStyle: 'italic' }}>
          Aucun add-on disponible.
        </div>
      )
    }

    return addons.map(a => {
      const badgeColor = getBadgeColor(a.sku)
      const subQty = getSubQty(a.sku)
      const hasSub = subQty > 0
      const qty = getQty(a.sku)

      return (
        <div key={a.sku} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 160px 80px 140px', padding: '16px 20px', borderBottom: '1px solid #14141f', alignItems: 'center' }}>
          {/* Addon badge */}
          <div>
            <div style={{ display: 'inline-block', background: `linear-gradient(135deg, ${badgeColor}, ${badgeColor}88)`, padding: '10px 18px', borderRadius: 8, minWidth: 100, textAlign: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.06em', textTransform: 'uppercase' }}>{a.name}</span>
            </div>
          </div>

          {/* Description */}
          <div style={{ paddingRight: 16 }}>
            <div style={{ fontSize: 12, color: '#6a6a8a', lineHeight: 1.5 }}>{a.description || '-'}</div>
          </div>

          {/* Prix */}
          <div>
            <span style={{ fontSize: 20, fontWeight: 800, color: badgeColor }}>{(a.price_monthly / 100).toFixed(0)}</span>
            <span style={{ fontSize: 12, color: '#5a5a7a' }}> CAD$/mois</span>
          </div>

          {/* Actif */}
          <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: subQty > 0 ? '#e8e8f8' : '#3a3a5a' }}>
            {subQty > 0 ? subQty : '-'}
          </div>

          {/* Quantite +/- ou bouton Souscrire */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {hasSub ? (
              <>
                <button onClick={() => adjustQty(a.sku, -1)}
                  style={{ width: 30, height: 30, borderRadius: 6, background: '#1a1a3a', border: '1px solid #2a2a4a', color: '#a8a8c8', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#e8e8f8' }}>{qty}</span>
                <button onClick={() => adjustQty(a.sku, 1)}
                  style={{ width: 30, height: 30, borderRadius: 6, background: '#7b61ff22', border: '1px solid #7b61ff44', color: '#a695ff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </>
            ) : (
              <button onClick={() => adjustQty(a.sku, 1)}
                style={{ padding: '6px 16px', background: '#7b61ff22', border: '1px solid #7b61ff44', borderRadius: 8, color: '#a695ff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Souscrire
              </button>
            )}
          </div>
        </div>
      )
    })
  }

  // ── Table wrapper with header ──────────────────────────────
  const renderTable = (content: React.ReactNode) => (
    <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 160px 80px 140px', padding: '12px 20px', borderBottom: '1px solid #1e1e3a', background: '#0a0a18' }}>
        <div style={{ fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '.04em' }}>Forfait</div>
        <div style={{ fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '.04em' }}>Details</div>
        <div style={{ fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '.04em' }}>Prix CAD$/mois</div>
        <div style={{ fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '.04em', textAlign: 'center' }}>Actif</div>
        <div style={{ fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '.04em', textAlign: 'center' }}>Quantite</div>
      </div>
      {content}
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans',ui-sans-serif,system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0, marginBottom: 6 }}>Mes forfaits</h1>
        <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Consultez et gerez vos forfaits, services et add-ons.</p>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#00d4aa18', border: '1px solid #00d4aa33', fontSize: 13, color: '#00d4aa' }}>
          {msg}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1e1e3a', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #7b61ff' : '2px solid transparent',
              color: tab === t.key ? '#e8e8f8' : '#5a5a7a',
              fontSize: 14,
              fontWeight: tab === t.key ? 700 : 500,
              cursor: 'pointer',
              transition: 'all .15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: TELEPHONIE                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'TELEPHONY' && (
        <div>
          {renderTable(renderPlanRows(plans.TELEPHONY))}
          {hasChanges && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={() => setShowChangesModal(true)}
                style={{ padding: '12px 28px', background: '#7b61ff', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Augmenter/Diminuer votre plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: DIALER                                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'DIALER' && (
        <div>
          {renderTable(renderPlanRows(plans.DIALER))}
          {hasChanges && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={() => setShowChangesModal(true)}
                style={{ padding: '12px 28px', background: '#7b61ff', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Augmenter/Diminuer votre plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: ROBOT                                             */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'ROBOT' && (
        <div>
          {renderTable(renderPlanRows(plans.ROBOT))}
          {hasChanges && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={() => setShowChangesModal(true)}
                style={{ padding: '12px 28px', background: '#7b61ff', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Augmenter/Diminuer votre plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: ADD-ONS                                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'ADDONS' && (
        <div>
          {renderTable(renderAddonRows())}
          {hasChanges && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
              <button onClick={() => setShowChangesModal(true)}
                style={{ padding: '12px 28px', background: '#7b61ff', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Augmenter/Diminuer votre plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FOOTER SECTION                                         */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div style={{ marginTop: 16, background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Date d'enregistrement</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#c8c8e8' }}>{getRegDate()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Prochain paiement</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#c8c8e8' }}>{getNextPayment()}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Forfaits actifs</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#c8c8e8' }}>{activePlansCount}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Montant recurrent total</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#7b61ff' }}>{fmtPrice(currentTotal())} CAD$/mois</div>
          </div>
        </div>

        {/* Annulation */}
        <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowCancelModal(true)}
            style={{ padding: '10px 24px', background: '#ff4d6d18', border: '1px solid #ff4d6d33', borderRadius: 8, color: '#ff4d6d', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Demande d'annulation
          </button>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      {showChangesModal && (
        <ChangesModal
          changes={getChanges()}
          newTotal={calcNewTotal()}
          onCancel={() => setShowChangesModal(false)}
          onConfirm={handleConfirmChanges}
        />
      )}

      {showCancelModal && (
        <ConfirmModal
          title="Demande d'annulation"
          message={"Etes-vous sur de vouloir soumettre une demande d'annulation de vos forfaits?\n\nNotre equipe vous contactera sous 24h pour confirmer et traiter votre demande."}
          onCancel={() => setShowCancelModal(false)}
          onConfirm={handleCancelSubscription}
          confirmLabel="Confirmer l'annulation"
          danger
        />
      )}
    </div>
  )
}
