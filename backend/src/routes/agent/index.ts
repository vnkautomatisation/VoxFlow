import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { twilioService } from "../../services/twilio/twilio.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)
router.use(authorize("AGENT", "SUPERVISOR", "ADMIN", "OWNER"))

// GET /api/v1/agent/token — Token WebRTC Twilio pour le softphone
router.get("/token", async (req: AuthRequest, res: Response) => {
  try {
    const identity = req.user!.userId
    const orgId    = req.user!.organizationId || "default"
    const token    = await twilioService.generateToken(identity, orgId)
    sendSuccess(res, { token, identity })
  } catch (err: any) {
    // En mode test sans Twilio configure — token simule
    sendSuccess(res, {
      token:     "simulated_token_" + Date.now(),
      identity:  req.user!.userId,
      simulated: true,
    })
  }
})

// PATCH /api/v1/agent/status — Changer statut agent
router.patch("/status", async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body
    const validStatuses = ["ONLINE", "OFFLINE", "BREAK", "BUSY"]
    if (!validStatuses.includes(String(status))) {
      return sendError(res, "Statut invalide", 400)
    }

    await supabaseAdmin
      .from("agents")
      .update({ status: String(status) })
      .eq("user_id", req.user!.userId)

    sendSuccess(res, { status, updated: true })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// GET /api/v1/agent/me — Profil agent
router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, name, email, role, status")
      .eq("id", req.user!.userId)
      .single()

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("status, extension, max_calls")
      .eq("user_id", req.user!.userId)
      .single()

    sendSuccess(res, { ...user, agentStatus: agent?.status || "OFFLINE" })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// GET /api/v1/agent/calls — Historique appels de l agent
router.get("/calls", async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || "20"))

    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("id, from_number, to_number, duration, status, direction, started_at, ended_at, notes, ai_summary")
      .eq("agent_id", req.user!.userId)
      .order("started_at", { ascending: false })
      .limit(limit)

    sendSuccess(res, calls || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// POST /api/v1/agent/calls — Initier un appel sortant
router.post("/calls", async (req: AuthRequest, res: Response) => {
  try {
    const { to, from } = req.body
    if (!to) return sendError(res, "Numero de destination requis", 400)

    // Enregistrer l appel en BDD
    const { data: call } = await supabaseAdmin
      .from("calls")
      .insert({
        twilio_sid:      "out_" + Date.now(),
        from_number:     from || "VoxFlow",
        to_number:       to,
        status:          "RINGING",
        direction:       "OUTBOUND",
        organization_id: req.user!.organizationId || "",
        agent_id:        req.user!.userId,
        started_at:      new Date().toISOString(),
      })
      .select().single()

    sendSuccess(res, { call, message: "Appel initie via softphone WebRTC" }, 201)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// PATCH /api/v1/agent/calls/:id/notes — Ajouter notes post-appel
router.patch("/calls/:id/notes", async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const { notes, tags } = req.body

    const { data } = await supabaseAdmin
      .from("calls")
      .update({ notes, ended_at: new Date().toISOString() })
      .eq("id", callId)
      .eq("agent_id", req.user!.userId)
      .select().single()

    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// GET /api/v1/agent/scripts — Scripts d appel disponibles
router.get("/scripts", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId
    if (!orgId) return sendSuccess(res, [])

    const { data } = await supabaseAdmin
      .from("call_scripts")
      .select("id, name, content, queue_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })

    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// GET /api/v1/agent/contacts — Recherche contacts CRM
router.get("/contacts", async (req: AuthRequest, res: Response) => {
  try {
    const search = String(req.query.search || "")
    const orgId  = req.user!.organizationId
    if (!orgId) return sendSuccess(res, [])

    // Pour l instant on retourne les appels recents comme contacts
    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("from_number, to_number, started_at")
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(50)

    // Deduplication des numeros
    const numbers = new Set<string>()
    const contacts: any[] = []

    for (const call of (calls || [])) {
      const num = call.from_number
      if (!numbers.has(num) && (!search || num.includes(search))) {
        numbers.add(num)
        contacts.push({
          id:          num,
          name:        "Contact " + num,
          phoneNumber: num,
          lastCall:    call.started_at,
        })
      }
    }

    sendSuccess(res, contacts.slice(0, 20))
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
