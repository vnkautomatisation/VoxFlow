import { Router, Response } from "express"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

// ══════════════════════════════════════════════════════════════
//  /api/v1/client/extensions — per-extension plans (migration 028)
//
//  Endpoints :
//   GET    /              → liste des extensions de l'org
//   POST   /              → cree une extension (avec plan_id optionnel)
//   PATCH  /:id           → update (plan_id, status, cost_per_month, label)
//   DELETE /:id           → supprime (release via pool si applicable)
//
//  Toutes les routes sont scopees a l'org de l'user authentifie.
// ══════════════════════════════════════════════════════════════

const router = Router()

function getOrgId(req: AuthRequest): string {
  const orgId = req.user?.organizationId
  if (!orgId) throw new Error("Organisation introuvable")
  return String(orgId)
}

// ── GET / — lister les extensions de l'org ──────────────────
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabaseAdmin
      .from("extensions")
      .select("id, extension_number, label, plan_id, status, capabilities, cost_per_month, did_number, user_id, created_at, updated_at")
      .eq("organization_id", orgId)
      .order("extension_number", { ascending: true })
    if (error) throw error
    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST / — creer une extension ────────────────────────────
// Body : { extension_number?, label, plan_id?, user_id?, did_number?, cost_per_month? }
// Si extension_number absent, allocate_next_extension() est appele
// (migration 029) pour prendre le prochain slot libre du pool global.
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const {
      extension_number,
      label,
      plan_id,
      user_id,
      did_number,
      cost_per_month,
      capabilities,
    } = req.body as {
      extension_number?: string
      label?: string
      plan_id?: string
      user_id?: string
      did_number?: string
      cost_per_month?: number
      capabilities?: Record<string, unknown>
    }

    if (!label) return sendError(res, "Le label est requis", 400)

    // Allocation automatique depuis le pool si pas de numero fourni
    let effectiveExt = extension_number
    if (!effectiveExt) {
      const { data: allocated, error: allocErr } = await supabaseAdmin
        .rpc("allocate_next_extension", { p_org_id: orgId })
      if (allocErr) return sendError(res, `Pool epuise : ${allocErr.message}`, 500)
      effectiveExt = String(allocated)
    }

    const { data, error } = await supabaseAdmin
      .from("extensions")
      .insert({
        organization_id: orgId,
        extension_number: effectiveExt,
        label,
        plan_id:        plan_id        || null,
        user_id:        user_id        || null,
        did_number:     did_number     || null,
        cost_per_month: cost_per_month ?? 0,
        capabilities:   capabilities   || {},
        status:         "ACTIVE",
      })
      .select().single()
    if (error) {
      // Si l'insert echoue, relacher le slot du pool
      if (!extension_number && effectiveExt) {
        await supabaseAdmin.rpc("release_extension", { p_ext_number: effectiveExt })
      }
      throw error
    }

    // Lier le slot du pool a l'extension reelle (migration 029)
    if (effectiveExt) {
      await supabaseAdmin
        .from("extension_pools")
        .update({
          status: "ALLOCATED",
          allocated_to_ext_id: data.id,
          allocated_at: new Date().toISOString(),
        })
        .eq("extension_number", effectiveExt)
    }

    sendSuccess(res, data, 201)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── PATCH /:id — update une extension ───────────────────────
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const updates: Record<string, unknown> = {}
    const fields = ["label", "plan_id", "user_id", "did_number", "cost_per_month", "capabilities", "status"]
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })

    if (Object.keys(updates).length === 0) {
      return sendError(res, "Aucun champ a mettre a jour", 400)
    }

    const { data, error } = await supabaseAdmin
      .from("extensions")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select().single()
    if (error) throw error
    if (!data) return sendError(res, "Extension introuvable", 404)

    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── DELETE /:id — supprimer (release dans le pool) ──────────
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)

    // Recuperer le numero AVANT de supprimer (pour le release)
    const { data: ext } = await supabaseAdmin
      .from("extensions")
      .select("extension_number")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single()
    if (!ext) return sendError(res, "Extension introuvable", 404)

    const { error } = await supabaseAdmin
      .from("extensions")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId)
    if (error) throw error

    // Release dans le pool (migration 029)
    if (ext.extension_number) {
      await supabaseAdmin.rpc("release_extension", {
        p_ext_number: ext.extension_number,
      })
    }

    sendSuccess(res, { deleted: true })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
