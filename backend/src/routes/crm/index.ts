import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { crmService } from "../../services/crm/crm.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)

const getOrgId = (req: AuthRequest): string =>
  String(req.user?.organizationId || req.query.orgId || "")

// ── CONTACTS ──────────────────────────────────────────────────
// GET /api/v1/crm/contacts
router.get("/contacts", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    const result = await crmService.getContacts(orgId, {
      search:  req.query.search  ? String(req.query.search)  : undefined,
      status:  req.query.status  ? String(req.query.status)  : undefined,
      stage:   req.query.stage   ? String(req.query.stage)   : undefined,
      tag:     req.query.tag     ? String(req.query.tag)     : undefined,
      agentId: req.query.agentId ? String(req.query.agentId) : undefined,
      page:    req.query.page    ? parseInt(String(req.query.page))  : 1,
      limit:   req.query.limit   ? parseInt(String(req.query.limit)) : 20,
      sortBy:  req.query.sortBy  ? String(req.query.sortBy)  : "created_at",
      sortDir: req.query.sortDir ? String(req.query.sortDir) : "desc",
    })
    sendSuccess(res, result)
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/crm/contacts/search
router.get("/contacts/search", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const query = String(req.query.q || "")
    if (!query || query.length < 2) return sendSuccess(res, [])
    sendSuccess(res, await crmService.searchContacts(orgId, query))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/crm/contacts/pipeline
router.get("/contacts/pipeline", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await crmService.getPipelineStats(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/crm/contacts/:id
router.get("/contacts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id    = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await crmService.getContactById(id, orgId))
  } catch (err: any) { sendError(res, err.message, 404) }
})

// POST /api/v1/crm/contacts
router.post("/contacts", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await crmService.createContact(orgId, req.user!.userId, req.body), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

// PATCH /api/v1/crm/contacts/:id
router.patch("/contacts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id    = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await crmService.updateContact(id, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

// DELETE /api/v1/crm/contacts/:id
router.delete("/contacts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id    = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await crmService.deleteContact(id, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/crm/contacts/:id/activities
router.post("/contacts/:id/activities", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id    = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await crmService.addActivity(id, orgId, { ...req.body, agentId: req.user!.userId }), 201)
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/crm/contacts/import
router.post("/contacts/import", async (req: AuthRequest, res: Response) => {
  try {
    const orgId    = getOrgId(req)
    const contacts = req.body.contacts
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return sendError(res, "Tableau de contacts requis", 400)
    }
    sendSuccess(res, await crmService.importContacts(orgId, req.user!.userId, contacts))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/crm/tags
router.get("/tags", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await crmService.getTags(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/crm/tags
router.post("/tags", async (req: AuthRequest, res: Response) => {
  try {
    const orgId         = getOrgId(req)
    const { name, color } = req.body
    if (!name) return sendError(res, "Nom du tag requis", 400)
    sendSuccess(res, await crmService.createTag(orgId, name, color || "#6366f1"), 201)
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/crm/phone/:phone -- trouver contact par numero (pour softphone)
router.get("/phone/:phone", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const phone = Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone
    sendSuccess(res, await crmService.findByPhone(phone, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/crm/calls/:callId/link
router.post("/calls/:callId/link", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const callId  = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { contactId } = req.body
    if (!contactId) return sendError(res, "Contact requis", 400)
    sendSuccess(res, await crmService.linkCallToContact(callId, contactId, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
