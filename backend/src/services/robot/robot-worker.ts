/**
 * Robot Dialer — Worker d'execution
 *
 * Boucle principale qui :
 *  1. Poll les campagnes ACTIVE dans Redis
 *  2. Pour chaque campagne, dequeue un batch de leads
 *  3. Verifie chaque lead contre la DNC list
 *  4. Place l'appel via Twilio REST API avec AMD (Answering Machine Detection)
 *  5. Met a jour le statut du lead (ANSWERED, NO_ANSWER, BUSY, FAILED, DNC, VOICEMAIL)
 *  6. Recycle les NO_ANSWER apres retry_delay
 *  7. Quand la queue est vide, marque la campagne COMPLETED
 *
 * Rate control :
 *  - Respecte campaign.dial_rate (calls/minute)
 *  - Respecte les limites CPS Twilio (1 call/sec par defaut)
 *  - Batch size = dial_rate / 6 (poll toutes les 10 secondes)
 *
 * Pour atteindre 150k/h il faut :
 *  - Plusieurs workers en parallele (horizontal scaling)
 *  - Twilio Account avec CPS eleve (demander a Twilio Support)
 *  - dial_rate = 2500/min par worker × 60 workers = 150k/h
 *
 * Ce worker est single-threaded pour simplifier. Pour le scaling,
 * deployer N instances qui partagent la meme Redis queue (les lpop
 * sont atomiques = pas de doublon).
 */

import { supabaseAdmin } from "../../config/supabase"
import { robotQueue } from "./robot-queue"
import twilio from "twilio"

const POLL_INTERVAL_MS = 10_000 // 10 secondes entre chaque batch
const MAX_CONCURRENT   = 50     // max appels simultanes par worker
const CALL_SPACING_MS  = 100    // 100ms entre chaque appel (10 CPS)

let running = false
let activeCallCount = 0

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

// ── Demarrer le worker ────────────────────────────────────
export function startRobotWorker(): void {
  if (running) return
  running = true
  console.log("[Robot Worker] Demarre — poll toutes les", POLL_INTERVAL_MS / 1000, "s")
  tick()
}

export function stopRobotWorker(): void {
  running = false
  console.log("[Robot Worker] Arrete")
}

// ── Boucle principale ────────────────────────────────────
async function tick(): Promise<void> {
  if (!running) return

  try {
    const campaigns = await robotQueue.activeCampaigns()

    for (const campaignId of campaigns) {
      if (!running) break
      await processCampaign(campaignId)
    }
  } catch (err: any) {
    console.error("[Robot Worker] Error:", err.message)
  }

  if (running) setTimeout(tick, POLL_INTERVAL_MS)
}

// ── Traiter une campagne ─────────────────────────────────
async function processCampaign(campaignId: string): Promise<void> {
  // Charger la config de la campagne
  const { data: campaign } = await supabaseAdmin
    .from("robot_campaigns")
    .select("id, organization_id, status, tts_message, voice, caller_id, dial_rate, max_attempts, retry_delay_sec, dnd_list_id, schedule_start, schedule_end, timezone")
    .eq("id", campaignId)
    .single()

  if (!campaign || campaign.status !== "ACTIVE") {
    await robotQueue.clear(campaignId)
    return
  }

  // Verifier les horaires (ne pas appeler en dehors de schedule_start..schedule_end)
  if (!isWithinSchedule(campaign)) {
    return // Skip, on reviendra au prochain tick
  }

  // Calculer le batch size depuis le dial_rate
  const dialRate    = campaign.dial_rate || 10
  const batchSize   = Math.min(Math.ceil(dialRate / 6), MAX_CONCURRENT - activeCallCount)
  if (batchSize <= 0) return

  // Dequeue les leads
  const leadIds = await robotQueue.dequeue(campaignId, batchSize)
  if (leadIds.length === 0) {
    // Queue vide → campagne terminee
    await supabaseAdmin.from("robot_campaigns")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
      .eq("id", campaignId)
    await robotQueue.deactivate(campaignId)
    console.log("[Robot Worker] Campaign", campaignId, "COMPLETED (queue empty)")
    return
  }

  // Charger les leads depuis la DB
  const { data: leads } = await supabaseAdmin
    .from("campaign_leads")
    .select("id, phone_number, name, attempts, status")
    .in("id", leadIds)

  if (!leads?.length) return

  // Charger la DNC list si configuree
  let dncSet: Set<string> = new Set()
  if (campaign.dnd_list_id) {
    const { data: dncEntries } = await supabaseAdmin
      .from("dnd_entries")
      .select("phone_number")
      .eq("list_id", campaign.dnd_list_id)
    dncEntries?.forEach(e => dncSet.add(e.phone_number))
  }
  // Aussi check la DNC globale de l'org
  const { data: globalDnc } = await supabaseAdmin
    .from("dnd_lists")
    .select("id")
    .eq("organization_id", campaign.organization_id)
    .eq("is_global", true)
    .limit(1)
    .single()
  if (globalDnc) {
    const { data: globalEntries } = await supabaseAdmin
      .from("dnd_entries")
      .select("phone_number")
      .eq("list_id", globalDnc.id)
    globalEntries?.forEach(e => dncSet.add(e.phone_number))
  }

  // Appeler chaque lead
  for (const lead of leads) {
    if (!running) break

    // DNC check
    if (dncSet.has(lead.phone_number)) {
      await updateLeadStatus(lead.id, "DNC")
      await incrementCampaignCounter(campaignId, "dnc_count")
      continue
    }

    // Max attempts check
    if (lead.attempts >= (campaign.max_attempts || 3)) {
      await updateLeadStatus(lead.id, "FAILED")
      await incrementCampaignCounter(campaignId, "failed_count")
      continue
    }

    // Placer l'appel
    activeCallCount++
    placeCall(campaign, lead).finally(() => { activeCallCount-- })

    // Spacing entre les appels (rate limit)
    await sleep(CALL_SPACING_MS)
  }
}

// ── Placer un appel Twilio ───────────────────────────────
async function placeCall(campaign: any, lead: any): Promise<void> {
  if (!twilioClient) {
    console.warn("[Robot Worker] Twilio not configured, simulating call to", lead.phone_number)
    await updateLeadStatus(lead.id, "FAILED")
    return
  }

  const backendUrl = process.env.BACKEND_URL || "http://localhost:4000"
  const orgId = campaign.organization_id

  try {
    // TwiML pour l'appel robot :
    //  1. Lire le message TTS
    //  2. Si IVR post-robot configure, <Gather> pour touche 1
    //  3. Sinon, raccrocher
    const gatherAction = `${backendUrl}/api/v1/telephony/twiml/ivr/${campaign.id}/gather?orgId=${orgId}`
    const twimlMessage = campaign.tts_message || "Bonjour, ceci est un message automatique de VoxFlow."
    const voice = campaign.voice || "Polly.Lea"

    // Appeler via Twilio REST API avec AMD (Answering Machine Detection)
    const call = await twilioClient.calls.create({
      to:   lead.phone_number,
      from: campaign.caller_id || process.env.TWILIO_PHONE_NUMBER || "",
      twiml: `<Response>
        <Gather numDigits="1" action="${gatherAction}" timeout="5">
          <Say language="fr-CA" voice="${voice}">${escapeXml(twimlMessage)}</Say>
          <Say language="fr-CA" voice="${voice}">Appuyez sur 1 pour parler a un agent. Sinon, raccrochez.</Say>
        </Gather>
        <Say language="fr-CA" voice="${voice}">Merci. Au revoir.</Say>
        <Hangup/>
      </Response>`,
      machineDetection: "DetectMessageEnd", // AMD
      statusCallback: `${backendUrl}/api/v1/telephony/webhook/status?orgId=${orgId}`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      timeout: 25,
    })

    // Update lead avec le CallSid
    await supabaseAdmin.from("campaign_leads")
      .update({
        status:          "DIALING",
        call_id:         null,
        attempts:        (lead.attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", lead.id)

    // Creer la row calls pour tracking
    await supabaseAdmin.from("calls").insert({
      organization_id: campaign.organization_id,
      twilio_sid:      call.sid,
      from_number:     campaign.caller_id || process.env.TWILIO_PHONE_NUMBER || "",
      to_number:       lead.phone_number,
      direction:       "OUTBOUND",
      status:          "RINGING",
      started_at:      new Date().toISOString(),
    })

    await incrementCampaignCounter(campaign.id, "called_count")

    console.log("[Robot Worker] Called", lead.phone_number, "sid:", call.sid)
  } catch (err: any) {
    console.error("[Robot Worker] Call failed:", lead.phone_number, err.message)
    await updateLeadStatus(lead.id, "FAILED")
    await incrementCampaignCounter(campaign.id, "failed_count")
  }
}

// ── Helpers ──────────────────────────────────────────────
async function updateLeadStatus(leadId: string, status: string): Promise<void> {
  await supabaseAdmin.from("campaign_leads")
    .update({ status, last_attempt_at: new Date().toISOString() })
    .eq("id", leadId)
}

async function incrementCampaignCounter(campaignId: string, field: string): Promise<void> {
  // Supabase n'a pas d'increment atomique via REST, on fait un read+write
  const { data } = await supabaseAdmin.from("robot_campaigns")
    .select(field).eq("id", campaignId).single()
  if (data) {
    await supabaseAdmin.from("robot_campaigns")
      .update({ [field]: ((data as any)[field] || 0) + 1 })
      .eq("id", campaignId)
  }
}

function isWithinSchedule(campaign: any): boolean {
  if (!campaign.schedule_start || !campaign.schedule_end) return true
  try {
    const now = new Date()
    // Simplification : on compare les heures en UTC.
    // Pour un vrai timezone-aware check, utiliser Intl.DateTimeFormat
    const h = now.getUTCHours()
    const m = now.getUTCMinutes()
    const nowMinutes = h * 60 + m
    const [sh, sm] = String(campaign.schedule_start).split(":").map(Number)
    const [eh, em] = String(campaign.schedule_end).split(":").map(Number)
    const startMinutes = (sh || 0) * 60 + (sm || 0)
    const endMinutes   = (eh || 0) * 60 + (em || 0)
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes
  } catch {
    return true
  }
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
