import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest, resolveOrgId } from "../../middleware/auth"
import { analyticsService } from "../../services/analytics/analytics.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)
router.use(authorize("ADMIN", "OWNER", "OWNER_STAFF" as any, "SUPERVISOR"))

// GET /api/v1/analytics/advanced — Stats avancées
// OWNER / OWNER_STAFF peuvent passer ?orgId=X pour cibler une autre org.
// ADMIN / SUPERVISOR utilisent strictement leur propre org depuis le JWT.
router.get("/advanced", async (req: AuthRequest, res: Response) => {
  try {
    const orgId  = resolveOrgId(req)
    const period = String(req.query.period || "30d")
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await analyticsService.getAdvancedStats(orgId, period))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/analytics/sla — Métriques SLA
router.get("/sla", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = resolveOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await analyticsService.getSLAMetrics(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
