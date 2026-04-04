import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest } from "../../middleware/auth"
import { supervisionService } from "../../services/supervision/supervision.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)
router.use(authorize("ADMIN", "OWNER", "SUPERVISOR"))

const getOrgId = (req: AuthRequest) => req.user?.organizationId || ""

// GET /api/v1/supervision/snapshot -- Snapshot temps reel
router.get("/snapshot", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.role === "OWNER"
      ? String(req.query.orgId || getOrgId(req))
      : getOrgId(req)
    sendSuccess(res, await supervisionService.getRealtimeSnapshot(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/supervision/alerts -- Alertes SLA
router.get("/alerts", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await supervisionService.getSLAAlerts(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/supervision/agent/:agentId/status -- Forcer statut
router.post("/agent/:agentId/status", async (req: AuthRequest, res: Response) => {
  try {
    const agentId = Array.isArray(req.params.agentId) ? req.params.agentId[0] : req.params.agentId
    const { status } = req.body
    const valid = ["ONLINE", "OFFLINE", "BREAK", "BUSY"]
    if (!valid.includes(status)) return sendError(res, "Statut invalide", 400)
    sendSuccess(res, await supervisionService.forceAgentStatus(agentId, status))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/supervision/call/:callId/join -- Ecoute/Whisper/Barge
router.post("/call/:callId/join", async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const mode   = req.body.mode || "listen"
    if (!["listen", "whisper", "barge"].includes(mode)) {
      return sendError(res, "Mode invalide", 400)
    }
    sendSuccess(res, await supervisionService.joinCall(callId, req.user!.userId, mode))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/supervision/log -- Historique
router.get("/log", async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || "20"))
    sendSuccess(res, await supervisionService.getSupervisionLog(getOrgId(req), limit))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
