'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// -- Types --
interface OrgInfo {
  id: string; name: string; status: string
  trial_ends_at: string | null; stripe_customer_id: string | null
}
interface Metrics {
  active_services: number; next_invoice_amount: number
  next_invoice_date: string | null; active_agents: number; did_numbers: number
}
interface Subscription {
  id: string; plan_id: string; plan_name: string; service_type: string
  quantity: number; billing_cycle: string; status: string
  unit_price: number; monthly_total: number; features_list: string[]
  current_period_end: string; trial_ends_at: string | null
}
interface Addon {
  sku: string; name: string; quantity: number; unit_price: number; total: number
}
interface DashboardData {
  org: OrgInfo; metrics: Metrics
  subscriptions: Subscription[]; addons: Addon[]
}

// -- API helper --
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

// -- Helpers --
function formatCAD(amount: number): string {
  return amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 })
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(iso: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function serviceTypeBadge(type: string) {
  switch (type.toUpperCase()) {
    case 'TELEPHONY': return { cls: 'bg-blue-900/50 text-blue-400', label: 'Telephonie' }
    case 'DIALER':    return { cls: 'bg-orange-900/50 text-orange-400', label: 'Dialer' }
    case 'ROBOT':     return { cls: 'bg-purple-900/50 text-purple-400', label: 'Robot' }
    default:          return { cls: 'bg-[#1e1e3a] text-[#7b61ff]', label: type }
  }
}

function statusBadge(status: string) {
  switch (status.toLowerCase()) {
    case 'active':   return { cls: 'bg-emerald-900/40 text-[#00d4aa]', label: 'Actif' }
    case 'trialing': return { cls: 'bg-blue-900/40 text-blue-400', label: 'Essai' }
    case 'past_due': return { cls: 'bg-red-900/40 text-[#ff4d6d]', label: 'En retard' }
    default:         return { cls: 'bg-[#1e1e3a] text-[#55557a]', label: status }
  }
}

// -- Telephony summary type --
interface TelSummary {
  activePlan: { plan_code: string; name: string; price_monthly: number; destinations: string[] } | null
  billingCycle: string
  status: string | null
  nbAgentsActive: number
  monthlyTotal: number
  trialEndsAt: string | null
}

// -- Addon summary type --
interface AddonModule {
  module_type: string; plan_code: string; status: string; price_monthly: number
}
interface AddonSummaryDash {
  activeModules: AddonModule[]
  monthlyTotal: number
  smsUsage: { smsSent: number; smsReceived: number; smsIncluded: number; percentUsed: number }
}

// -- Robot summary type --
interface RobotSummaryDash {
  activePlan: { plan_code: string; name: string; price_monthly: number; minutes_included: number } | null
  status: string | null
  minutesUsage: { minutesUsed: number; minutesIncluded: number; minutesRemaining: number; minutesOverage: number; percentUsed: number }
  creditsBalance: number
}

// -- Main Page --
export default function ClientDashboardPage() {
  const api = useApi()
  const [data, setData] = useState<DashboardData | null>(null)
  const [telSummary, setTelSummary] = useState<TelSummary | null>(null)
  const [addonSummary, setAddonSummary] = useState<AddonSummaryDash | null>(null)
  const [robotSummary, setRobotSummary] = useState<RobotSummaryDash | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [dashRes, telRes, addonRes, robotRes] = await Promise.all([
          api('/api/v1/client/portal/dashboard'),
          api('/api/v1/billing/telephony/summary').catch(() => ({ success: false })),
          api('/api/v1/billing/addons/summary').catch(() => ({ success: false })),
          api('/api/v1/billing/robot/summary').catch(() => ({ success: false })),
        ])
        const d = dashRes.data || dashRes
        if (!cancelled) {
          if (d.org) {
            setData(d)
          } else {
            setError(dashRes.error || 'Impossible de charger le tableau de bord')
          }
          if (telRes.success) setTelSummary(telRes.data)
          if ((addonRes as any).success) setAddonSummary((addonRes as any).data)
          if ((robotRes as any).success) setRobotSummary((robotRes as any).data)
        }
      } catch {
        if (!cancelled) setError('Erreur de connexion au serveur')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // -- Loading --
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 border-[3px] border-[#2e2e44] border-t-[#7b61ff] rounded-full animate-spin" />
          <span className="text-[13px] text-[#55557a]">Chargement...</span>
        </div>
      </div>
    )
  }

  // -- Error --
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-[15px] text-[#ff4d6d] mb-2">{error || 'Erreur inconnue'}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold"
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  const { org, metrics, subscriptions, addons } = data
  const trialDays = daysUntil(org.trial_ends_at)
  const hasSubscriptions = subscriptions && subscriptions.length > 0

  return (
    <div className="max-w-[1100px]">

      {/* -- Past due banner -- */}
      {org.status === 'past_due' && (
        <div className="bg-red-950/60 border border-red-900/50 rounded-xl px-5 py-3 mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4d6d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span className="text-[13px] text-red-300 font-semibold">Paiement en retard</span>
            <span className="text-xs text-red-400/60">Votre methode de paiement a ete refusee. Mettez a jour votre carte pour eviter une interruption de service.</span>
          </div>
          <Link
            href="/client/invoices"
            className="bg-[#ff4d6d] text-white rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap no-underline hover:bg-red-500"
          >
            Mettre a jour la carte
          </Link>
        </div>
      )}

      {/* -- Trial banner -- */}
      {org.status === 'trialing' && org.trial_ends_at && (
        <div className="bg-blue-950/50 border border-blue-800/40 rounded-xl px-5 py-3 mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="text-[13px] text-blue-300 font-semibold">{trialDays} jour{trialDays > 1 ? 's' : ''} restant{trialDays > 1 ? 's' : ''}</span>
            <span className="text-xs text-blue-400/50">Votre periode d&apos;essai se termine le {formatDate(org.trial_ends_at)}.</span>
          </div>
          <Link
            href="/client/plans"
            className="bg-blue-500 text-white rounded-lg px-4 py-1.5 text-xs font-semibold whitespace-nowrap no-underline hover:bg-blue-600"
          >
            Choisir un forfait
          </Link>
        </div>
      )}

      {/* -- Header -- */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#eeeef8] m-0">Mon compte</h1>
          <p className="text-[13px] text-[#55557a] mt-1 mb-0">{org.name}</p>
        </div>
        <Link
          href="/client/plans"
          className="inline-flex items-center gap-2 bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold no-underline transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Commander un service
        </Link>
      </div>

      {/* -- Metric cards -- */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        {/* Services actifs */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 flex flex-col gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#7b61ff]/10 border border-[#7b61ff]/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div className="text-[26px] font-bold text-[#eeeef8]">{metrics.active_services}</div>
          <div className="text-xs text-[#55557a] font-medium">Services actifs</div>
        </div>

        {/* Prochaine facture */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 flex flex-col gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#00d4aa]/10 border border-[#00d4aa]/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="text-[26px] font-bold text-[#eeeef8]">{formatCAD(metrics.next_invoice_amount)}</div>
          <div className="text-xs text-[#55557a] font-medium">
            Prochaine facture{metrics.next_invoice_date ? ` - ${formatDate(metrics.next_invoice_date)}` : ''}
          </div>
        </div>

        {/* Agents actifs */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 flex flex-col gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div className="text-[26px] font-bold text-[#eeeef8]">{metrics.active_agents}</div>
          <div className="text-xs text-[#55557a] font-medium">Agents actifs</div>
        </div>

        {/* Numeros DID */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 flex flex-col gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#ffb547]/10 border border-[#ffb547]/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb547" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6.29 6.29l1.86-1.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </div>
          <div className="text-[26px] font-bold text-[#eeeef8]">{metrics.did_numbers}</div>
          <div className="text-xs text-[#55557a] font-medium">Numeros DID</div>
        </div>
      </div>

      {/* -- Subscriptions -- */}
      <div className="mb-7">
        <h2 className="text-base font-bold text-[#9898b8] mb-3.5">Mes services actifs</h2>

        {hasSubscriptions ? (
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[120px_1fr_100px_100px_130px_90px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
              <div>Type</div>
              <div>Forfait</div>
              <div>Quantite</div>
              <div>Statut</div>
              <div className="text-right">Montant</div>
              <div className="text-right" />
            </div>

            {/* Rows */}
            {subscriptions.map(sub => {
              const sType = serviceTypeBadge(sub.service_type)
              const sBadge = statusBadge(sub.status)
              return (
                <div
                  key={sub.id}
                  className="grid grid-cols-[120px_1fr_100px_100px_130px_90px] px-5 py-3.5 border-b border-[#2e2e44]/60 items-center hover:bg-[#1e1e2a] transition-colors"
                >
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sType.cls}`}>
                      {sType.label}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#eeeef8]">{sub.plan_name}</div>
                    {sub.trial_ends_at && (
                      <div className="text-[11px] text-blue-400 mt-0.5">
                        Essai jusqu&apos;au {formatDate(sub.trial_ends_at)}
                      </div>
                    )}
                  </div>
                  <div className="text-[13px] text-[#9898b8]">{sub.quantity} poste{sub.quantity > 1 ? 's' : ''}</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sBadge.cls}`}>
                      {sBadge.label}
                    </span>
                  </div>
                  <div className="text-right text-sm font-semibold text-[#eeeef8]">
                    {formatCAD(sub.monthly_total)}
                    <span className="text-[11px] text-[#55557a] font-normal"> /mois</span>
                  </div>
                  <div className="text-right">
                    <Link
                      href="/client/plans"
                      className="inline-block text-[11px] font-semibold text-[#7b61ff] px-3 py-1 border border-[#7b61ff]/25 rounded-lg no-underline bg-[#7b61ff]/5 hover:bg-[#7b61ff]/15 transition-colors"
                    >
                      Gerer
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* -- Empty state CTA -- */
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl py-12 px-8 text-center">
            <div className="w-14 h-14 rounded-xl bg-[#7b61ff]/10 border border-[#7b61ff]/20 flex items-center justify-center mx-auto mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <h3 className="text-lg font-bold text-[#eeeef8] mb-2">Commencer avec VoxFlow</h3>
            <p className="text-[13px] text-[#55557a] mb-6 max-w-[380px] mx-auto">
              Choisissez un forfait de telephonie, de dialer ou de robot d&apos;appel pour commencer a utiliser la plateforme.
            </p>
            <Link
              href="/client/plans"
              className="inline-flex items-center gap-2 bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-7 py-3 text-sm font-bold no-underline transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Decouvrir les forfaits
            </Link>
          </div>
        )}
      </div>

      {/* -- Telephony card -- */}
      {telSummary && telSummary.activePlan && (
        <div className="mb-7">
          <h2 className="text-base font-bold text-[#9898b8] mb-3.5">Telephonie</h2>
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
            {telSummary.status === 'trialing' && telSummary.trialEndsAt && (
              <div className="bg-blue-950/50 border border-blue-800/40 rounded-lg px-4 py-2 mb-4 flex items-center gap-2 text-[12px] text-blue-300 font-semibold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Essai gratuit — {daysUntil(telSummary.trialEndsAt)} jours restants
              </div>
            )}
            {telSummary.status === 'past_due' && (
              <div className="bg-red-950/50 border border-red-800/40 rounded-lg px-4 py-2 mb-4 flex items-center justify-between text-[12px] text-red-300 font-semibold">
                <span>Paiement en retard</span>
                <Link href="/client/plans" className="text-red-400 underline text-[11px] no-underline hover:text-red-300">Mettre a jour la carte</Link>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-400">Telephonie</span>
                <span className="text-sm font-semibold text-[#eeeef8]">{telSummary.activePlan.name}</span>
                <span className="text-[12px] text-[#55557a]">{telSummary.nbAgentsActive} agent{telSummary.nbAgentsActive > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-[#eeeef8]">
                  {formatCAD(telSummary.monthlyTotal / 100)}
                  <span className="text-[11px] text-[#55557a] font-normal"> /mois</span>
                </span>
                {telSummary.status && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${telSummary.status === 'active' ? 'bg-emerald-900/40 text-[#00d4aa]' : telSummary.status === 'trialing' ? 'bg-blue-900/40 text-blue-400' : 'bg-red-900/40 text-[#ff4d6d]'}`}>
                    {telSummary.status === 'active' ? 'Actif' : telSummary.status === 'trialing' ? 'Essai' : telSummary.status === 'past_due' ? 'En retard' : telSummary.status}
                  </span>
                )}
                <Link href="/client/plans" className="inline-block text-[11px] font-semibold text-[#7b61ff] px-3 py-1 border border-[#7b61ff]/25 rounded-lg no-underline bg-[#7b61ff]/5 hover:bg-[#7b61ff]/15 transition-colors">
                  Gerer
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Telephony CTA when no active plan */}
      {telSummary && !telSummary.activePlan && !hasSubscriptions && (
        <div className="mb-7">
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl py-10 px-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6.29 6.29l1.86-1.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <h3 className="text-base font-bold text-[#eeeef8] mb-2">Commencer avec la telephonie VoxFlow</h3>
            <p className="text-[12px] text-[#55557a] mb-5 max-w-[340px] mx-auto">Appels illimites, CRM integre, supervision live et plus encore.</p>
            <Link href="/commander?service=telephony" className="inline-flex items-center gap-2 bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-6 py-2.5 text-sm font-bold no-underline transition-colors">
              Decouvrir les forfaits
            </Link>
          </div>
        </div>
      )}

      {/* -- Active modules -- */}
      {addonSummary && addonSummary.activeModules.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-base font-bold text-[#9898b8]">Modules actifs</h2>
            <Link href="/client/plans" className="text-[11px] font-semibold text-[#7b61ff] no-underline hover:underline">Gerer les modules</Link>
          </div>
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl divide-y divide-[#2e2e44]/60">
            {addonSummary.activeModules.map(m => (
              <div key={m.module_type} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#7b61ff]/10 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
                  </div>
                  <span className="text-[13px] font-semibold text-[#eeeef8]">{m.plan_code.replace('MODULE_', '').replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : m.status === 'trialing' ? 'bg-blue-900/40 text-blue-400' : 'bg-orange-900/40 text-orange-400'}`}>
                    {m.status === 'active' ? 'Actif' : m.status === 'trialing' ? 'Essai' : m.status}
                  </span>
                  <span className="text-[12px] text-[#9898b8]">{formatCAD(m.price_monthly / 100)}/mois</span>
                </div>
              </div>
            ))}
          </div>
          {/* SMS quota alert */}
          {addonSummary.smsUsage && addonSummary.smsUsage.percentUsed > 80 && addonSummary.activeModules.some(m => m.module_type === 'sms') && (
            <div className="bg-orange-950/40 border border-orange-800/30 rounded-lg px-4 py-2.5 mt-3 flex items-center gap-2 text-[12px] text-orange-300 font-semibold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Quota SMS bientot atteint — {Math.max(0, addonSummary.smsUsage.smsIncluded - addonSummary.smsUsage.smsSent - addonSummary.smsUsage.smsReceived)} SMS restants ce mois.
            </div>
          )}
        </div>
      )}

      {/* Module CTA when no modules active */}
      {(!addonSummary || addonSummary.activeModules.length === 0) && telSummary?.activePlan && (
        <div className="mb-7">
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl py-8 px-6 text-center">
            <h3 className="text-base font-bold text-[#eeeef8] mb-2">Boostez votre equipe</h3>
            <p className="text-[12px] text-[#55557a] mb-4 max-w-[380px] mx-auto">IA transcription, campagnes sortantes, analytics avances et SMS — personnalisez votre plateforme.</p>
            <Link href="/tarifs#modules" className="inline-flex items-center gap-2 bg-[#7b61ff]/10 border border-[#7b61ff]/30 text-[#7b61ff] rounded-lg px-5 py-2 text-[13px] font-semibold no-underline hover:bg-[#7b61ff]/20 transition-colors">
              Decouvrir les modules
            </Link>
          </div>
        </div>
      )}

      {/* -- Robot card -- */}
      {robotSummary?.activePlan && (
        <div className="mb-7">
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-900/50 text-purple-400">Robot</span>
                <span className="text-sm font-semibold text-[#eeeef8]">{robotSummary.activePlan.name}</span>
                {robotSummary.status && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${robotSummary.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-blue-900/40 text-blue-400'}`}>{robotSummary.status === 'active' ? 'Actif' : 'Essai'}</span>}
              </div>
              <Link href="/client/robot" className="inline-block text-[11px] font-semibold text-[#7b61ff] px-3 py-1 border border-[#7b61ff]/25 rounded-lg no-underline bg-[#7b61ff]/5 hover:bg-[#7b61ff]/15 transition-colors">Gerer les campagnes</Link>
            </div>
            {robotSummary.minutesUsage && (
              <div>
                <div className="flex justify-between mb-1 text-[12px]">
                  <span className="text-[#9898b8]">{robotSummary.minutesUsage.minutesUsed.toFixed(0)} / {robotSummary.minutesUsage.minutesIncluded} min</span>
                  <span className="text-[#eeeef8] font-semibold">{robotSummary.minutesUsage.percentUsed}%</span>
                </div>
                <div className="h-2 bg-[#111118] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${robotSummary.minutesUsage.percentUsed > 100 ? 'bg-red-500' : robotSummary.minutesUsage.percentUsed > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, robotSummary.minutesUsage.percentUsed)}%` }} />
                </div>
              </div>
            )}
            {robotSummary.minutesUsage.minutesOverage > 0 && (
              <div className="text-[11px] text-orange-400 mt-2">Surplus: {robotSummary.minutesUsage.minutesOverage.toFixed(1)} min</div>
            )}
          </div>
        </div>
      )}

      {/* Robot credits only */}
      {robotSummary && !robotSummary.activePlan && robotSummary.creditsBalance > 0 && (
        <div className="mb-7">
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-900/50 text-purple-400">Robot</span>
              <span className="text-sm text-[#eeeef8]">{robotSummary.creditsBalance} minutes disponibles</span>
            </div>
            <Link href="/client/robot" className="inline-block text-[11px] font-semibold text-[#7b61ff] px-3 py-1 border border-[#7b61ff]/25 rounded-lg no-underline bg-[#7b61ff]/5">Lancer une campagne</Link>
          </div>
        </div>
      )}

      {/* Robot CTA */}
      {(!robotSummary || (!robotSummary.activePlan && robotSummary.creditsBalance <= 0)) && (
        <div className="mb-7">
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl py-8 px-6 text-center">
            <h3 className="text-base font-bold text-[#eeeef8] mb-2">Automatisez votre prospection</h3>
            <p className="text-[12px] text-[#55557a] mb-4">Robot d&apos;appel masse — TTS, audio MP3, IVR, detection repondeur.</p>
            <Link href="/commander?service=robot" className="inline-flex items-center gap-2 bg-[#7b61ff]/10 border border-[#7b61ff]/30 text-[#7b61ff] rounded-lg px-5 py-2 text-[13px] font-semibold no-underline hover:bg-[#7b61ff]/20 transition-colors">Decouvrir le Robot</Link>
          </div>
        </div>
      )}

      {/* -- Addons -- */}
      {addons && addons.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-[#9898b8] mb-3.5">Modules complementaires</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {addons.map(addon => (
              <div
                key={addon.sku}
                className="bg-[#18181f] border border-[#2e2e44] rounded-xl px-[18px] py-4"
              >
                <div className="text-[13px] font-semibold text-[#9898b8] mb-1.5">{addon.name}</div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#55557a]">Qte: {addon.quantity}</span>
                  <span className="text-[13px] font-semibold text-[#eeeef8]">
                    {formatCAD(addon.total)}
                    <span className="text-[11px] text-[#55557a] font-normal"> /mois</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
