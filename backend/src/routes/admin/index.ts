import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest } from "../../middleware/auth"
import { adminService } from "../../services/admin/admin.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)
router.use(authorize("ADMIN", "OWNER", "SUPERVISOR"))

const getOrgId = (req: AuthRequest): string => {
  return String(req.user?.organizationId || req.query.orgId || "")
}

// Stats
router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await adminService.getDashboardStats(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── AGENTS ────────────────────────────────────────────────────
router.get("/agents", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await adminService.getAgents(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/agents", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    const { name, email, password, role } = req.body
    if (!name || !email || !password) return sendError(res, "Nom, email et mot de passe requis", 400)
    sendSuccess(res, await adminService.createAgent(orgId, { name, email, password, role }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/agents/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateAgent(agentId, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/agents/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteAgent(agentId, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── QUEUES ────────────────────────────────────────────────────
router.get("/queues", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await adminService.getQueues(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/queues", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, description, strategy, maxWaitTime, welcomeMessage } = req.body
    if (!name) return sendError(res, "Nom de file requis", 400)
    sendSuccess(res, await adminService.createQueue(orgId, { name, description, strategy, maxWaitTime, welcomeMessage }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/queues/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const queueId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateQueue(queueId, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/queues/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const queueId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteQueue(queueId, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── IVR ───────────────────────────────────────────────────────
router.get("/ivr", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await adminService.getIVRConfigs(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/ivr", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, welcomeMessage, nodes } = req.body
    if (!name) return sendError(res, "Nom IVR requis", 400)
    sendSuccess(res, await adminService.createIVR(orgId, { name, welcomeMessage, nodes }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/ivr/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const ivrId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateIVR(ivrId, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/ivr/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const ivrId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteIVR(ivrId, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── AUDIO / MUSIQUE D ATTENTE ─────────────────────────────────
router.get("/audio", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await adminService.getAudioFiles(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/audio", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, url, type, duration } = req.body
    if (!name || !url) return sendError(res, "Nom et URL requis", 400)
    sendSuccess(res, await adminService.createAudioFile(orgId, { name, url, type, duration }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/audio/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateAudioFile(id, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/audio/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteAudioFile(id, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── SCRIPTS ───────────────────────────────────────────────────
router.get("/scripts", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await adminService.getScripts(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/scripts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateScript(id, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/scripts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteScript(id, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/scripts", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, content, queueId } = req.body
    if (!name || !content) return sendError(res, "Nom et contenu requis", 400)
    sendSuccess(res, await adminService.createScript(orgId, { name, content, queueId }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

// ── RAPPORTS ──────────────────────────────────────────────────
router.get("/reports", async (req: AuthRequest, res: Response) => {
  try {
    const orgId  = getOrgId(req)
    const period = String(req.query.period || "30d")
    sendSuccess(res, await adminService.getReports(orgId, period))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
