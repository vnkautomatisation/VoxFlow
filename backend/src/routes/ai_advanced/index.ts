import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { aiAdvancedService } from "../../services/ai_advanced/ai_advanced.service"
import { dialerService } from "../../services/dialer/dialer.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)

const getOrgId = (req: AuthRequest) => req.user?.organizationId || ""

// ── IA AVANCEE ─────────────────────────────────────────────────

// POST /api/v1/ai2/score/:callId
router.post("/score/:callId", async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { transcription, duration } = req.body
    sendSuccess(res, await aiAdvancedService.scoreCall(callId, transcription || "", duration || 0))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/ai2/coaching/:agentId
router.post("/coaching/:agentId", async (req: AuthRequest, res: Response) => {
  try {
    const agentId = Array.isArray(req.params.agentId) ? req.params.agentId[0] : req.params.agentId
    const period  = String(req.body.period || "WEEKLY")
    sendSuccess(res, await aiAdvancedService.generateCoachingReport(agentId, getOrgId(req), period))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/ai2/coaching
router.get("/coaching", async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await (await import("../../config/supabase")).supabaseAdmin
      .from("ai_coaching")
      .select("*, agent:users!ai_coaching_agent_id_fkey(id,name)")
      .eq("organization_id", getOrgId(req))
      .order("created_at", { ascending: false })
      .limit(20)
    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/ai2/suggestions
router.post("/suggestions", async (req: AuthRequest, res: Response) => {
  try {
    const { keywords } = req.body
    sendSuccess(res, await aiAdvancedService.getRealtimeSuggestions(keywords || []))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/ai2/stats
router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await aiAdvancedService.getAIStats(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

// ── POWER DIALER ──────────────────────────────────────────────

// GET /api/v1/ai2/campaigns
router.get("/campaigns", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await dialerService.getCampaigns(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/ai2/campaigns
router.post("/campaigns", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await dialerService.createCampaign(getOrgId(req), req.user!.userId, req.body), 201)
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/ai2/campaigns/:id
router.get("/campaigns/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await dialerService.getCampaign(id, getOrgId(req)))
  } catch (err: any) { sendError(res, err.message, 404) }
})

// PATCH /api/v1/ai2/campaigns/:id/status
router.patch("/campaigns/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id     = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const status = String(req.body.status || "PAUSED")
    sendSuccess(res, await dialerService.updateCampaignStatus(id, getOrgId(req), status))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/ai2/campaigns/:id/contacts
router.post("/campaigns/:id/contacts", async (req: AuthRequest, res: Response) => {
  try {
    const id       = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const contacts = req.body.contacts || []
    sendSuccess(res, await dialerService.addContacts(id, contacts), 201)
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/ai2/campaigns/:id/stats
router.get("/campaigns/:id/stats", async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await dialerService.getCampaignStats(id))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/ai2/campaigns/:id/next
router.get("/campaigns/:id/next", async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await dialerService.getNextContact(id))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
