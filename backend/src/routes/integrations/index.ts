import { Router, Request, Response } from "express"
import { authenticate, apiKeyAuth, AuthRequest } from "../../middleware/auth"
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

// ── API PUBLIQUE v2 (authentification par clé API vf_*) ───────
// Chaque endpoint exige la permission listée dans son scope.
// Le client sélectionne les permissions lors de la création de la clé API
// dans l'onglet "Clés API". Une clé sans la permission requise reçoit 403.

// ─── CALLS ──────────────────────────────────────────────────
router.get("/v2/calls", apiKeyAuth("calls:read"), async (req: AuthRequest, res: Response) => {
  try {
    const { supabaseAdmin } = await import("../../config/supabase")
    const limit  = Math.min(parseInt(String(req.query.limit || "50")) || 50, 200)
    const offset = parseInt(String(req.query.offset || "0")) || 0

    const { data, count } = await supabaseAdmin
      .from("calls")
      .select("id, from_number, to_number, direction, status, duration, started_at, ended_at, recording_url, ai_summary, ai_sentiment", { count: "exact" })
      .eq("organization_id", req.apiKey!.organizationId)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1)

    sendSuccess(res, { calls: data || [], total: count || 0, limit, offset })
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/v2/calls", apiKeyAuth("calls:write"), async (req: AuthRequest, res: Response) => {
  try {
    const { to, from } = req.body || {}
    if (!to) return sendError(res, "Champ 'to' requis", 400)

    const { twilioService } = await import("../../services/twilio/twilio.service")
    const { supabaseAdmin } = await import("../../config/supabase")

    // Récupère le numéro d'envoi par défaut de l'org si 'from' non fourni
    let fromNumber = from
    if (!fromNumber) {
      const { data: phones } = await supabaseAdmin
        .from("phone_numbers")
        .select("number")
        .eq("organization_id", req.apiKey!.organizationId)
        .limit(1)
      fromNumber = phones?.[0]?.number || process.env.TWILIO_PHONE_NUMBER || ""
    }

    if (!fromNumber) return sendError(res, "Aucun numéro d'envoi configuré", 400)

    const backendUrl = process.env.BACKEND_URL || "http://localhost:4000"
    const call = await twilioService.makeOutboundCall({
      to,
      from:        fromNumber,
      callbackUrl: `${backendUrl}/api/v1/telephony/voice`,
      statusUrl:   `${backendUrl}/api/v1/telephony/webhook/status`,
    })

    // Enregistre l'appel en DB avec l'orgId de la clé API
    const callRow = await supabaseAdmin
      .from("calls")
      .insert({
        organization_id: req.apiKey!.organizationId,
        twilio_sid:      (call as any).sid,
        from_number:     fromNumber,
        to_number:       to,
        direction:       "OUTBOUND",
        status:          "RINGING",
        initiated_via:   "API",
      })
      .select().single()

    sendSuccess(res, { call: callRow.data, twilio_sid: (call as any).sid }, 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

// ─── CONTACTS ───────────────────────────────────────────────
router.get("/v2/contacts", apiKeyAuth("contacts:read"), async (req: AuthRequest, res: Response) => {
  try {
    const { supabaseAdmin } = await import("../../config/supabase")
    const limit  = Math.min(parseInt(String(req.query.limit || "100")) || 100, 500)
    const offset = parseInt(String(req.query.offset || "0")) || 0
    const search = String(req.query.search || "").trim()

    let query = supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company, status, pipeline_stage, score, tags, created_at, updated_at", { count: "exact" })
      .eq("organization_id", req.apiKey!.organizationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data, count } = await query
    sendSuccess(res, { contacts: data || [], total: count || 0, limit, offset })
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/v2/contacts", apiKeyAuth("contacts:write"), async (req: AuthRequest, res: Response) => {
  try {
    const { first_name, last_name, email, phone, company, status, pipeline_stage, tags } = req.body || {}
    if (!first_name && !last_name && !email && !phone) {
      return sendError(res, "Au moins un champ requis: first_name, last_name, email ou phone", 400)
    }

    const { supabaseAdmin } = await import("../../config/supabase")
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .upsert({
        organization_id: req.apiKey!.organizationId,
        first_name:      first_name     || null,
        last_name:       last_name      || null,
        email:           email          || null,
        phone:           phone          || null,
        company:         company        || null,
        status:          status         || "NEW",
        pipeline_stage:  pipeline_stage || null,
        tags:            tags           || [],
        source:          "API",
      }, { onConflict: "organization_id,email" })
      .select().single()

    if (error) return sendError(res, error.message, 400)
    sendSuccess(res, { contact: data }, 201)
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/v2/contacts/:id", apiKeyAuth("contacts:write"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const allowed = ["first_name", "last_name", "email", "phone", "company", "status", "pipeline_stage", "score", "tags", "notes"]
    const update: any = { updated_at: new Date().toISOString() }
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) update[k] = req.body[k]
    }

    const { supabaseAdmin } = await import("../../config/supabase")
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .update(update)
      .eq("id", id)
      .eq("organization_id", req.apiKey!.organizationId)
      .select().single()

    if (error) return sendError(res, error.message, 400)
    if (!data) return sendError(res, "Contact introuvable", 404)
    sendSuccess(res, { contact: data })
  } catch (err: any) { sendError(res, err.message) }
})

// ─── CONVERSATIONS (multicanal) ─────────────────────────────
router.get("/v2/conversations", apiKeyAuth("conversations:read"), async (req: AuthRequest, res: Response) => {
  try {
    const { supabaseAdmin } = await import("../../config/supabase")
    const limit   = Math.min(parseInt(String(req.query.limit || "50")) || 50, 200)
    const offset  = parseInt(String(req.query.offset || "0")) || 0
    const channel = req.query.channel ? String(req.query.channel) : null
    const status  = req.query.status  ? String(req.query.status)  : null

    let query = supabaseAdmin
      .from("conversations")
      .select(`
        id, channel, status, priority, subject, tags, created_at, updated_at, last_message_at, resolved_at, closed_at,
        contact:contacts(id, first_name, last_name, email, phone, company),
        agent:users!conversations_assigned_to_fkey(id, name, email)
      `, { count: "exact" })
      .eq("organization_id", req.apiKey!.organizationId)
      .order("last_message_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (channel) query = query.eq("channel", channel)
    if (status)  query = query.eq("status", status)

    const { data, count } = await query
    sendSuccess(res, { conversations: data || [], total: count || 0, limit, offset })
  } catch (err: any) { sendError(res, err.message) }
})

// ─── ANALYTICS (résumé agrégé) ──────────────────────────────
router.get("/v2/analytics", apiKeyAuth("analytics:read"), async (req: AuthRequest, res: Response) => {
  try {
    const { supabaseAdmin } = await import("../../config/supabase")
    const days = Math.min(parseInt(String(req.query.days || "30")) || 30, 365)
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
    const orgId = req.apiKey!.organizationId

    // Appels agrégés sur la période
    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("direction, status, duration, ai_sentiment")
      .eq("organization_id", orgId)
      .gte("started_at", since)

    const callsArr = calls || []
    const totalCalls     = callsArr.length
    const inboundCalls   = callsArr.filter((c: any) => c.direction === "INBOUND").length
    const outboundCalls  = callsArr.filter((c: any) => c.direction === "OUTBOUND").length
    const answeredCalls  = callsArr.filter((c: any) => ["COMPLETED", "IN_PROGRESS"].includes(c.status)).length
    const missedCalls    = callsArr.filter((c: any) => ["NO_ANSWER", "FAILED", "BUSY"].includes(c.status)).length
    const totalDuration  = callsArr.reduce((acc: number, c: any) => acc + (c.duration || 0), 0)
    const avgDuration    = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0

    // Contacts ajoutés sur la période
    const { count: newContacts } = await supabaseAdmin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", since)

    // Conversations ouvertes vs fermées sur la période
    const { data: convs } = await supabaseAdmin
      .from("conversations")
      .select("status, channel")
      .eq("organization_id", orgId)
      .gte("created_at", since)

    const convsArr       = convs || []
    const totalConvs     = convsArr.length
    const openConvs      = convsArr.filter((c: any) => c.status === "OPEN").length
    const resolvedConvs  = convsArr.filter((c: any) => c.status === "RESOLVED").length
    const resolutionRate = totalConvs > 0 ? Math.round((resolvedConvs / totalConvs) * 100) : 0

    sendSuccess(res, {
      period:     { days, since },
      calls: {
        total:    totalCalls,
        inbound:  inboundCalls,
        outbound: outboundCalls,
        answered: answeredCalls,
        missed:   missedCalls,
        avg_duration_seconds: avgDuration,
      },
      contacts: {
        new: newContacts || 0,
      },
      conversations: {
        total:           totalConvs,
        open:            openConvs,
        resolved:        resolvedConvs,
        resolution_rate: resolutionRate,
      },
    })
  } catch (err: any) { sendError(res, err.message) }
})

export default router
