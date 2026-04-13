import { Router, Response } from "express"
import { authenticate, authorize, AuthRequest } from "../../middleware/auth"
import { adminService } from "../../services/admin/admin.service"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
router.use(authenticate)
// Accès au portail admin: ADMIN + SUPERVISOR de leur org. OWNER et
// OWNER_STAFF peuvent aussi accéder mais voient uniquement LEUR PROPRE
// organisation (l'org VNK interne). Pour gérer un client, l'OWNER doit
// passer par /api/v1/owner/organizations (routes séparées avec auth own).
router.use(authorize("ADMIN", "SUPERVISOR", "OWNER", "OWNER_STAFF" as any))

/**
 * Récupère l'organizationId strictement depuis le JWT décodé.
 * Plus de fallback sur req.query.orgId — ça créait une faille potentielle
 * où un attaquant pouvait tenter de passer ?orgId=OTHER_ORG pour accéder
 * aux données d'une autre organisation. La source de vérité est le JWT
 * signé, qui contient l'organization_id liée au user authentifié.
 */
const getOrgId = (req: AuthRequest): string => {
  return String(req.user?.organizationId || "")
}

// Stats
router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await adminService.getDashboardStats(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── AGENTS ────────────────────────────────────────────────────
router.get("/agents", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    sendSuccess(res, await adminService.getAgents(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/agents", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    if (!orgId) return sendError(res, "Organisation requise", 400)
    const { name, email, password, role, extension } = req.body
    if (!name || !email || !password) return sendError(res, "Nom, email et mot de passe requis", 400)
    sendSuccess(res, await adminService.createAgent(orgId, { name, email, password, role, extension }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/agents/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateAgent(agentId, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/agents/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const agentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteAgent(agentId, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── QUEUES ────────────────────────────────────────────────────
router.get("/queues", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await adminService.getQueues(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/queues", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, description, strategy, maxWaitTime, welcomeMessage } = req.body
    if (!name) return sendError(res, "Nom de file requis", 400)
    sendSuccess(res, await adminService.createQueue(orgId, { name, description, strategy, maxWaitTime, welcomeMessage }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/queues/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const queueId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateQueue(queueId, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/queues/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId   = getOrgId(req)
    const queueId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteQueue(queueId, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── QUEUE AGENTS ─────────────────────────────────────────────
router.post("/queues/:id/agents", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const queueId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const { agentId, skillLevel } = req.body
    if (!agentId) return sendError(res, "agentId requis", 400)
    const { data, error } = await (await import("../../config/supabase")).supabaseAdmin
      .from("queue_agents").upsert({ queue_id: queueId, agent_id: agentId, skill_level: skillLevel || 1, organization_id: orgId }, { onConflict: "queue_id,agent_id" }).select().single()
    if (error) throw error
    sendSuccess(res, data, 201)
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/queues/:queueId/agents/:agentId", async (req: AuthRequest, res: Response) => {
  try {
    const { queueId, agentId } = req.params
    const { error } = await (await import("../../config/supabase")).supabaseAdmin
      .from("queue_agents").delete().eq("queue_id", queueId).eq("agent_id", agentId)
    if (error) throw error
    sendSuccess(res, { removed: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── IVR ───────────────────────────────────────────────────────
router.get("/ivr", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await adminService.getIVRConfigs(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/ivr", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, welcomeMessage, nodes } = req.body
    if (!name) return sendError(res, "Nom IVR requis", 400)
    sendSuccess(res, await adminService.createIVR(orgId, { name, welcomeMessage, nodes }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/ivr/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const ivrId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateIVR(ivrId, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/ivr/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const ivrId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteIVR(ivrId, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/ivr/:id/compile", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const ivrId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const ivrList = await adminService.getIVRConfigs(orgId)
    const ivr = Array.isArray(ivrList) ? ivrList.find((i: any) => i.id === ivrId) : null
    if (!ivr) return sendError(res, "IVR introuvable", 404)

    const flow = ivr.flow_json || {}
    const nodes = flow.nodes || ivr.nodes || []
    const edges = flow.edges || []

    // Compiler les nodes en TwiML
    let twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n'

    const welcomeNode = nodes.find((n: any) => n.type === 'welcome' || n.data?.type === 'welcome')
    if (welcomeNode) {
      const msg = welcomeNode.data?.message || ivr.welcome_message || 'Bienvenue'
      twiml += `  <Say language="fr-CA" voice="Polly.Lea">${msg}</Say>\n`
    } else if (ivr.welcome_message) {
      twiml += `  <Say language="fr-CA" voice="Polly.Lea">${ivr.welcome_message}</Say>\n`
    }

    const menuNodes = nodes.filter((n: any) => n.type === 'menu' || n.data?.type === 'menu')
    if (menuNodes.length > 0) {
      twiml += `  <Gather input="dtmf" numDigits="1" timeout="${ivr.timeout || 5}" action="/api/v1/telephony/voice/ivr-gather/${ivrId}">\n`
      const menuMsg = menuNodes.map((n: any) => {
        const digit = n.data?.digit || n.digit || '?'
        const label = n.data?.label || n.label || ''
        return `Pour ${label}, appuyez sur ${digit}.`
      }).join(' ')
      twiml += `    <Say language="fr-CA" voice="Polly.Lea">${menuMsg}</Say>\n`
      twiml += `  </Gather>\n`
      twiml += `  <Say language="fr-CA" voice="Polly.Lea">Nous n'avons pas recu votre choix.</Say>\n`
      twiml += `  <Redirect>/api/v1/telephony/voice/ivr/${ivrId}</Redirect>\n`
    }

    const queueNodes = nodes.filter((n: any) => n.type === 'queue' || n.data?.type === 'queue')
    if (queueNodes.length > 0 && menuNodes.length === 0) {
      const qId = queueNodes[0].data?.queueId || queueNodes[0].data?.target || ''
      twiml += `  <Enqueue>${qId}</Enqueue>\n`
    }

    const hangupNode = nodes.find((n: any) => n.type === 'hangup' || n.data?.type === 'hangup')
    if (hangupNode || nodes.length === 0) {
      twiml += `  <Hangup />\n`
    }

    twiml += '</Response>'

    sendSuccess(res, { twiml, nodesCount: nodes.length, edgesCount: edges.length })
  } catch (err: any) { sendError(res, err.message) }
})

// ── AUDIO / MUSIQUE D ATTENTE ─────────────────────────────────
router.get("/audio", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await adminService.getAudioFiles(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/audio", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, url, type, duration } = req.body
    if (!name || !url) return sendError(res, "Nom et URL requis", 400)
    sendSuccess(res, await adminService.createAudioFile(orgId, { name, url, type, duration }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

router.patch("/audio/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateAudioFile(id, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/audio/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteAudioFile(id, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

// ── SCRIPTS ───────────────────────────────────────────────────
router.get("/scripts", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    sendSuccess(res, await adminService.getScripts(orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.patch("/scripts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.updateScript(id, orgId, req.body))
  } catch (err: any) { sendError(res, err.message) }
})

router.delete("/scripts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    sendSuccess(res, await adminService.deleteScript(id, orgId))
  } catch (err: any) { sendError(res, err.message) }
})

router.post("/scripts", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, content, queueId } = req.body
    if (!name || !content) return sendError(res, "Nom et contenu requis", 400)
    sendSuccess(res, await adminService.createScript(orgId, { name, content, queueId }), 201)
  } catch (err: any) { sendError(res, err.message, 400) }
})

// ── RAPPORTS ──────────────────────────────────────────────────
router.get("/reports", async (req: AuthRequest, res: Response) => {
  try {
    const orgId  = getOrgId(req)
    const period = String(req.query.period || "30d")
    sendSuccess(res, await adminService.getReports(orgId, period))
  } catch (err: any) { sendError(res, err.message) }
})

export default router
