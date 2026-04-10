import { Router, Request, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { integrationsService } from "../../services/integrations/integrations.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()

const getOrgId = (req: AuthRequest) => req.user?.organizationId || ""

// ── API KEYS ──────────────────────────────────────────────────
router.get("/keys", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.getAPIKeys(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/keys", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, permissions, expiresInDays } = req.body
    if (!name) return sendError(res, "Nom requis", 400)
    sendSuccess(res, await integrationsService.createAPIKey(
      getOrgId(req), req.user!.userId, name,
      permissions || ["calls:read", "contacts:read"], expiresInDays
    ), 201)
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/keys/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await integrationsService.revokeAPIKey(id, getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

// ── WEBHOOKS ──────────────────────────────────────────────────
router.get("/webhooks", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.getWebhooks(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/webhooks", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, url, events, secret } = req.body
    if (!name || !url) return sendError(res, "Nom et URL requis", 400)
    if (!Array.isArray(events) || events.length === 0) return sendError(res, "Evenements requis", 400)
    sendSuccess(res, await integrationsService.createWebhook(getOrgId(req), { name, url, events, secret }), 201)
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/webhooks/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await integrationsService.updateWebhook(id, getOrgId(req), req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/webhooks/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await integrationsService.deleteWebhook(id, getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/webhooks/:id/test", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const results = await integrationsService.triggerWebhook(getOrgId(req), "test", {
      message: "Test webhook VoxFlow",
      timestamp: new Date().toISOString(),
    })
    sendSuccess(res, results)
  } catch (err: any) { sendError(res, err.message) }
})

router.get("/webhooks/:id/logs", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id    = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const limit = parseInt(String(req.query.limit || "20"))
    sendSuccess(res, await integrationsService.getWebhookLogs(id, limit))
  } catch (err: any) { sendError(res, err.message) }
})

// ── INTEGRATIONS CRM ──────────────────────────────────────────
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.getIntegrations(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/connect", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.connectIntegration(getOrgId(req), req.body), 201)
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/:id/disconnect", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await integrationsService.disconnectIntegration(id, getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/hubspot/sync", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.syncHubSpot(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.post("/salesforce/sync", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.syncSalesforce(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.post("/zendesk/sync", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.syncZendesk(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.post("/slack/test", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.testSlack(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.post("/google-calendar/sync", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await integrationsService.syncGoogleCalendar(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message, 400) }
})

// ── API PUBLIQUE v2 (authentification par API key) ────────────
router.get("/v2/calls", async (req: Request, res: Response) => {
  try {
    const apiKey = String(req.headers["x-api-key"] || req.query.api_key || "")
    if (!apiKey.startsWith("vf_")) return sendError(res, "Cle API requise", 401)

    const auth = await integrationsService.validateAPIKey(apiKey)
    if (!auth) return sendError(res, "Cle API invalide ou expiree", 401)

    const { data } = await (await import("../../config/supabase")).supabaseAdmin
      .from("calls")
      .select("id, from_number, to_number, direction, status, duration, started_at, ai_summary")
      .eq("organization_id", auth.organizationId)
      .order("started_at", { ascending: false })
      .limit(50)

    sendSuccess(res, { calls: data || [], organization_id: auth.organizationId })
  } catch (err: any) { sendError(res, err.message) }
})

router.get("/v2/contacts", async (req: Request, res: Response) => {
  try {
    const apiKey = String(req.headers["x-api-key"] || req.query.api_key || "")
    if (!apiKey.startsWith("vf_")) return sendError(res, "Cle API requise", 401)

    const auth = await integrationsService.validateAPIKey(apiKey)
    if (!auth) return sendError(res, "Cle API invalide ou expiree", 401)

    const { data } = await (await import("../../config/supabase")).supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company, status, pipeline_stage, score")
      .eq("organization_id", auth.organizationId)
      .order("created_at", { ascending: false })
      .limit(100)

    sendSuccess(res, { contacts: data || [], organization_id: auth.organizationId })
  } catch (err: any) { sendError(res, err.message) }
})

export default router
