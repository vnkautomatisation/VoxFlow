import { Router, Response } from "express"
import { z } from "zod"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"
import { invalidatePlanCache } from "../../services/auth/auth.service"

const router = Router()

// ══════════════════════════════════════════════════════════════
//  Zod schemas
// ══════════════════════════════════════════════════════════════

// Schéma souple : on accepte n'importe quelle clé string → bool
// pour être extensible sans redéployer.
const featuresSchema = z.record(z.string(), z.boolean()).default({})

const createPlanSchema = z.object({
  id:              z.string().min(2).max(32).regex(/^[A-Z0-9_]+$/, 'ID doit être en MAJUSCULES (A-Z, 0-9, _)'),
  name:            z.string().min(2).max(64),
  description:     z.string().max(500).optional().nullable(),
  price_monthly:   z.number().int().min(0),
  price_yearly:    z.number().int().min(0).optional().nullable(),
  currency:        z.string().length(3).default('CAD'),
  max_agents:      z.number().int().min(0).nullable().optional(),
  max_dids:        z.number().int().min(0).nullable().optional(),
  max_calls_month: z.number().int().min(0).nullable().optional(),
  features:        featuresSchema,
  is_default:      z.boolean().default(false),
  is_public:       z.boolean().default(true),
  sort_order:      z.number().int().default(0),
  stripe_price_id: z.string().optional().nullable(),
})

const updatePlanSchema = createPlanSchema.partial().omit({ id: true })

// ══════════════════════════════════════════════════════════════
//  GET /owner/plans — liste tous les forfaits
// ══════════════════════════════════════════════════════════════
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('plan_definitions')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw new Error(error.message)

    // Compter les orgs qui utilisent chaque plan
    const { data: orgCounts } = await supabaseAdmin
      .from('organizations')
      .select('plan')
    const usage: Record<string, number> = {}
    ;(orgCounts || []).forEach((o: any) => {
      const p = String(o.plan || '').toUpperCase()
      usage[p] = (usage[p] || 0) + 1
    })

    const plans = (data || []).map((p: any) => ({
      ...p,
      usage: usage[p.id] || 0,
    }))
    sendSuccess(res, { plans })
  } catch (err: any) {
    sendError(res, err.message, 500)
  }
})

// ══════════════════════════════════════════════════════════════
//  GET /owner/plans/:id — détail d'un forfait
// ══════════════════════════════════════════════════════════════
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id).toUpperCase()
    const { data, error } = await supabaseAdmin
      .from('plan_definitions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return sendError(res, "Forfait introuvable", 404)

    const { count: usage } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true })
      .eq('plan', id)

    sendSuccess(res, { ...data, usage: usage || 0 })
  } catch (err: any) {
    sendError(res, err.message, 500)
  }
})

// ══════════════════════════════════════════════════════════════
//  POST /owner/plans — créer un forfait custom
// ══════════════════════════════════════════════════════════════
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createPlanSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error:   'Données invalides',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const dto = parsed.data

    // Vérifier que l'ID n'est pas déjà pris
    const { data: existing } = await supabaseAdmin
      .from('plan_definitions')
      .select('id')
      .eq('id', dto.id)
      .maybeSingle()
    if (existing) return sendError(res, `Un forfait avec l'ID "${dto.id}" existe déjà`, 409)

    // Si is_default, désactiver l'ancien default
    if (dto.is_default) {
      await supabaseAdmin
        .from('plan_definitions')
        .update({ is_default: false })
        .eq('is_default', true)
    }

    const { data, error } = await supabaseAdmin
      .from('plan_definitions')
      .insert({
        ...dto,
        created_by: req.user!.userId,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Invalider le cache des plans
    invalidatePlanCache()

    sendSuccess(res, data, 201, "Forfait créé")
  } catch (err: any) {
    sendError(res, err.message, 400)
  }
})

// ══════════════════════════════════════════════════════════════
//  PATCH /owner/plans/:id — mettre à jour un forfait
// ══════════════════════════════════════════════════════════════
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id).toUpperCase()
    const parsed = updatePlanSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error:   'Données invalides',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    // Vérifier que le plan existe
    const { data: existing } = await supabaseAdmin
      .from('plan_definitions')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return sendError(res, "Forfait introuvable", 404)

    // Si is_default, désactiver l'ancien default
    if (parsed.data.is_default) {
      await supabaseAdmin
        .from('plan_definitions')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', id)
    }

    const { data, error } = await supabaseAdmin
      .from('plan_definitions')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Invalider le cache
    invalidatePlanCache(id)

    sendSuccess(res, data, 200, "Forfait mis à jour")
  } catch (err: any) {
    sendError(res, err.message, 400)
  }
})

// ══════════════════════════════════════════════════════════════
//  DELETE /owner/plans/:id — supprimer (refuse si des orgs l'utilisent)
// ══════════════════════════════════════════════════════════════
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id).toUpperCase()

    // Protection : refuser si au moins une org utilise ce plan
    const { count } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true })
      .eq('plan', id)

    if (count && count > 0) {
      return res.status(409).json({
        success: false,
        error:   `Impossible de supprimer ce forfait : ${count} organisation(s) l'utilise(nt) encore`,
        usage:   count,
      })
    }

    const { error } = await supabaseAdmin
      .from('plan_definitions')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)

    invalidatePlanCache(id)

    sendSuccess(res, null, 200, "Forfait supprimé")
  } catch (err: any) {
    sendError(res, err.message, 400)
  }
})

// ══════════════════════════════════════════════════════════════
//  GET /owner/plans/:id/usage — nombre d'orgs utilisant ce plan
// ══════════════════════════════════════════════════════════════
router.get("/:id/usage", async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id).toUpperCase()
    const { count } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true })
      .eq('plan', id)
    sendSuccess(res, { planId: id, count: count || 0 })
  } catch (err: any) {
    sendError(res, err.message, 500)
  }
})

export default router
