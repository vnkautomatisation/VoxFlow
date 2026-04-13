import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

// Cache: orgId:moduleType -> { active: boolean, ts: number }
const cache = new Map<string, { active: boolean; ts: number }>()
const CACHE_TTL = 30_000

export function requireModule(moduleType: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (role === 'OWNER' || role === 'OWNER_STAFF') return next()

    const orgId = req.user?.organizationId
    if (!orgId) return res.status(403).json({ success: false, error: 'Module non active', moduleType, upgradeUrl: '/client/plans' })

    const cacheKey = `${orgId}:${moduleType}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (cached.active) return next()
      return res.status(403).json({ success: false, error: 'Module non active', moduleType, upgradeUrl: '/client/plans' })
    }

    try {
      const { data } = await supabase
        .from('org_addons')
        .select('id')
        .eq('organization_id', orgId)
        .eq('module_type', moduleType)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle()

      const active = !!data
      cache.set(cacheKey, { active, ts: Date.now() })

      if (active) return next()
      return res.status(403).json({ success: false, error: 'Module non active', moduleType, upgradeUrl: '/client/plans' })
    } catch {
      // fail-open
      return next()
    }
  }
}

export function invalidateModuleCache(orgId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(orgId + ':')) cache.delete(key)
  }
}
