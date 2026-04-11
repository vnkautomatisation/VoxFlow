import { Router, Response } from "express"
import { AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

// ══════════════════════════════════════════════════════════════
//  /api/v1/client/robot — robot dialer + leads (migration 032)
//
//  Endpoints :
//   GET    /                      → liste des campagnes
//   POST   /                      → cree une campagne
//   GET    /:id                   → detail + stats (v_campaign_progress)
//   PATCH  /:id                   → update (name, tts_message, voice, schedule)
//   DELETE /:id                   → supprime
//   POST   /:id/launch            → status PAUSED → ACTIVE
//   POST   /:id/pause             → status ACTIVE → PAUSED
//   GET    /:id/leads             → liste des leads
//   POST   /:id/leads/import      → import CSV (JSON array dans le body)
//   GET    /:id/stats             → analytics (alias v_campaign_progress)
// ══════════════════════════════════════════════════════════════

const router = Router()

function getOrgId(req: AuthRequest): string {
  const orgId = req.user?.organizationId
  if (!orgId) throw new Error("Organisation introuvable")
  return String(orgId)
}

async function ensureCampaignOwnership(campaignId: string, orgId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("robot_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("organization_id", orgId)
    .single()
  return !!data
}

// ── GET / ────────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data, error } = await supabaseAdmin
      .from("robot_campaigns")
      .select("id, name, status, tts_message, voice, caller_id, total_contacts, called_count, answered_count, failed_count, dnc_count, created_at, updated_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
    if (error) throw error
    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST / ───────────────────────────────────────────────────
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const userId = String(req.user?.userId || "")
    const {
      name, tts_message, voice, caller_id,
      script_id, dial_rate, schedule_start, schedule_end, timezone,
      max_attempts, retry_delay_sec, dnd_list_id,
    } = req.body as Record<string, unknown>

    if (!name) return sendError(res, "name requis", 400)

    const { data, error } = await supabaseAdmin
      .from("robot_campaigns")
      .insert({
        organization_id: orgId,
        name,
        status:          "PAUSED",
        tts_message:     String(tts_message || ""),
        voice:           voice      || "female_fr",
        caller_id:       caller_id  || null,
        script_id:       script_id  || null,
        dial_rate:       dial_rate       ?? 10,
        schedule_start:  schedule_start  || "09:00:00",
        schedule_end:    schedule_end    || "20:00:00",
        timezone:        timezone        || "America/Montreal",
        max_attempts:    max_attempts    ?? 3,
        retry_delay_sec: retry_delay_sec ?? 3600,
        dnd_list_id:     dnd_list_id     || null,
        created_by:      userId          || null,
      })
      .select().single()
    if (error) throw error
    sendSuccess(res, data, 201)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── GET /:id ─────────────────────────────────────────────────
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const { data, error } = await supabaseAdmin
      .from("robot_campaigns")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single()
    if (error || !data) return sendError(res, "Campagne introuvable", 404)
    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── PATCH /:id ───────────────────────────────────────────────
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const updates: Record<string, unknown> = {}
    const fields = [
      "name", "tts_message", "voice", "caller_id", "script_id",
      "dial_rate", "schedule_start", "schedule_end", "timezone",
      "max_attempts", "retry_delay_sec", "dnd_list_id",
    ]
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })

    if (Object.keys(updates).length === 0) {
      return sendError(res, "Aucun champ a mettre a jour", 400)
    }

    const { data, error } = await supabaseAdmin
      .from("robot_campaigns")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select().single()
    if (error) throw error
    if (!data) return sendError(res, "Campagne introuvable", 404)
    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── DELETE /:id ──────────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const { error } = await supabaseAdmin
      .from("robot_campaigns")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId)
    if (error) throw error
    sendSuccess(res, { deleted: true })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST /:id/launch ─────────────────────────────────────────
router.post("/:id/launch", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    if (!await ensureCampaignOwnership(id, orgId)) {
      return sendError(res, "Campagne introuvable", 404)
    }

    const { data, error } = await supabaseAdmin
      .from("robot_campaigns")
      .update({ status: "ACTIVE", started_at: new Date().toISOString() })
      .eq("id", id)
      .select().single()
    if (error) throw error
    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST /:id/pause ──────────────────────────────────────────
router.post("/:id/pause", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    if (!await ensureCampaignOwnership(id, orgId)) {
      return sendError(res, "Campagne introuvable", 404)
    }

    const { data, error } = await supabaseAdmin
      .from("robot_campaigns")
      .update({ status: "PAUSED" })
      .eq("id", id)
      .select().single()
    if (error) throw error
    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── GET /:id/leads ───────────────────────────────────────────
router.get("/:id/leads", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    if (!await ensureCampaignOwnership(id, orgId)) {
      return sendError(res, "Campagne introuvable", 404)
    }

    const limit  = Math.min(parseInt(String(req.query.limit  || "100")), 500)
    const offset = parseInt(String(req.query.offset || "0"))
    const status = req.query.status ? String(req.query.status) : null

    let query = supabaseAdmin
      .from("campaign_leads")
      .select("id, phone_number, name, status, attempts, last_attempt_at, next_retry_at, keypress, notes, tags, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)
    if (status) query = query.eq("status", status)

    const { data, error } = await query
    if (error) throw error
    sendSuccess(res, data || [])
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── POST /:id/leads/import ───────────────────────────────────
// Body : { leads: [{ phone_number, name?, tags? }, ...] }
// Pas de CSV parsing cote backend — le frontend parse le CSV et envoie
// un array JSON. Insert en batch avec upsert pour idempotence.
router.post("/:id/leads/import", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    if (!await ensureCampaignOwnership(id, orgId)) {
      return sendError(res, "Campagne introuvable", 404)
    }

    const leads = Array.isArray(req.body?.leads) ? req.body.leads : null
    if (!leads || leads.length === 0) return sendError(res, "leads requis", 400)
    if (leads.length > 10000) return sendError(res, "Maximum 10000 leads par import", 400)

    const rows = leads.map((l: any) => ({
      campaign_id:   id,
      phone_number:  String(l.phone_number || l.phone || "").trim(),
      name:          l.name    || null,
      tags:          Array.isArray(l.tags) ? l.tags : [],
      status:        "PENDING",
    })).filter((r: any) => r.phone_number)

    if (rows.length === 0) return sendError(res, "Aucun numero valide", 400)

    const { data, error } = await supabaseAdmin
      .from("campaign_leads")
      .insert(rows)
      .select("id")
    if (error) throw error

    // Update total_contacts sur la campagne
    await supabaseAdmin
      .from("robot_campaigns")
      .update({ total_contacts: rows.length })
      .eq("id", id)

    sendSuccess(res, { imported: data?.length || 0 })
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// ── GET /:id/stats — alias v_campaign_progress ───────────────
router.get("/:id/stats", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const { data, error } = await supabaseAdmin
      .from("v_campaign_progress")
      .select("*")
      .eq("campaign_id", id)
      .eq("organization_id", orgId)
      .single()
    if (error || !data) return sendError(res, "Campagne introuvable", 404)
    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
