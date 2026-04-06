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


// GET /api/v1/agent/goals — Objectifs journaliers + stats du jour
router.get("/goals", async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user!.userId
    const orgId   = req.user!.organizationId || ""

    // Objectifs configurés
    const { data: goalRow } = await supabaseAdmin
      .from("agent_goals")
      .select("daily_calls_target, daily_answer_rate, avg_duration_max, daily_talk_time")
      .eq("agent_id", agentId)
      .is("effective_to", null)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single()

    const goals = goalRow || {
      daily_calls_target: 50,
      daily_answer_rate:  80,
      avg_duration_max:   300,
      daily_talk_time:    14400,
    }

    // Stats du jour depuis agent_daily_stats
    const today = new Date().toISOString().slice(0, 10)
    const { data: statsRow } = await supabaseAdmin
      .from("agent_daily_stats")
      .select("total_calls, answered_calls, missed_calls, total_talk_time, avg_call_duration")
      .eq("agent_id", agentId)
      .eq("stat_date", today)
      .single()

    // Fallback : calculer depuis la table calls si pas de stats pré-calculées
    let stats = statsRow
    if (!stats) {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { data: todayCalls } = await supabaseAdmin
        .from("calls")
        .select("status, duration")
        .eq("agent_id", agentId)
        .gte("started_at", startOfDay.toISOString())

      const calls      = todayCalls || []
      const answered   = calls.filter((c: any) => c.status === "COMPLETED")
      const missed     = calls.filter((c: any) => ["NO_ANSWER","MISSED","FAILED"].includes(c.status))
      const talkTime   = answered.reduce((s: number, c: any) => s + (c.duration || 0), 0)
      const avgDur     = answered.length ? Math.round(talkTime / answered.length) : 0

      stats = {
        total_calls:      calls.length,
        answered_calls:   answered.length,
        missed_calls:     missed.length,
        total_talk_time:  talkTime,
        avg_call_duration: avgDur,
      }
    }

    sendSuccess(res, { goals, stats })
  } catch (err: any) {
    // Fallback complet si tables absentes
    sendSuccess(res, {
      goals: { daily_calls_target: 50, daily_answer_rate: 80, avg_duration_max: 300, daily_talk_time: 14400 },
      stats: { total_calls: 0, answered_calls: 0, missed_calls: 0, total_talk_time: 0, avg_call_duration: 0 },
    })
  }
})
export default router

