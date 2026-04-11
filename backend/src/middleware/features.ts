import { Response, NextFunction } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { AuthRequest, resolveOrgId } from './auth'

// Cache in-memory des features par org (60s) pour éviter un round-trip
// DB à chaque requête. Invalidé implicitement par la TTL.
const _cache: Map<string, { features: Record<string, boolean>; planId: string; ts: number }> = new Map()
const CACHE_TTL_MS = 60_000

export function invalidateFeaturesCache(orgId?: string) {
  if (orgId) _cache.delete(orgId)
  else _cache.clear()
}

async function getOrgFeatures(orgId: string): Promise<{ features: Record<string, boolean>; planId: string }> {
  const cached = _cache.get(orgId)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { features: cached.features, planId: cached.planId }
  }

  // 1. Récupérer le plan de l'org
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .maybeSingle()

  const planId = String(org?.plan || 'STARTER').toUpperCase()

  // 2. Récupérer les features du plan
  const { data: plan } = await supabaseAdmin
    .from('plan_definitions')
    .select('features')
    .eq('id', planId)
    .maybeSingle()

  const features = (plan?.features && typeof plan.features === 'object') ? plan.features : {}

  _cache.set(orgId, { features, planId, ts: Date.now() })
  return { features, planId }
}

// ══════════════════════════════════════════════════════════════
//  requireFeature(featureName) middleware
//
//  Block la requête avec 403 FEATURE_NOT_IN_PLAN si le forfait de
//  l'org de l'utilisateur n'inclut pas la feature demandée.
//
//  Bypass pour OWNER / OWNER_STAFF (staff VoxFlow).
//
//  Usage :
//  router.post('/call/outbound', authenticate, requireFeature('outbound_calls'), handler)
// ══════════════════════════════════════════════════════════════
export const requireFeature = (feature: string) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    // OWNER/OWNER_STAFF bypass toutes les restrictions de features
    const role = req.user?.role
    if (role === 'OWNER' || role === 'OWNER_STAFF') return next()

    const orgId = resolveOrgId(req)
    if (!orgId) {
      return res.status(403).json({
        success: false,
        error:   'Organisation requise',
        code:    'ORG_REQUIRED',
      })
    }

    try {
      const { features, planId } = await getOrgFeatures(orgId)
      if (!features[feature]) {
        return res.status(403).json({
          success: false,
          error:   `Cette fonctionnalité n'est pas incluse dans votre forfait ${planId}. Passez à un forfait supérieur pour y accéder.`,
          code:    'FEATURE_NOT_IN_PLAN',
          feature,
          plan:    planId,
        })
      }
      next()
    } catch (err: any) {
      // Fail-open en cas d'erreur DB pour ne pas bloquer l'app
      console.warn('[requireFeature] fallback fail-open:', err?.message)
      next()
    }
  }
