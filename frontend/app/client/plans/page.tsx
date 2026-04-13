'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────
interface TelcoPlan {
  plan_code: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number
  destinations: string[]
  features: string[]
  sms_included: number
  sort_order: number
  popular: boolean
}

interface SummaryData {
  activePlan: { plan_code: string; name: string; price_monthly: number; price_yearly: number; destinations: string[] } | null
  billingCycle: 'monthly' | 'yearly'
  status: 'trialing' | 'active' | 'past_due' | 'canceling' | null
  nbAgentsActive: number
  monthlyTotal: number
  registeredAt: string | null
  nextPaymentAt: string | null
  trialEndsAt: string | null
  cancelAt: string | null
  stripeSubscriptionId: string | null
}

interface AgentRow {
  id: string
  firstName: string
  lastName: string
  email: string
  extension: string
  planCode: string | null
  planName: string
  unitPrice: number
}

// ── API helper ────────────────────────────────────────────
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

// ── Format helpers ────────────────────────────────────────
function fmtCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '-' }
}

function daysUntil(iso: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

// ── Plan badge colors ─────────────────────────────────────
const PLAN_COLORS: Record<string, string> = {
  TELCO_INBOUND: 'bg-[#3a3a4a] text-[#c0c0d0]',
  TELCO_CA_US: 'bg-blue-900/60 text-blue-300',
  TELCO_CA_US_FR: 'bg-purple-900/60 text-purple-300',
  TELCO_INTL: 'bg-amber-900/60 text-amber-300',
}

// ── Main tabs ─────────────────────────────────────────────
type ServiceTab = 'telephony' | 'dialer' | 'robot' | 'addons'
const SERVICE_TABS: { key: ServiceTab; label: string }[] = [
  { key: 'telephony', label: "Telephonie d'entreprise" },
  { key: 'dialer', label: 'Predictive Dialer' },
  { key: 'robot', label: "Robot d'appel" },
  { key: 'addons', label: 'Add-ons' },
]

type SubTab = 'resume' | 'ajouter' | 'editer' | 'supprimer'
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'resume', label: 'Resume' },
  { key: 'ajouter', label: 'Ajouter' },
  { key: 'editer', label: 'Editer' },
  { key: 'supprimer', label: 'Supprimer' },
]

// ══════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════
export default function PlansPage() {
  const api = useApi()
  const [serviceTab, setServiceTab] = useState<ServiceTab>('telephony')
  const [subTab, setSubTab] = useState<SubTab>('resume')

  // Data
  const [plans, setPlans] = useState<TelcoPlan[]>([])
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const flash = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Modals
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [cancelModal, setCancelModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Editer state
  const [editPlans, setEditPlans] = useState<Record<string, string>>({})

  // Supprimer state
  const [deleteChecked, setDeleteChecked] = useState<Set<string>>(new Set())

  // CGV checkbox
  const [cgvAccepted, setCgvAccepted] = useState(false)

  // Selected plan for upgrade
  const [selectedPlan, setSelectedPlan] = useState<string>('')

  // ── Load data ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [plansRes, summaryRes, agentsRes] = await Promise.all([
        api('/api/v1/billing/telephony/plans'),
        api('/api/v1/billing/telephony/summary'),
        api('/api/v1/billing/telephony/agents'),
      ])
      if (plansRes.success) setPlans(plansRes.data || [])
      if (summaryRes.success) setSummary(summaryRes.data)
      if (agentsRes.success) setAgents(agentsRes.data || [])
    } catch { flash('Erreur de chargement', 'error') }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // Reset sub-state on tab change
  useEffect(() => {
    setUpgradeModal(false)
    setCancelModal(false)
    setDeleteConfirm(false)
    setCgvAccepted(false)
    setDeleteChecked(new Set())
    setEditPlans(Object.fromEntries(agents.filter(a => a.planCode).map(a => [a.id, a.planCode!])))
  }, [subTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cancel handler ────────────────────────────────────
  const handleCancel = async () => {
    try {
      const res = await api('/api/v1/billing/telephony/cancel', { method: 'DELETE' })
      if (res.success) {
        flash('Annulation programmee')
        setCancelModal(false)
        loadData()
      } else { flash(res.error || 'Erreur', 'error') }
    } catch { flash('Erreur serveur', 'error') }
  }

  // ── Subscribe handler ─────────────────────────────────
  const handleSubscribe = async (planCode: string) => {
    try {
      const res = await api('/api/v1/billing/telephony/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planCode, billingCycle: 'monthly' }),
      })
      if (res.success) {
        flash('Plan active avec succes')
        setUpgradeModal(false)
        loadData()
      } else { flash(res.error || 'Erreur', 'error') }
    } catch { flash('Erreur serveur', 'error') }
  }

  // ── Edit agent plan handler ───────────────────────────
  const handleEditSave = async () => {
    try {
      const changes = Object.entries(editPlans)
        .filter(([id, code]) => {
          const agent = agents.find(a => a.id === id)
          return agent && agent.planCode !== code
        })
        .map(([agentId, planCode]) => ({ agentId, planCode }))

      if (changes.length === 0) { flash('Aucun changement', 'error'); return }

      // Update each agent's extension plan
      for (const c of changes) {
        await api(`/api/v1/billing/telephony/agent/${c.agentId}`, {
          method: 'PUT',
          body: JSON.stringify({ planCode: c.planCode }),
        })
      }
      flash('Plans mis a jour')
      setUpgradeModal(false)
      loadData()
    } catch { flash('Erreur serveur', 'error') }
  }

  // ── Delete agents handler ─────────────────────────────
  const handleDeleteAgents = async () => {
    try {
      for (const agentId of deleteChecked) {
        await api(`/api/v1/billing/telephony/agent/${agentId}`, { method: 'DELETE' })
      }
      flash(`${deleteChecked.size} agent(s) retire(s)`)
      setDeleteConfirm(false)
      setDeleteChecked(new Set())
      loadData()
    } catch { flash('Erreur serveur', 'error') }
  }

  // ── Skeleton ──────────────────────────────────────────
  const Skeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-14 bg-[#18181f] rounded-lg animate-pulse" />
      ))}
    </div>
  )

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="w-full">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg text-sm font-semibold shadow-lg transition-all ${toast.type === 'error' ? 'bg-red-950 border border-red-800 text-red-300' : 'bg-emerald-950 border border-emerald-800 text-emerald-300'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <h1 className="text-[22px] font-bold text-[#eeeef8] mb-5">Mes forfaits</h1>

      {/* Service tabs */}
      <div className="flex gap-1 mb-6 bg-[#111118] rounded-xl p-1 border border-[#2e2e44]">
        {SERVICE_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setServiceTab(t.key); setSubTab('resume') }}
            className={`px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer border-none ${serviceTab === t.key ? 'bg-[#7b61ff] text-white' : 'bg-transparent text-[#9898b8] hover:text-white hover:bg-[#1e1e2a]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Telephony content */}
      {serviceTab === 'telephony' && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-0 mb-6 border-b border-[#2e2e44]">
            {SUB_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setSubTab(t.key)}
                className={`px-5 py-3 text-[13px] font-semibold transition-colors cursor-pointer border-none bg-transparent relative ${subTab === t.key ? 'text-[#7b61ff]' : 'text-[#55557a] hover:text-[#9898b8]'}`}
              >
                {t.label}
                {subTab === t.key && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#7b61ff] rounded-t" />}
              </button>
            ))}
          </div>

          {loading ? <Skeleton /> : (
            <>
              {/* ═══ RESUME ═══ */}
              {subTab === 'resume' && summary && (
                <div>
                  {/* Banners */}
                  {summary.status === 'trialing' && summary.trialEndsAt && (
                    <div className="bg-blue-950/50 border border-blue-800/40 rounded-xl px-5 py-3 mb-5 flex items-center gap-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span className="text-[13px] text-blue-300 font-semibold">Essai gratuit en cours — {daysUntil(summary.trialEndsAt)} jours restants</span>
                    </div>
                  )}
                  {summary.status === 'past_due' && (
                    <div className="bg-red-950/60 border border-red-900/50 rounded-xl px-5 py-3 mb-5 flex items-center gap-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4d6d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span className="text-[13px] text-red-300 font-semibold">Paiement en retard — Mettre a jour votre carte</span>
                    </div>
                  )}
                  {summary.status === 'canceling' && summary.cancelAt && (
                    <div className="bg-orange-950/50 border border-orange-800/40 rounded-xl px-5 py-3 mb-5 flex items-center gap-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb547" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span className="text-[13px] text-orange-300 font-semibold">Annulation prevue le {fmtDate(summary.cancelAt)}</span>
                    </div>
                  )}

                  {/* Upgrade button */}
                  <button
                    onClick={() => setSubTab('ajouter')}
                    className="mb-5 flex items-center gap-2 bg-[#7b61ff]/10 border border-[#7b61ff]/30 text-[#7b61ff] hover:bg-[#7b61ff]/20 rounded-lg px-5 py-2.5 text-[13px] font-semibold cursor-pointer transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                    Augmenter/Diminuer votre plan
                  </button>

                  {/* Plans table */}
                  <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-6">
                    <div className="grid grid-cols-[25%_45%_15%_15%] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
                      <div>Forfaits</div>
                      <div>Details</div>
                      <div className="text-right">Prix CAD$/agent/mois</div>
                      <div className="text-center">Actif</div>
                    </div>
                    {plans.map(p => {
                      const isActive = summary.activePlan?.plan_code === p.plan_code
                      return (
                        <div key={p.plan_code} className="grid grid-cols-[25%_45%_15%_15%] px-5 py-3.5 border-b border-[#2e2e44]/60 items-center hover:bg-[#1e1e2a] transition-colors">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PLAN_COLORS[p.plan_code] || 'bg-[#1e1e3a] text-[#9898b8]'}`}>
                              {p.name}
                            </span>
                            {p.popular && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7b61ff]/15 text-[#7b61ff]">Populaire</span>}
                          </div>
                          <div className="text-[13px] text-[#9898b8]">
                            {p.destinations.length > 0 ? `Illimite fixes et mobiles: ${p.destinations.map(d => d.replace(' fixes et mobiles', '')).join(', ')}` : 'Appels entrants uniquement'}
                          </div>
                          <div className="text-right text-[14px] font-semibold text-[#eeeef8]">
                            {fmtCents(p.price_monthly)} <span className="text-[11px] text-[#55557a] font-normal">CAD$</span>
                          </div>
                          <div className="text-center">
                            {isActive ? (
                              <span className="text-emerald-400 font-semibold text-[13px]">{summary.nbAgentsActive} agent{summary.nbAgentsActive > 1 ? 's' : ''}</span>
                            ) : (
                              <span className="text-[#55557a]">-</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Footer info */}
                  <div className="flex items-end gap-4 mb-4 w-full">
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-[10px] text-[#55557a] uppercase tracking-wider font-semibold mb-1">Date d&apos;enregistrement</div>
                        <div className="text-[13px] text-[#eeeef8] font-medium">{fmtDate(summary.registeredAt)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#55557a] uppercase tracking-wider font-semibold mb-1">Prochain paiement</div>
                        <div className="text-[13px] text-[#eeeef8] font-medium">{fmtDate(summary.nextPaymentAt)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#55557a] uppercase tracking-wider font-semibold mb-1">Forfaits actifs</div>
                        <div className="text-[13px] text-[#eeeef8] font-medium">{summary.activePlan ? 1 : 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#55557a] uppercase tracking-wider font-semibold mb-1">Montant recurrent total</div>
                        <div className="text-[15px] text-[#7b61ff] font-bold">{fmtCents(summary.monthlyTotal)} CAD$/mois</div>
                      </div>
                    </div>

                    {summary.status === 'active' && (
                      <button
                        onClick={() => setCancelModal(true)}
                        className="flex-shrink-0 px-5 py-2.5 bg-red-950/40 border border-red-800/40 text-red-400 rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-red-950/60 transition-colors"
                      >
                        Demande d&apos;annulation
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ AJOUTER ═══ */}
              {subTab === 'ajouter' && (
                <div>
                  <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-6">
                    <div className="grid grid-cols-[18%_28%_14%_18%_10%_12%] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
                      <div>Forfaits</div>
                      <div>Details</div>
                      <div>Destinations</div>
                      <div className="text-right">Prix CAD$/agent/mois</div>
                      <div className="text-center">Actif</div>
                      <div className="text-center">Quantite</div>
                    </div>
                    {plans.map(p => {
                      const isActive = summary?.activePlan?.plan_code === p.plan_code
                      return (
                        <div
                          key={p.plan_code}
                          onClick={() => setSelectedPlan(p.plan_code)}
                          className={`grid grid-cols-[18%_28%_14%_18%_10%_12%] px-5 py-3.5 border-b border-[#2e2e44]/60 items-center cursor-pointer transition-colors ${selectedPlan === p.plan_code ? 'bg-[#7b61ff]/10 border-l-2 border-l-[#7b61ff]' : 'hover:bg-[#1e1e2a]'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${PLAN_COLORS[p.plan_code] || 'bg-[#1e1e3a] text-[#9898b8]'}`}>
                              {p.name}
                            </span>
                          </div>
                          <div className="text-[13px] text-[#9898b8]">{p.description}</div>
                          <div>
                            {p.destinations.length > 0 ? (
                              <DestinationsDropdown destinations={p.destinations} />
                            ) : <span className="text-[12px] text-[#55557a]">-</span>}
                          </div>
                          <div className="text-right text-[14px] font-semibold text-[#eeeef8]">
                            {fmtCents(p.price_monthly)} <span className="text-[11px] text-[#55557a] font-normal">CAD$</span>
                          </div>
                          <div className="text-center">
                            {isActive ? (
                              <span className="text-emerald-400 font-semibold text-[13px]">{summary?.nbAgentsActive || 0}</span>
                            ) : <span className="text-[#55557a]">-</span>}
                          </div>
                          <div className="text-center" title="La quantite est automatiquement synchronisee avec le nombre d'agents actifs dans votre compte.">
                            <span className="text-[13px] text-[#9898b8] bg-[#111118] px-3 py-1 rounded border border-[#2e2e44]">{summary?.nbAgentsActive || 0}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => { if (selectedPlan) setUpgradeModal(true) }}
                      disabled={!selectedPlan}
                      className={`px-6 py-2.5 rounded-lg text-[13px] font-bold border-none cursor-pointer transition-colors ${selectedPlan ? 'bg-[#7b61ff] text-white hover:bg-[#6145ff]' : 'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ EDITER ═══ */}
              {subTab === 'editer' && (
                <div>
                  <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-6">
                    <div className="grid grid-cols-[120px_1fr_200px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
                      <div>Extension</div>
                      <div>Contexte</div>
                      <div>Forfait</div>
                    </div>
                    {agents.length === 0 ? (
                      <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Il n&apos;y a aucun agent.</div>
                    ) : agents.map(a => (
                      <div key={a.id} className="grid grid-cols-[120px_1fr_200px] px-5 py-3 border-b border-[#2e2e44]/60 items-center">
                        <div className="text-[13px] text-[#eeeef8] font-mono">{a.extension}</div>
                        <div className="text-[13px] text-[#9898b8]">{a.email}</div>
                        <div>
                          <select
                            value={editPlans[a.id] || a.planCode || ''}
                            onChange={e => setEditPlans(prev => ({ ...prev, [a.id]: e.target.value }))}
                            className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none focus:border-[#7b61ff] cursor-pointer"
                          >
                            <option value="">Aucun</option>
                            {plans.map(p => (
                              <option key={p.plan_code} value={p.plan_code}>{p.name} — {fmtCents(p.price_monthly)} CAD$</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setUpgradeModal(true)}
                      className="px-6 py-2.5 bg-[#7b61ff] text-white rounded-lg text-[13px] font-bold border-none cursor-pointer hover:bg-[#6145ff] transition-colors"
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ SUPPRIMER ═══ */}
              {subTab === 'supprimer' && (
                <div>
                  <div className="bg-orange-950/30 border border-orange-800/30 rounded-xl px-5 py-3 mb-5 text-[13px] text-orange-300">
                    Retirer un agent du forfait desactivera sa ligne telephonique.
                  </div>

                  <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-6">
                    <div className="grid grid-cols-[50px_120px_1fr_160px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
                      <div />
                      <div>Extension</div>
                      <div>Contexte</div>
                      <div>Forfait actuel</div>
                    </div>
                    {agents.length === 0 ? (
                      <div className="px-5 py-8 text-center text-[13px] text-[#55557a]">Il n&apos;y a aucun agent.</div>
                    ) : agents.map(a => (
                      <div key={a.id} className="grid grid-cols-[50px_120px_1fr_160px] px-5 py-3 border-b border-[#2e2e44]/60 items-center hover:bg-[#1e1e2a] transition-colors">
                        <div>
                          <input
                            type="checkbox"
                            checked={deleteChecked.has(a.id)}
                            onChange={() => {
                              const next = new Set(deleteChecked)
                              if (next.has(a.id)) next.delete(a.id); else next.add(a.id)
                              setDeleteChecked(next)
                            }}
                            className="w-4 h-4 accent-[#7b61ff] cursor-pointer"
                          />
                        </div>
                        <div className="text-[13px] text-[#eeeef8] font-mono">{a.extension}</div>
                        <div className="text-[13px] text-[#9898b8]">{a.email}</div>
                        <div className="text-[13px] text-[#eeeef8]">{a.planName}</div>
                      </div>
                    ))}
                  </div>

                  {deleteChecked.size > 0 && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        className="px-6 py-2.5 bg-[#ff4d6d] text-white rounded-lg text-[13px] font-bold border-none cursor-pointer hover:bg-[#e8405f] transition-colors"
                      >
                        Continuer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Addons tab */}
      {serviceTab === 'addons' && (
        <AddonsTab api={api} flash={flash} />
      )}

      {/* Robot tab */}
      {serviceTab === 'robot' && (
        <RobotTab api={api} flash={flash} />
      )}

      {/* Placeholder tabs */}
      {serviceTab !== 'telephony' && serviceTab !== 'addons' && serviceTab !== 'robot' && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl py-16 text-center">
          <div className="text-[15px] text-[#55557a]">Section {SERVICE_TABS.find(t => t.key === serviceTab)?.label} — bientot disponible</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* UPGRADE MODAL                                      */}
      {/* ══════════════════════════════════════════════════ */}
      {upgradeModal && (
        <UpgradeModal
          plans={plans}
          agents={agents}
          selectedPlan={selectedPlan}
          summary={summary}
          editPlans={subTab === 'editer' ? editPlans : undefined}
          cgvAccepted={cgvAccepted}
          onCgvChange={setCgvAccepted}
          onClose={() => setUpgradeModal(false)}
          onConfirm={async () => {
            if (subTab === 'editer') { await handleEditSave() }
            else if (selectedPlan) { await handleSubscribe(selectedPlan) }
          }}
          api={api}
        />
      )}

      {/* Cancel modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setCancelModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[460px] max-w-[95vw]">
            <div className="text-[17px] font-bold text-[#eeeef8] mb-4">Demande d&apos;annulation</div>
            <div className="text-[13px] text-[#9898b8] leading-relaxed mb-7">
              Votre abonnement telephonie sera annule a la fin de la periode en cours ({fmtDate(summary?.nextPaymentAt || null)}). Vous conserverez l&apos;acces a votre forfait jusqu&apos;a cette date.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelModal(false)} className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer hover:bg-[#1f1f2a] transition-colors">
                Annuler
              </button>
              <button onClick={handleCancel} className="px-6 py-2.5 bg-[#ff4d6d] border-none rounded-lg text-white text-[13px] font-bold cursor-pointer hover:bg-[#e8405f] transition-colors">
                Confirmer l&apos;annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setDeleteConfirm(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[520px] max-w-[95vw]">
            <div className="text-[17px] font-bold text-[#eeeef8] mb-4">Confirmer la suppression</div>
            <div className="text-[13px] text-[#9898b8] leading-relaxed mb-4">
              Vous allez retirer {deleteChecked.size} agent(s) du forfait telephonie.
            </div>
            <div className="bg-[#111118] rounded-lg p-4 mb-5 space-y-1.5">
              {agents.filter(a => deleteChecked.has(a.id)).map(a => (
                <div key={a.id} className="flex gap-3 text-[13px]">
                  <span className="text-[#eeeef8] font-mono">{a.extension}</span>
                  <span className="text-[#9898b8]">{a.email}</span>
                  <span className="text-[#55557a]">{a.planName}</span>
                </div>
              ))}
            </div>
            <div className="text-[13px] text-[#9898b8] mb-6">
              Nouveau montant mensuel estime: <span className="font-bold text-[#eeeef8]">
                {fmtCents((summary?.monthlyTotal || 0) - agents.filter(a => deleteChecked.has(a.id)).reduce((s, a) => s + a.unitPrice, 0))} CAD$/mois
              </span>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer hover:bg-[#1f1f2a] transition-colors">
                Annuler
              </button>
              <button onClick={handleDeleteAgents} className="px-6 py-2.5 bg-[#ff4d6d] border-none rounded-lg text-white text-[13px] font-bold cursor-pointer hover:bg-[#e8405f] transition-colors">
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Destinations dropdown
// ══════════════════════════════════════════════════════════
function DestinationsDropdown({ destinations }: { destinations: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className="text-[12px] text-[#7b61ff] underline bg-transparent border-none cursor-pointer hover:text-[#9b88ff]"
      >
        Destinations
      </button>
      {open && (
        <div className="absolute top-6 left-0 z-10 bg-[#0c0c1a] border border-[#2e2e44] rounded-lg p-3 min-w-[200px] shadow-xl">
          {destinations.map((d, i) => (
            <div key={i} className="text-[12px] text-[#eeeef8] py-1">{d}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Upgrade Modal
// ══════════════════════════════════════════════════════════
function UpgradeModal({
  plans, agents, selectedPlan, summary, editPlans,
  cgvAccepted, onCgvChange, onClose, onConfirm, api,
}: {
  plans: TelcoPlan[]
  agents: AgentRow[]
  selectedPlan: string
  summary: SummaryData | null
  editPlans?: Record<string, string>
  cgvAccepted: boolean
  onCgvChange: (v: boolean) => void
  onClose: () => void
  onConfirm: () => Promise<void>
  api: (path: string, opts?: RequestInit) => Promise<any>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [prorata, setProrata] = useState<any>(null)

  const effectivePlan = selectedPlan || summary?.activePlan?.plan_code || ''
  const plan = plans.find(p => p.plan_code === effectivePlan)
  const nbAgents = summary?.nbAgentsActive || agents.length || 1

  useEffect(() => {
    if (!effectivePlan) return
    api(`/api/v1/billing/telephony/prorata?planCode=${effectivePlan}&billingCycle=monthly`)
      .then(r => { if (r.success) setProrata(r.data) })
      .catch(() => {})
  }, [effectivePlan]) // eslint-disable-line react-hooks/exhaustive-deps

  const taxRate = 0.14975
  const subtotal = prorata?.prorataAmount || 0
  const tax = Math.round(subtotal * taxRate)
  const total = subtotal + tax

  const handleSubmit = async () => {
    setSubmitting(true)
    await onConfirm()
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-8 pt-7 pb-4 border-b border-[#2e2e44]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#7b61ff]/10 border border-[#7b61ff]/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/></svg>
              </div>
              <div>
                <div className="text-[17px] font-bold text-[#eeeef8]">Resume de la mise a niveau</div>
                <div className="text-[12px] text-[#55557a]">Telephonie d&apos;entreprise: Augmenter/Diminuer votre plan</div>
              </div>
            </div>
            <div className="text-[11px] text-[#55557a]">
              Espace client &gt; Mes Forfaits (Telephonie) &gt; Augmenter/Diminuer
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          {/* Agents table */}
          <div className="bg-[#111118] border border-[#2e2e44] rounded-lg overflow-hidden mb-5">
            <div className="grid grid-cols-[120px_1fr_130px] px-4 py-2 bg-[#0c0c16] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
              <div>Extension</div>
              <div>Forfait</div>
              <div className="text-right">Prix</div>
            </div>
            {agents.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-[#55557a]">Il n&apos;y a aucun enregistrement.</div>
            ) : agents.map(a => {
              const agentPlanCode = editPlans?.[a.id] || a.planCode || effectivePlan
              const agentPlan = plans.find(p => p.plan_code === agentPlanCode)
              return (
                <div key={a.id} className="grid grid-cols-[120px_1fr_130px] px-4 py-2.5 border-b border-[#1f1f2a] items-center">
                  <div className="text-[13px] text-[#eeeef8] font-mono">{a.extension}</div>
                  <div className="text-[13px] text-[#9898b8]">{agentPlan?.name || a.planName}</div>
                  <div className="text-right text-[13px] font-semibold text-[#eeeef8]">{fmtCents(agentPlan?.price_monthly || a.unitPrice)} CAD$</div>
                </div>
              )
            })}
          </div>

          {/* Totals */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] text-[#9898b8]">Montant de la taxe:</div>
            <div className="text-[14px] font-semibold text-[#eeeef8]">{fmtCents(tax)} CAD$</div>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="text-[15px] font-bold text-[#eeeef8]">Total a payer aujourd&apos;hui:</div>
            <div className="text-[20px] font-bold text-[#7b61ff]">{fmtCents(total)} CAD$</div>
          </div>

          {/* Payment */}
          <div className="border-t border-[#2e2e44] pt-5">
            <div className="text-[12px] text-[#55557a] uppercase tracking-wider font-semibold mb-3">Mode de paiement</div>
            <div className="bg-[#111118] border border-[#2e2e44] rounded-lg px-4 py-3 mb-4 text-[13px] text-[#9898b8]">
              Paiement securise par Stripe
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cgvAccepted} onChange={e => onCgvChange(e.target.checked)} className="w-4 h-4 accent-[#7b61ff]" />
              <span className="text-[12px] text-[#9898b8]">J&apos;accepte les conditions generales de vente</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-[#2e2e44] flex items-center justify-between">
          <button onClick={onClose} className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer hover:bg-[#1f1f2a] transition-colors flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Retour
          </button>
          <button
            onClick={handleSubmit}
            disabled={!cgvAccepted || submitting}
            className={`px-8 py-2.5 rounded-lg text-[13px] font-bold border-none cursor-pointer transition-colors ${cgvAccepted && !submitting ? 'bg-[#7b61ff] text-white hover:bg-[#6145ff]' : 'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}
          >
            {submitting ? 'Traitement...' : 'Regler'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Addons Tab
// ══════════════════════════════════════════════════════════
const MODULE_ICONS: Record<string, { bg: string; stroke: string }> = {
  ia_basic: { bg: 'bg-purple-900/30', stroke: '#a78bfa' },
  ia_coaching: { bg: 'bg-purple-900/50', stroke: '#7c3aed' },
  campaigns: { bg: 'bg-orange-900/30', stroke: '#fb923c' },
  analytics: { bg: 'bg-blue-900/30', stroke: '#60a5fa' },
  sms: { bg: 'bg-emerald-900/30', stroke: '#34d399' },
}

interface AddonPlan {
  plan_code: string; name: string; module_type: string
  price_monthly: number; price_yearly: number
  features: string[]; description: string; sms_overage_rate: number
}

interface AddonSummary {
  activeModules: { module_type: string; plan_code: string; status: string; billingCycle: string; price_monthly: number; trialEndsAt: string | null; currentPeriodEnd: string | null; cancelAt: string | null }[]
  monthlyTotal: number; nbAgents: number
  smsUsage: { smsIncluded: number; smsSent: number; smsReceived: number; smsOverage: number; overageAmount: number; percentUsed: number }
}

function AddonsTab({ api, flash }: { api: (path: string, opts?: RequestInit) => Promise<any>; flash: (msg: string, type?: 'success' | 'error') => void }) {
  const [plans, setPlans] = useState<AddonPlan[]>([])
  const [summary, setSummary] = useState<AddonSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [activateModal, setActivateModal] = useState<string | null>(null)
  const [manageModal, setManageModal] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [cgv, setCgv] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadAddons = useCallback(async () => {
    setLoading(true)
    const [p, s] = await Promise.all([
      api('/api/v1/billing/addons/plans'),
      api('/api/v1/billing/addons/summary'),
    ])
    if (p.success) setPlans(p.data || [])
    if (s.success) setSummary(s.data)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAddons() }, [loadAddons])

  const getActiveModule = (mt: string) => summary?.activeModules.find(m => m.module_type === mt)
  const isActive = (mt: string) => !!getActiveModule(mt)

  const handleActivate = async (moduleType: string) => {
    setSubmitting(true)
    const res = await api('/api/v1/billing/addons/subscribe', {
      method: 'POST', body: JSON.stringify({ moduleType, billingCycle: 'monthly' }),
    })
    if (res.success) { flash('Module active avec succes'); setActivateModal(null); setCgv(false); loadAddons() }
    else flash(res.error || 'Erreur', 'error')
    setSubmitting(false)
  }

  const handleCancel = async (moduleType: string) => {
    const res = await api(`/api/v1/billing/addons/${moduleType}/cancel`, { method: 'DELETE' })
    if (res.success) { flash('Annulation programmee'); setCancelConfirm(null); setManageModal(null); loadAddons() }
    else flash(res.error || 'Erreur', 'error')
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-40 bg-[#18181f] rounded-xl animate-pulse" />)}</div>

  // Hide ia_basic card if ia_coaching is active
  const iaCoachingActive = isActive('ia_coaching')
  const visiblePlans = plans.filter(p => !(p.module_type === 'ia_basic' && iaCoachingActive))

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {visiblePlans.map(p => {
          const active = getActiveModule(p.module_type)
          const icon = MODULE_ICONS[p.module_type] || MODULE_ICONS.ia_basic
          const isPerOrg = p.module_type === 'sms'
          return (
            <div key={p.plan_code} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-lg ${icon.bg} flex items-center justify-center`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={icon.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#eeeef8]">{p.name}</div>
                  <div className="text-[12px] text-[#7b61ff] font-semibold">
                    {fmtCents(p.price_monthly)} CAD$/{isPerOrg ? 'mois' : 'agent/mois'}
                  </div>
                </div>
              </div>
              <div className="text-[12px] text-[#9898b8] mb-3">{p.description}</div>
              <div className="space-y-1 mb-4 flex-1">
                {p.features.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#9898b8]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {f}
                  </div>
                ))}
              </div>

              {/* SMS progress bar */}
              {p.module_type === 'sms' && active && summary?.smsUsage && (
                <div className="mb-3">
                  <div className="flex justify-between text-[11px] text-[#9898b8] mb-1">
                    <span>{summary.smsUsage.smsSent + summary.smsUsage.smsReceived} / {summary.smsUsage.smsIncluded} SMS</span>
                    <span>{summary.smsUsage.percentUsed}%</span>
                  </div>
                  <div className="h-2 bg-[#111118] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${summary.smsUsage.percentUsed > 100 ? 'bg-red-500' : summary.smsUsage.percentUsed > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, summary.smsUsage.percentUsed)}%` }} />
                  </div>
                </div>
              )}

              {/* Status badge */}
              {active && (
                <div className="mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${active.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : active.status === 'trialing' ? 'bg-blue-900/40 text-blue-400' : active.status === 'past_due' ? 'bg-red-900/40 text-red-400' : active.status === 'canceling' ? 'bg-orange-900/40 text-orange-400' : 'bg-[#1e1e3a] text-[#55557a]'}`}>
                    {active.status === 'active' ? 'Actif' : active.status === 'trialing' ? 'Essai' : active.status === 'past_due' ? 'En retard' : active.status === 'canceling' ? `Annulation prevue le ${fmtDate(active.cancelAt)}` : active.status}
                  </span>
                </div>
              )}

              {active ? (
                <button onClick={() => setManageModal(p.module_type)} className="w-full py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[12px] font-semibold text-[#9898b8] cursor-pointer hover:bg-[#1e1e2a] transition-colors">
                  Gerer
                </button>
              ) : (
                <button onClick={() => { setActivateModal(p.module_type); setCgv(false) }} className="w-full py-2 bg-[#7b61ff] border-none rounded-lg text-[12px] font-bold text-white cursor-pointer hover:bg-[#6145ff] transition-colors">
                  Activer
                </button>
              )}

              {/* Note ia_coaching */}
              {p.module_type === 'ia_coaching' && isActive('ia_basic') && (
                <div className="text-[10px] text-[#7b61ff] mt-2">Inclut tout IA Basique + fonctionnalites coaching</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer total */}
      {summary && summary.monthlyTotal > 0 && (
        <div className="text-[13px] text-[#9898b8]">
          Total modules actifs: <span className="font-bold text-[#7b61ff]">{fmtCents(summary.monthlyTotal)} CAD$/mois</span>
        </div>
      )}

      {/* ── ACTIVATE MODAL ─────────────────────────────── */}
      {activateModal && (() => {
        const plan = plans.find(p => p.module_type === activateModal)
        if (!plan) return null
        const isPerOrg = plan.module_type === 'sms'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setActivateModal(null)}>
            <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl w-[600px] max-w-[95vw] max-h-[85vh] overflow-y-auto">
              <div className="px-7 pt-6 pb-4 border-b border-[#2e2e44]">
                <div className="text-[17px] font-bold text-[#eeeef8]">{plan.name}</div>
                <div className="text-[12px] text-[#55557a]">{plan.description}</div>
              </div>
              <div className="px-7 py-5 space-y-4">
                <div className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] text-[#9898b8]">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
                <div className="bg-[#111118] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-[#9898b8]">Prix unitaire</span>
                    <span className="text-[#eeeef8] font-semibold">{fmtCents(plan.price_monthly)} CAD$/{isPerOrg ? 'mois' : 'agent/mois'}</span>
                  </div>
                  {!isPerOrg && (
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#9898b8]">Agents actifs</span>
                      <span className="text-[#eeeef8]">{summary?.nbAgents || 1}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[13px] font-bold border-t border-[#2e2e44] pt-2">
                    <span className="text-[#eeeef8]">Total mensuel</span>
                    <span className="text-[#7b61ff]">{fmtCents(plan.price_monthly * (isPerOrg ? 1 : (summary?.nbAgents || 1)))} CAD$/mois</span>
                  </div>
                </div>
                {plan.module_type === 'sms' && (
                  <div className="text-[11px] text-[#55557a]">1000 SMS inclus par mois. Surplus facture a 0,018 CAD$/SMS.</div>
                )}
                {plan.module_type === 'ia_coaching' && isActive('ia_basic') && (
                  <div className="text-[11px] text-[#7b61ff]">IA Basique sera automatiquement remplace par IA Coaching Live. Aucune double facturation.</div>
                )}
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={cgv} onChange={e => setCgv(e.target.checked)} className="w-4 h-4 accent-[#7b61ff]" />
                  <span className="text-[12px] text-[#9898b8]">J&apos;accepte les conditions generales de vente</span>
                </label>
              </div>
              <div className="px-7 py-4 border-t border-[#2e2e44] flex justify-end gap-3">
                <button onClick={() => setActivateModal(null)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer hover:bg-[#1f1f2a]">Annuler</button>
                <button onClick={() => handleActivate(plan.module_type)} disabled={!cgv || submitting} className={`px-6 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer ${cgv && !submitting ? 'bg-[#7b61ff] text-white hover:bg-[#6145ff]' : 'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}>
                  {submitting ? 'Activation...' : 'Activer le module'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── MANAGE MODAL ───────────────────────────────── */}
      {manageModal && (() => {
        const plan = plans.find(p => p.module_type === manageModal)
        const active = getActiveModule(manageModal)
        if (!plan || !active) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setManageModal(null)}>
            <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl w-[600px] max-w-[95vw] max-h-[85vh] overflow-y-auto">
              <div className="px-7 pt-6 pb-4 border-b border-[#2e2e44] flex items-center justify-between">
                <div>
                  <div className="text-[17px] font-bold text-[#eeeef8]">{plan.name}</div>
                  <div className="text-[12px] text-[#55557a]">{plan.description}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${active.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : active.status === 'trialing' ? 'bg-blue-900/40 text-blue-400' : 'bg-orange-900/40 text-orange-400'}`}>
                  {active.status === 'active' ? 'Actif' : active.status === 'trialing' ? 'Essai' : active.status}
                </span>
              </div>
              <div className="px-7 py-5 space-y-4">
                <div className="space-y-1.5">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] text-[#9898b8]">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
                <div className="bg-[#111118] rounded-lg p-4 text-[13px] text-[#9898b8]">
                  <div className="flex justify-between mb-1">
                    <span>Prix actuel</span>
                    <span className="text-[#eeeef8] font-semibold">{fmtCents(active.price_monthly)} CAD$/{active.billingCycle === 'monthly' ? 'mois' : 'an'}</span>
                  </div>
                  {active.currentPeriodEnd && (
                    <div className="flex justify-between">
                      <span>Prochain paiement</span>
                      <span className="text-[#eeeef8]">{fmtDate(active.currentPeriodEnd)}</span>
                    </div>
                  )}
                </div>
                {active.status === 'canceling' && active.cancelAt && (
                  <div className="text-[12px] text-orange-400">Annulation prevue le {fmtDate(active.cancelAt)}. Le module restera actif jusqu&apos;a cette date.</div>
                )}
              </div>
              <div className="px-7 py-4 border-t border-[#2e2e44] flex justify-between">
                <button onClick={() => setManageModal(null)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer hover:bg-[#1f1f2a]">Fermer</button>
                {active.status !== 'canceling' && (
                  <button onClick={() => setCancelConfirm(manageModal)} className="px-5 py-2 bg-red-950/40 border border-red-800/40 text-red-400 rounded-lg text-[12px] font-semibold cursor-pointer hover:bg-red-950/60">
                    Annuler le module
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Cancel confirm */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setCancelConfirm(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[460px] max-w-[95vw]">
            <div className="text-[17px] font-bold text-[#eeeef8] mb-4">Confirmer l&apos;annulation</div>
            <div className="text-[13px] text-[#9898b8] mb-6">
              Le module restera actif jusqu&apos;a la fin de la periode en cours.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCancelConfirm(null)} className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer">Revenir en arriere</button>
              <button onClick={() => handleCancel(cancelConfirm)} className="px-6 py-2.5 bg-[#ff4d6d] border-none rounded-lg text-white text-[13px] font-bold cursor-pointer hover:bg-[#e8405f]">Confirmer l&apos;annulation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Robot Tab
// ══════════════════════════════════════════════════════════
interface RobotPlan {
  plan_code: string; name: string; description: string
  price_monthly: number; price_yearly: number; features: string[]
  minutes_included: number; overage_rate: number
  max_concurrent_calls: number; max_contacts_per_campaign: number
  popular: boolean
}

interface RobotSummary {
  activePlan: { plan_code: string; name: string; price_monthly: number; minutes_included: number; overage_rate: number; max_concurrent_calls: number } | null
  billingCycle: string; status: string | null; trialEndsAt: string | null; nextPaymentAt: string | null; cancelAt: string | null
  minutesUsage: { minutesIncluded: number; minutesUsed: number; minutesRemaining: number; minutesOverage: number; overageAmount: number; percentUsed: number; month: string }
  creditsBalance: number
  credits: { id: string; minutesPurchased: number; minutesRemaining: number; expiresAt: string }[]
}

function RobotTab({ api, flash }: { api: (path: string, opts?: RequestInit) => Promise<any>; flash: (msg: string, type?: 'success' | 'error') => void }) {
  const [plans, setPlans] = useState<RobotPlan[]>([])
  const [summary, setSummary] = useState<RobotSummary | null>(null)
  const [creditsPacks, setCreditsPacks] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activateModal, setActivateModal] = useState(false)
  const [creditsModal, setCreditsModal] = useState(false)
  const [cancelModal, setCancelModal] = useState(false)
  const [changeModal, setChangeModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [selectedCredits, setSelectedCredits] = useState('')
  const [cycle] = useState<'monthly' | 'yearly'>('monthly')
  const [cgv, setCgv] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [p, s, c, h] = await Promise.all([
      api('/api/v1/billing/robot/plans'), api('/api/v1/billing/robot/summary'),
      api('/api/v1/billing/robot/credits-plans'), api('/api/v1/billing/robot/minutes-history'),
    ])
    if (p.success) { setPlans(p.data || []); if (!selectedPlan) setSelectedPlan((p.data || []).find((x: any) => x.popular)?.plan_code || '') }
    if (s.success) setSummary(s.data)
    if (c.success) setCreditsPacks(c.data || [])
    if (h.success) setHistory(h.data || [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  const handleSubscribe = async () => {
    setSubmitting(true)
    const res = await api('/api/v1/billing/robot/subscribe', { method: 'POST', body: JSON.stringify({ planCode: selectedPlan, billingCycle: cycle }) })
    if (res.success) { flash('Robot active avec succes'); setActivateModal(false); setCgv(false); loadData() }
    else flash(res.error || 'Erreur', 'error')
    setSubmitting(false)
  }
  const handleBuyCredits = async () => {
    setSubmitting(true)
    const res = await api('/api/v1/billing/robot/buy-credits', { method: 'POST', body: JSON.stringify({ creditsPack: selectedCredits }) })
    if (res.success) { flash('Credits ajoutes'); setCreditsModal(false); loadData() }
    else flash(res.error || 'Erreur', 'error')
    setSubmitting(false)
  }
  const handleCancel2 = async () => {
    const res = await api('/api/v1/billing/robot/cancel', { method: 'DELETE' })
    if (res.success) { flash('Annulation programmee'); setCancelModal(false); loadData() }
    else flash(res.error || 'Erreur', 'error')
  }
  const handleChangePlan = async () => {
    setSubmitting(true)
    const res = await api('/api/v1/billing/robot/plan', { method: 'PUT', body: JSON.stringify({ planCode: selectedPlan, billingCycle: cycle }) })
    if (res.success) { flash('Plan mis a jour'); setChangeModal(false); loadData() }
    else flash(res.error || 'Erreur', 'error')
    setSubmitting(false)
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 bg-[#18181f] rounded-xl animate-pulse" />)}</div>

  const hasActive = summary?.activePlan && summary.status && ['active','trialing','past_due','canceling'].includes(summary.status)
  const mu = summary?.minutesUsage

  if (hasActive && summary?.activePlan) {
    return (
      <div>
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#7b61ff]/10 flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg></div>
            <div>
              <div className="text-[15px] font-bold text-[#eeeef8]">{summary.activePlan.name}</div>
              <div className="text-[12px] text-[#55557a]">{fmtCents(summary.activePlan.price_monthly)} CAD$/mois — Prochain: {fmtDate(summary.nextPaymentAt)}</div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ml-2 ${summary.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : summary.status === 'trialing' ? 'bg-blue-900/40 text-blue-400' : 'bg-orange-900/40 text-orange-400'}`}>
              {summary.status === 'active' ? 'Actif' : summary.status === 'trialing' ? 'Essai' : summary.status}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setSelectedPlan(summary.activePlan!.plan_code); setChangeModal(true) }} className="px-4 py-2 bg-[#7b61ff]/10 border border-[#7b61ff]/30 text-[#7b61ff] rounded-lg text-[12px] font-semibold cursor-pointer">Changer de plan</button>
            {summary.status !== 'canceling' && <button onClick={() => setCancelModal(true)} className="px-4 py-2 bg-red-950/40 border border-red-800/40 text-red-400 rounded-lg text-[12px] font-semibold cursor-pointer">Annuler</button>}
          </div>
        </div>
        {mu && (
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 mb-5">
            <div className="flex justify-between mb-2">
              <span className="text-[13px] text-[#9898b8]">{mu.minutesUsed.toFixed(1)} / {mu.minutesIncluded} min ({mu.percentUsed}%)</span>
              <span className="text-[13px] text-[#eeeef8] font-semibold">{mu.minutesRemaining.toFixed(0)} restantes</span>
            </div>
            <div className="h-3 bg-[#111118] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${mu.percentUsed > 100 ? 'bg-red-500' : mu.percentUsed > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, mu.percentUsed)}%` }} />
            </div>
            {mu.minutesOverage > 0 && <div className="text-[12px] text-orange-400 mt-2">{mu.minutesOverage.toFixed(1)} min surplus — {fmtCents(Math.round(mu.overageAmount * 100))} CAD$</div>}
          </div>
        )}
        {summary.creditsBalance > 0 && (
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 mb-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] font-semibold text-[#eeeef8]">Credits: {summary.creditsBalance} min</span>
              <button onClick={() => setCreditsModal(true)} className="text-[11px] text-[#7b61ff] font-semibold cursor-pointer bg-transparent border-none">Acheter plus</button>
            </div>
            {summary.credits.map(c => <div key={c.id} className="flex justify-between text-[12px] text-[#9898b8] py-0.5"><span>{c.minutesRemaining}/{c.minutesPurchased} min</span><span>Expire {fmtDate(c.expiresAt)}</span></div>)}
          </div>
        )}
        {history.length > 0 && (
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
            <div className="grid grid-cols-5 px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
              <div>Mois</div><div className="text-right">Utilisees</div><div className="text-right">Incluses</div><div className="text-right">Surplus</div><div className="text-right">Montant</div>
            </div>
            {history.map((h: any, i: number) => (
              <div key={i} className="grid grid-cols-5 px-5 py-2.5 border-b border-[#2e2e44]/60 text-[13px]">
                <div className="text-[#eeeef8]">{h.month}</div><div className="text-right text-[#9898b8]">{parseFloat(h.minutes_used||0).toFixed(1)}</div>
                <div className="text-right text-[#9898b8]">{h.minutes_included}</div><div className="text-right text-[#9898b8]">{parseFloat(h.minutes_overage||0).toFixed(1)}</div>
                <div className="text-right text-[#eeeef8]">{fmtCents(Math.round(parseFloat(h.overage_amount||0)*100))} CAD$</div>
              </div>
            ))}
          </div>
        )}
        {cancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setCancelModal(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[460px]">
              <div className="text-[17px] font-bold text-[#eeeef8] mb-4">Confirmer l&apos;annulation</div>
              <div className="text-[13px] text-[#9898b8] mb-6">Le plan robot sera annule a la fin de la periode.</div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setCancelModal(false)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
                <button onClick={handleCancel2} className="px-5 py-2 bg-[#ff4d6d] border-none rounded-lg text-white text-[12px] font-bold cursor-pointer">Confirmer</button>
              </div>
            </div>
          </div>
        )}
        {changeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setChangeModal(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[700px] max-w-[95vw]">
              <div className="text-[17px] font-bold text-[#eeeef8] mb-5">Changer de plan</div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {plans.map(p => (
                  <div key={p.plan_code} onClick={() => setSelectedPlan(p.plan_code)} className={`p-4 rounded-xl cursor-pointer border-2 ${selectedPlan === p.plan_code ? 'border-[#7b61ff] bg-[#7b61ff]/5' : 'border-[#2e2e44] bg-[#111118]'}`}>
                    <div className="text-[14px] font-bold text-[#eeeef8] mb-1">{p.name}</div>
                    <div className="text-[20px] font-extrabold text-[#eeeef8]">{fmtCents(p.price_monthly)}<span className="text-[12px] text-[#55557a]"> CAD$/mois</span></div>
                    <div className="text-[12px] text-[#7b61ff] font-semibold mt-1">{p.minutes_included} min</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setChangeModal(false)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
                <button onClick={handleChangePlan} disabled={submitting} className="px-6 py-2 bg-[#7b61ff] border-none rounded-lg text-white text-[12px] font-bold cursor-pointer">{submitting ? '...' : 'Confirmer'}</button>
              </div>
            </div>
          </div>
        )}
        {creditsModal && <CreditsModal2 packs={creditsPacks} selected={selectedCredits} onSelect={setSelectedCredits} onBuy={handleBuyCredits} onClose={() => setCreditsModal(false)} submitting={submitting} />}
      </div>
    )
  }

  // ── NO PLAN ──
  return (
    <div>
      <h3 className="text-[15px] font-bold text-[#eeeef8] mb-4">Plans Robot d&apos;appel</h3>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {plans.map(p => (
          <div key={p.plan_code} className={`bg-[#18181f] border rounded-xl p-5 flex flex-col relative ${p.popular ? 'border-[#7b61ff] border-2' : 'border-[#2e2e44]'}`}>
            {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#7b61ff] text-white text-[10px] font-bold rounded-full">Populaire</span>}
            <div className="text-[15px] font-bold text-[#eeeef8] mb-1">{p.name}</div>
            <div className="text-[24px] font-extrabold text-[#eeeef8] mb-1">{fmtCents(p.price_monthly)}<span className="text-[12px] text-[#55557a]"> CAD$/mois</span></div>
            <div className="text-[13px] text-[#7b61ff] font-bold mb-3">{p.minutes_included} min incluses</div>
            <div className="text-[11px] text-[#55557a] mb-3">{p.max_concurrent_calls} simultanes — Surplus: {p.overage_rate.toFixed(2)} CAD$/min</div>
            <div className="space-y-1 mb-4 flex-1">
              {p.features.slice(0,5).map((f,i) => <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#9898b8]"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{f}</div>)}
            </div>
            <button onClick={() => { setSelectedPlan(p.plan_code); setActivateModal(true); setCgv(false) }} className={`w-full py-2.5 rounded-lg text-[12px] font-bold cursor-pointer border-none ${p.popular ? 'bg-[#7b61ff] text-white' : 'bg-[#1e1e2a] text-[#9898b8]'}`}>Souscrire</button>
          </div>
        ))}
      </div>
      <h3 className="text-[15px] font-bold text-[#eeeef8] mb-2">Ou sans abonnement — achetez des minutes</h3>
      <div className="grid grid-cols-4 gap-3">
        {creditsPacks.map((p: any) => (
          <div key={p.code} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4 text-center">
            <div className="text-[18px] font-extrabold text-[#eeeef8]">{p.minutes}</div>
            <div className="text-[11px] text-[#55557a] mb-2">minutes</div>
            <div className="text-[15px] font-bold text-[#7b61ff] mb-1">{fmtCents(p.amount)} CAD$</div>
            <div className="text-[10px] text-[#55557a] mb-3">~ {p.estimatedCalls30s} appels</div>
            <button onClick={() => { setSelectedCredits(p.code); setCreditsModal(true) }} className="w-full py-2 bg-[#1e1e2a] border border-[#2e2e44] rounded-lg text-[12px] font-semibold text-[#9898b8] cursor-pointer">Acheter</button>
          </div>
        ))}
      </div>
      {activateModal && (() => {
        const plan = plans.find(p => p.plan_code === selectedPlan); if (!plan) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setActivateModal(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl w-[600px] max-w-[95vw]">
              <div className="px-7 pt-6 pb-4 border-b border-[#2e2e44]"><div className="text-[17px] font-bold text-[#eeeef8]">{plan.name}</div><div className="text-[12px] text-[#55557a]">14 jours gratuits</div></div>
              <div className="px-7 py-5 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {plans.map(p => <div key={p.plan_code} onClick={() => setSelectedPlan(p.plan_code)} className={`p-3 rounded-lg cursor-pointer border text-center ${selectedPlan === p.plan_code ? 'border-[#7b61ff] bg-[#7b61ff]/5' : 'border-[#2e2e44] bg-[#111118]'}`}><div className="text-[13px] font-bold text-[#eeeef8]">{p.name}</div><div className="text-[11px] text-[#7b61ff]">{p.minutes_included} min</div></div>)}
                </div>
                <div className="bg-[#111118] rounded-lg p-4">
                  <div className="flex justify-between text-[13px] mb-1"><span className="text-[#9898b8]">Minutes</span><span className="text-[#eeeef8] font-bold">{plan.minutes_included}</span></div>
                  <div className="flex justify-between text-[13px] mb-1"><span className="text-[#9898b8]">Simultanes</span><span className="text-[#eeeef8]">{plan.max_concurrent_calls}</span></div>
                  <div className="flex justify-between text-[13px] font-bold border-t border-[#2e2e44] pt-2 mt-2"><span className="text-[#eeeef8]">Prix</span><span className="text-[#7b61ff]">{fmtCents(plan.price_monthly)} CAD$/mois</span></div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={cgv} onChange={e => setCgv(e.target.checked)} className="w-4 h-4 accent-[#7b61ff]" /><span className="text-[12px] text-[#9898b8]">J&apos;accepte les CGV</span></label>
              </div>
              <div className="px-7 py-4 border-t border-[#2e2e44] flex justify-end gap-3">
                <button onClick={() => setActivateModal(false)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
                <button onClick={handleSubscribe} disabled={!cgv||submitting} className={`px-6 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer ${cgv&&!submitting?'bg-[#7b61ff] text-white':'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}>{submitting?'...':'Activer'}</button>
              </div>
            </div>
          </div>
        )
      })()}
      {creditsModal && <CreditsModal2 packs={creditsPacks} selected={selectedCredits} onSelect={setSelectedCredits} onBuy={handleBuyCredits} onClose={() => setCreditsModal(false)} submitting={submitting} />}
    </div>
  )
}

function CreditsModal2({ packs, selected, onSelect, onBuy, onClose, submitting }: { packs: any[]; selected: string; onSelect: (v: string) => void; onBuy: () => void; onClose: () => void; submitting: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[550px]">
        <div className="text-[17px] font-bold text-[#eeeef8] mb-5">Acheter des credits</div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {packs.map((p: any) => <div key={p.code} onClick={() => onSelect(p.code)} className={`p-4 rounded-xl cursor-pointer border-2 text-center ${selected===p.code?'border-[#7b61ff] bg-[#7b61ff]/5':'border-[#2e2e44] bg-[#111118]'}`}><div className="text-[18px] font-extrabold text-[#eeeef8]">{p.minutes} min</div><div className="text-[15px] font-bold text-[#7b61ff] mt-1">{fmtCents(p.amount)} CAD$</div><div className="text-[10px] text-[#55557a] mt-1">12 mois</div></div>)}
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Annuler</button>
          <button onClick={onBuy} disabled={!selected||submitting} className={`px-6 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer ${selected&&!submitting?'bg-[#7b61ff] text-white':'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}>{submitting?'...':'Acheter'}</button>
        </div>
      </div>
    </div>
  )
}
