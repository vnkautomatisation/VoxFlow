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

// GET /api/v1/analytics/export — Export CSV des stats
router.get("/export", async (req: AuthRequest, res: Response) => {
  try {
    const orgId  = resolveOrgId(req)
    const period = String(req.query.period || "30d")
    if (!orgId) return sendError(res, "Organisation requise", 400)
    const stats = await analyticsService.getAdvancedStats(orgId, period)

    const header = "Metrique,Valeur"
    const rows = Object.entries(stats).map(([k, v]) => `"${k}","${v}"`).join("\n")
    const csv = header + "\n" + rows

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="voxflow-analytics-${period}.csv"`)
    res.send("\uFEFF" + csv)
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/analytics/agents — Stats par agent
router.get("/agents", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = resolveOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)

    const { data } = await (await import("../../config/supabase")).supabaseAdmin
      .from("calls")
      .select("agent_id, status, duration")
      .eq("organization_id", orgId)
      .not("agent_id", "is", null)

    // Agreger par agent
    const byAgent: Record<string, { total: number; completed: number; totalDuration: number }> = {}
    for (const c of data || []) {
      if (!byAgent[c.agent_id]) byAgent[c.agent_id] = { total: 0, completed: 0, totalDuration: 0 }
      byAgent[c.agent_id].total++
      if (c.status === "COMPLETED") byAgent[c.agent_id].completed++
      byAgent[c.agent_id].totalDuration += c.duration || 0
    }

    const result = Object.entries(byAgent).map(([agentId, s]) => ({
      agentId, ...s,
      avgDuration: s.total ? Math.round(s.totalDuration / s.total) : 0,
      rate: s.total ? Math.round((s.completed / s.total) * 100) : 0,
    }))

    sendSuccess(res, result)
  } catch (err: any) { sendError(res, err.message) }
})

export default router
