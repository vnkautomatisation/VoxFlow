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

// All Twilio-supported countries for DID purchase
const COUNTRY_OPTIONS = [
  { code: 'CA', label: 'Canada', dotColors: ['#ff0000'] },
  { code: 'US', label: 'Etats-Unis', dotColors: ['#3c3bfa'] },
  { code: 'FR', label: 'France', dotColors: ['#0055a4', '#ffffff', '#ef4135'] },
  { code: 'GB', label: 'Royaume-Uni', dotColors: ['#c8102e'] },
  { code: 'DE', label: 'Allemagne', dotColors: ['#000000', '#dd0000', '#ffcc00'] },
  { code: 'ES', label: 'Espagne', dotColors: ['#c60b1e', '#ffc400'] },
  { code: 'IT', label: 'Italie', dotColors: ['#008c45', '#ffffff', '#cd212a'] },
  { code: 'NL', label: 'Pays-Bas', dotColors: ['#ae1c28', '#ffffff', '#21468b'] },
  { code: 'BE', label: 'Belgique', dotColors: ['#000000', '#ffd90c', '#f31830'] },
  { code: 'CH', label: 'Suisse', dotColors: ['#ff0000'] },
  { code: 'PT', label: 'Portugal', dotColors: ['#006600', '#ff0000'] },
  { code: 'AT', label: 'Autriche', dotColors: ['#ed2939', '#ffffff'] },
  { code: 'IE', label: 'Irlande', dotColors: ['#169b62', '#ffffff', '#ff883e'] },
  { code: 'SE', label: 'Suede', dotColors: ['#006aa7', '#fecc00'] },
  { code: 'NO', label: 'Norvege', dotColors: ['#ef2b2d', '#002868'] },
  { code: 'DK', label: 'Danemark', dotColors: ['#c60c30'] },
  { code: 'FI', label: 'Finlande', dotColors: ['#003580', '#ffffff'] },
  { code: 'PL', label: 'Pologne', dotColors: ['#ffffff', '#dc143c'] },
  { code: 'CZ', label: 'Republique Tcheque', dotColors: ['#11457e', '#d7141a'] },
  { code: 'AU', label: 'Australie', dotColors: ['#00008b', '#ffffff'] },
  { code: 'NZ', label: 'Nouvelle-Zelande', dotColors: ['#00247d'] },
  { code: 'JP', label: 'Japon', dotColors: ['#bc002d'] },
  { code: 'SG', label: 'Singapour', dotColors: ['#ef3340', '#ffffff'] },
  { code: 'HK', label: 'Hong Kong', dotColors: ['#de2910'] },
  { code: 'IL', label: 'Israel', dotColors: ['#0038b8'] },
  { code: 'ZA', label: 'Afrique du Sud', dotColors: ['#007749', '#000000', '#de3831'] },
  { code: 'BR', label: 'Bresil', dotColors: ['#009c3b', '#ffdf00'] },
  { code: 'MX', label: 'Mexique', dotColors: ['#006847', '#ffffff', '#ce1126'] },
  { code: 'AR', label: 'Argentine', dotColors: ['#75aadb', '#ffffff'] },
  { code: 'CL', label: 'Chili', dotColors: ['#d52b1e', '#ffffff', '#0039a6'] },
  { code: 'CO', label: 'Colombie', dotColors: ['#fcd116', '#003893', '#ce1126'] },
  { code: 'PR', label: 'Porto Rico', dotColors: ['#3c3bfa', '#ff0000'] },
  { code: 'DO', label: 'Republique Dominicaine', dotColors: ['#002d62', '#ce1126'] },
  { code: 'IN', label: 'Inde', dotColors: ['#ff9933', '#ffffff', '#138808'] },
  { code: 'PH', label: 'Philippines', dotColors: ['#0038a8', '#ce1126'] },
  { code: 'RO', label: 'Roumanie', dotColors: ['#002b7f', '#fcd116', '#ce1126'] },
  { code: 'BG', label: 'Bulgarie', dotColors: ['#ffffff', '#00966e', '#d62612'] },
  { code: 'HR', label: 'Croatie', dotColors: ['#ff0000', '#ffffff', '#171796'] },
  { code: 'SK', label: 'Slovaquie', dotColors: ['#ffffff', '#0b4ea2', '#ee1c25'] },
  { code: 'LT', label: 'Lituanie', dotColors: ['#fdb913', '#006a44', '#c1272d'] },
  { code: 'LV', label: 'Lettonie', dotColors: ['#9e3039'] },
  { code: 'EE', label: 'Estonie', dotColors: ['#0072ce', '#000000'] },
]

// Default regions per country (main areas) -- for countries not listed, user enters area code manually
const REGIONS_BY_COUNTRY: Record<string, { label: string; areaCode: string; addressRequired: boolean; delay: string; documentsRequired: string }[]> = {
  CA: [
    { label: 'Quebec - Montreal', areaCode: '514', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Quebec - Quebec City', areaCode: '418', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Ontario - Toronto', areaCode: '416', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Ontario - Ottawa', areaCode: '613', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Colombie-Britannique - Vancouver', areaCode: '604', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Alberta - Calgary', areaCode: '403', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Alberta - Edmonton', areaCode: '780', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Manitoba - Winnipeg', areaCode: '204', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Sans-frais / Toll-free', areaCode: '800', addressRequired: false, delay: '1-2 jours', documentsRequired: 'Aucun' },
  ],
  US: [
    { label: 'New York', areaCode: '212', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Los Angeles', areaCode: '310', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Chicago', areaCode: '312', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Houston', areaCode: '713', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Miami', areaCode: '305', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'San Francisco', areaCode: '415', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Washington DC', areaCode: '202', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Toll-free', areaCode: '888', addressRequired: false, delay: '1-2 jours', documentsRequired: 'Aucun' },
  ],
  FR: [
    { label: 'Paris / Ile-de-France', areaCode: '01', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Lyon / Rhone-Alpes', areaCode: '04', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Marseille / PACA', areaCode: '04', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Toulouse / Midi-Pyrenees', areaCode: '05', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Bordeaux / Aquitaine', areaCode: '05', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Nantes / Pays de la Loire', areaCode: '02', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Strasbourg / Alsace', areaCode: '03', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Mobile', areaCode: '06', addressRequired: true, delay: '5-7 jours', documentsRequired: 'Piece identite' },
  ],
  GB: [
    { label: 'London', areaCode: '20', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Proof of address' },
    { label: 'Manchester', areaCode: '161', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Proof of address' },
    { label: 'Birmingham', areaCode: '121', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Proof of address' },
    { label: 'Edinburgh', areaCode: '131', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Proof of address' },
    { label: 'National', areaCode: '330', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
  ],
  DE: [
    { label: 'Berlin', areaCode: '30', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Munich', areaCode: '89', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Frankfurt', areaCode: '69', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Hamburg', areaCode: '40', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
  ],
  ES: [
    { label: 'Madrid', areaCode: '91', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Barcelona', areaCode: '93', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'National', areaCode: '900', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
  ],
  IT: [
    { label: 'Rome', areaCode: '06', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Milan', areaCode: '02', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
  ],
  NL: [
    { label: 'Amsterdam', areaCode: '20', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Rotterdam', areaCode: '10', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
  ],
  BE: [
    { label: 'Bruxelles', areaCode: '2', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Anvers', areaCode: '3', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
  ],
  CH: [
    { label: 'Zurich', areaCode: '44', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Geneve', areaCode: '22', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
  ],
  AU: [
    { label: 'Sydney', areaCode: '2', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
    { label: 'Melbourne', areaCode: '3', addressRequired: false, delay: '1-3 jours', documentsRequired: 'Aucun' },
  ],
  BR: [
    { label: 'Sao Paulo', areaCode: '11', addressRequired: true, delay: '5-7 jours', documentsRequired: 'Piece identite + adresse' },
    { label: 'Rio de Janeiro', areaCode: '21', addressRequired: true, delay: '5-7 jours', documentsRequired: 'Piece identite + adresse' },
  ],
  MX: [
    { label: 'Mexico City', areaCode: '55', addressRequired: true, delay: '5-7 jours', documentsRequired: 'Piece identite' },
  ],
  JP: [
    { label: 'Tokyo', areaCode: '3', addressRequired: true, delay: '5-10 jours', documentsRequired: 'Documents entreprise' },
    { label: 'Osaka', areaCode: '6', addressRequired: true, delay: '5-10 jours', documentsRequired: 'Documents entreprise' },
  ],
  IL: [
    { label: 'Tel Aviv', areaCode: '3', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
  ],
  IN: [
    { label: 'Mumbai', areaCode: '22', addressRequired: true, delay: '7-14 jours', documentsRequired: 'Documents entreprise' },
    { label: 'Delhi', areaCode: '11', addressRequired: true, delay: '7-14 jours', documentsRequired: 'Documents entreprise' },
  ],
  ZA: [
    { label: 'Johannesburg', areaCode: '11', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
    { label: 'Cape Town', areaCode: '21', addressRequired: true, delay: '3-5 jours', documentsRequired: 'Piece identite' },
  ],
}

// For countries without predefined regions, show a generic "area code" input
const DEFAULT_REGION = { label: 'Numero national', areaCode: '', addressRequired: true, delay: '3-7 jours', documentsRequired: 'Selon le pays' }

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
  return value || '--'
}

/* ────────────────────────────── Helpers ──────────────────────────── */

function CountryDot({ code, size = 10 }: { code: string; size?: number }) {
  const c = COUNTRY_OPTIONS.find(c => c.code === code)
  if (!c) return <span className="text-xs text-[#6a6a8a]">{code}</span>
  if (c.dotColors.length === 1) {
    return (
      <span
        className="inline-block rounded-full shrink-0"
        style={{ width: size, height: size, background: c.dotColors[0] }}
      />
    )
  }
  const segW = size / c.dotColors.length
  return (
    <span className="inline-flex rounded-full overflow-hidden shrink-0" style={{ width: size, height: size }}>
      {c.dotColors.map((col, i) => (
        <span key={i} style={{ width: segW, height: size, background: col }} />
      ))}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string; border: string }> = {
    active:       { label: 'Actif',           bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    provisioning: { label: 'Provisionnement', bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20' },
    released:     { label: 'Libere',          bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/20' },
  }
  const s = map[status] || { label: status, bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  )
}

function GroupedActionSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] ${className || ''}`}
    >
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
    <div className="mb-4">
      <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">{label}</label>
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

  /* -- Load -- */

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

  /* -- Edit -- */

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

  /* -- Release -- */

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

  /* -- Wizard -- */

  const resetWizard = () => {
    setWizardOpen(false); setWizardStep(1); setWizCountry('CA')
    setWizRegionIdx(0); setWizAction(''); setWizDesc('')
    setWizOrdering(false); setWizDone(false)
  }

  const wizRegions = REGIONS_BY_COUNTRY[wizCountry] || [DEFAULT_REGION]
  const wizSelectedRegion = wizRegions[wizRegionIdx] || wizRegions[0] || DEFAULT_REGION

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

  /* -- Render -- */

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-7 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#eeeef8] mb-1.5">Numeros DID</h1>
          <p className="text-[13px] text-[#6a6a8a]">Gerez vos numeros de telephone, assignez-les a vos extensions, IVR ou groupes.</p>
        </div>
        <button
          onClick={() => { resetWizard(); setWizardOpen(true) }}
          className="bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold"
        >
          Commander un numero
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid gap-3 px-5 py-3 border-b border-[#1f1f2a]" style={{ gridTemplateColumns: '2fr 100px 1fr 1.2fr 120px 140px' }}>
          {['Numero', 'Pays', 'Region', 'Action assignee', 'Statut', 'Actions'].map(h => (
            <div key={h} className="text-[10px] text-[#4a4a6a] uppercase tracking-wider font-semibold">{h}</div>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-8 text-center text-[#4a4a6a] text-[13px]">Chargement des numeros...</div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mx-4 my-4 p-4 bg-red-500/5 border border-red-500/20 rounded-lg text-red-400 text-[13px]">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && numbers.length === 0 && (
          <div className="py-10 text-center text-[#4a4a6a]">
            <div className="text-sm mb-1.5">Aucun numero</div>
            <div className="text-xs text-[#3a3a5a]">Commandez votre premier numero en cliquant sur "Commander un numero".</div>
          </div>
        )}

        {/* Rows */}
        {numbers.map((n, i) => (
          <div
            key={n.id}
            className={`grid gap-3 px-5 py-3.5 items-center hover:bg-[#1f1f2a] transition-colors ${i < numbers.length - 1 ? 'border-b border-[#1f1f2a]' : ''}`}
            style={{ gridTemplateColumns: '2fr 100px 1fr 1.2fr 120px 140px' }}
          >
            {/* Numero */}
            <div className="text-sm font-semibold text-[#eeeef8] font-mono">{n.phone_number}</div>

            {/* Pays */}
            <div className="flex items-center gap-1.5">
              <CountryDot code={n.country} size={10} />
              <span className="text-xs text-[#9898b8]">{n.country}</span>
            </div>

            {/* Region */}
            <div className="text-[13px] text-[#9898b8]">{n.region || '--'}</div>

            {/* Action assignee */}
            <div className={`text-[13px] ${n.action_target ? 'text-[#c8c8e8]' : 'text-[#3a3a5a] italic'}`}>
              {findActionLabel(n.action_target)}
            </div>

            {/* Statut */}
            <StatusBadge status={n.status} />

            {/* Actions */}
            <div className="flex gap-1.5">
              <button
                onClick={() => openEdit(n)}
                className="px-3 py-1 bg-[#7b61ff]/10 border border-[#7b61ff]/25 rounded-md text-[#a695ff] text-[11px] font-medium hover:bg-[#7b61ff]/20 transition-colors"
              >
                Editer
              </button>
              <button
                onClick={() => setReleaseNum(n)}
                className="px-3 py-1 bg-red-500/5 border border-red-500/20 rounded-md text-red-400/60 text-[11px] font-medium hover:bg-red-500/10 transition-colors"
              >
                Liberer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* -- Release Confirm Modal -- */}
      {releaseNum && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center" onClick={() => !releasing && setReleaseNum(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-8 w-[460px] max-w-[90vw]">
            <div className="text-base font-bold text-[#eeeef8] mb-1.5">Liberer le numero</div>
            <div className="text-[13px] text-[#7b61ff] font-mono mb-5">{releaseNum.phone_number}</div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3.5 mb-6">
              <div className="text-[13px] text-red-300 leading-relaxed">
                Attention : cette action est irreversible. Le numero sera libere et ne pourra plus etre recupere.
              </div>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setReleaseNum(null)}
                disabled={releasing}
                className="px-5 py-2.5 bg-transparent border border-[#2e2e44] rounded-lg text-[#6a6a8a] text-[13px] hover:border-[#3e3e54] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmRelease}
                disabled={releasing}
                className="px-5 py-2.5 bg-red-500 border-none rounded-lg text-white text-[13px] font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {releasing ? 'Liberation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Edit Drawer (right side) -- */}
      {editNum && (
        <>
          <div className="fixed inset-0 bg-black/65 z-50" onClick={() => !editSaving && setEditNum(null)} />
          <div className="fixed top-0 right-0 bottom-0 w-[440px] max-w-[95vw] bg-[#18181f] border-l border-[#2e2e44] z-[51] flex flex-col">
            {/* Drawer header */}
            <div className="px-7 pt-6 pb-5 border-b border-[#2e2e44]">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-base font-bold text-[#eeeef8] mb-1">Editer le numero</div>
                  <div className="text-[13px] text-[#7b61ff] font-mono">{editNum.phone_number}</div>
                </div>
                <button onClick={() => setEditNum(null)} className="text-[#5a5a7a] hover:text-[#8a8aa8] transition-colors text-xl p-0 bg-transparent border-none cursor-pointer">x</button>
              </div>
            </div>

            {/* Drawer body */}
            <div className="flex-1 px-7 py-6 overflow-y-auto">
              <FL label="Action assignee">
                <GroupedActionSelect value={editAction} onChange={setEditAction} />
              </FL>

              <FL label="Description">
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-y"
                  placeholder="Description du numero..."
                />
              </FL>

              {/* Info block */}
              <div className="bg-[#0f0f18] rounded-xl p-4 mb-5">
                <div className="text-[10px] text-[#4a4a6a] uppercase tracking-wider mb-2.5">Informations</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[#5a5a7a]">Pays</span>
                  <span className="text-[#9898b8] flex items-center gap-1.5"><CountryDot code={editNum.country} size={8} /> {editNum.country}</span>
                  <span className="text-[#5a5a7a]">Region</span>
                  <span className="text-[#9898b8]">{editNum.region || '--'}</span>
                  <span className="text-[#5a5a7a]">Cout mensuel</span>
                  <span className="text-[#7b61ff] font-semibold">{(editNum.monthly_cost ?? 0).toFixed(2)} CAD$/mois</span>
                  <span className="text-[#5a5a7a]">Statut</span>
                  <span><StatusBadge status={editNum.status} /></span>
                </div>
              </div>
            </div>

            {/* Drawer footer */}
            <div className="px-7 py-4 border-t border-[#2e2e44] flex gap-2.5">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 py-2.5 bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg text-[13px] font-bold transition-colors disabled:opacity-60"
              >
                {editSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button
                onClick={() => setEditNum(null)}
                className="px-5 py-2.5 bg-transparent border border-[#2e2e44] rounded-lg text-[#6a6a8a] text-[13px] hover:border-[#3e3e54] transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </>
      )}

      {/* -- Order Wizard Modal -- */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center" onClick={() => { if (!wizOrdering) resetWizard() }}>
          <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-xl w-[560px] max-w-[95vw] overflow-hidden">

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-0 px-8 pt-6 pb-5">
              {[1, 2, 3].map(step => {
                const isDone = wizardStep > step
                const isActive = wizardStep === step
                return (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold border-2 transition-all ${
                      isDone ? 'bg-emerald-400 text-[#080810] border-emerald-400' :
                      isActive ? 'bg-[#7b61ff] text-white border-[#7b61ff]' :
                      'bg-[#1e1e3a] text-[#4a4a6a] border-[#2e2e44]'
                    }`}>
                      {isDone ? 'v' : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-[60px] h-0.5 mx-2 ${isDone ? 'bg-emerald-400/25' : 'bg-[#1e1e3a]'}`} />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="px-8 pb-7">

              {/* Step titles */}
              <div className="text-base font-bold text-[#eeeef8] mb-1">
                {wizardStep === 1 && 'Choisir Region'}
                {wizardStep === 2 && 'Choisir Action'}
                {wizardStep === 3 && 'Resume'}
              </div>
              <div className="text-xs text-[#4a4a6a] mb-5">
                {wizardStep === 1 && 'Selectionnez le pays et la region pour votre nouveau numero.'}
                {wizardStep === 2 && 'Definissez l\'action a executer lorsque ce numero recoit un appel.'}
                {wizardStep === 3 && 'Verifiez les informations avant de confirmer votre commande.'}
              </div>

              {/* -- Step 1: Region -- */}
              {wizardStep === 1 && (
                <>
                  <FL label="Pays">
                    <select
                      value={wizCountry}
                      onChange={e => { setWizCountry(e.target.value); setWizRegionIdx(0) }}
                      className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]"
                    >
                      {COUNTRY_OPTIONS.map(c => (
                        <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                      ))}
                    </select>
                    {/* Country dot display */}
                    <div className="flex items-center gap-2 mt-2">
                      <CountryDot code={wizCountry} size={14} />
                      <span className="text-xs text-[#6a6a8a]">{COUNTRY_OPTIONS.find(c => c.code === wizCountry)?.label}</span>
                    </div>
                  </FL>

                  <FL label="Region / Indicatif">
                    <select
                      value={wizRegionIdx}
                      onChange={e => setWizRegionIdx(Number(e.target.value))}
                      className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]"
                    >
                      {wizRegions.map((r, i) => (
                        <option key={i} value={i}>{r.label} ({r.areaCode})</option>
                      ))}
                    </select>
                  </FL>

                  {/* Info table */}
                  {wizSelectedRegion && (
                    <div className="bg-[#0f0f18] rounded-xl p-4">
                      <div className="text-[10px] text-[#4a4a6a] uppercase tracking-wider mb-2.5">Informations de provisionnement</div>
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <span className="text-[#5a5a7a]">Adresse requise</span>
                        <span className={`font-semibold ${wizSelectedRegion.addressRequired ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {wizSelectedRegion.addressRequired ? 'Oui' : 'Non'}
                        </span>
                        <span className="text-[#5a5a7a]">Delai provisionnement</span>
                        <span className="text-[#9898b8]">{wizSelectedRegion.delay}</span>
                        <span className="text-[#5a5a7a]">Documents requis</span>
                        <span className={`font-medium ${wizSelectedRegion.documentsRequired === 'Aucun' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {wizSelectedRegion.documentsRequired}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* -- Step 2: Action -- */}
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
                      className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] resize-y"
                      placeholder="Description facultative..."
                    />
                  </FL>
                </>
              )}

              {/* -- Step 3: Summary -- */}
              {wizardStep === 3 && (
                <>
                  {wizDone ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3 text-emerald-400">OK</div>
                      <div className="text-base font-bold text-emerald-400 mb-1.5">Commande envoyee</div>
                      <div className="text-xs text-[#6a6a8a]">Votre numero sera provisionne sous 1-3 jours ouvrables.</div>
                    </div>
                  ) : (
                    <div className="bg-[#0f0f18] rounded-xl p-5">
                      <div className="grid gap-3 text-[13px]" style={{ gridTemplateColumns: '140px 1fr' }}>
                        <span className="text-[#5a5a7a]">Pays</span>
                        <span className="text-[#eeeef8] flex items-center gap-1.5">
                          <CountryDot code={wizCountry} size={10} />
                          {COUNTRY_OPTIONS.find(c => c.code === wizCountry)?.label} ({wizCountry})
                        </span>

                        <span className="text-[#5a5a7a]">Region</span>
                        <span className="text-[#eeeef8]">{wizSelectedRegion?.label}</span>

                        <span className="text-[#5a5a7a]">Indicatif</span>
                        <span className="text-[#eeeef8] font-mono">{wizSelectedRegion?.areaCode}</span>

                        <span className="text-[#5a5a7a]">Action</span>
                        <span className="text-[#eeeef8]">{wizAction ? findActionLabel(wizAction) : '-- Aucune --'}</span>

                        <span className="text-[#5a5a7a]">Prix</span>
                        <span className="text-[#7b61ff] font-bold text-[15px]">7 CAD$/mois</span>
                      </div>

                      <div className="mt-4 px-4 py-3 bg-[#7b61ff]/5 border border-[#7b61ff]/20 rounded-lg">
                        <div className="text-xs text-[#a695ff] leading-relaxed">
                          Provisionnement sous 1-3 jours ouvrables
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Buttons */}
              {!wizDone && (
                <div className="flex gap-2.5 justify-end mt-6">
                  {wizardStep === 1 && (
                    <button onClick={resetWizard} className="px-5 py-2.5 bg-transparent border border-[#2e2e44] rounded-lg text-[#6a6a8a] text-[13px] hover:border-[#3e3e54] transition-colors">
                      Fermer
                    </button>
                  )}
                  {wizardStep > 1 && (
                    <button onClick={() => setWizardStep(s => s - 1)} className="px-5 py-2.5 bg-transparent border border-[#2e2e44] rounded-lg text-[#6a6a8a] text-[13px] hover:border-[#3e3e54] transition-colors">
                      Retour
                    </button>
                  )}
                  {wizardStep < 3 && (
                    <button onClick={() => setWizardStep(s => s + 1)} className="bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold transition-colors">
                      Suivant
                    </button>
                  )}
                  {wizardStep === 3 && (
                    <button
                      onClick={submitOrder}
                      disabled={wizOrdering}
                      className="bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60"
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
