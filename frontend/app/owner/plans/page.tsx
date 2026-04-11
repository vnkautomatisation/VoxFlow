'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { ownerApi } from '@/lib/ownerApi'
import PlanEditorModal from '@/components/owner/PlanEditorModal'

// ══════════════════════════════════════════════════════════════
//  /owner/plans — Gestion des forfaits (OWNER / OWNER_STAFF)
//
//  Permet au OWNER de créer, éditer, supprimer des plan_definitions
//  et de choisir quelles features sont activées pour chaque plan
//  (outbound_calls, messaging, recording, AI, robot_dialer...).
//
//  Les orgs clients héritent automatiquement des features de leur
//  plan au prochain refresh JWT (max 2 min via le poller).
// ══════════════════════════════════════════════════════════════

export interface PlanDef {
  id:                string
  name:              string
  description?:      string | null
  price_monthly:     number
  price_yearly?:     number | null
  currency:          string
  max_agents?:       number | null
  max_dids?:         number | null
  max_calls_month?:  number | null
  features:          Record<string, boolean>
  is_default:        boolean
  is_public:         boolean
  sort_order:        number
  usage?:            number
  created_at:        string
  updated_at:        string
}

export default function OwnerPlansPage() {
  const router = useRouter()
  const { user, isAuth, accessToken } = useAuthStore()

  const [plans, setPlans] = useState<PlanDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<PlanDef | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Guard OWNER/OWNER_STAFF
  useEffect(() => {
    if (!isAuth || !user) { router.push('/login'); return }
    if (user.role !== 'OWNER' && user.role !== 'OWNER_STAFF') {
      router.push('/login')
    }
  }, [isAuth, user, router])

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError('')
    try {
      const res = await ownerApi.getPlans(accessToken)
      if (res.success) setPlans(res.data?.plans || [])
      else setError(res.error || 'Erreur de chargement')
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { load() }, [load])

  const handleSave = async (data: Partial<PlanDef>) => {
    if (!accessToken) return
    try {
      const res = editing
        ? await ownerApi.updatePlan(accessToken, editing.id, data)
        : await ownerApi.createPlan(accessToken, data)
      if (!res.success) {
        throw new Error(res.error || 'Erreur lors de la sauvegarde')
      }
      setEditing(null)
      setCreating(false)
      await load()
    } catch (e: any) {
      throw e
    }
  }

  const handleDelete = async (id: string) => {
    if (!accessToken) return
    try {
      const res = await ownerApi.deletePlan(accessToken, id)
      if (!res.success) {
        setError(res.error || 'Impossible de supprimer')
      } else {
        setDeleteConfirm(null)
        await load()
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau')
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#111118] text-[#eeeef8]">
      {/* Header */}
      <div className="border-b border-[#2e2e44] bg-[#18181f]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#eeeef8] flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#7b61ff]" style={{ boxShadow: '0 0 8px #7b61ff' }} />
              Gestion des forfaits
            </h1>
            <p className="text-[11px] text-[#55557a] mt-1">
              Créez et configurez les forfaits proposés à vos clients. Chaque forfait définit les fonctionnalités activées.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/owner/dashboard')}
              className="bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2 rounded-lg text-xs font-bold hover:text-[#eeeef8] transition-colors"
            >
              ← Retour
            </button>
            <button
              onClick={() => { setCreating(true); setEditing(null) }}
              className="bg-[#7b61ff] hover:bg-[#6145ff] text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouveau forfait
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg px-4 py-3 mb-4 text-xs">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-[#55557a] text-sm">Chargement...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-[#55557a] text-sm">
            Aucun forfait défini.
            <div className="mt-2">
              <button onClick={() => setCreating(true)} className="text-[#7b61ff] hover:text-[#6145ff] text-xs font-bold">
                Créer le premier forfait
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => {
              const enabledFeatures = Object.entries(plan.features || {}).filter(([_, v]) => v).length
              const totalFeatures   = Object.keys(plan.features || {}).length
              return (
                <div
                  key={plan.id}
                  className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 hover:border-[#3a3a55] transition-colors"
                >
                  {/* Header card */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-[#eeeef8] truncate">{plan.name}</h3>
                        {plan.is_default && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#7b61ff]/15 text-[#7b61ff] border border-[#7b61ff]/40 uppercase">
                            Défaut
                          </span>
                        )}
                        {!plan.is_public && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#55557a]/15 text-[#9898b8] border border-[#55557a]/30 uppercase">
                            Privé
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#55557a] font-mono">{plan.id}</div>
                    </div>
                  </div>

                  {/* Prix */}
                  <div className="mb-4">
                    <div className="text-2xl font-bold text-[#eeeef8] font-mono">
                      {(plan.price_monthly / 100).toFixed(0)}
                      <span className="text-sm text-[#55557a] font-normal ml-1">$ / mois</span>
                    </div>
                    {plan.description && (
                      <div className="text-[11px] text-[#9898b8] mt-2 line-clamp-2">{plan.description}</div>
                    )}
                  </div>

                  {/* Limites */}
                  <div className="grid grid-cols-2 gap-2 mb-4 text-[11px]">
                    <div className="bg-[#1f1f2a] rounded-lg px-3 py-2">
                      <div className="text-[9px] text-[#55557a] font-bold uppercase tracking-wider">Agents</div>
                      <div className="text-[#eeeef8] font-mono font-bold">
                        {plan.max_agents ?? '∞'}
                      </div>
                    </div>
                    <div className="bg-[#1f1f2a] rounded-lg px-3 py-2">
                      <div className="text-[9px] text-[#55557a] font-bold uppercase tracking-wider">Numéros</div>
                      <div className="text-[#eeeef8] font-mono font-bold">
                        {plan.max_dids ?? '∞'}
                      </div>
                    </div>
                  </div>

                  {/* Features count + usage */}
                  <div className="flex items-center justify-between text-[11px] mb-4">
                    <span className="text-[#9898b8]">
                      <span className="text-[#7b61ff] font-bold">{enabledFeatures}</span>
                      <span className="text-[#55557a]"> / {totalFeatures} fonctionnalités</span>
                    </span>
                    <span className="text-[#9898b8]">
                      <span className={`font-bold ${plan.usage ? 'text-[#00d4aa]' : 'text-[#55557a]'}`}>
                        {plan.usage || 0}
                      </span>
                      <span className="text-[#55557a]"> org{(plan.usage || 0) > 1 ? 's' : ''}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(plan)}
                      className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#eeeef8] px-3 py-2 rounded-lg text-xs font-bold hover:border-[#7b61ff]/40 transition-colors"
                    >
                      Éditer
                    </button>
                    {deleteConfirm === plan.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(plan.id)}
                          className="bg-rose-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-2 rounded-lg text-xs font-bold"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(plan.id)}
                        disabled={!!plan.usage && plan.usage > 0}
                        className="bg-[#1f1f2a] border border-rose-400/30 text-rose-400 px-3 py-2 rounded-lg text-xs font-bold hover:bg-rose-400/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title={plan.usage ? `${plan.usage} organisation(s) utilisent ce forfait` : 'Supprimer'}
                      >
                        Suppr.
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal éditeur */}
      {(editing || creating) && (
        <PlanEditorModal
          plan={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
