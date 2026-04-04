import { Router, Request, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { twilioService } from "../../services/twilio/twilio.service"
import { crmService } from "../../services/crm/crm.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()

// ── TOKEN WEBRTC ──────────────────────────────────────────────
router.get("/token", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const identity = req.user!.userId
    const orgId    = req.user!.organizationId || "default"
    try {
      const token = await twilioService.generateToken(identity, orgId)
      sendSuccess(res, { token, identity })
    } catch {
      sendSuccess(res, { token: "simulated_" + Date.now(), identity, simulated: true })
    }
  } catch (err: any) { sendError(res, err.message) }
})

// ── STATUT AGENT ──────────────────────────────────────────────
router.patch("/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.body.status || "OFFLINE")
    await supabaseAdmin.from("agents")
      .update({ status })
      .eq("user_id", req.user!.userId)
    sendSuccess(res, { status })
  } catch (err: any) { sendError(res, err.message) }
})

// ── INITIER APPEL SORTANT ─────────────────────────────────────
router.post("/call/outbound", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, contactId } = req.body
    const orgId = req.user!.organizationId || ""
    if (!to) return sendError(res, "Numero destination requis", 400)

    // Chercher contact par numero si pas fourni
    let contact = null
    if (contactId) {
      const { data } = await supabaseAdmin.from("contacts")
        .select("id, first_name, last_name, company, phone").eq("id", contactId).single()
      contact = data
    } else {
      contact = await crmService.findByPhone(to, orgId)
    }

    // Creer l appel en BDD
    const { data: call } = await supabaseAdmin.from("calls").insert({
      twilio_sid:      "out_" + Date.now(),
      from_number:     "VoxFlow",
      to_number:       to,
      status:          "RINGING",
      direction:       "OUTBOUND",
      organization_id: orgId,
      agent_id:        req.user!.userId,
      contact_id:      contact?.id || null,
      started_at:      new Date().toISOString(),
    }).select().single()

    sendSuccess(res, { call, contact }, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// ── TERMINER APPEL ────────────────────────────────────────────
router.patch("/call/:callId/end", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId   = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { duration, notes } = req.body

    await supabaseAdmin.from("calls").update({
      status:   "COMPLETED",
      duration: duration || 0,
      notes:    notes || null,
      ended_at: new Date().toISOString(),
    }).eq("id", callId)

    sendSuccess(res, { ended: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── TRANSFERT D APPEL ─────────────────────────────────────────
router.post("/call/:callId/transfer", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { to, type } = req.body // type: "blind" | "attended"
    if (!to) return sendError(res, "Destination de transfert requise", 400)

    // Simulation transfert (Twilio reel necessite conferenceApi)
    console.log("Transfert " + type + " vers " + to + " pour appel " + callId)

    sendSuccess(res, {
      transferred: true,
      to,
      type: type || "blind",
      simulated: true,
    })
  } catch (err: any) { sendError(res, err.message) }
})

// ── CONFERENCE 3 VOIES ────────────────────────────────────────
router.post("/call/:callId/conference", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { participant } = req.body

    sendSuccess(res, {
      conference: true,
      participant,
      callId,
      simulated: true,
    })
  } catch (err: any) { sendError(res, err.message) }
})

// ── NOTES POST-APPEL ──────────────────────────────────────────
router.patch("/call/:callId/notes", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { notes } = req.body

    await supabaseAdmin.from("calls")
      .update({ notes })
      .eq("id", callId)
      .eq("agent_id", req.user!.userId)

    sendSuccess(res, { saved: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── HISTORIQUE APPELS AGENT ───────────────────────────────────
router.get("/calls", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || "30"))

    const { data } = await supabaseAdmin
      .from("calls")
      .select("id, from_number, to_number, duration, status, direction, started_at, notes, contact_id, contacts(first_name,last_name,company)")
      .eq("agent_id", req.user!.userId)
      .order("started_at", { ascending: false })
      .limit(limit)

    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

// ── CHERCHER CONTACT PAR NUMERO (pour popup appel entrant) ────
router.get("/lookup/:phone", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const phone = Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone
    const orgId = req.user?.organizationId || ""

    const contact = await crmService.findByPhone(
      decodeURIComponent(phone), orgId
    )

    sendSuccess(res, { contact })
  } catch (err: any) { sendError(res, err.message) }
})

// ── WEBHOOKS TWILIO ────────────────────────────────────────────
// POST /api/v1/telephony/webhook/voice
router.post("/webhook/voice", (req: Request, res: Response) => {
  const from = req.body?.From || "Inconnu"
  const to   = req.body?.To   || ""

  console.log("Appel entrant Twilio - De:", from, "Vers:", to)

  res.set("Content-Type", "text/xml")
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR" voice="alice">
    Bienvenue chez VoxFlow. Votre appel est important pour nous.
    Veuillez patienter, un agent va prendre votre appel.
  </Say>
  <Enqueue waitUrl="/api/v1/telephony/webhook/wait">support</Enqueue>
</Response>`)
})

// POST /api/v1/telephony/webhook/status
router.post("/webhook/status", async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration, From, To } = req.body

  if (CallSid) {
    await supabaseAdmin.from("calls")
      .update({
        status:   CallStatus?.toUpperCase().replace("-", "_") || "COMPLETED",
        duration: parseInt(CallDuration || "0"),
        ended_at: ["completed", "failed", "busy", "no-answer"].includes(CallStatus || "")
          ? new Date().toISOString() : undefined,
      })
      .eq("twilio_sid", CallSid)
  }

  sendSuccess(res, { received: true })
})

export default router
