import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest } from "../../middleware/auth"
import { acdService } from "../../services/acd/acd.service"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)

const getOrgId = (req: AuthRequest) => req.user?.organizationId || ""

// ── QUEUES ────────────────────────────────────────────────────

// GET /api/v1/queues -- Toutes les files avec stats temps reel
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await acdService.getQueuesWithStats(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/queues -- Creer file
router.post("/", authorize("ADMIN","OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabaseAdmin
      .from("queues")
      .insert({ ...req.body, organization_id: orgId })
      .select().single()
    if (error) throw new Error(error.message)
    sendSuccess(res, data, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// PATCH /api/v1/queues/:id -- Modifier file
router.patch("/:id", authorize("ADMIN","OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    const id    = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const orgId = getOrgId(req)
    const { data, error } = await supabaseAdmin
      .from("queues")
      .update(req.body)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select().single()
    if (error) throw new Error(error.message)
    sendSuccess(res, data)
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/queues/:id/realtime -- Stats temps reel
router.get("/:id/realtime", async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await acdService.getQueueRealtime(id))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/queues/:id/agents -- Ajouter agent a file
router.post("/:id/agents", authorize("ADMIN","OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    const queueId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const { agentId, skillLevel, priority } = req.body
    const { data, error } = await supabaseAdmin
      .from("queue_agents")
      .upsert({ queue_id: queueId, user_id: agentId, skill_level: skillLevel || 1, priority: priority || 1 })
      .select().single()
    if (error) throw new Error(error.message)
    sendSuccess(res, data, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// DELETE /api/v1/queues/:id/agents/:agentId -- Retirer agent
router.delete("/:id/agents/:agentId", authorize("ADMIN","OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    const queueId  = Array.isArray(req.params.id)      ? req.params.id[0]      : req.params.id
    const agentId  = Array.isArray(req.params.agentId) ? req.params.agentId[0] : req.params.agentId
    await supabaseAdmin.from("queue_agents")
      .delete().eq("queue_id", queueId).eq("user_id", agentId)
    sendSuccess(res, { removed: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── HORAIRES ──────────────────────────────────────────────────

// GET /api/v1/queues/schedules
router.get("/schedules", async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from("schedules")
      .select("*")
      .eq("organization_id", getOrgId(req))
      .order("created_at")
    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/queues/schedules
router.post("/schedules", authorize("ADMIN","OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("schedules")
      .insert({ ...req.body, organization_id: getOrgId(req) })
      .select().single()
    if (error) throw new Error(error.message)
    sendSuccess(res, data, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// PATCH /api/v1/queues/schedules/:id
router.patch("/schedules/:id", authorize("ADMIN","OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const { data, error } = await supabaseAdmin
      .from("schedules")
      .update(req.body)
      .eq("id", id)
      .eq("organization_id", getOrgId(req))
      .select().single()
    if (error) throw new Error(error.message)
    sendSuccess(res, data)
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/queues/hours/status -- Verifier heures ouverture
router.get("/hours/status", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await acdService.isWithinBusinessHours(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

// ── CALLBACKS ─────────────────────────────────────────────────

// GET /api/v1/queues/callbacks
router.get("/callbacks", async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined
    sendSuccess(res, await acdService.getCallbacks(getOrgId(req), status))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/queues/callbacks
router.post("/callbacks", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await acdService.createCallback(getOrgId(req), req.body), 201)
  } catch (err: any) { sendError(res, err.message) }
})

// PATCH /api/v1/queues/callbacks/:id/complete
router.patch("/callbacks/:id/complete", async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await acdService.completeCallback(id, req.user!.userId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── ROUTING RULES ─────────────────────────────────────────────

// GET /api/v1/queues/rules
router.get("/rules", authorize("ADMIN","OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await acdService.getRoutingRules(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/queues/rules
router.post("/rules", authorize("ADMIN","OWNER"), async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await acdService.createRoutingRule(getOrgId(req), req.body), 201)
  } catch (err: any) { sendError(res, err.message) }
})

export default router
