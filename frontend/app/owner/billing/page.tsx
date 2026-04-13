'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

// ══════════════════════════════════════════════════════════════
//  /owner/billing — Facturation & revenus (OWNER / OWNER_STAFF)
// ══════════════════════════════════════════════════════════════

const API_URL = typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
const apiFetch = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(API_URL + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) } })
  return r.json()
}

interface BillingStats {
  mrr: number
  arr: number
  churn_rate: number
  new_clients: number
  volume_this_month: number
  mrr_history: { month: string; mrr: number }[]
  past_due: { id: string; name: string; email: string }[]
  expiring_trials: { id: string; name: string; trial_ends_at: string }[]
  recent_events: { id: string; type: string; description: string; amount: number; created_at: string; org_id: string }[]
}

interface Transaction {
  id: string
  type: string
  description: string
  amount: number
  currency: string
  org_name: string
  org_id: string
  created_at: string
  status: string
}

interface PromoCode {
  id: string
  code: string
  type: string
  value: number
  max_uses: number | null
  current_uses: number
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export default function OwnerBillingPage() {
  const router = useRouter()
  const { user, isAuth } = useAuthStore()

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<BillingStats | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [showPromoModal, setShowPromoModal] = useState(false)

  // Promo form state
  const [promoForm, setPromoForm] = useState({
    code: '',
    type: 'percent' as 'percent' | 'fixed',
    value: '',
    max_uses: '',
    expires_at: '',
  })
  const [promoCreating, setPromoCreating] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isAuth || !user) { router.push('/login'); return }
    if (user.role !== 'OWNER' && user.role !== 'OWNER_STAFF') { router.push('/login'); return }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAuth, user])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, txRes, promoRes] = await Promise.all([
        apiFetch('/api/v1/owner/billing-stats'),
        apiFetch('/api/v1/owner/billing-stats/transactions?limit=50'),
        apiFetch('/api/v1/owner/billing-stats/promo-codes'),
      ])
      if (statsRes && !statsRes.error) setStats(statsRes)
      if (Array.isArray(txRes)) setTransactions(txRes)
      if (Array.isArray(promoRes)) setPromoCodes(promoRes)
    } catch (err) {
      console.error('Erreur chargement billing:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCreatePromo = async () => {
    if (!promoForm.code || !promoForm.value) return
    setPromoCreating(true)
    try {
      await apiFetch('/api/v1/owner/billing-stats/promo-codes', {
        method: 'POST',
        body: JSON.stringify({
          code: promoForm.code.toUpperCase(),
          type: promoForm.type,
          value: parseFloat(promoForm.value),
          max_uses: promoForm.max_uses ? parseInt(promoForm.max_uses) : null,
          expires_at: promoForm.expires_at || null,
        }),
      })
      setShowPromoModal(false)
      setPromoForm({ code: '', type: 'percent', value: '', max_uses: '', expires_at: '' })
      loadAll()
    } catch (err) {
      console.error('Erreur creation promo:', err)
    } finally {
      setPromoCreating(false)
    }
  }

  const handleDeactivatePromo = async (id: string) => {
    try {
      await apiFetch(`/api/v1/owner/billing-stats/promo-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
      })
      loadAll()
    } catch (err) {
      console.error('Erreur desactivation promo:', err)
    }
  }

  const fmtDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const fmtAmount = (n: number) => {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n)
  }

  // Computed metrics
  const successCount = stats?.recent_events?.filter(e => e.type === 'payment_success' || e.type === 'invoice_paid').length ?? 0
  const failedCount = stats?.past_due?.length ?? 0
  const totalPayments = successCount + failedCount
  const successRate = totalPayments > 0 ? Math.round((successCount / totalPayments) * 100) : 100

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white">
              Vox<span className="text-purple-500">Flow</span>
            </h1>
            <span className="text-gray-400 text-sm">Facturation</span>
          </div>
          <button
            onClick={() => router.push('/owner/dashboard')}
            className="border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg text-sm hover:border-gray-500 hover:text-white transition-colors"
          >
            Retour au dashboard
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500 animate-pulse">Chargement...</p>
          </div>
        ) : (
          <>
            {/* ── Metric cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Volume ce mois"
                value={fmtAmount(stats?.volume_this_month ?? 0)}
                sub="CAD"
              />
              <MetricCard
                label="Paiements reussis"
                value={String(successCount)}
                sub="ce mois"
                color="text-green-400"
              />
              <MetricCard
                label="Paiements echoues"
                value={String(failedCount)}
                sub="en souffrance"
                color={failedCount > 0 ? 'text-red-400' : 'text-gray-400'}
              />
              <MetricCard
                label="Taux de succes"
                value={`${successRate}%`}
                sub={`${totalPayments} paiements`}
                color={successRate >= 95 ? 'text-green-400' : successRate >= 80 ? 'text-yellow-400' : 'text-red-400'}
              />
            </div>

            {/* ── Failed payments ── */}
            {stats && stats.past_due.length > 0 && (
              <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-5">
                <h2 className="text-red-400 font-semibold mb-3">Paiements en souffrance</h2>
                <div className="space-y-2">
                  {stats.past_due.map(org => (
                    <div key={org.id} className="flex items-center justify-between bg-red-950/40 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-white text-sm font-medium">{org.name}</p>
                        <p className="text-red-300/70 text-xs">{org.email}</p>
                      </div>
                      <button
                        onClick={() => router.push('/owner/admins')}
                        className="text-red-400 border border-red-800 px-3 py-1 rounded-lg text-xs hover:bg-red-900/40 transition-colors"
                      >
                        Voir client
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Transactions table ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="text-white font-semibold">Transactions</h2>
              </div>
              {transactions.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-gray-500 text-sm">Aucune transaction</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                        <th className="text-left px-5 py-3 font-medium">Date</th>
                        <th className="text-left px-5 py-3 font-medium">Organisation</th>
                        <th className="text-left px-5 py-3 font-medium">Description</th>
                        <th className="text-right px-5 py-3 font-medium">Montant CAD$</th>
                        <th className="text-center px-5 py-3 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-5 py-3 text-gray-400">{fmtDate(tx.created_at)}</td>
                          <td className="px-5 py-3 text-white">{tx.org_name}</td>
                          <td className="px-5 py-3 text-gray-300">{tx.description}</td>
                          <td className="px-5 py-3 text-right text-white font-medium">{fmtAmount(tx.amount)}</td>
                          <td className="px-5 py-3 text-center">
                            <StatusBadge status={tx.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Promo codes ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-white font-semibold">Codes promo</h2>
                <button
                  onClick={() => setShowPromoModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Creer un code promo
                </button>
              </div>
              {promoCodes.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-gray-500 text-sm">Aucun code promo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                        <th className="text-left px-5 py-3 font-medium">Code</th>
                        <th className="text-left px-5 py-3 font-medium">Type</th>
                        <th className="text-right px-5 py-3 font-medium">Valeur</th>
                        <th className="text-center px-5 py-3 font-medium">Utilisations</th>
                        <th className="text-left px-5 py-3 font-medium">Expiration</th>
                        <th className="text-center px-5 py-3 font-medium">Statut</th>
                        <th className="text-center px-5 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {promoCodes.map(promo => (
                        <tr key={promo.id} className="hover:bg-gray-800/50 transition-colors">
                          <td className="px-5 py-3 text-white font-mono font-medium">{promo.code}</td>
                          <td className="px-5 py-3 text-gray-300">
                            {promo.type === 'percent' ? 'Pourcentage' : 'Montant fixe'}
                          </td>
                          <td className="px-5 py-3 text-right text-white">
                            {promo.type === 'percent' ? `${promo.value}%` : `${promo.value}$`}
                          </td>
                          <td className="px-5 py-3 text-center text-gray-400">
                            {promo.current_uses}/{promo.max_uses ?? '---'}
                          </td>
                          <td className="px-5 py-3 text-gray-400">
                            {promo.expires_at ? fmtDate(promo.expires_at) : 'Aucune'}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {promo.is_active ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-400 border border-green-800/50">
                                Actif
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-500 border border-gray-700">
                                Inactif
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {promo.is_active && (
                              <button
                                onClick={() => handleDeactivatePromo(promo.id)}
                                className="text-red-400 border border-red-800/50 px-3 py-1 rounded-lg text-xs hover:bg-red-900/30 transition-colors"
                              >
                                Desactiver
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal: Creer un code promo ── */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6">
            <h3 className="text-white font-semibold text-lg mb-4">Creer un code promo</h3>

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Code</label>
                <input
                  type="text"
                  value={promoForm.code}
                  onChange={e => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="PROMO2026"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-gray-600"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="promo-type"
                      checked={promoForm.type === 'percent'}
                      onChange={() => setPromoForm(f => ({ ...f, type: 'percent' }))}
                      className="accent-purple-500"
                    />
                    <span className="text-gray-300 text-sm">Pourcentage</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="promo-type"
                      checked={promoForm.type === 'fixed'}
                      onChange={() => setPromoForm(f => ({ ...f, type: 'fixed' }))}
                      className="accent-purple-500"
                    />
                    <span className="text-gray-300 text-sm">Montant fixe</span>
                  </label>
                </div>
              </div>

              {/* Valeur */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  Valeur {promoForm.type === 'percent' ? '(%)' : '($)'}
                </label>
                <input
                  type="number"
                  value={promoForm.value}
                  onChange={e => setPromoForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={promoForm.type === 'percent' ? '15' : '50'}
                  min="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-gray-600"
                />
              </div>

              {/* Date expiration */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Date d'expiration</label>
                <input
                  type="date"
                  value={promoForm.expires_at}
                  onChange={e => setPromoForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 [color-scheme:dark]"
                />
              </div>

              {/* Max utilisations */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Nombre max d'utilisations (optionnel)</label>
                <input
                  type="number"
                  value={promoForm.max_uses}
                  onChange={e => setPromoForm(f => ({ ...f, max_uses: e.target.value }))}
                  placeholder="Illimite"
                  min="1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 placeholder:text-gray-600"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPromoModal(false)
                  setPromoForm({ code: '', type: 'percent', value: '', max_uses: '', expires_at: '' })
                }}
                className="border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm hover:border-gray-500 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreatePromo}
                disabled={promoCreating || !promoForm.code || !promoForm.value}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {promoCreating ? 'Creation...' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ── */

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'success' || s === 'paid' || s === 'succeeded') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-400 border border-green-800/50">
        Reussi
      </span>
    )
  }
  if (s === 'failed' || s === 'past_due') {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-900/40 text-red-400 border border-red-800/50">
        Echoue
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-500 border border-gray-700">
      {status === 'cancelled' ? 'Annule' : status}
    </span>
  )
}
