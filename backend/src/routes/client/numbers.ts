import { Router, Response } from "express"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

// ══════════════════════════════════════════════════════════════
//  /api/v1/client/numbers — catalog + number wizard (migration 030)
//
//  Endpoints :
//   GET  /catalog         → liste des produits achetables (public avec auth)
//   GET  /                → numeros actifs de l'org
//   POST /buy             → enregistre l'achat d'un numero via un SKU
//   DELETE /:id           → release un numero (passage en PENDING_RELEASE)
//
//  NB : l'achat reel cote Twilio passe par /api/v1/telephony/numbers/purchase
//  qui existe deja (routes/telephony/index.ts:454). Ici on ne fait que la
//  synchro DB (link product → phone_numbers row) une fois Twilio a confirme.
// ══════════════════════════════════════════════════════════════

const router = Router()

function getOrgId(req: AuthRequest): string {
  const orgId = req.user?.organizationId
  if (!orgId) throw new Error("Organisation introuvable")
  return String(orgId)
}

// ── GET /catalog ─────────────────────────────────────────────
// Liste des produits actifs dans le product_catalog. Visible par
// tous les users authentifies (pour afficher le wizard d'achat).
router.get("/catalog", async (req: AuthRequest, res: Response) => {
  try {
    const { category, country } = req.query as { category?: string; country?: string }

    let query = supabaseAdmin
      .from("products")
      .select("id, sku, category, name, description, country, region, number_type, capabilities, price_monthly, setup_fee, stripe_price_id, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (category) query = query.eq("category", category)
    if (country)  query = query.eq("country",  country)

    const { data, error } = await query
    if (error) throw error
    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── GET / — lister les numeros de l'org ─────────────────────
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, number, friendly_name, country, region, capabilities, price_monthly, status, extension_id, product_sku, purchased_at, created_at")
      .eq("organization_id", orgId)
      .neq("status", "RELEASED")
      .order("created_at", { ascending: false })
    if (error) throw error
    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST /buy — enregistre un achat ─────────────────────────
// Body : { product_sku, number, twilio_sid?, friendly_name?, extension_id? }
// Doit etre appele APRES que telephony/numbers/purchase ait confirme
// l'achat cote Twilio. Cree la row phone_numbers associee au SKU.
router.post("/buy", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { product_sku, number, twilio_sid, friendly_name, extension_id } = req.body as {
      product_sku?:   string
      number?:        string
      twilio_sid?:    string
      friendly_name?: string
      extension_id?:  string
    }

    if (!product_sku) return sendError(res, "product_sku requis", 400)
    if (!number)      return sendError(res, "number requis",      400)

    // Charger le produit pour recuperer le prix, le pays, les capabilities
    const { data: product, error: pErr } = await supabaseAdmin
      .from("products")
      .select("sku, country, region, capabilities, price_monthly, is_active")
      .eq("sku", product_sku)
      .single()
    if (pErr || !product) return sendError(res, "Produit introuvable", 404)
    if (!product.is_active) return sendError(res, "Produit desactive", 400)

    const { data, error } = await supabaseAdmin
      .from("phone_numbers")
      .insert({
        number,
        twilio_sid:     twilio_sid  || null,
        organization_id: orgId,
        product_sku:    product_sku,
        country:        product.country,
        region:         product.region,
        capabilities:   product.capabilities || { voice: true },
        price_monthly:  product.price_monthly,
        status:         "ACTIVE",
        friendly_name:  friendly_name || number,
        extension_id:   extension_id  || null,
        purchased_at:   new Date().toISOString(),
      })
      .select().single()
    if (error) throw error

    sendSuccess(res, data, 201)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── DELETE /:id — release un numero ─────────────────────────
// Marque le numero comme PENDING_RELEASE ; un job backend doit
// ensuite appeler Twilio pour relacher le DID et mettre status=RELEASED.
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)

    const { data, error } = await supabaseAdmin
      .from("phone_numbers")
      .update({
        status:       "PENDING_RELEASE",
        released_at:  new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", orgId)
      .select().single()
    if (error) throw error
    if (!data) return sendError(res, "Numero introuvable", 404)

    sendSuccess(res, { released: true, number: data.number })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
