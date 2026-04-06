import { Router, Request, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { twilioService } from "../../services/twilio/twilio.service"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"
import voiceRoutes from './voice'

const router = Router()
const BACKEND = () => process.env.BACKEND_URL || "http://localhost:4000"
const getOrgId = (req: AuthRequest) =>
  req.user?.organizationId || String(req.query.orgId || "")

// ── helpers ──────────────────────────────────────────────────
async function findContactByPhone(phone: string, orgId: string) {
  try {
    const clean = phone.replace(/\D/g, "")
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, company, phone, email")
      .eq("organization_id", orgId)
      .or(`phone.ilike.%${clean}%,phone.eq.${phone}`)
      .limit(1)
    return data?.[0] || null
  } catch { return null }
}

// ════════════════════════════════════════════════════════════
//  TOKEN WEBRTC
// ════════════════════════════════════════════════════════════
router.get("/token", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const identity = req.user!.userId
    const token    = await twilioService.generateToken(identity, getOrgId(req))
    sendSuccess(res, { token, identity, configured: true })
  } catch (err: any) {
    sendSuccess(res, { token: "demo_" + Date.now(), identity: req.user!.userId, configured: false })
  }
})

// ════════════════════════════════════════════════════════════
//  APPEL SORTANT
// ════════════════════════════════════════════════════════════
router.post("/call/outbound", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, contactId, fromNumber } = req.body
    const orgId = getOrgId(req)
    if (!to) return sendError(res, "Numero requis", 400)

    const contact = contactId
      ? (await supabaseAdmin.from("contacts").select("*").eq("id", contactId).single()).data
      : await findContactByPhone(to, orgId)

    const { data: call } = await supabaseAdmin.from("calls").insert({
      organization_id: orgId,
      agent_id:        req.user!.userId,
      contact_id:      contact?.id || null,
      from_number:     fromNumber || process.env.TWILIO_PHONE_NUMBER,
      to_number:       to,
      direction:       "OUTBOUND",
      status:          "RINGING",
      started_at:      new Date().toISOString(),
    }).select().single()

    // Lancer le vrai appel Twilio
    const twilioCall = await twilioService.makeOutboundCall({
      to,
      from:        fromNumber || process.env.TWILIO_PHONE_NUMBER || "",
      callbackUrl: BACKEND() + "/api/v1/telephony/webhook/answer",
      statusUrl:   BACKEND() + "/api/v1/telephony/webhook/status",
    })

    console.log("[Twilio] Appel sortant:", twilioCall.sid, "->", to)

    if ((call as any)?.id) {
      await supabaseAdmin.from("calls")
        .update({ twilio_sid: twilioCall.sid })
        .eq("id", (call as any).id)
    }

    sendSuccess(res, { call: { ...(call as any), twilio_sid: twilioCall.sid }, contact }, 201)
  } catch (err: any) {
    console.error("[Twilio ERROR outbound]", err.message)
    sendError(res, "Erreur Twilio: " + err.message, 500)
  }
})

// ════════════════════════════════════════════════════════════
//  MUTE / HOLD / RACCROCHER / NOTES
// ════════════════════════════════════════════════════════════
router.patch("/call/:id/mute", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { mute, twilioSid } = req.body
    if (twilioSid) await twilioService.muteCall(twilioSid, mute)
    sendSuccess(res, { muted: mute })
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:id/hold", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { hold, twilioSid } = req.body
    if (twilioSid) await twilioService.holdCall(twilioSid, hold)
    sendSuccess(res, { onHold: hold })
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:id/end", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId = req.params.id
    const { duration, notes, twilioSid } = req.body

    await supabaseAdmin.from("calls").update({
      status:   "COMPLETED",
      duration: duration || 0,
      notes:    notes || null,
      ended_at: new Date().toISOString(),
    }).eq("id", callId)

    if (twilioSid) {
      try {
        const twilio = (await import("twilio")).default
        const c = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
        await c.calls(twilioSid).update({ status: "completed" })
      } catch {}
    }

    sendSuccess(res, { ended: true })
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:id/notes", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await supabaseAdmin.from("calls")
      .update({ notes: req.body.notes })
      .eq("id", req.params.id)
    sendSuccess(res, { saved: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  TRANSFERT
// ════════════════════════════════════════════════════════════
router.post("/call/:id/transfer", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, type, twilioSid } = req.body
    if (!to) return sendError(res, "Destination requise", 400)
    if (twilioSid) {
      const result = await twilioService.transferCall({ callSid: twilioSid, to, type: type || "blind" })
      sendSuccess(res, result)
    } else {
      sendSuccess(res, { transferred: true, simulated: true })
    }
  } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  CONFERENCE 3 VOIES
// ════════════════════════════════════════════════════════════
router.post("/call/:id/conference", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { participant } = req.body
    const result = await twilioService.addParticipantToConference({
      conferenceName:   "conf-" + req.params.id,
      participantPhone: participant,
    })
    sendSuccess(res, result)
  } catch (err: any) {
    sendSuccess(res, { conference: true, simulated: true })
  }
})

// ════════════════════════════════════════════════════════════
//  SUPERVISION
// ════════════════════════════════════════════════════════════
router.post("/call/:id/supervise", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { mode, twilioSid } = req.body
    if (twilioSid) {
      const result = await twilioService.joinCallAsSupervisor({
        callSid:      twilioSid,
        supervisorId: req.user!.userId,
        mode:         mode || "listen",
      })
      sendSuccess(res, result)
    } else {
      sendSuccess(res, { mode, simulated: true })
    }
  } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  ENREGISTREMENTS
// ════════════════════════════════════════════════════════════
router.get("/call/:id/recordings", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from("calls").select("twilio_sid").eq("id", req.params.id).single()
    if (!(data as any)?.twilio_sid) return sendSuccess(res, [])
    sendSuccess(res, await twilioService.getRecordings((data as any).twilio_sid))
  } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  VOICEMAILS
// ════════════════════════════════════════════════════════════
router.get("/voicemails", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data } = await supabaseAdmin
      .from("voicemails")
      .select("*, contact:contacts(id, first_name, last_name, company)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50)
    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/voicemail/:id/listen", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await supabaseAdmin.from("voicemails")
      .update({ status: "LISTENED" }).eq("id", req.params.id)
    sendSuccess(res, { listened: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  NUMEROS DID
// ════════════════════════════════════════════════════════════
router.get("/numbers", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await twilioService.getPhoneNumbers())
  } catch (err: any) { sendError(res, err.message) }
})

router.get("/numbers/search", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const areaCode = String(req.query.areaCode || "514")
    const country  = String(req.query.country  || "CA")
    sendSuccess(res, await twilioService.searchAvailableNumbers(areaCode, country))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/numbers/purchase", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { phoneNumber } = req.body
    if (!phoneNumber) return sendError(res, "Numero requis", 400)
    sendSuccess(res, await twilioService.purchasePhoneNumber(phoneNumber, getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  HISTORIQUE + STATUT
// ════════════════════════════════════════════════════════════
router.get("/calls", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const orgId  = getOrgId(req)
    const limit  = parseInt(String(req.query.limit || "30"))
    const isAgent = req.user!.role === "AGENT"

    let q = supabaseAdmin
      .from("calls")
      .select(`
        id, from_number, to_number, direction, status, duration,
        started_at, ended_at, notes, transcription, recording_url,
        twilio_sid, quality_score,
        contact:contacts(id, first_name, last_name, company, phone)
      `)
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(limit)

    if (isAgent) q = q.eq("agent_id", req.user!.userId)

    const { data } = await q
    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await supabaseAdmin.from("agents")
      .update({ status: req.body.status })
      .eq("user_id", req.user!.userId)
    sendSuccess(res, { status: req.body.status })
  } catch (err: any) { sendError(res, err.message) }
})

router.get("/lookup/:phone", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const phone   = decodeURIComponent(Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone)
    const contact = await findContactByPhone(phone, getOrgId(req))
    sendSuccess(res, { contact })
  } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  WEBHOOKS TWILIO
// ════════════════════════════════════════════════════════════

// Appel entrant
router.post("/webhook/voice", async (req: Request, res: Response) => {
  try {
    const { From, To, CallSid } = req.body
    const orgId = String(req.query.orgId || "org_test_001")
    console.log(`[Twilio] Entrant: ${From} -> ${To} | SID: ${CallSid}`)

    const contact = orgId ? await findContactByPhone(From, orgId) : null

    if (orgId) {
      await supabaseAdmin.from("calls").insert({
        organization_id: orgId,
        twilio_sid:      CallSid,
        from_number:     From,
        to_number:       To,
        direction:       "INBOUND",
        status:          "RINGING",
        contact_id:      contact?.id || null,
        started_at:      new Date().toISOString(),
      })
    }

    // Trouver agent disponible
    let agentIdentity = "agent-default"
    if (orgId) {
      const { data: agents } = await supabaseAdmin
        .from("agents")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("status", "ONLINE")
        .limit(1)
      if (agents?.length) agentIdentity = agents[0].user_id
    }

    const twiml = twilioService.generateIncomingTwiML({ agentIdentity })
    res.set("Content-Type", "text/xml")
    res.send(twiml)
  } catch (err: any) {
    console.error("[Webhook voice error]", err.message)
    res.set("Content-Type", "text/xml")
    res.send(`<?xml version="1.0"?><Response><Say language="fr-CA">Erreur. Rappellez.</Say></Response>`)
  }
})

// Statut appel
router.post("/webhook/status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body
    if (!CallSid) return res.json({ ok: true })

    const statusMap: Record<string, string> = {
      "queued":      "RINGING",
      "ringing":     "RINGING",
      "in-progress": "IN_PROGRESS",
      "completed":   "COMPLETED",
      "busy":        "BUSY",
      "failed":      "FAILED",
      "no-answer":   "NO_ANSWER",
      "canceled":    "CANCELLED",
    }

    const update: any = { status: statusMap[CallStatus] || CallStatus.toUpperCase() }
    if (CallDuration) update.duration = parseInt(CallDuration)
    if (RecordingUrl) update.recording_url = RecordingUrl + ".mp3"
    if (["completed","failed","busy","no-answer","canceled"].includes(CallStatus)) {
      update.ended_at = new Date().toISOString()
    }

    await supabaseAdmin.from("calls").update(update).eq("twilio_sid", CallSid)

    // Transcription auto si enregistrement
    if (RecordingUrl) {
      const { data: call } = await supabaseAdmin
        .from("calls").select("id").eq("twilio_sid", CallSid).single()
      if (call) {
        twilioService.transcribeAudio(RecordingUrl + ".mp3", (call as any).id)
          .catch((e: any) => console.error("[Whisper error]", e.message))
      }
    }

    res.json({ ok: true })
  } catch (err: any) {
    console.error("[Webhook status error]", err.message)
    res.json({ ok: true })
  }
})

// Voicemail
router.post("/webhook/voicemail", async (req: Request, res: Response) => {
  try {
    const { CallSid, RecordingUrl, From, To } = req.body
    const orgId = String(req.query.orgId || "org_test_001")
    console.log(`[Twilio] Voicemail: ${From} | ${RecordingUrl}`)

    if (orgId) {
      const contact = await findContactByPhone(From, orgId)
      await supabaseAdmin.from("voicemails").insert({
        organization_id: orgId,
        twilio_sid:      CallSid,
        from_number:     From,
        to_number:       To,
        recording_url:   RecordingUrl + ".mp3",
        contact_id:      contact?.id || null,
        status:          "NEW",
        created_at:      new Date().toISOString(),
      })

      // Transcription voicemail
      if (RecordingUrl) {
        twilioService.transcribeAudio(RecordingUrl + ".mp3", "vm-" + CallSid)
          .catch((e: any) => console.error("[Voicemail transcription error]", e.message))
      }
    }

    res.set("Content-Type", "text/xml")
    res.send(`<?xml version="1.0"?><Response></Response>`)
  } catch (err: any) {
    console.error("[Webhook voicemail error]", err.message)
    res.set("Content-Type", "text/xml")
    res.send(`<?xml version="1.0"?><Response></Response>`)
  }
})

// TwiML statiques
router.get("/twiml/hold-music", (_req: Request, res: Response) => {
  res.set("Content-Type", "text/xml")
  res.send(`<?xml version="1.0"?><Response><Play loop="0">http://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.mp3</Play></Response>`)
})

router.get("/twiml/conference/:name", (req: Request, res: Response) => {
  const name  = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name
  const isSup = req.query.supervisor === "true"
  res.set("Content-Type", "text/xml")
  res.send(twilioService.generateConferenceTwiML(name, isSup))
})

router.get("/twiml/voicemail", (req: Request, res: Response) => {
  const orgId = String(req.query.orgId || "org_test_001")
  res.set("Content-Type", "text/xml")
  res.send(twilioService.generateVoicemailTwiML(orgId))
})

router.use('/', voiceRoutes)

export default router

