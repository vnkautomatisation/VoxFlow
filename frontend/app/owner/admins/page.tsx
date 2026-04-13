'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

// ══════════════════════════════════════════════════════════════
//  /owner/admins — Gestion des clients (OWNER / OWNER_STAFF)
//
//  Liste les organisations clientes avec recherche, filtres,
//  impersonnation (login as), suspension et reactivation.
// ══════════════════════════════════════════════════════════════

const API_URL = typeof window !== 'undefined'
  ? (localStorage.getItem('vf_url') || 'http://localhost:4000')
  : 'http://localhost:4000'

const getTok = () =>
  typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null

const apiFetch = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(API_URL + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}),
      ...(opts.headers || {}),
    },
  })
  return r.json()
}

interface Org {
  id: string
  name: string
  email: string
  plan: string
  status: string
  user_count: number
  mrr: number
  trial_ends_at: string | null
  created_at: string
  last_activity: string | null
  stripe_customer_id: string | null
}

const STATUS_OPTIONS = [
  { value: 'all',       label: 'Tous' },
  { value: 'ACTIVE',    label: 'Actif' },
  { value: 'SUSPENDED', label: 'Suspendu' },
  { value: 'TRIAL',     label: 'Essai' },
]

const statusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-500/15 text-green-400 border border-green-500/30'
    case 'SUSPENDED':
      return 'bg-red-500/15 text-red-400 border border-red-500/30'
    case 'TRIAL':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
    case 'CANCELLED':
      return 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
    default:
      return 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
  }
}

function relativeTime(date: string | null): string {
  if (!date) return '-'
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1) return 'A l\'instant'
  if (mins < 60) return mins + ' min'
  if (hours < 24) return hours + ' h'
  if (days < 30) return days + ' j'
  return new Date(date).toLocaleDateString('fr-CA')
}

export default function OwnerAdminsPage() {
  const router = useRouter()
  const { user, isAuth } = useAuthStore()

  const [orgs, setOrgs]           = useState<Org[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [mounted, setMounted]     = useState(false)
  const LIMIT = 50

  // Suspend modal
  const [suspendOrg, setSuspendOrg]     = useState<Org | null>(null)
  const [suspending, setSuspending]     = useState(false)

  // Impersonation loading
  const [impersonating, setImpersonating] = useState<string | null>(null)

  // ── Auth guard ─────────────────────────────────────────────
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isAuth || !user) { router.push('/login'); return }
    if (user.role !== 'OWNER' && user.role !== 'OWNER_STAFF') {
      router.push('/login')
    }
  }, [mounted, isAuth, user, router])

  // ── Load data ──────────────────────────────────────────────
  const loadOrgs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        status: statusFilter,
      })
      if (search.trim()) params.set('search', search.trim())
      const res = await apiFetch('/api/v1/owner/admins?' + params.toString())
      setOrgs(res.organizations || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Erreur chargement admins:', err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => {
    if (mounted && isAuth) loadOrgs()
  }, [mounted, isAuth, loadOrgs])

  // Debounce search
  const [searchDebounce, setSearchDebounce] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchDebounce)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchDebounce])

  // ── Impersonate ────────────────────────────────────────────
  const handleImpersonate = async (org: Org) => {
    setImpersonating(org.id)
    try {
      const res = await apiFetch('/api/v1/owner/admins/' + org.id + '/impersonate', {
        method: 'POST',
      })
      if (res.token) {
        const currentToken = getTok()
        localStorage.setItem('vf_impersonate', JSON.stringify({
          originalToken: currentToken,
          impersonatingOrgId: res.org_id,
          impersonatingOrgName: res.org_name,
        }))
        localStorage.setItem('vf_tok', res.token)
        router.push('/admin/dashboard')
      }
    } catch (err) {
      console.error('Erreur impersonation:', err)
    } finally {
      setImpersonating(null)
    }
  }

  // ── Suspend ────────────────────────────────────────────────
  const handleSuspend = async () => {
    if (!suspendOrg) return
    setSuspending(true)
    try {
      await apiFetch('/api/v1/owner/admins/' + suspendOrg.id + '/suspend', {
        method: 'POST',
      })
      setSuspendOrg(null)
      loadOrgs()
    } catch (err) {
      console.error('Erreur suspension:', err)
    } finally {
      setSuspending(false)
    }
  }

  // ── Reactivate ─────────────────────────────────────────────
  const handleReactivate = async (org: Org) => {
    try {
      await apiFetch('/api/v1/owner/admins/' + org.id + '/reactivate', {
        method: 'POST',
      })
      loadOrgs()
    } catch (err) {
      console.error('Erreur reactivation:', err)
    }
  }

  // ── Pagination ─────────────────────────────────────────────
  const totalPages = Math.ceil(total / LIMIT)

  if (!mounted || !user) return null

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/owner/dashboard')}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              &larr; Retour
            </button>
            <h1 className="text-xl font-bold text-white">Gestion des clients</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-gray-400 text-sm">{user.name}</p>
            <span className="text-purple-400 text-xs font-medium">{user.role}</span>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher par nom ou courriel..."
              value={searchDebounce}
              onChange={(e) => setSearchDebounce(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-purple-600 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-600 transition-colors"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="text-gray-500 text-sm whitespace-nowrap">
            {total} organisation{total !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-500 animate-pulse">Chargement...</p>
            </div>
          ) : orgs.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-gray-500">Aucune organisation trouvee</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Organisation</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Plan actif</th>
                  <th className="text-center px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Nb users</th>
                  <th className="text-right px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">MRR CAD$</th>
                  <th className="text-center px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Statut</th>
                  <th className="text-center px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Derniere activite</th>
                  <th className="text-right px-4 py-3 text-gray-400 text-xs font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    {/* Organisation */}
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{org.name}</p>
                      <p className="text-gray-500 text-xs">{org.email}</p>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <span className="text-gray-300 text-sm">{org.plan || '-'}</span>
                    </td>

                    {/* Users count */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-gray-300 text-sm">{org.user_count}</span>
                    </td>

                    {/* MRR */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-white text-sm font-medium">
                        {org.mrr != null ? org.mrr.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $' : '-'}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3 text-center">
                      <span className={'inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusBadge(org.status)}>
                        {org.status}
                      </span>
                    </td>

                    {/* Last activity */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-gray-400 text-sm">{relativeTime(org.last_activity)}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Login as */}
                        <button
                          onClick={() => handleImpersonate(org)}
                          disabled={impersonating === org.id}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
                        >
                          {impersonating === org.id ? '...' : 'Login as'}
                        </button>

                        {/* Suspend (only if not already suspended) */}
                        {org.status !== 'SUSPENDED' && (
                          <button
                            onClick={() => setSuspendOrg(org)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors"
                          >
                            Suspendre
                          </button>
                        )}

                        {/* Reactivate (only if suspended) */}
                        {org.status === 'SUSPENDED' && (
                          <button
                            onClick={() => handleReactivate(org)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 transition-colors"
                          >
                            Reactiver
                          </button>
                        )}

                        {/* Factures placeholder */}
                        <button
                          title="Bientot"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-700/30 text-gray-500 border border-gray-700/50 cursor-not-allowed"
                        >
                          Factures
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pb-6">
            <p className="text-gray-500 text-sm">
              Page {page} sur {totalPages} ({total} resultats)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Precedent
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number
                if (totalPages <= 7) {
                  p = i + 1
                } else if (page <= 4) {
                  p = i + 1
                } else if (page >= totalPages - 3) {
                  p = totalPages - 6 + i
                } else {
                  p = page - 3 + i
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={'px-3 py-1.5 rounded-lg text-sm transition-colors ' + (
                      p === page
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                    )}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suspend confirmation modal */}
      {suspendOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !suspending && setSuspendOrg(null)} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-white font-semibold text-lg mb-2">
              Confirmer la suspension
            </h3>
            <p className="text-gray-400 text-sm mb-1">
              Confirmer la suspension de <span className="text-white font-medium">{suspendOrg.name}</span> ?
            </p>
            <p className="text-gray-500 text-xs mb-6">
              L'organisation et tous ses utilisateurs perdront l'acces a la plateforme.
              Cette action peut etre annulee en reactivant le compte.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSuspendOrg(null)}
                disabled={suspending}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 border border-gray-700 hover:text-white hover:border-gray-600 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSuspend}
                disabled={suspending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {suspending ? 'Suspension...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
