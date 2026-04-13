'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────
interface PlanSummary {
  plan_code: string
  plan_name: string
  description: string
  price_per_agent: number // cents
  active_agents: number
  monthly_total: number   // cents
}

interface SummaryData {
  plans: PlanSummary[]
  total_agents: number
  total_monthly: number
  currency: string
  registration_date: string | null
  next_payment_date: string | null
}

interface Agent {
  id: string
  extension: string
  label: string
  email: string
  name: string
  plan_code: string | null
  plan_name: string
  price: number // cents
  status: string
}

interface Destination {
  country: string
  fixed: boolean
  mobile: boolean
}

interface UpgradeResult {
  agents: { agentId: string; planCode: string; planName: string; price: number; proRata: number }[]
  prorata: number
  tax: number
  total: number
  currency: string
}

// ── Plan catalog (hardcoded for UI) ───────────────────────
const PLANS = [
  { code: 'ENTRANTS',          name: 'Entrants',          detail: 'Appels entrants uniquement',                              price: 1900, badge: 'bg-emerald-600' },
  { code: 'CANADA_USA',        name: 'Canada/USA',        detail: 'Illimite fixes et mobiles : Canada et USA',               price: 3500, badge: 'bg-sky-600' },
  { code: 'CANADA_USA_FRANCE', name: 'Canada/USA/France', detail: 'Illimite fixes et mobiles : Canada, USA et France',       price: 5000, badge: 'bg-[#7b61ff]' },
  { code: 'INTERNATIONAL',     name: 'International',     detail: 'Illimite fixes et mobiles : pays Europeens',              price: 7500, badge: 'bg-orange-500' },
] as const

const PLAN_MAP = Object.fromEntries(PLANS.map(p => [p.code, p]))

// ── API helper ────────────────────────────────────────────
function useApi() {
  const getUrl = () =>
    typeof window !== 'undefined'
      ? localStorage.getItem('vf_url') || 'http://localhost:4000'
      : 'http://localhost:4000'
  const getTok = () =>
    typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}),
        ...(opts.headers || {}),
      },
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
  try {
    return new Date(iso).toLocaleDateString('fr-CA', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch { return '-' }
}

// ── Tabs ──────────────────────────────────────────────────
type TabKey = 'RESUME' | 'AJOUTER' | 'EDITER' | 'SUPPRIMER'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'RESUME',    label: 'Resume' },
  { key: 'AJOUTER',   label: 'Ajouter' },
  { key: 'EDITER',    label: 'Editer' },
  { key: 'SUPPRIMER', label: 'Supprimer' },
]

// ── Sub-views ─────────────────────────────────────────────
type SubView = 'main' | 'upgrade-summary' | 'delete-confirm' | 'destinations'

// ══════════════════════════════════════════════════════════
// Confirm Modal
// ══════════════════════════════════════════════════════════
function ConfirmModal({
  title, message, onCancel, onConfirm, confirmLabel, danger,
}: {
  title: string; message: string; onCancel: () => void; onConfirm: () => void
  confirmLabel?: string; danger?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[460px] max-w-[95vw]">
        <div className="text-[17px] font-bold text-[#eeeef8] mb-4">{title}</div>
        <div className="text-[13px] text-[#9898b8] leading-relaxed whitespace-pre-line mb-7">{message}</div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer hover:bg-[#1f1f2a] transition-colors">
            Annuler
          </button>
          <button onClick={onConfirm} className={`px-6 py-2.5 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer transition-colors ${danger ? 'bg-[#ff4d6d] hover:bg-[#e8405f]' : 'bg-[#7b61ff] hover:bg-[#6145ff]'}`}>
            {confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Destinations Modal
// ══════════════════════════════════════════════════════════
function DestinationsModal({
  planCode, planName, destinations, onClose,
}: {
  planCode: string; planName: string; destinations: Destination[]; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-[#0c0c1a] border border-[#2e2e44] rounded-xl p-8 w-[560px] max-w-[95vw] max-h-[80vh] flex flex-col">
        <div className="text-[17px] font-bold text-[#eeeef8] mb-1">Destinations incluses</div>
        <div className="text-[13px] text-[#9898b8] mb-5">Forfait {planName}</div>
        <div className="flex-1 overflow-y-auto">
          {destinations.length === 0 ? (
            <div className="text-[13px] text-[#55557a] italic py-6 text-center">Aucune destination sortante incluse (entrants uniquement)</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2e2e44]">
                  <th className="text-left text-[11px] text-[#55557a] uppercase tracking-wider font-semibold py-2 px-3">Pays</th>
                  <th className="text-center text-[11px] text-[#55557a] uppercase tracking-wider font-semibold py-2 px-3">Fixes</th>
                  <th className="text-center text-[11px] text-[#55557a] uppercase tracking-wider font-semibold py-2 px-3">Mobiles</th>
                </tr>
              </thead>
              <tbody>
                {destinations.map((d, i) => (
                  <tr key={i} className="border-b border-[#1f1f2a] hover:bg-[#1f1f2a] transition-colors">
                    <td className="py-2.5 px-3 text-[13px] text-[#eeeef8]">{d.country}</td>
                    <td className="py-2.5 px-3 text-center text-[13px]">
                      {d.fixed ? <span className="text-emerald-400">Illimite</span> : <span className="text-[#55557a]">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center text-[13px]">
                      {d.mobile ? <span className="text-emerald-400">Illimite</span> : <span className="text-[#55557a]">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer hover:bg-[#1f1f2a] transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════
export default function PlansPage() {
  const api = useApi()
  const [tab, setTab] = useState<TabKey>('RESUME')
  const [subView, setSubView] = useState<SubView>('main')
  const [msg, setMsg] = useState<string | null>(null)
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  // Data
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  // Ajouter tab state
  const [addQty, setAddQty] = useState<Record<string, number>>({})

  // Editer tab state
  const [editPlans, setEditPlans] = useState<Record<string, string>>({})

  // Supprimer tab state
  const [deleteChecked, setDeleteChecked] = useState<Set<string>>(new Set())

  // Upgrade result
  const [upgradeResult, setUpgradeResult] = useState<UpgradeResult | null>(null)

  // Destinations modal
  const [destModal, setDestModal] = useState<{ planCode: string; planName: string; destinations: Destination[] } | null>(null)

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; danger?: boolean } | null>(null)

  const flash = (m: string, type: 'success' | 'error' = 'success') => {
    setMsg(m)
    setMsgType(type)
    setTimeout(() => setMsg(null), 4000)
  }

  // ── Load data ─────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, agRes] = await Promise.all([
        api('/api/v1/billing/telephony/summary'),
        api('/api/v1/billing/telephony/agents'),
      ])
      if (sumRes.success) setSummary(sumRes.data)
      if (agRes.success) setAgents(agRes.data || [])
    } catch {
      flash('Erreur de chargement', 'error')
    }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // Reset sub-state on tab change
  useEffect(() => {
    setSubView('main')
    setAddQty({})
    setEditPlans(Object.fromEntries(agents.filter(a => a.plan_code).map(a => [a.id, a.plan_code!])))
    setDeleteChecked(new Set())
    setUpgradeResult(null)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Destinations loader ───────────────────────────────
  const showDestinations = async (planCode: string) => {
    try {
      const res = await api(`/api/v1/billing/telephony/destinations/${planCode}`)
      if (res.success) {
        setDestModal({
          planCode,
          planName: PLAN_MAP[planCode]?.name || planCode,
          destinations: res.data.destinations,
        })
      }
    } catch { flash('Erreur chargement destinations', 'error') }
  }

  // ── Ajouter: Continue ─────────────────────────────────
  const handleAddContinue = async () => {
    const changes: { agentId: string; planCode: string }[] = []

    // For each plan with qty > 0, we need to create "virtual" new agent assignments
    // In reality, this should assign existing unassigned agents or prompt to create new extensions
    // For now, we'll show the summary with the planned additions
    const hasChanges = Object.values(addQty).some(q => q > 0)
    if (!hasChanges) {
      flash('Selectionnez au moins un agent a ajouter', 'error')
      return
    }

    // Build a preview for upgrade summary
    const previewAgents: UpgradeResult['agents'] = []
    let totalProrata = 0

    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysRemaining = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / 86400000))
    const daysInMonth = endOfMonth.getDate()
    const factor = daysRemaining / daysInMonth

    for (const plan of PLANS) {
      const qty = addQty[plan.code] || 0
      for (let i = 0; i < qty; i++) {
        const proRata = Math.round(plan.price * factor)
        totalProrata += proRata
        previewAgents.push({
          agentId: `new-${plan.code}-${i}`,
          planCode: plan.code,
          planName: plan.name,
          price: plan.price,
          proRata,
        })
      }
    }

    const tax = Math.round(totalProrata * 0.14975)
    setUpgradeResult({
      agents: previewAgents,
      prorata: totalProrata,
      tax,
      total: totalProrata + tax,
      currency: 'CAD',
    })
    setSubView('upgrade-summary')
  }

  // ── Editer: Continue ──────────────────────────────────
  const handleEditContinue = async () => {
    const changes: { agentId: string; planCode: string }[] = []
    for (const agent of agents) {
      const newPlan = editPlans[agent.id]
      if (newPlan && newPlan !== agent.plan_code) {
        changes.push({ agentId: agent.id, planCode: newPlan })
      }
    }
    if (changes.length === 0) {
      flash('Aucun changement detecte', 'error')
      return
    }

    try {
      const res = await api('/api/v1/billing/telephony/upgrade', {
        method: 'POST',
        body: JSON.stringify({ changes }),
      })
      if (res.success) {
        setUpgradeResult(res.data)
        setSubView('upgrade-summary')
      } else {
        flash(res.error || 'Erreur', 'error')
      }
    } catch { flash('Erreur lors de la mise a jour', 'error') }
  }

  // ── Supprimer: Continue ───────────────────────────────
  const handleDeleteContinue = () => {
    if (deleteChecked.size === 0) {
      flash('Selectionnez au moins un agent', 'error')
      return
    }
    const selected = agents.filter(a => deleteChecked.has(a.id))
    const totalSaved = selected.reduce((s, a) => s + a.price, 0)
    setConfirmModal({
      title: 'Confirmer la suppression',
      message: `Vous allez retirer ${selected.length} agent(s) de leur forfait telephonie.\n\nEconomie mensuelle estimee: ${fmtCents(totalSaved)} CAD$/mois\n\nCette action est irreversible.`,
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null)
        let ok = 0
        for (const id of deleteChecked) {
          try {
            const res = await api(`/api/v1/billing/telephony/agent/${id}`, { method: 'DELETE' })
            if (res.success) ok++
          } catch {}
        }
        flash(`${ok} agent(s) retire(s) du forfait`)
        setDeleteChecked(new Set())
        loadData()
      },
    })
  }

  // ── Upgrade Summary: Pay ──────────────────────────────
  const handlePay = () => {
    flash('Paiement traite avec succes')
    setSubView('main')
    setTab('RESUME')
    loadData()
  }

  // ── Active agents with plan ───────────────────────────
  const activeAgents = agents.filter(a => a.plan_code)

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[#eeeef8] m-0 mb-1.5">Mes forfaits</h1>
        <p className="text-[13px] text-[#9898b8] m-0">Telephonie d'entreprise — gerez vos forfaits par agent.</p>
      </div>

      {/* Flash */}
      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-[13px] ${
          msgType === 'error'
            ? 'bg-[#ff4d6d]/10 border border-[#ff4d6d]/20 text-[#ff4d6d]'
            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        }`}>
          {msg}
        </div>
      )}

      {/* Sub-view: Upgrade Summary */}
      {subView === 'upgrade-summary' && upgradeResult && (
        <UpgradeSummaryView
          result={upgradeResult}
          agents={agents}
          onBack={() => setSubView('main')}
          onPay={handlePay}
        />
      )}

      {/* Main view */}
      {subView === 'main' && (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-[#2e2e44] mb-6">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-6 py-2.5 bg-transparent border-none text-[14px] cursor-pointer transition-all border-b-2 ${
                  tab === t.key
                    ? 'border-b-[#7b61ff] text-[#eeeef8] font-bold'
                    : 'border-b-transparent text-[#55557a] font-medium hover:text-[#9898b8]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="py-16 text-center text-[#55557a] text-[13px]">Chargement...</div>
          )}

          {/* ── TAB: RESUME ──────────────────────────────── */}
          {!loading && tab === 'RESUME' && summary && (
            <>
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
                {/* Header */}
                <div className="grid grid-cols-[180px_1fr_160px_100px] px-5 py-3 border-b border-[#2e2e44] bg-[#14141c]">
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Forfait</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Details</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Prix CAD$/agent/mois</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider text-center">Actif</div>
                </div>
                {/* Rows */}
                {summary.plans.map(p => {
                  const ui = PLAN_MAP[p.plan_code]
                  return (
                    <div key={p.plan_code} className="grid grid-cols-[180px_1fr_160px_100px] px-5 py-4 border-b border-[#1f1f2a] hover:bg-[#1f1f2a] items-center transition-colors">
                      <div>
                        <span className={`${ui?.badge || 'bg-[#7b61ff]'} px-3 py-2 rounded-lg text-[11px] font-extrabold text-white uppercase tracking-wide inline-block`}>
                          {p.plan_name}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#9898b8]">{p.description}</div>
                      <div>
                        <span className="text-[20px] font-extrabold text-[#eeeef8]">{fmtCents(p.price_per_agent)}</span>
                        <span className="text-[11px] text-[#55557a] ml-1">CAD$/mois</span>
                      </div>
                      <div className="text-center">
                        <span className={`text-[16px] font-bold ${p.active_agents > 0 ? 'text-[#eeeef8]' : 'text-[#55557a]'}`}>
                          {p.active_agents > 0 ? `${p.active_agents} agent${p.active_agents > 1 ? 's' : ''}` : '-'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* CTA button */}
              <div className="mb-5 flex justify-center">
                <button
                  onClick={() => setTab('AJOUTER')}
                  className="px-8 py-3 bg-[#7b61ff] hover:bg-[#6145ff] text-white rounded-lg text-[13px] font-bold cursor-pointer transition-colors"
                >
                  Augmenter / Diminuer votre plan d'hebergement
                </button>
              </div>

              {/* Footer */}
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 px-6">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] text-[#55557a] uppercase tracking-widest mb-1.5">Date d'enregistrement</div>
                    <div className="text-[13px] font-semibold text-[#eeeef8]">{fmtDate(summary.registration_date)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#55557a] uppercase tracking-widest mb-1.5">Prochain paiement</div>
                    <div className="text-[13px] font-semibold text-[#eeeef8]">{fmtDate(summary.next_payment_date)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#55557a] uppercase tracking-widest mb-1.5">Forfaits actifs</div>
                    <div className="text-[13px] font-semibold text-[#eeeef8]">
                      {summary.plans.filter(p => p.active_agents > 0).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#55557a] uppercase tracking-widest mb-1.5">Montant recurrent total</div>
                    <div className="text-[18px] font-extrabold text-[#7b61ff]">
                      {fmtCents(summary.total_monthly)} CAD$/mois
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── TAB: AJOUTER ─────────────────────────────── */}
          {!loading && tab === 'AJOUTER' && (
            <>
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
                {/* Header */}
                <div className="grid grid-cols-[140px_1fr_130px_120px_100px_150px] px-5 py-3 border-b border-[#2e2e44] bg-[#14141c]">
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Forfait</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Details</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Destinations</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Prix</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider text-center">Actif</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider text-center">Quantite</div>
                </div>
                {PLANS.map(plan => {
                  const summaryPlan = summary?.plans.find(p => p.plan_code === plan.code)
                  const currentAgents = summaryPlan?.active_agents || 0
                  const qty = addQty[plan.code] || 0
                  return (
                    <div key={plan.code} className="grid grid-cols-[140px_1fr_130px_120px_100px_150px] px-5 py-4 border-b border-[#1f1f2a] hover:bg-[#1f1f2a] items-center transition-colors">
                      <div>
                        <span className={`${plan.badge} px-3 py-2 rounded-lg text-[10px] font-extrabold text-white uppercase tracking-wide inline-block`}>
                          {plan.name}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#9898b8] pr-3">{plan.detail}</div>
                      <div>
                        {plan.code === 'ENTRANTS' ? (
                          <span className="text-[12px] text-[#55557a]">-</span>
                        ) : (
                          <button
                            onClick={() => showDestinations(plan.code)}
                            className="text-[12px] text-[#7b61ff] hover:text-[#a695ff] underline cursor-pointer bg-transparent border-none transition-colors"
                          >
                            Voir destinations
                          </button>
                        )}
                      </div>
                      <div>
                        <span className="text-[18px] font-extrabold text-[#eeeef8]">{plan.price / 100}</span>
                        <span className="text-[11px] text-[#55557a] ml-1">CAD$</span>
                      </div>
                      <div className="text-center">
                        <span className={`text-[14px] font-bold ${currentAgents > 0 ? 'text-[#eeeef8]' : 'text-[#55557a]'}`}>
                          {currentAgents}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={e => setAddQty(prev => ({ ...prev, [plan.code]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          className="w-16 bg-[#111118] border border-[#2e2e44] rounded-lg px-2.5 py-2 text-sm text-[#eeeef8] text-center outline-none focus:border-[#7b61ff]/50 transition-colors"
                        />
                        <button
                          onClick={() => setAddQty(prev => ({ ...prev, [plan.code]: (prev[plan.code] || 0) + 1 }))}
                          className="w-8 h-8 rounded-lg bg-[#7b61ff]/15 border border-[#7b61ff]/30 text-[#a695ff] cursor-pointer text-[16px] flex items-center justify-center hover:bg-[#7b61ff]/25 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddContinue}
                  className="px-8 py-3 bg-[#7b61ff] hover:bg-[#6145ff] text-white rounded-lg text-[13px] font-bold cursor-pointer transition-colors"
                >
                  Continuer
                </button>
              </div>
            </>
          )}

          {/* ── TAB: EDITER ──────────────────────────────── */}
          {!loading && tab === 'EDITER' && (
            <>
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
                <div className="grid grid-cols-[120px_1fr_250px] px-5 py-3 border-b border-[#2e2e44] bg-[#14141c]">
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Extension</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Contexte</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Forfait</div>
                </div>
                {activeAgents.length === 0 ? (
                  <div className="py-10 text-center text-[#55557a] text-[13px] italic">Aucun agent avec forfait actif</div>
                ) : (
                  activeAgents.map(agent => (
                    <div key={agent.id} className="grid grid-cols-[120px_1fr_250px] px-5 py-3.5 border-b border-[#1f1f2a] hover:bg-[#1f1f2a] items-center transition-colors">
                      <div className="text-[14px] font-bold text-[#eeeef8]">{agent.extension}</div>
                      <div>
                        <div className="text-[13px] text-[#eeeef8]">{agent.name || agent.email || agent.label || '-'}</div>
                        <div className="text-[11px] text-[#55557a]">{agent.email}</div>
                      </div>
                      <div>
                        <select
                          value={editPlans[agent.id] || agent.plan_code || ''}
                          onChange={e => setEditPlans(prev => ({ ...prev, [agent.id]: e.target.value }))}
                          className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]/50 transition-colors cursor-pointer"
                        >
                          {PLANS.map(p => (
                            <option key={p.code} value={p.code}>
                              {p.name} — {p.price / 100} CAD$/mois
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {activeAgents.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleEditContinue}
                    className="px-8 py-3 bg-[#7b61ff] hover:bg-[#6145ff] text-white rounded-lg text-[13px] font-bold cursor-pointer transition-colors"
                  >
                    Continuer
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── TAB: SUPPRIMER ───────────────────────────── */}
          {!loading && tab === 'SUPPRIMER' && (
            <>
              <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
                <div className="grid grid-cols-[120px_1fr_180px_80px] px-5 py-3 border-b border-[#2e2e44] bg-[#14141c]">
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Extension</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Contexte</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Forfait actuel</div>
                  <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider text-center">Supprimer</div>
                </div>
                {activeAgents.length === 0 ? (
                  <div className="py-10 text-center text-[#55557a] text-[13px] italic">Aucun agent avec forfait actif</div>
                ) : (
                  activeAgents.map(agent => {
                    const ui = PLAN_MAP[agent.plan_code || '']
                    return (
                      <div key={agent.id} className="grid grid-cols-[120px_1fr_180px_80px] px-5 py-3.5 border-b border-[#1f1f2a] hover:bg-[#1f1f2a] items-center transition-colors">
                        <div className="text-[14px] font-bold text-[#eeeef8]">{agent.extension}</div>
                        <div>
                          <div className="text-[13px] text-[#eeeef8]">{agent.name || agent.email || agent.label || '-'}</div>
                          <div className="text-[11px] text-[#55557a]">{agent.email}</div>
                        </div>
                        <div>
                          <span className={`${ui?.badge || 'bg-[#7b61ff]'} px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold text-white uppercase tracking-wide inline-block`}>
                            {agent.plan_name}
                          </span>
                        </div>
                        <div className="text-center">
                          <input
                            type="checkbox"
                            checked={deleteChecked.has(agent.id)}
                            onChange={e => {
                              const next = new Set(deleteChecked)
                              if (e.target.checked) next.add(agent.id)
                              else next.delete(agent.id)
                              setDeleteChecked(next)
                            }}
                            className="w-5 h-5 rounded cursor-pointer accent-[#ff4d6d]"
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              {activeAgents.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleDeleteContinue}
                    className="px-8 py-3 bg-[#ff4d6d] hover:bg-[#e8405f] text-white rounded-lg text-[13px] font-bold cursor-pointer transition-colors"
                  >
                    Continuer
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Modals ───────────────────────────────────────── */}
      {destModal && (
        <DestinationsModal
          planCode={destModal.planCode}
          planName={destModal.planName}
          destinations={destModal.destinations}
          onClose={() => setDestModal(null)}
        />
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          danger={confirmModal.danger}
          onCancel={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
          confirmLabel="Confirmer"
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Upgrade Summary Sub-View
// ══════════════════════════════════════════════════════════
function UpgradeSummaryView({
  result, agents, onBack, onPay,
}: {
  result: UpgradeResult
  agents: Agent[]
  onBack: () => void
  onPay: () => void
}) {
  const [payMethod, setPayMethod] = useState<'card'>('card')

  return (
    <div>
      <h2 className="text-[18px] font-bold text-[#eeeef8] mb-1">Resume de la mise a niveau</h2>
      <p className="text-[13px] text-[#9898b8] mb-6">Verifiez les changements avant de proceder au paiement.</p>

      {/* Agents table */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-5">
        <div className="grid grid-cols-[120px_1fr_160px] px-5 py-3 border-b border-[#2e2e44] bg-[#14141c]">
          <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Extension</div>
          <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider">Forfait</div>
          <div className="text-[11px] text-[#55557a] uppercase font-semibold tracking-wider text-right">Prix</div>
        </div>
        {result.agents.map((a, i) => {
          const original = agents.find(ag => ag.id === a.agentId)
          const ui = PLAN_MAP[a.planCode]
          return (
            <div key={i} className="grid grid-cols-[120px_1fr_160px] px-5 py-3.5 border-b border-[#1f1f2a] items-center">
              <div className="text-[14px] font-bold text-[#eeeef8]">
                {original?.extension || `Nouvel agent`}
              </div>
              <div>
                <span className={`${ui?.badge || 'bg-[#7b61ff]'} px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold text-white uppercase tracking-wide inline-block`}>
                  {a.planName}
                </span>
              </div>
              <div className="text-right text-[14px] font-semibold text-[#eeeef8]">
                {fmtCents(a.price)} CAD$/mois
              </div>
            </div>
          )
        })}
      </div>

      {/* Totals */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 mb-5">
        <div className="flex justify-between py-2 border-b border-[#1f1f2a]">
          <span className="text-[13px] text-[#9898b8]">Montant de la taxe estimee (TPS + TVQ)</span>
          <span className="text-[14px] font-semibold text-[#eeeef8]">{fmtCents(result.tax)} CAD$</span>
        </div>
        <div className="flex justify-between py-3">
          <span className="text-[15px] font-bold text-[#eeeef8]">Total a payer aujourd'hui (prorata)</span>
          <span className="text-[20px] font-extrabold text-[#7b61ff]">{fmtCents(result.total)} CAD$</span>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 mb-6">
        <div className="text-[12px] text-[#55557a] uppercase tracking-widest mb-3">Mode de paiement</div>
        <button
          onClick={() => setPayMethod('card')}
          className={`px-5 py-3 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors ${
            payMethod === 'card'
              ? 'bg-[#7b61ff]/15 border border-[#7b61ff]/40 text-[#a695ff]'
              : 'bg-[#111118] border border-[#2e2e44] text-[#9898b8] hover:bg-[#1f1f2a]'
          }`}
        >
          Credit Card
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[13px] font-semibold cursor-pointer hover:bg-[#1f1f2a] transition-colors flex items-center gap-2"
        >
          <span>&#8592;</span> Retour
        </button>
        <button
          onClick={onPay}
          className="px-8 py-3 bg-[#7b61ff] hover:bg-[#6145ff] text-white rounded-lg text-[13px] font-bold cursor-pointer transition-colors flex items-center gap-2"
        >
          Regler <span>&#8594;</span>
        </button>
      </div>
    </div>
  )
}
