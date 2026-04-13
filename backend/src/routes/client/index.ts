import { Router, Request, Response } from "express"
import { createClient } from "@supabase/supabase-js"
import { authenticate } from "../../middleware/auth"
import extensionsRouter from "./extensions"
import numbersRouter    from "./numbers"
import robotRouter      from "./robot"
import twilioConfigRouter from "./twilio-config"
import portalRouter     from "./portal"

// ══════════════════════════════════════════════════════════════
//  VoxFlow -- /api/v1/client/*
//  Routes Phase B pour le portail client (org-scoped).
//
//  /portal/plans-catalog est public (pas d'auth).
//  Tous les autres sub-routers heritent du middleware authenticate.
// ══════════════════════════════════════════════════════════════

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ── Route publique: catalogue des plans (pas d'auth) ──
router.get("/portal/plans-catalog", async (_req: Request, res: Response) => {
  try {
    const { data: plans } = await supabase
      .from('plan_definitions')
      .select('*')
      .eq('is_public', true)
      .order('sort_order')

    const { data: addonsRaw } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    // Only keep ADDON_* skus (filter out old MODULE-* products)
    const addons = (addonsRaw || []).filter((a: any) => a.sku?.startsWith('ADDON_'))

    const grouped: Record<string, any[]> = {}
    for (const p of plans || []) {
      const st = p.service_type || 'TELEPHONY'
      if (!grouped[st]) grouped[st] = []
      grouped[st].push({
        id: p.id, name: p.name, description: p.description,
        price_monthly: p.price_monthly, price_yearly: p.price_yearly,
        currency: p.currency || 'CAD', max_agents: p.max_agents,
        max_dids: p.max_dids, features: p.features || {},
        features_list: p.features_list || [],
        service_type: st, sort_order: p.sort_order,
        highlight: p.highlight || false,
      })
    }

    res.json({
      success: true,
      data: {
        services: grouped,
        addons: (addons || []).map((a: any) => {
          const [desc, unit] = (a.description || '|per_unit').split('|')
          return {
            sku: a.sku, name: a.name, description: desc.trim(),
            price_monthly: a.price_monthly,
            price_yearly: (a.price_monthly || 0) * 10,
            billing_unit: unit?.trim() || 'per_unit',
          }
        }),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Auth requise pour tout le reste ──
router.use(authenticate)

router.use("/portal",        portalRouter)
router.use("/extensions",    extensionsRouter)
router.use("/numbers",       numbersRouter)
router.use("/robot",         robotRouter)
router.use("/twilio-config", twilioConfigRouter)

export default router
