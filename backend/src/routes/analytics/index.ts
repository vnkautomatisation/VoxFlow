import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest } from "../../middleware/auth"
import { analyticsService } from "../../services/analytics/analytics.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)
router.use(authorize("ADMIN", "OWNER", "SUPERVISOR"))

// GET /api/v1/analytics/advanced — Stats avancees
router.get("/advanced", async (req: AuthRequest, res: Response) => {
  try {
    const orgId  = req.user?.role === "OWNER"
      ? String(req.query.orgId || "")
      : req.user?.organizationId || ""
    const period = String(req.query.period || "30d")
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await analyticsService.getAdvancedStats(orgId, period))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/analytics/sla — Metriques SLA
router.get("/sla", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId || ""
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await analyticsService.getSLAMetrics(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
