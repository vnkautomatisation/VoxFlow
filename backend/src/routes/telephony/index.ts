import { Router, Request, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { twilioService } from "../../services/twilio/twilio.service"
import { crmService } from "../../services/crm/crm.service"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
const getOrgId = (req: AuthRequest) => req.user?.organizationId || String(req.query.orgId || "")

// ══════════════════════════════════════════════════════════════
//  TOKEN WEBRTC — pour le softphone navigateur
// ══════════════════════════════════════════════════════════════

router.get("/token", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const identity = req.user!.userId
    const orgId    = getOrgId(req)
    const token    = await twilioService.generateToken(identity, orgId)
    sendSuccess(res, { token, identity, configured: true })
  } catch (err: any) {
    // Fallback mode demo si Twilio pas encore configure
    sendSuccess(res, {
      token:      "demo_" + Date.now(),
      identity:   req.user!.userId,
      configured: false,
      message:    err.message,
    })
  }
})

// ══════════════════════════════════════════════════════════════
//  APPEL SORTANT
// ══════════════════════════════════════════════════════════════

router.post("/call/outbound", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, contactId, fromNumber } = req.body
    const orgId = getOrgId(req)
    if (!to) return sendError(res, "Numero destination requis", 400)
    console.log("[VoxFlow Outbound] Appel vers:", to, "| Org:", orgId)

    // Lookup CRM
    let contact = null
    if (contactId) {
      const { data } = await supabaseAdmin.from("contacts").select("*").eq("id", contactId).single()
      contact = data
    } else {
      contact = await crmService.findByPhone(to, orgId)
    }

    const baseUrl = process.env.BACKEND_URL || "http://localhost:4000"

    // Creer l appel en BDD
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

    // Si Twilio configure, initier le vrai appel
    try {
      console.log("[VoxFlow] Initiation appel Twilio vers:", to)
      const twilioCall = await twilioService.makeOutboundCall({
        to,
        from:        fromNumber || process.env.TWILIO_PHONE_NUMBER || "",
        callbackUrl: `${baseUrl}/api/v1/telephony/webhook/answer`,
        statusUrl:   `${baseUrl}/api/v1/telephony/webhook/status`,
      })

      // Mettre a jour avec le SID Twilio
      await supabaseAdmin.from("calls").update({ twilio_sid: twilioCall.sid }).eq("id", (call as any).id)

    } catch (twilioErr) {
      console.log("Mode demo - Twilio non configure:", (twilioErr as any).message)
    }

    sendSuccess(res, { call, contact }, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// ══════════════════════════════════════════════════════════════
//  MUTE / HOLD / TRANSFERT
// ══════════════════════════════════════════════════════════════

router.patch("/call/:callId/mute", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { mute, twilioSid } = req.body
    if (twilioSid) {
      sendSuccess(res, await twilioService.muteCall(twilioSid, mute))
    } else {
      sendSuccess(res, { muted: mute, simulated: true })
    }
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:callId/hold", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { hold, twilioSid } = req.body
    if (twilioSid) {
      sendSuccess(res, await twilioService.holdCall(twilioSid, hold))
    } else {
      sendSuccess(res, { onHold: hold, simulated: true })
    }
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/call/:callId/transfer", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { to, type, twilioSid } = req.body
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    if (!to) return sendError(res, "Destination requise", 400)

    if (twilioSid) {
      sendSuccess(res, await twilioService.transferCall({ callSid: twilioSid, to, type: type || "blind" }))
    } else {
      sendSuccess(res, { transferred: true, to, type: type || "blind", simulated: true })
    }
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:callId/end", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId    = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { duration, notes, twilioSid } = req.body

    await supabaseAdmin.from("calls").update({
      status:   "COMPLETED",
      duration: duration || 0,
      notes:    notes || null,
      ended_at: new Date().toISOString(),
    }).eq("id", callId)

    // Raccrocher le vrai appel Twilio
    if (twilioSid) {
      try {
        const client = (await import("twilio")).default
        const c = client(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
        await c.calls(twilioSid).update({ status: "completed" })
      } catch {}
    }

    sendSuccess(res, { ended: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ══════════════════════════════════════════════════════════════
//  CONFERENCE 3 VOIES
// ══════════════════════════════════════════════════════════════

router.post("/call/:callId/conference", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { participant } = req.body
    sendSuccess(res, await twilioService.addParticipantToConference({
      conferenceName:   "conf-" + req.params.callId,
      participantPhone: participant,
    }))
  } catch (err: any) {
    sendSuccess(res, { conference: true, participant: req.body.participant, simulated: true })
  }
})

// ══════════════════════════════════════════════════════════════
//  SUPERVISION (listen/whisper/barge)
// ══════════════════════════════════════════════════════════════

router.post("/call/:callId/supervise", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { mode, twilioSid } = req.body

    // Recuperer le vrai SID si pas fourni
    let actualSid = twilioSid
    if (!actualSid) {
      const { data } = await supabaseAdmin.from("calls").select("twilio_sid").eq("id", callId).single()
      actualSid = (data as any)?.twilio_sid
    }

    if (actualSid) {
      sendSuccess(res, await twilioService.joinCallAsSupervisor({
        callSid:      actualSid,
        supervisorId: req.user!.userId,
        mode:         mode || "listen",
      }))
    } else {
      sendSuccess(res, { mode, simulated: true, message: "SID Twilio requis pour supervision reelle" })
    }
  } catch (err: any) {
    sendSuccess(res, { mode: req.body.mode, simulated: true, message: err.message })
  }
})

// ══════════════════════════════════════════════════════════════
//  ENREGISTREMENTS
// ══════════════════════════════════════════════════════════════

router.get("/call/:callId/recordings", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const { data } = await supabaseAdmin.from("calls").select("twilio_sid").eq("id", callId).single()
    const twilioSid = (data as any)?.twilio_sid

    if (!twilioSid) return sendSuccess(res, [])
    sendSuccess(res, await twilioService.getRecordings(twilioSid))
  } catch (err: any) { sendError(res, err.message) }
})

// ══════════════════════════════════════════════════════════════
//  NUMEROS DID
// ══════════════════════════════════════════════════════════════

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
    const orgId = getOrgId(req)
    if (!phoneNumber) return sendError(res, "Numero requis", 400)
    sendSuccess(res, await twilioService.purchasePhoneNumber(phoneNumber, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ══════════════════════════════════════════════════════════════
//  WEBHOOK VOIX ENTRANT — Twilio appelle cette URL
// ══════════════════════════════════════════════════════════════

router.post("/webhook/voice", async (req: Request, res: Response) => {
  try {
    const { From, To, CallSid } = req.body
    const orgId = String(req.query.orgId || "")

    console.log(`[Twilio] Appel entrant: ${From} -> ${To} | SID: ${CallSid}`)

    // Creer l appel en BDD
    let contact = null
    if (orgId && From) {
      try {
        contact = await crmService.findByPhone(From, orgId)
      } catch {}
    }

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

    // Trouver un agent disponible
    let agentIdentity = "agent-default"
    if (orgId) {
      const { data: agents } = await supabaseAdmin
        .from("agents")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("status", "ONLINE")
        .limit(1)

      if (agents?.length) {
        agentIdentity = agents[0].user_id
      }
    }

    const twiml = twilioService.generateIncomingTwiML({ agentIdentity })
    res.set("Content-Type", "text/xml")
    res.send(twiml)
  } catch (err: any) {
    console.error("Webhook voice error:", err)
    res.set("Content-Type", "text/xml")
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-CA" voice="alice">Une erreur s est produite. Veuillez rappeler.</Say>
</Response>`)
  }
})

// ══════════════════════════════════════════════════════════════
//  WEBHOOK STATUS — Twilio met a jour le statut
// ══════════════════════════════════════════════════════════════

router.post("/webhook/status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration, RecordingUrl, RecordingSid } = req.body

    if (!CallSid) return res.json({ received: true })

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

    const update: any = {
      status:   statusMap[CallStatus] || CallStatus?.toUpperCase(),
      duration: parseInt(CallDuration || "0"),
    }

    if (["completed","failed","busy","no-answer","canceled"].includes(CallStatus)) {
      update.ended_at = new Date().toISOString()
    }

    if (RecordingUrl) {
      update.recording_url = RecordingUrl
    }

    await supabaseAdmin.from("calls")
      .update(update)
      .eq("twilio_sid", CallSid)

    // Lancer transcription si enregistrement disponible
    if (RecordingUrl && RecordingSid) {
      const { data: call } = await supabaseAdmin.from("calls")
        .select("id").eq("twilio_sid", CallSid).single()

      if (call) {
        // Transcription en arriere-plan
        twilioService.transcribeAudio(RecordingUrl + ".mp3", (call as any).id)
          .catch((e: any) => console.error("Transcription error:", e))
      }
    }

    res.json({ received: true })
  } catch (err: any) {
    console.error("Webhook status error:", err)
    res.json({ received: true })
  }
})

// ══════════════════════════════════════════════════════════════
//  WEBHOOK VOICEMAIL
// ══════════════════════════════════════════════════════════════

router.post("/webhook/voicemail", async (req: Request, res: Response) => {
  try {
    const { CallSid, RecordingUrl, From, To } = req.body
    const orgId = String(req.query.orgId || "")

    console.log(`[Twilio] Voicemail: ${From} | Recording: ${RecordingUrl}`)

    // Sauvegarder le voicemail
    supabaseAdmin.from("voicemails").insert({
      organization_id: orgId,
      twilio_sid:      CallSid,
      from_number:     From,
      to_number:       To,
      recording_url:   RecordingUrl,
      status:          "NEW",
      created_at:      new Date().toISOString(),
    }).then(() => {})

    // Transcription du voicemail
    if (RecordingUrl && orgId) {
      twilioService.transcribeAudio(RecordingUrl + ".mp3", "voicemail-" + CallSid)
        .catch((e: any) => console.error("Voicemail transcription error:", e))
    }

    res.set("Content-Type", "text/xml")
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`)
  } catch (err: any) {
    console.error("Voicemail webhook error:", err)
    res.set("Content-Type", "text/xml")
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`)
  }
})

// ══════════════════════════════════════════════════════════════
//  TWIML DYNAMIQUES
// ══════════════════════════════════════════════════════════════

router.get("/twiml/hold-music", (req: Request, res: Response) => {
  res.set("Content-Type", "text/xml")
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play loop="0">http://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.mp3</Play>
</Response>`)
})

router.get("/twiml/conference/:name", (req: Request, res: Response) => {
  const name     = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name
  const isSup    = req.query.supervisor === "true"
  const twiml    = twilioService.generateConferenceTwiML(name, isSup)
  res.set("Content-Type", "text/xml")
  res.send(twiml)
})

router.get("/twiml/voicemail", (req: Request, res: Response) => {
  const orgId = String(req.query.orgId || "")
  const twiml = twilioService.generateVoicemailTwiML(orgId)
  res.set("Content-Type", "text/xml")
  res.send(twiml)
})

// ══════════════════════════════════════════════════════════════
//  LOOKUP CRM par numero (pour popup appel entrant)
// ══════════════════════════════════════════════════════════════

router.get("/lookup/:phone", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const phone = decodeURIComponent(Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone)
    const orgId = getOrgId(req)
    const contact = await crmService.findByPhone(phone, orgId)
    sendSuccess(res, { contact })
  } catch (err: any) { sendError(res, err.message) }
})

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE APPELS + NOTES
// ══════════════════════════════════════════════════════════════

router.get("/calls", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit  = parseInt(String(req.query.limit || "30"))
    const orgId  = getOrgId(req)
    const isAgent = req.user!.role === "AGENT"

    let query = supabaseAdmin
      .from("calls")
      .select(`
        id, from_number, to_number, direction, status, duration,
        started_at, ended_at, notes, transcription, recording_url,
        quality_score, twilio_sid,
        contact:contacts(id, first_name, last_name, company, phone)
      `)
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(limit)

    if (isAgent) {
      query = query.eq("agent_id", req.user!.userId)
    }

    const { data } = await query
    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:callId/notes", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    await supabaseAdmin.from("calls")
      .update({ notes: req.body.notes })
      .eq("id", callId)
    sendSuccess(res, { saved: true })
  } catch (err: any) { sendError(res, err.message) }
})

// Statut agent
router.patch("/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await supabaseAdmin.from("agents")
      .update({ status: req.body.status })
      .eq("user_id", req.user!.userId)
    sendSuccess(res, { status: req.body.status })
  } catch (err: any) { sendError(res, err.message) }
})

export default router






