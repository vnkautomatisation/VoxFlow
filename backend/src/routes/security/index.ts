import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { securityService } from "../../services/security/security.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)

// ── 2FA ───────────────────────────────────────────────────────
router.get("/2fa/status", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await securityService.get2FAStatus(req.user!.userId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/2fa/setup", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await securityService.setup2FA(req.user!.userId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/2fa/enable", async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body
    if (!code) return sendError(res, "Code requis", 400)
    const ok = await securityService.enable2FA(req.user!.userId, code)
    if (!ok) return sendError(res, "Code invalide", 400)

    await securityService.log(req.user!.organizationId, req.user!.userId, "2FA_ENABLED", {
      ip: req.ip
    })
    sendSuccess(res, { enabled: true })
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/2fa/disable", async (req: AuthRequest, res: Response) => {
  try {
    await securityService.disable2FA(req.user!.userId)
    await securityService.log(req.user!.organizationId, req.user!.userId, "2FA_DISABLED")
    sendSuccess(res, { disabled: true })
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/2fa/verify", async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body
    if (!code) return sendError(res, "Code requis", 400)
    const ok = await securityService.verify2FA(req.user!.userId, code)
    sendSuccess(res, { valid: ok })
  } catch (err: any) { sendError(res, err.message) }
})

// ── SESSIONS ──────────────────────────────────────────────────
router.get("/sessions", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await securityService.getSessions(req.user!.userId))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/sessions/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await securityService.revokeSession(id, req.user!.userId))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/sessions", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await securityService.revokeAllSessions(req.user!.userId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── AUDIT LOGS ────────────────────────────────────────────────
router.get("/audit", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendError(res, "Organisation requise", 400)
    const limit = parseInt(String(req.query.limit || "50"))
    sendSuccess(res, await securityService.getAuditLogs(orgId, limit))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
