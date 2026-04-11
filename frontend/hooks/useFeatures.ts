'use client'
import { useAuthStore } from '@/store/authStore'

/**
 * useFeatures() — hook d'accès aux features du forfait courant.
 *
 * Lit d'abord depuis le store Zustand (user.features) puis fallback
 * sur localStorage (vf_features) pour les contextes Electron où le
 * store n'est pas hydraté.
 *
 * Retourne :
 * - has(feature) : true si la feature est activée
 * - all          : l'objet complet { feature: boolean }
 * - planId       : 'STARTER' | 'CONFORT' | ...
 * - planName     : "Starter" | "Confort" | ...
 * - trial        : { days_left, expired, ends_at } | null
 * - isTrialExpired : true si trial.expired
 * - isLoading    : true si les données ne sont pas encore chargées
 *
 * Fallback permissif si les features sont vides (dev/bug) — on
 * affiche tout pour ne pas casser le flow.
 */
export function useFeatures() {
  const { user } = useAuthStore()

  // Lire depuis le store OU localStorage (pour Electron/dialer)
  let features: Record<string, boolean> = user?.features || {}
  let trial = user?.trial || null
  let planId = user?.planId
  let planName = user?.planName

  if (typeof window !== 'undefined' && (!features || Object.keys(features).length === 0)) {
    try {
      const fromLS = localStorage.getItem('vf_features')
      if (fromLS) features = JSON.parse(fromLS)
    } catch {}
    try {
      const trialLS = localStorage.getItem('vf_trial')
      if (trialLS && !trial) trial = JSON.parse(trialLS)
    } catch {}
    if (!planId) planId = localStorage.getItem('vf_plan_id') || undefined
    if (!planName) planName = localStorage.getItem('vf_plan_name') || undefined
  }

  const hasFeatures = features && Object.keys(features).length > 0

  const has = (feature: string): boolean => {
    // Fallback permissif : si features est vide, on autorise tout
    // (pour ne pas casser les users existants sans la migration 027)
    if (!hasFeatures) return true
    return !!features[feature]
  }

  return {
    has,
    all: features,
    planId,
    planName,
    trial,
    isTrialExpired: !!(trial && (trial as any).expired),
    trialDaysLeft:  trial ? (trial as any).days_left : null,
    isLoading: !user && typeof window !== 'undefined' && !hasFeatures,
  }
}
