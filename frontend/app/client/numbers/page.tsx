'use client'

import { useState, useEffect, useCallback } from 'react'

/* ────────────────────────────── Types ────────────────────────────── */

interface DIDNumber {
  id: string
  phone_number: string
  country: string
  region: string
  action_type: string
  action_target: string
  description: string
  monthly_cost: number
  status: 'active' | 'provisioning' | 'released'
}

/* ────────────────────────────── API ──────────────────────────────── */

function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) } })
    return r.json()
  }
}

/* ────────────────────────────── Data ─────────────────────────────── */

const COUNTRY_OPTIONS = [
  { code: 'CA', label: 'Canada', dotColors: ['#ff0000'] },
  { code: 'US', label: 'Etats-Unis', dotColors: ['#3c3bfa'] },
  { code: 'FR', label: 'France', dotColors: ['#0055a4', '#ffffff', '#ef4135'] },
]

const REGIONS_BY_COUNTRY: Record<string, { label: string; areaCode: string; addressRequired: boolean; delay: string; documentsRequired: string }[]> = {
  CA: [
    { label: 'Quebec', areaCode: '514', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Ontario', areaCode: '416', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Colombie-Britannique', areaCode: '604', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
  ],
  US: [
    { label: 'New York', areaCode: '212', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'California', areaCode: '310', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
  ],
  FR: [
    { label: 'Paris', areaCode: '01', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Lyon', areaCode: '04', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
  ],
}

interface ActionOption { label: string; value: string }
interface ActionGroup { category: string; options: ActionOption[] }

const ACTION_GROUPS: ActionGroup[] = [
  { category: 'Extensions', options: [
    { label: 'Extension 100', value: 'ext-100' },
    { label: 'Extension 101', value: 'ext-101' },
    { label: 'Extension 102', value: 'ext-102' },
    { label: 'Extension 103', value: 'ext-103' },
  ]},
  { category: 'IVR', options: [
    { label: 'IVR Principal', value: 'ivr-principal' },
    { label: 'IVR Support', value: 'ivr-support' },
  ]},
  { category: 'Ring groups', options: [
    { label: 'Groupe Ventes', value: 'rg-ventes' },
    { label: 'Groupe Support', value: 'rg-support' },
  ]},
  { category: 'Time conditions', options: [
    { label: 'Horaire bureau', value: 'tc-bureau' },
    { label: 'Horaire weekend', value: 'tc-weekend' },
  ]},
  { category: 'Voicemails', options: [
    { label: 'Messagerie generale', value: 'vm-general' },
  ]},
]

function findActionLabel(value: string): string {
  for (const g of ACTION_GROUPS) {
    const o = g.options.find(o => o.value === value)
    if (o) return o.label
  }
  return value || '—'
}

/* ────────────────────────────── Styles ───────────────────────────── */

const IS: React.CSSProperties = {
  width: '100%', background: '#080810', border: '1px solid #2a2a4a',
  borderRadius: 8, padding: '9px 12px', color: '#e8e8f8', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, background: '#000000bb', zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const CARD: React.CSSProperties = {
  background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12,
}

/* ────────────────────────────── Helpers ──────────────────────────── */

function CountryDot({ code, size = 10 }: { code: string; size?: number }) {
  const c = COUNTRY_OPTIONS.find(c => c.code === code)
  if (!c) return <span style={{ fontSize: 11, color: '#6a6a8a' }}>{code}</span>
  if (c.dotColors.length === 1) {
    return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c.dotColors[0], flexShrink: 0 }} />
  }
  // Multi-color (FR flag style)
  const segW = size / c.dotColors.length
  return (
    <span style={{ display: 'inline-flex', borderRadius: '50%', overflow: 'hidden', width: size, height: size, flexShrink: 0 }}>
      {c.dotColors.map((col, i) => (
        <span key={i} style={{ width: segW, height: size, background: col }} />
      ))}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active:       { label: 'Actif',          color: '#00d4aa' },
    provisioning: { label: 'Provisionnement', color: '#ff9f43' },
    released:     { label: 'Libere',         color: '#6a6a8a' },
  }
  const s = map[status] || { label: status, color: '#6a6a8a' }
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.color + '18', color: s.color, border: `1px solid ${s.color}33` }}>
      {s.label}
    </span>
  )
}

function GroupedActionSelect({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...IS, ...style }}>
      <option value="">-- Choisir une action --</option>
      {ACTION_GROUPS.map(g => (
        <optgroup key={g.category} label={g.category}>
          {g.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

/* ────────────────────────────── Page ─────────────────────────────── */

export default function NumbersPage() {
  const api = useApi()

  const [numbers, setNumbers]         = useState<DIDNumber[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // Edit drawer
  const [editNum, setEditNum]         = useState<DIDNumber | null>(null)
  const [editAction, setEditAction]   = useState('')
  const [editDesc, setEditDesc]       = useState('')
  const [editSaving, setEditSaving]   = useState(false)

  // Release modal
  const [releaseNum, setReleaseNum]   = useState<DIDNumber | null>(null)
  const [releasing, setReleasing]     = useState(false)

  // Wizard
  const [wizardOpen, setWizardOpen]   = useState(false)
  const [wizardStep, setWizardStep]   = useState(1)
  const [wizCountry, setWizCountry]   = useState('CA')
  const [wizRegionIdx, setWizRegionIdx] = useState(0)
  const [wizAction, setWizAction]     = useState('')
  const [wizDesc, setWizDesc]         = useState('')
  const [wizOrdering, setWizOrdering] = useState(false)
  const [wizDone, setWizDone]         = useState(false)

  /* ── Load ── */

  const loadNumbers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api('/api/v1/client/portal/numbers')
      if (Array.isArray(r)) setNumbers(r)
      else if (r.data && Array.isArray(r.data)) setNumbers(r.data)
      else { setNumbers([]); if (r.error) setError(r.error) }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les numeros')
      setNumbers([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadNumbers() }, [loadNumbers])

  /* ── Edit ── */

  const openEdit = (n: DIDNumber) => {
    setEditNum(n)
    setEditAction(n.action_target || '')
    setEditDesc(n.description || '')
  }

  const saveEdit = async () => {
    if (!editNum) return
    setEditSaving(true)
    try {
      await api(`/api/v1/client/portal/numbers/${editNum.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action_type: editAction ? ACTION_GROUPS.find(g => g.options.some(o => o.value === editAction))?.category || 'extension' : '', action_target: editAction, description: editDesc }),
      })
      setNumbers(prev => prev.map(n => n.id === editNum.id ? { ...n, action_target: editAction, description: editDesc } : n))
      setEditNum(null)
    } catch { /* silent */ }
    setEditSaving(false)
  }

  /* ── Release ── */

  const confirmRelease = async () => {
    if (!releaseNum) return
    setReleasing(true)
    try {
      await api(`/api/v1/client/portal/numbers/${releaseNum.id}`, { method: 'DELETE' })
      setNumbers(prev => prev.filter(n => n.id !== releaseNum.id))
      setReleaseNum(null)
    } catch { /* silent */ }
    setReleasing(false)
  }

  /* ── Wizard ── */

  const resetWizard = () => {
    setWizardOpen(false); setWizardStep(1); setWizCountry('CA')
    setWizRegionIdx(0); setWizAction(''); setWizDesc('')
    setWizOrdering(false); setWizDone(false)
  }

  const wizRegions = REGIONS_BY_COUNTRY[wizCountry] || []
  const wizSelectedRegion = wizRegions[wizRegionIdx] || wizRegions[0]

  const submitOrder = async () => {
    if (!wizSelectedRegion) return
    setWizOrdering(true)
    try {
      await api('/api/v1/client/portal/numbers/order', {
        method: 'POST',
        body: JSON.stringify({
          country: wizCountry,
          region: wizSelectedRegion.label,
          area_code: wizSelectedRegion.areaCode,
          action_type: wizAction ? ACTION_GROUPS.find(g => g.options.some(o => o.value === wizAction))?.category || '' : '',
          action_target: wizAction,
          description: wizDesc,
        }),
      })
      setWizDone(true)
      await loadNumbers()
      setTimeout(() => resetWizard(), 1800)
    } catch { /* silent */ }
    setWizOrdering(false)
  }

  /* ── Render ── */

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0, marginBottom: 6 }}>Numeros DID</h1>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Gerez vos numeros de telephone, assignez-les a vos extensions, IVR ou groupes.</p>
        </div>
        <button
          onClick={() => { resetWizard(); setWizardOpen(true) }}
          style={{ padding: '10px 22px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Commander un numero
        </button>
      </div>

      {/* Table */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 1fr 1.2fr 120px 140px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #1e1e3a' }}>
          {['Numero', 'Pays', 'Region', 'Action assignee', 'Statut', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{h}</div>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: '#4a4a6a', fontSize: 13 }}>Chargement des numeros...</div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ padding: 20, margin: 16, background: '#ff4d6d10', border: '1px solid #ff4d6d33', borderRadius: 8, color: '#ff4d6d', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && numbers.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#4a4a6a' }}>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Aucun numero</div>
            <div style={{ fontSize: 12, color: '#3a3a5a' }}>Commandez votre premier numero en cliquant sur "Commander un numero".</div>
          </div>
        )}

        {/* Rows */}
        {numbers.map((n, i) => (
          <div
            key={n.id}
            style={{
              display: 'grid', gridTemplateColumns: '2fr 100px 1fr 1.2fr 120px 140px',
              gap: 12, padding: '14px 20px', alignItems: 'center',
              borderBottom: i < numbers.length - 1 ? '1px solid #1a1a2e' : 'none',
            }}
          >
            {/* Numero */}
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f8', fontFamily: 'monospace' }}>
              {n.phone_number}
            </div>

            {/* Pays */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CountryDot code={n.country} size={10} />
              <span style={{ fontSize: 12, color: '#9898b8' }}>{n.country}</span>
            </div>

            {/* Region */}
            <div style={{ fontSize: 13, color: '#9898b8' }}>{n.region || '—'}</div>

            {/* Action assignee */}
            <div style={{ fontSize: 13, color: n.action_target ? '#c8c8e8' : '#3a3a5a', fontStyle: n.action_target ? 'normal' : 'italic' }}>
              {findActionLabel(n.action_target)}
            </div>

            {/* Statut */}
            <StatusBadge status={n.status} />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => openEdit(n)}
                style={{ padding: '5px 12px', background: '#7b61ff18', border: '1px solid #7b61ff44', borderRadius: 6, color: '#a695ff', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
              >
                Editer
              </button>
              <button
                onClick={() => setReleaseNum(n)}
                style={{ padding: '5px 12px', background: '#ff4d6d10', border: '1px solid #ff4d6d33', borderRadius: 6, color: '#ff4d6d99', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}
              >
                Liberer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Release Confirm Modal ── */}
      {releaseNum && (
        <div style={OVERLAY} onClick={() => !releasing && setReleaseNum(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0f1e', border: '1px solid #2a2a4a', borderRadius: 16, padding: 32, width: 460, maxWidth: '90vw' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f8', marginBottom: 6 }}>Liberer le numero</div>
            <div style={{ fontSize: 13, color: '#7b61ff', fontFamily: 'monospace', marginBottom: 20 }}>{releaseNum.phone_number}</div>
            <div style={{ background: '#ff4d6d10', border: '1px solid #ff4d6d33', borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#ff8a9e', lineHeight: 1.5 }}>
                Attention : cette action est irreversible. Le numero sera libere et ne pourra plus etre recupere.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setReleaseNum(null)}
                disabled={releasing}
                style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 8, color: '#6a6a8a', fontSize: 13, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={confirmRelease}
                disabled={releasing}
                style={{ padding: '10px 20px', background: '#ff4d6d', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: releasing ? 0.6 : 1 }}
              >
                {releasing ? 'Liberation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Drawer (right side) ── */}
      {editNum && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: '#000000aa', zIndex: 50 }} onClick={() => !editSaving && setEditNum(null)} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '95vw',
            background: '#0c0c1a', borderLeft: '1px solid #1e1e3a', zIndex: 51,
            display: 'flex', flexDirection: 'column',
            transform: 'translateX(0)', transition: 'transform .2s ease',
          }}>
            {/* Drawer header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #1e1e3a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f8', marginBottom: 4 }}>Editer le numero</div>
                  <div style={{ fontSize: 13, color: '#7b61ff', fontFamily: 'monospace' }}>{editNum.phone_number}</div>
                </div>
                <button onClick={() => setEditNum(null)} style={{ background: 'transparent', border: 'none', color: '#5a5a7a', cursor: 'pointer', fontSize: 22, padding: 0 }}>x</button>
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
              <FL label="Action assignee">
                <GroupedActionSelect value={editAction} onChange={setEditAction} />
              </FL>

              <FL label="Description">
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={4}
                  style={{ ...IS, resize: 'vertical' }}
                  placeholder="Description du numero..."
                />
              </FL>

              {/* Info block */}
              <div style={{ background: '#080810', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Informations</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#5a5a7a' }}>Pays</span>
                  <span style={{ color: '#9898b8', display: 'flex', alignItems: 'center', gap: 6 }}><CountryDot code={editNum.country} size={8} /> {editNum.country}</span>
                  <span style={{ color: '#5a5a7a' }}>Region</span>
                  <span style={{ color: '#9898b8' }}>{editNum.region || '—'}</span>
                  <span style={{ color: '#5a5a7a' }}>Cout mensuel</span>
                  <span style={{ color: '#7b61ff', fontWeight: 600 }}>{(editNum.monthly_cost ?? 0).toFixed(2)} CAD$/mois</span>
                  <span style={{ color: '#5a5a7a' }}>Statut</span>
                  <span><StatusBadge status={editNum.status} /></span>
                </div>
              </div>
            </div>

            {/* Drawer footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #1e1e3a', display: 'flex', gap: 10 }}>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                style={{ flex: 1, padding: '11px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: editSaving ? 0.6 : 1 }}
              >
                {editSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button
                onClick={() => setEditNum(null)}
                style={{ padding: '11px 20px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 8, color: '#6a6a8a', fontSize: 13, cursor: 'pointer' }}
              >
                Annuler
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Order Wizard Modal ── */}
      {wizardOpen && (
        <div style={OVERLAY} onClick={() => { if (!wizOrdering) resetWizard() }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0f1e', border: '1px solid #2a2a4a', borderRadius: 16, padding: 0, width: 560, maxWidth: '95vw', overflow: 'hidden' }}>

            {/* Step indicators */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '24px 32px 20px' }}>
              {[1, 2, 3].map(step => {
                const isDone = wizardStep > step
                const isActive = wizardStep === step
                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      background: isDone ? '#00d4aa' : isActive ? '#7b61ff' : '#1e1e3a',
                      color: isDone ? '#080810' : isActive ? '#fff' : '#4a4a6a',
                      border: `2px solid ${isDone ? '#00d4aa' : isActive ? '#7b61ff' : '#2a2a4a'}`,
                      transition: 'all .2s',
                    }}>
                      {isDone ? '✓' : step}
                    </div>
                    {step < 3 && (
                      <div style={{ width: 60, height: 2, background: isDone ? '#00d4aa44' : '#1e1e3a', margin: '0 8px' }} />
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '0 32px 28px' }}>

              {/* Step titles */}
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f8', marginBottom: 4 }}>
                {wizardStep === 1 && 'Choisir Region'}
                {wizardStep === 2 && 'Choisir Action'}
                {wizardStep === 3 && 'Resume'}
              </div>
              <div style={{ fontSize: 12, color: '#4a4a6a', marginBottom: 20 }}>
                {wizardStep === 1 && 'Selectionnez le pays et la region pour votre nouveau numero.'}
                {wizardStep === 2 && 'Definissez l\'action a executer lorsque ce numero recoit un appel.'}
                {wizardStep === 3 && 'Verifiez les informations avant de confirmer votre commande.'}
              </div>

              {/* ── Step 1: Region ── */}
              {wizardStep === 1 && (
                <>
                  <FL label="Pays">
                    <select
                      value={wizCountry}
                      onChange={e => { setWizCountry(e.target.value); setWizRegionIdx(0) }}
                      style={IS}
                    >
                      {COUNTRY_OPTIONS.map(c => (
                        <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                      ))}
                    </select>
                    {/* Country dot display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <CountryDot code={wizCountry} size={14} />
                      <span style={{ fontSize: 12, color: '#6a6a8a' }}>{COUNTRY_OPTIONS.find(c => c.code === wizCountry)?.label}</span>
                    </div>
                  </FL>

                  <FL label="Region / Indicatif">
                    <select
                      value={wizRegionIdx}
                      onChange={e => setWizRegionIdx(Number(e.target.value))}
                      style={IS}
                    >
                      {wizRegions.map((r, i) => (
                        <option key={i} value={i}>{r.label} ({r.areaCode})</option>
                      ))}
                    </select>
                  </FL>

                  {/* Info table */}
                  {wizSelectedRegion && (
                    <div style={{ background: '#080810', borderRadius: 10, padding: '14px 18px' }}>
                      <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Informations de provisionnement</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                        <span style={{ color: '#5a5a7a' }}>Adresse requise</span>
                        <span style={{ color: wizSelectedRegion.addressRequired ? '#ff9f43' : '#00d4aa', fontWeight: 600 }}>
                          {wizSelectedRegion.addressRequired ? 'Oui' : 'Non'}
                        </span>
                        <span style={{ color: '#5a5a7a' }}>Delai provisionnement</span>
                        <span style={{ color: '#9898b8' }}>{wizSelectedRegion.delay}</span>
                        <span style={{ color: '#5a5a7a' }}>Documents requis</span>
                        <span style={{ color: wizSelectedRegion.documentsRequired === 'Aucun' ? '#00d4aa' : '#ff9f43', fontWeight: 500 }}>
                          {wizSelectedRegion.documentsRequired}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Step 2: Action ── */}
              {wizardStep === 2 && (
                <>
                  <FL label="Action assignee">
                    <GroupedActionSelect value={wizAction} onChange={setWizAction} />
                  </FL>

                  <FL label="Description">
                    <textarea
                      value={wizDesc}
                      onChange={e => setWizDesc(e.target.value)}
                      rows={3}
                      style={{ ...IS, resize: 'vertical' }}
                      placeholder="Description facultative..."
                    />
                  </FL>
                </>
              )}

              {/* ── Step 3: Summary ── */}
              {wizardStep === 3 && (
                <>
                  {wizDone ? (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                      <div style={{ fontSize: 36, marginBottom: 12, color: '#00d4aa' }}>OK</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#00d4aa', marginBottom: 6 }}>Commande envoyee</div>
                      <div style={{ fontSize: 12, color: '#6a6a8a' }}>Votre numero sera provisionne sous 1-3 jours ouvrables.</div>
                    </div>
                  ) : (
                    <div style={{ background: '#080810', borderRadius: 10, padding: '18px 22px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, fontSize: 13 }}>
                        <span style={{ color: '#5a5a7a' }}>Pays</span>
                        <span style={{ color: '#e8e8f8', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CountryDot code={wizCountry} size={10} />
                          {COUNTRY_OPTIONS.find(c => c.code === wizCountry)?.label} ({wizCountry})
                        </span>

                        <span style={{ color: '#5a5a7a' }}>Region</span>
                        <span style={{ color: '#e8e8f8' }}>{wizSelectedRegion?.label}</span>

                        <span style={{ color: '#5a5a7a' }}>Indicatif</span>
                        <span style={{ color: '#e8e8f8', fontFamily: 'monospace' }}>{wizSelectedRegion?.areaCode}</span>

                        <span style={{ color: '#5a5a7a' }}>Action</span>
                        <span style={{ color: '#e8e8f8' }}>{wizAction ? findActionLabel(wizAction) : '— Aucune —'}</span>

                        <span style={{ color: '#5a5a7a' }}>Prix</span>
                        <span style={{ color: '#7b61ff', fontWeight: 700, fontSize: 15 }}>7 CAD$/mois</span>
                      </div>

                      <div style={{ marginTop: 18, padding: '12px 16px', background: '#7b61ff10', border: '1px solid #7b61ff33', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: '#a695ff', lineHeight: 1.5 }}>
                          Provisionnement sous 1-3 jours ouvrables
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Buttons */}
              {!wizDone && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                  {wizardStep === 1 && (
                    <button onClick={resetWizard} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 8, color: '#6a6a8a', fontSize: 13, cursor: 'pointer' }}>
                      Fermer
                    </button>
                  )}
                  {wizardStep > 1 && (
                    <button onClick={() => setWizardStep(s => s - 1)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 8, color: '#6a6a8a', fontSize: 13, cursor: 'pointer' }}>
                      Retour
                    </button>
                  )}
                  {wizardStep < 3 && (
                    <button onClick={() => setWizardStep(s => s + 1)} style={{ padding: '10px 22px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Suivant
                    </button>
                  )}
                  {wizardStep === 3 && (
                    <button
                      onClick={submitOrder}
                      disabled={wizOrdering}
                      style={{ padding: '10px 22px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: wizOrdering ? 0.6 : 1 }}
                    >
                      {wizOrdering ? 'Commande en cours...' : 'Confirmer l\'achat'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
