import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest, resolveOrgId } from "../../middleware/auth"
import { supervisionService } from "../../services/supervision/supervision.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)
router.use(authorize("ADMIN", "OWNER", "OWNER_STAFF" as any, "SUPERVISOR"))

const getOrgId = (req: AuthRequest) => String(req.user?.organizationId || "")

// GET /api/v1/supervision/snapshot -- Snapshot temps réel
// OWNER / OWNER_STAFF peuvent cibler une autre org via ?orgId=X.
router.get("/snapshot", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = resolveOrgId(req)
    sendSuccess(res, await supervisionService.getRealtimeSnapshot(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/supervision/alerts -- Alertes SLA
router.get("/alerts", async (req: AuthRequest, res: Response) => {
  try {
    sendSuccess(res, await supervisionService.getSLAAlerts(getOrgId(req)))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/supervision/agent/:agentId/status -- Forcer statut
router.post("/agent/:agentId/status", async (req: AuthRequest, res: Response) => {
  try {
    const agentId = Array.isArray(req.params.agentId) ? req.params.agentId[0] : req.params.agentId
    const { status } = req.body
    const valid = ["ONLINE", "OFFLINE", "BREAK", "BUSY"]
    if (!valid.includes(status)) return sendError(res, "Statut invalide", 400)
    sendSuccess(res, await supervisionService.forceAgentStatus(agentId, status))
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/supervision/call/:callId/join -- Ecoute/Whisper/Barge
router.post("/call/:callId/join", async (req: AuthRequest, res: Response) => {
  try {
    const callId = Array.isArray(req.params.callId) ? req.params.callId[0] : req.params.callId
    const mode   = req.body.mode || "listen"
    if (!["listen", "whisper", "barge"].includes(mode)) {
      return sendError(res, "Mode invalide", 400)
    }
    sendSuccess(res, await supervisionService.joinCall(callId, req.user!.userId, mode))
  } catch (err: any) { sendError(res, err.message) }
})

// ── Aliases utilisés par le dialer Electron ────────────────────
// Le dialer (frontend/app/dialer/hooks/useDialer.ts) appelle
// POST /supervision/:mode/:agentId au lieu de POST /call/:callId/join
// { mode }. On expose 3 aliases sémantiques qui trouvent le call
// actif courant de l'agent et appellent joinCall() avec le callId.
import { supabaseAdmin } from "../../config/supabase"

async function resolveActiveCallForAgent(agentId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("calls")
    .select("id")
    .eq("agent_id", agentId)
    .in("status", ["RINGING", "IN_PROGRESS", "ANSWERED"])
    .order("started_at", { ascending: false })
    .limit(1)
    .single()
  return data?.id || null
}

async function handleJoin(
  req: AuthRequest,
  res: Response,
  mode: "listen" | "whisper" | "barge"
) {
  try {
    const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const callId  = await resolveActiveCallForAgent(agentId)
    if (!callId) return sendError(res, "Aucun appel actif pour cet agent", 404)
    sendSuccess(res, await supervisionService.joinCall(callId, req.user!.userId, mode))
  } catch (err: any) {
    sendError(res, err.message)
  }
}

router.post("/listen/:id",  (req: AuthRequest, res: Response) => handleJoin(req, res, "listen"))
router.post("/whisper/:id", (req: AuthRequest, res: Response) => handleJoin(req, res, "whisper"))
router.post("/barge/:id",   (req: AuthRequest, res: Response) => handleJoin(req, res, "barge"))

// ── Chat superviseur-agent (migration 036) ─────────────────
// POST /api/v1/supervision/chat/:agentId — envoyer un message
router.post("/chat/:agentId", async (req: AuthRequest, res: Response) => {
  try {
    const agentId = String(req.params.agentId)
    const content = String(req.body?.content || '').trim()
    if (!content) return sendError(res, "Contenu requis", 400)

    const orgId = String(req.user?.organizationId || '')
    const { data, error } = await supabaseAdmin
      .from("supervisor_messages")
      .insert({
        organization_id: orgId,
        from_user_id:    req.user!.userId,
        to_user_id:      agentId,
        call_id:         req.body?.call_id || null,
        content,
      })
      .select().single()
    if (error) throw error
    sendSuccess(res, data, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/supervision/chat/:agentId — lire les messages recents
router.get("/chat/:agentId", async (req: AuthRequest, res: Response) => {
  try {
    const agentId = String(req.params.agentId)
    const limit   = Math.min(parseInt(String(req.query.limit || "20")), 100)
    const { data, error } = await supabaseAdmin
      .from("supervisor_messages")
      .select("id, from_user_id, to_user_id, content, call_id, read_at, created_at")
      .or(`to_user_id.eq.${agentId},from_user_id.eq.${agentId}`)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    sendSuccess(res, (data || []).reverse())
  } catch (err: any) { sendError(res, err.message) }
})

// PATCH /api/v1/supervision/chat/:msgId/read — marquer lu
router.patch("/chat/:msgId/read", async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabaseAdmin
      .from("supervisor_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", req.params.msgId)
      .eq("to_user_id", req.user!.userId)
    if (error) throw error
    sendSuccess(res, { read: true })
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/supervision/log -- Historique
router.get("/log", async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || "20"))
    sendSuccess(res, await supervisionService.getSupervisionLog(getOrgId(req), limit))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
