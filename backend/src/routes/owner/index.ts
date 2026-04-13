import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest } from "../../middleware/auth"
import { ownerService } from "../../services/owner/owner.service"
import { sendSuccess, sendError } from "../../utils/response"
import { createClient } from "@supabase/supabase-js"

const supabaseOwner = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
import plansRouter         from "./plans"
import featuresRouter      from "./features"
import extensionPoolRouter from "./extension-pool"
import productsRouter      from "./products"
import twilioConfigRouter  from "./twilio-config"
import adminsRouter        from "./admins"
import billingStatsRouter  from "./billing-stats"

const router = Router()
router.use(authenticate)
router.use(authorize("OWNER", "OWNER_STAFF" as any))

// Sous-routeurs montés avant les catch-all — Phase B (migrations 028-033)
router.use("/plans",           plansRouter)
router.use("/features",        featuresRouter)
router.use("/extension-pool",  extensionPoolRouter)
router.use("/products",        productsRouter)
router.use("/twilio-config",   twilioConfigRouter)
router.use("/admins",          adminsRouter)
router.use("/billing-stats",   billingStatsRouter)

router.get("/stats", async (req: AuthRequest, res: Response) => {
  try { sendSuccess(res, await ownerService.getGlobalStats()) }
  catch (err: any) { sendError(res, err.message) }
})

router.get("/organizations", async (req: AuthRequest, res: Response) => {
  try {
    const page  = parseInt(String(req.query.page  || "1"))
    const limit = parseInt(String(req.query.limit || "20"))
    sendSuccess(res, await ownerService.getAllOrganizations(page, limit))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/organizations", async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, plan, orgName } = req.body
    if (!name || !email || !password || !plan || !orgName)
      return sendError(res, "Tous les champs sont requis", 400)
    sendSuccess(res, await ownerService.createAdmin({ name, email, password, plan, orgName }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/organizations/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const orgId  = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const status = String(req.body.status || "")
    if (!["ACTIVE", "SUSPENDED", "CANCELLED", "TRIAL"].includes(status))
      return sendError(res, "Statut invalide", 400)
    sendSuccess(res, await ownerService.updateOrgStatus(orgId, status as any))
  } catch (err: any) { sendError(res, err.message) }
})

// PATCH /owner/organizations/:id/plan — change le forfait d'une org
// L'id du plan doit exister dans plan_definitions (sinon 400)
router.patch("/organizations/:id/plan", async (req: AuthRequest, res: Response) => {
  try {
    const orgId  = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const planId = String(req.body.plan || "").toUpperCase()
    if (!planId) return sendError(res, "Plan ID requis", 400)
    sendSuccess(res, await ownerService.updateOrgPlan(orgId, planId))
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.get("/numbers/search", async (req: AuthRequest, res: Response) => {
  try {
    const country  = String(req.query.country  || "CA")
    const areaCode = req.query.areaCode ? String(req.query.areaCode) : undefined
    sendSuccess(res, { numbers: await ownerService.searchAvailableNumbers(country, areaCode) })
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/numbers/assign", async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber, organizationId } = req.body
    if (!phoneNumber || !organizationId)
      return sendError(res, "Numero et organisation requis", 400)
    sendSuccess(res, await ownerService.assignNumber(phoneNumber, organizationId), 201)
  } catch (err: any) { sendError(res, err.message) }
})

router.get("/revenue", async (req: AuthRequest, res: Response) => {
  try { sendSuccess(res, await ownerService.getRevenueDetails()) }
  catch (err: any) { sendError(res, err.message) }
})

// ── DID Identities management ────────────────────────────
router.get("/did/identities", async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined
    let query = supabaseOwner.from("did_identities")
      .select("*, org:organization_id(name)")
      .order("created_at", { ascending: false })
    if (status) query = query.eq("status", status)
    const { data } = await query
    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

router.put("/did/identities/:id/approve", async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    await supabaseOwner.from("did_identities").update({
      status: "approved", reviewed_by: req.user?.userId, reviewed_at: new Date().toISOString(),
    }).eq("id", id)
    sendSuccess(res, { success: true })
  } catch (err: any) { sendError(res, err.message) }
})

router.put("/did/identities/:id/reject", async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const { rejectionReason } = req.body
    await supabaseOwner.from("did_identities").update({
      status: "rejected", rejection_reason: rejectionReason || "", reviewed_by: req.user?.userId, reviewed_at: new Date().toISOString(),
    }).eq("id", id)
    sendSuccess(res, { success: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── Porting management ───────────────────────────────────
router.get("/porting", async (_req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseOwner.from("did_porting_requests")
      .select("*, org:organization_id(name)")
      .in("status", ["submitted", "in_progress"])
      .order("created_at", { ascending: false })
    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

router.put("/porting/:id/update", async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id)
    const { status, rejectionReason, estimatedCompletionDate } = req.body
    const updates: any = { status }
    if (rejectionReason) updates.rejection_reason = rejectionReason
    if (estimatedCompletionDate) updates.estimated_completion_date = estimatedCompletionDate
    if (status === "completed") updates.completed_at = new Date().toISOString()
    await supabaseOwner.from("did_porting_requests").update(updates).eq("id", id)
    sendSuccess(res, { success: true })
  } catch (err: any) { sendError(res, err.message) }
})

export default router
