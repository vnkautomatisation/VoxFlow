import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest } from "../../middleware/auth"
import { ownerService } from "../../services/owner/owner.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)
router.use(authorize("OWNER"))

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
    if (!["ACTIVE", "SUSPENDED", "CANCELLED"].includes(status))
      return sendError(res, "Statut invalide", 400)
    sendSuccess(res, await ownerService.updateOrgStatus(orgId, status as any))
  } catch (err: any) { sendError(res, err.message) }
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

export default router
