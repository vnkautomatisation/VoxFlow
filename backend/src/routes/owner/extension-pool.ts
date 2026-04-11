import { Router, Response } from "express"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

// ══════════════════════════════════════════════════════════════
//  /api/v1/owner/extension-pool — pool global (migration 029)
//
//  Endpoints :
//   GET    /                    → voir tout le pool (liste 201..999)
//   POST   /allocate            → { organization_id } → alloue le prochain libre
//   POST   /release             → { extension_number } → remet FREE
//
//  Auth : OWNER / OWNER_STAFF uniquement.
// ══════════════════════════════════════════════════════════════

const router = Router()

// ── GET / ────────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status ? String(req.query.status) : null
    let query = supabaseAdmin
      .from("extension_pools")
      .select("id, extension_number, organization_id, allocated_to_ext_id, status, reserved_at, reserved_until, allocated_at, released_at")
      .order("extension_number", { ascending: true })
    if (status) query = query.eq("status", status)

    const { data, error } = await query
    if (error) throw error

    // Stats rapides
    const counts = (data || []).reduce((acc: Record<string, number>, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1
      return acc
    }, {})

    sendSuccess(res, { slots: data || [], counts })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST /allocate ───────────────────────────────────────────
router.post("/allocate", async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.body?.organization_id
    if (!organizationId) return sendError(res, "organization_id requis", 400)

    const { data, error } = await supabaseAdmin
      .rpc("allocate_next_extension", { p_org_id: organizationId })
    if (error) return sendError(res, `Allocation impossible : ${error.message}`, 500)

    sendSuccess(res, { extension_number: data, organization_id: organizationId })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST /release ────────────────────────────────────────────
router.post("/release", async (req: AuthRequest, res: Response) => {
  try {
    const extNumber = req.body?.extension_number
    if (!extNumber) return sendError(res, "extension_number requis", 400)

    const { error } = await supabaseAdmin
      .rpc("release_extension", { p_ext_number: String(extNumber) })
    if (error) throw error

    sendSuccess(res, { released: true, extension_number: extNumber })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
