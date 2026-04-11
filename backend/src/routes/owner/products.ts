import { Router, Response } from "express"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

// ══════════════════════════════════════════════════════════════
//  /api/v1/owner/products — CRUD du catalogue (migration 030)
//
//  Endpoints :
//   GET    /          → liste complete (inclut inactifs, contrairement au /catalog client)
//   GET    /:id       → detail
//   POST   /          → creer un produit
//   PATCH  /:id       → update
//   DELETE /:id       → soft delete (is_active=false)
//
//  Auth : OWNER / OWNER_STAFF uniquement.
// ══════════════════════════════════════════════════════════════

const router = Router()

// ── GET / ────────────────────────────────────────────────────
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true })
    if (error) throw error
    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── GET /:id ─────────────────────────────────────────────────
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", req.params.id)
      .single()
    if (error || !data) return sendError(res, "Produit introuvable", 404)
    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST / ───────────────────────────────────────────────────
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      sku, category, name, description, country, region, number_type,
      capabilities, price_monthly, setup_fee, available_qty, stripe_price_id,
      is_active, sort_order,
    } = req.body as Record<string, unknown>

    if (!sku)      return sendError(res, "sku requis",      400)
    if (!category) return sendError(res, "category requis", 400)
    if (!name)     return sendError(res, "name requis",     400)

    const { data, error } = await supabaseAdmin
      .from("products")
      .insert({
        sku:             String(sku),
        category:        String(category),
        name:            String(name),
        description:     description    || null,
        country:         country        || null,
        region:          region         || null,
        number_type:     number_type    || null,
        capabilities:    capabilities   || {},
        price_monthly:   Number(price_monthly) || 0,
        setup_fee:       Number(setup_fee)     || 0,
        available_qty:   available_qty ?? null,
        stripe_price_id: stripe_price_id || null,
        is_active:       is_active       !== false,
        sort_order:      Number(sort_order) || 0,
      })
      .select().single()
    if (error) throw error
    sendSuccess(res, data, 201)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── PATCH /:id ───────────────────────────────────────────────
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const updates: Record<string, unknown> = {}
    const fields = [
      "sku", "category", "name", "description", "country", "region",
      "number_type", "capabilities", "price_monthly", "setup_fee",
      "available_qty", "stripe_price_id", "is_active", "sort_order",
    ]
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })
    if (Object.keys(updates).length === 0) {
      return sendError(res, "Aucun champ a mettre a jour", 400)
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .update(updates)
      .eq("id", req.params.id)
      .select().single()
    if (error) throw error
    if (!data) return sendError(res, "Produit introuvable", 404)
    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── DELETE /:id — soft delete ────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .update({ is_active: false })
      .eq("id", req.params.id)
      .select().single()
    if (error) throw error
    if (!data) return sendError(res, "Produit introuvable", 404)
    sendSuccess(res, { deleted: true, id: data.id })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
