import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { smsService } from "../../services/sms/sms.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)

// GET /api/v1/sms — Liste conversations SMS
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendSuccess(res, [])
    sendSuccess(res, await smsService.getConversations(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/sms/thread/:phone — Thread d un numero
router.get("/thread/:phone", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    const phone = Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await smsService.getThread(phone, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/sms/send — Envoyer un SMS
router.post("/send", async (req: AuthRequest, res: Response) => {
  try {
    const { to, from, body } = req.body
    const orgId = req.user?.organizationId
    if (!to || !body) return sendError(res, "Destinataire et message requis", 400)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await smsService.sendSMS(to, from || "+15141234567", body, orgId), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

export default router
