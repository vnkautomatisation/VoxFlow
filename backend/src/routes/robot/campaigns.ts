import { Router, Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticate, AuthRequest } from '../../middleware/auth'
import { sendSuccess, sendError } from '../../utils/response'
import { trackRobotMinutes } from '../billing/robot'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let twilioClient: any = null
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio')
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
} catch {}

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!orgId) throw new Error('Organisation introuvable')
  return String(orgId)
}

// ── Middleware: require active robot ──────────────────────
async function requireRobotActive(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).user?.role
  if (role === 'OWNER' || role === 'OWNER_STAFF') return next()
  const orgId = getOrgId(req)
  // Check subscription
  const { data: sub } = await supabase.from('org_robot_subscriptions')
    .select('id').eq('organization_id', orgId).in('status', ['active', 'trialing']).maybeSingle()
  if (sub) return next()
  // Check credits balance
  const { data: credits } = await supabase.from('robot_credits')
    .select('minutes_remaining').eq('organization_id', orgId).eq('status', 'active')
    .gt('expires_at', new Date().toISOString()).gt('minutes_remaining', 0).limit(1).maybeSingle()
  if (credits) return next()
  return res.status(403).json({ success: false, error: 'Aucun plan Robot actif ni credits disponibles.', upgradeUrl: '/client/plans' })
}

router.use(authenticate)
router.use(requireRobotActive as any)

// ── GET /campaigns ───────────────────────────────────────
router.get('/campaigns', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const status = req.query.status ? String(req.query.status) : undefined
    const page = parseInt(String(req.query.page || '1'))
    const limit = parseInt(String(req.query.limit || '20'))
    const offset = (page - 1) * limit

    let query = supabase.from('robot_campaigns_v2')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)

    const { data, count } = await query

    const campaigns = (data || []).map((c: any) => ({
      ...c,
      progressPercent: c.total_contacts > 0 ? Math.round(((c.called || 0) / c.total_contacts) * 100) : 0,
    }))

    sendSuccess(res, { campaigns, total: count || 0, page, limit })
  } catch (err: any) { sendError(res, err.message) }
})

// ── GET /campaigns/:id ───────────────────────────────────
router.get('/campaigns/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const page = parseInt(String(req.query.page || '1'))
    const limit = 20
    const offset = (page - 1) * limit

    const { data: campaign } = await supabase.from('robot_campaigns_v2')
      .select('*').eq('id', id).eq('organization_id', orgId).single()
    if (!campaign) return sendError(res, 'Campagne introuvable', 404)

    const { data: contacts, count } = await supabase.from('robot_contacts')
      .select('*', { count: 'exact' })
      .eq('campaign_id', id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    sendSuccess(res, {
      ...campaign,
      progressPercent: campaign.total_contacts > 0 ? Math.round(((campaign.called || 0) / campaign.total_contacts) * 100) : 0,
      contacts: contacts || [], contactsTotal: count || 0, contactsPage: page,
    })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns ──────────────────────────────────────
router.post('/campaigns', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const userId = (req as any).user?.userId
    const {
      name, messageType = 'tts', messageContent, language = 'fr',
      afterAnswerAction = 'hangup', afterAnswerActionId, afterAnswerActionType,
      callerId, maxAttempts = 3, scheduledAt, timezone = 'America/Toronto',
      gdprConsentConfirmed = false,
    } = req.body

    if (!name) return sendError(res, 'Nom requis', 400)

    const { data, error } = await supabase.from('robot_campaigns_v2').insert({
      organization_id: orgId, name, message_type: messageType,
      message_content: messageContent, language,
      after_answer_action: afterAnswerAction,
      after_answer_action_id: afterAnswerActionId || null,
      after_answer_action_type: afterAnswerActionType || null,
      caller_id: callerId || null, max_attempts: Math.min(5, Math.max(1, maxAttempts)),
      scheduled_at: scheduledAt || null, timezone,
      gdpr_consent_confirmed: gdprConsentConfirmed, status: 'draft',
      created_by: userId,
    }).select().single()

    if (error) throw error
    sendSuccess(res, data, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// ── PUT /campaigns/:id ───────────────────────────────────
router.put('/campaigns/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)

    const { data: campaign } = await supabase.from('robot_campaigns_v2')
      .select('status').eq('id', id).eq('organization_id', orgId).single()
    if (!campaign) return sendError(res, 'Campagne introuvable', 404)
    if (!['draft', 'paused'].includes(campaign.status)) return sendError(res, 'Modification impossible dans cet etat', 400)

    const fields: any = {}
    const allowed = ['name', 'message_type', 'message_content', 'language', 'after_answer_action',
      'after_answer_action_id', 'after_answer_action_type', 'caller_id', 'max_attempts',
      'scheduled_at', 'timezone', 'gdpr_consent_confirmed']
    for (const k of allowed) {
      const camel = k.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
      if (req.body[camel] !== undefined) fields[k] = req.body[camel]
      else if (req.body[k] !== undefined) fields[k] = req.body[k]
    }

    const { data } = await supabase.from('robot_campaigns_v2').update(fields).eq('id', id).eq('organization_id', orgId).select().single()
    sendSuccess(res, data)
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/contacts — CSV import ────────────
router.post('/campaigns/:id/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const { contacts } = req.body // Expected: [{ phone, first_name?, last_name?, ...custom }]

    if (!contacts || !Array.isArray(contacts)) return sendError(res, 'contacts array requis', 400)

    // Check plan limit
    const { data: sub } = await supabase.from('org_robot_subscriptions')
      .select('plan_code').eq('organization_id', orgId).in('status', ['active', 'trialing']).maybeSingle()
    if (sub?.plan_code) {
      const { data: plan } = await supabase.from('plan_definitions').select('max_contacts_per_campaign').eq('id', sub.plan_code).single()
      const maxContacts = plan?.max_contacts_per_campaign || 0
      if (maxContacts > 0 && contacts.length > maxContacts) {
        return sendError(res, `Limite de contacts depassee pour votre plan. Limite: ${maxContacts} contacts.`, 400)
      }
    }

    // Get blacklist
    const { data: blacklist } = await supabase.from('robot_blacklist')
      .select('phone').eq('organization_id', orgId)
    const blacklistSet = new Set((blacklist || []).map((b: any) => b.phone))

    // Deduplicate
    const { data: existingContacts } = await supabase.from('robot_contacts')
      .select('phone').eq('campaign_id', id)
    const existingSet = new Set((existingContacts || []).map((c: any) => c.phone))

    let imported = 0, blacklisted = 0, duplicates = 0, invalid = 0
    const toInsert: any[] = []

    for (const c of contacts) {
      const phone = String(c.phone || '').replace(/[^+\d]/g, '')
      if (!phone || phone.length < 7) { invalid++; continue }
      if (blacklistSet.has(phone)) { blacklisted++; continue }
      if (existingSet.has(phone)) { duplicates++; continue }
      existingSet.add(phone)
      toInsert.push({
        campaign_id: id, organization_id: orgId, phone,
        first_name: c.first_name || c.firstName || null,
        last_name: c.last_name || c.lastName || null,
        custom_fields: c.custom_fields || {},
      })
      imported++
    }

    if (toInsert.length > 0) {
      await supabase.from('robot_contacts').insert(toInsert)
    }

    // Update total
    const { count } = await supabase.from('robot_contacts')
      .select('id', { count: 'exact', head: true }).eq('campaign_id', id)
    await supabase.from('robot_campaigns_v2').update({ total_contacts: count || 0 }).eq('id', id)

    sendSuccess(res, { imported, blacklisted, duplicates, invalid, total: count || 0 })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/start ────────────────────────────
router.post('/campaigns/:id/start', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)

    const { data: campaign } = await supabase.from('robot_campaigns_v2')
      .select('*').eq('id', id).eq('organization_id', orgId).single()
    if (!campaign) return sendError(res, 'Campagne introuvable', 404)

    // Validations
    if (!campaign.gdpr_consent_confirmed) return res.status(403).json({ success: false, error: 'Confirmation RGPD requise avant le lancement.' })
    if (campaign.total_contacts === 0) return sendError(res, 'Aucun contact importe', 400)
    if (!campaign.message_content && !campaign.message_audio_url) return sendError(res, 'Message requis (TTS ou audio)', 400)

    // Check concurrent campaigns limit
    const { data: sub } = await supabase.from('org_robot_subscriptions')
      .select('plan_code').eq('organization_id', orgId).in('status', ['active', 'trialing']).maybeSingle()
    if (sub?.plan_code) {
      const { count: runningCount } = await supabase.from('robot_campaigns_v2')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'running')
      const limits: Record<string, number> = { ROBOT_STARTER: 1, ROBOT_BUSINESS: 5, ROBOT_ENTERPRISE: 999 }
      const maxConcurrent = limits[sub.plan_code] || 1
      if ((runningCount || 0) >= maxConcurrent) {
        return sendError(res, `Limite de campagnes simultanees atteinte (${maxConcurrent})`, 400)
      }
    }

    await supabase.from('robot_campaigns_v2').update({ status: 'running' }).eq('id', id)

    // Count contacts to queue
    const { count } = await supabase.from('robot_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id).eq('status', 'pending')

    sendSuccess(res, { started: true, contactsQueued: count || 0 })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/pause ────────────────────────────
router.post('/campaigns/:id/pause', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    await supabase.from('robot_campaigns_v2').update({ status: 'paused' }).eq('id', id).eq('organization_id', orgId)
    sendSuccess(res, { paused: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/resume ───────────────────────────
router.post('/campaigns/:id/resume', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    await supabase.from('robot_campaigns_v2').update({ status: 'running' }).eq('id', id).eq('organization_id', orgId)
    sendSuccess(res, { resumed: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/cancel ───────────────────────────
router.post('/campaigns/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    await supabase.from('robot_campaigns_v2').update({ status: 'canceled' }).eq('id', id).eq('organization_id', orgId)
    sendSuccess(res, { canceled: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── GET /campaigns/:id/export ────────────────────────────
router.get('/campaigns/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const { data: contacts } = await supabase.from('robot_contacts')
      .select('phone, first_name, last_name, status, call_attempts, call_duration_seconds, last_attempt_at')
      .eq('campaign_id', id).eq('organization_id', orgId)

    let csv = 'phone,first_name,last_name,status,call_attempts,call_duration_seconds,last_attempt_at\n'
    for (const c of contacts || []) {
      csv += `${c.phone},${c.first_name || ''},${c.last_name || ''},${c.status},${c.call_attempts},${c.call_duration_seconds},${c.last_attempt_at || ''}\n`
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=campaign-${id}.csv`)
    res.send(csv)
  } catch (err: any) { sendError(res, err.message) }
})

// ── GET /blacklist ───────────────────────────────────────
router.get('/blacklist', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const page = parseInt(String(req.query.page || '1'))
    const limit = 50
    const { data, count } = await supabase.from('robot_blacklist')
      .select('*, user:added_by(name, email)', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    sendSuccess(res, { items: data || [], total: count || 0, page })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /blacklist ──────────────────────────────────────
router.post('/blacklist', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const userId = (req as any).user?.userId
    const { phones, reason } = req.body
    const list = (Array.isArray(phones) ? phones : [phones]).filter(Boolean).map((p: string) => ({
      organization_id: orgId, phone: p.replace(/[^+\d]/g, ''), reason: reason || null, added_by: userId,
    }))
    if (list.length === 0) return sendError(res, 'Numeros requis', 400)
    const { data } = await supabase.from('robot_blacklist').upsert(list, { onConflict: 'organization_id,phone' }).select()
    sendSuccess(res, data, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// ── DELETE /blacklist/:id ────────────────────────────────
router.delete('/blacklist/:id', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    await supabase.from('robot_blacklist').delete().eq('id', String(req.params.id)).eq('organization_id', orgId)
    sendSuccess(res, { deleted: true })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /blacklist/import ───────────────────────────────
router.post('/blacklist/import', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const userId = (req as any).user?.userId
    const { phones } = req.body
    if (!Array.isArray(phones)) return sendError(res, 'phones array requis', 400)
    const list = phones.filter(Boolean).map((p: string) => ({
      organization_id: orgId, phone: p.replace(/[^+\d]/g, ''), added_by: userId,
    }))
    await supabase.from('robot_blacklist').upsert(list, { onConflict: 'organization_id,phone' })
    sendSuccess(res, { added: list.length })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /tts/preview ────────────────────────────────────
router.post('/tts/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { text, language = 'fr' } = req.body
    if (!text) return sendError(res, 'text requis', 400)
    // Generate TwiML URL for preview
    const voice = language === 'en' ? 'Polly.Joanna' : 'Polly.Lea'
    const lang = language === 'en' ? 'en-US' : 'fr-CA'
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="${voice}" language="${lang}">${text}</Say></Response>`
    // Return TwiML that can be played by frontend via Twilio's say endpoint
    res.setHeader('Content-Type', 'text/xml')
    res.send(twiml)
  } catch (err: any) { sendError(res, err.message) }
})

// ── GET /stats ───────────────────────────────────────────
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const { count: totalCampaigns } = await supabase.from('robot_campaigns_v2')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
    const { count: activeCampaigns } = await supabase.from('robot_campaigns_v2')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'running')

    // This month campaigns
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const { count: campaignsThisMonth } = await supabase.from('robot_campaigns_v2')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
      .gte('created_at', monthStart.toISOString())

    // Aggregate stats from campaigns
    const { data: agg } = await supabase.from('robot_campaigns_v2')
      .select('total_contacts, answered_human, minutes_used')
      .eq('organization_id', orgId)

    let totalContacts = 0, totalAnswered = 0, totalMinutes = 0
    for (const c of agg || []) {
      totalContacts += c.total_contacts || 0
      totalAnswered += c.answered_human || 0
      totalMinutes += parseFloat(c.minutes_used || '0')
    }

    sendSuccess(res, {
      totalCampaigns: totalCampaigns || 0, totalContacts, totalMinutesUsed: Math.round(totalMinutes * 10) / 10,
      avgAnswerRate: totalContacts > 0 ? Math.round((totalAnswered / totalContacts) * 100) : 0,
      campaignsThisMonth: campaignsThisMonth || 0, activeCampaigns: activeCampaigns || 0,
    })
  } catch (err: any) { sendError(res, err.message) }
})

export default router
