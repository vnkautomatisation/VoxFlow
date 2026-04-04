import { Router, Request, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { multicanalService } from "../../services/multicanal/multicanal.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()

const getOrgId = (req: AuthRequest) => req.user?.organizationId || ""

// ── CONVERSATIONS ──────────────────────────────────────────────
router.get("/conversations", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await multicanalService.getConversations(getOrgId(req), {
      channel:  req.query.channel  ? String(req.query.channel)  : undefined,
      status:   req.query.status   ? String(req.query.status)   : undefined,
      agentId:  req.query.agentId  ? String(req.query.agentId)  : undefined,
      page:     req.query.page     ? parseInt(String(req.query.page))  : 1,
      limit:    req.query.limit    ? parseInt(String(req.query.limit)) : 20,
    })
    sendSuccess(res, result)
  } catch (err: any) { sendError(res, err.message) }
})

router.get("/conversations/stats", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await multicanalService.getOmnichannelStats(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

router.get("/conversations/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await multicanalService.getConversation(id, getOrgId(req)))
  } catch (err: any) { sendError(res, err.message, 404) }
})

router.post("/conversations", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await multicanalService.createConversation(getOrgId(req), req.body), 201)
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/conversations/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await multicanalService.updateConversation(id, getOrgId(req), req.body))
  } catch (err: any) { sendError(res, err.message) }
})

// ── MESSAGES ──────────────────────────────────────────────────
router.post("/conversations/:id/messages", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await multicanalService.sendMessage(id, getOrgId(req), {
      ...req.body,
      senderType: "AGENT",
      senderId:   req.user!.userId,
    }), 201)
  } catch (err: any) { sendError(res, err.message) }
})

// ── REPONSES PREDEFINIES ──────────────────────────────────────
router.get("/canned", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const channel = req.query.channel ? String(req.query.channel) : undefined
    sendSuccess(res, await multicanalService.getCannedResponses(getOrgId(req), channel))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/canned", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await multicanalService.createCannedResponse(getOrgId(req), req.user!.userId, req.body), 201)
  } catch (err: any) { sendError(res, err.message) }
})

// ── EMAIL TICKETS ─────────────────────────────────────────────
router.get("/email", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined
    sendSuccess(res, await multicanalService.getEmailTickets(getOrgId(req), status))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/email", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await multicanalService.createEmailTicket(getOrgId(req), req.body), 201)
  } catch (err: any) { sendError(res, err.message) }
})

// ── WEBHOOK WhatsApp (Twilio) ─────────────────────────────────
router.post("/webhook/whatsapp", async (req: Request, res: Response) => {
  try {
    const { From, Body, To } = req.body
    const phone   = From?.replace("whatsapp:", "") || ""
    const orgPhone = To?.replace("whatsapp:", "") || ""

    console.log("[WhatsApp] Message entrant de", phone, ":", Body)

    // Trouver l org par numero
    const { data: phoneNum } = await (await import("../../config/supabase")).supabaseAdmin
      .from("phone_numbers")
      .select("organization_id")
      .eq("number", orgPhone)
      .single()

    if (phoneNum) {
      // Trouver ou creer conversation
      const { data: existing } = await (await import("../../config/supabase")).supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("organization_id", phoneNum.organization_id)
        .eq("channel", "WHATSAPP")
        .contains("metadata", { phone })
        .single()

      let convId = existing?.id
      if (!convId) {
        const conv = await multicanalService.createConversation(phoneNum.organization_id, {
          channel:  "WHATSAPP",
          metadata: { phone },
        })
        convId = conv.id
      }

      await multicanalService.sendMessage(convId, phoneNum.organization_id, {
        content:    Body || "",
        senderType: "CONTACT",
      })
    }

    res.set("Content-Type", "text/xml")
    res.send("<Response></Response>")
  } catch (err: any) {
    res.set("Content-Type", "text/xml")
    res.send("<Response></Response>")
  }
})

// ── WIDGET CHAT (public, pas d auth) ─────────────────────────
router.post("/chat/start", async (req: Request, res: Response) => {
  try {
    const { visitorName, visitorEmail, pageUrl, orgId } = req.body
    if (!orgId) return sendError(res, "Organisation requise", 400)

    const visitorId = "v_" + Date.now()

    // Creer conversation chat
    const conv = await multicanalService.createConversation(orgId, {
      channel:  "CHAT",
      metadata: { visitorId, visitorName, visitorEmail, pageUrl },
    })

    await (await import("../../config/supabase")).supabaseAdmin
      .from("chat_sessions")
      .insert({
        organization_id: orgId,
        conversation_id: conv.id,
        visitor_id:      visitorId,
        visitor_name:    visitorName || null,
        visitor_email:   visitorEmail || null,
        page_url:        pageUrl || null,
      })

    sendSuccess(res, { conversationId: conv.id, visitorId }, 201)
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/chat/:convId/message", async (req: Request, res: Response) => {
  try {
    const convId = Array.isArray(req.params.convId) ? req.params.convId[0] : req.params.convId
    const { content, visitorId, orgId } = req.body

    sendSuccess(res, await multicanalService.sendMessage(convId, orgId, {
      content,
      senderType: "CONTACT",
      senderId:   visitorId,
    }), 201)
  } catch (err: any) { sendError(res, err.message) }
})

export default router
