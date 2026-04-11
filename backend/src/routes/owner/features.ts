import { Router, Response } from "express"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

// ══════════════════════════════════════════════════════════════
//  /api/v1/owner/features — feature flags par plan (migration 033)
//
//  Endpoints :
//   GET  /                          → liste des 71 features + etat par plan
//   PUT  /:planId/:feature          → toggle une feature pour un plan
//
//  Auth : OWNER / OWNER_STAFF uniquement (heritage de routes/owner/index.ts).
// ══════════════════════════════════════════════════════════════

const router = Router()

// ── GET / — matrice features x plans ─────────────────────────
// Retourne :
//  - allFeatures : array de 71 clefs triees alphabetiquement
//  - plans       : array des 6 plans { id, name, features: {key: bool} }
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const { data: plans, error } = await supabaseAdmin
      .from("plan_definitions")
      .select("id, name, features, sort_order")
      .order("sort_order", { ascending: true })
    if (error) throw error

    // Collecter toutes les clefs uniques de toutes les features JSONB
    const allKeys = new Set<string>()
    for (const p of (plans || [])) {
      if (p.features && typeof p.features === "object") {
        Object.keys(p.features as Record<string, unknown>).forEach(k => allKeys.add(k))
      }
    }
    const allFeatures = Array.from(allKeys).sort()

    sendSuccess(res, {
      allFeatures,
      count: allFeatures.length,
      plans: plans || [],
    })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── PUT /:planId/:feature — toggle une feature ──────────────
// Body : { enabled: boolean }
router.put("/:planId/:feature", async (req: AuthRequest, res: Response) => {
  try {
    // Cast explicite : req.params est typé string | string[] | ParsedQs
    // selon la version d'express, et le computed property name exige string.
    const planId  = String(req.params.planId)
    const feature = String(req.params.feature)
    const enabled = req.body?.enabled
    if (typeof enabled !== "boolean") {
      return sendError(res, "body.enabled doit etre un booleen", 400)
    }

    // Charger le plan
    const { data: plan, error: readErr } = await supabaseAdmin
      .from("plan_definitions")
      .select("features")
      .eq("id", planId)
      .single()
    if (readErr || !plan) return sendError(res, "Plan introuvable", 404)

    const newFeatures = { ...(plan.features || {}), [feature]: enabled }

    const { data, error } = await supabaseAdmin
      .from("plan_definitions")
      .update({ features: newFeatures })
      .eq("id", planId)
      .select("id, features").single()
    if (error) throw error

    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
