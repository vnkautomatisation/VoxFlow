import { Router, Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticate, AuthRequest } from '../../middleware/auth'
import { sendSuccess, sendError } from '../../utils/response'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

function getOrgId(req: Request): string {
  const o = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!o) throw new Error('Organisation introuvable')
  return String(o)
}

// ── Middleware: require active dialer ─────────────────────
async function requireDialerActive(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).user?.role
  if (role === 'OWNER' || role === 'OWNER_STAFF') return next()
  const orgId = getOrgId(req)
  const { data: sub } = await supabase.from('org_dialer_subscriptions')
    .select('id').eq('organization_id', orgId).in('status', ['active', 'trialing']).maybeSingle()
  if (sub) return next()
  return res.status(403).json({ success: false, error: 'Predictive Dialer non actif.', upgradeUrl: '/client/plans' })
}

router.use(authenticate)
router.use(requireDialerActive as any)

// ── GET /campaigns ───────────────────────────────────────
router.get('/campaigns', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const status = req.query.status ? String(req.query.status) : undefined
    const page = parseInt(String(req.query.page || '1'))
    const limit = parseInt(String(req.query.limit || '20'))

    let query = supabase.from('dialer_campaigns')
      .select('*', { count: 'exact' }).eq('organization_id', orgId)
      .order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)
    if (status && status !== 'all') query = query.eq('status', status)

    const { data, count } = await query
    const campaigns = (data || []).map((c: any) => ({
      ...c, progressPercent: c.total_contacts > 0 ? Math.round(((c.called || 0) / c.total_contacts) * 100) : 0,
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

    const { data: campaign } = await supabase.from('dialer_campaigns').select('*').eq('id', id).eq('organization_id', orgId).single()
    if (!campaign) return sendError(res, 'Campagne introuvable', 404)

    const { data: contacts, count } = await supabase.from('dialer_contacts')
      .select('*', { count: 'exact' }).eq('campaign_id', id)
      .order('created_at', { ascending: true }).range((page - 1) * limit, page * limit - 1)

    sendSuccess(res, {
      ...campaign, progressPercent: campaign.total_contacts > 0 ? Math.round(((campaign.called || 0) / campaign.total_contacts) * 100) : 0,
      contacts: contacts || [], contactsTotal: count || 0, contactsPage: page,
    })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns ──────────────────────────────────────
router.post('/campaigns', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const userId = (req as any).user?.userId
    const { name, ratio = 1.0, maxAttempts = 3, scriptId, scheduledAt, timezone = 'America/Toronto', callerId } = req.body
    if (!name) return sendError(res, 'Nom requis', 400)

    const { data, error } = await supabase.from('dialer_campaigns').insert({
      organization_id: orgId, name, ratio: Math.min(10, Math.max(1, ratio)),
      max_attempts: Math.min(5, Math.max(1, maxAttempts)),
      script_id: scriptId || null, scheduled_at: scheduledAt || null, timezone,
      caller_id: callerId || null, status: scheduledAt ? 'scheduled' : 'draft', created_by: userId,
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
    const { data: camp } = await supabase.from('dialer_campaigns').select('status').eq('id', id).eq('organization_id', orgId).single()
    if (!camp) return sendError(res, 'Campagne introuvable', 404)
    if (!['draft', 'paused'].includes(camp.status)) return sendError(res, 'Modification impossible dans cet etat', 400)

    const fields: any = {}
    const map: Record<string, string> = { name: 'name', ratio: 'ratio', maxAttempts: 'max_attempts', scriptId: 'script_id', scheduledAt: 'scheduled_at', timezone: 'timezone', callerId: 'caller_id' }
    for (const [camel, col] of Object.entries(map)) { if (req.body[camel] !== undefined) fields[col] = req.body[camel] }

    const { data } = await supabase.from('dialer_campaigns').update(fields).eq('id', id).eq('organization_id', orgId).select().single()
    sendSuccess(res, data)
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/contacts — CSV import ────────────
router.post('/campaigns/:id/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const { contacts } = req.body
    if (!contacts || !Array.isArray(contacts)) return sendError(res, 'contacts array requis', 400)

    const { data: blacklist } = await supabase.from('dialer_blacklist').select('phone').eq('organization_id', orgId)
    const blacklistSet = new Set((blacklist || []).map((b: any) => b.phone))
    const { data: existing } = await supabase.from('dialer_contacts').select('phone').eq('campaign_id', id)
    const existingSet = new Set((existing || []).map((c: any) => c.phone))

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
        first_name: c.first_name || c.firstName || null, last_name: c.last_name || c.lastName || null,
        company: c.company || null, custom_fields: c.custom_fields || {},
      })
      imported++
    }

    if (toInsert.length > 0) await supabase.from('dialer_contacts').insert(toInsert)
    const { count } = await supabase.from('dialer_contacts').select('id', { count: 'exact', head: true }).eq('campaign_id', id)
    await supabase.from('dialer_campaigns').update({ total_contacts: count || 0 }).eq('id', id)
    sendSuccess(res, { imported, blacklisted, duplicates, invalid, total: count || 0 })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/start ────────────────────────────
router.post('/campaigns/:id/start', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const { data: camp } = await supabase.from('dialer_campaigns').select('*').eq('id', id).eq('organization_id', orgId).single()
    if (!camp) return sendError(res, 'Campagne introuvable', 404)
    if (camp.total_contacts === 0) return sendError(res, 'Aucun contact', 400)
    if (!['draft', 'paused', 'scheduled'].includes(camp.status)) return sendError(res, 'Impossible de lancer dans cet etat', 400)

    const { count: running } = await supabase.from('dialer_campaigns')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'running')
    if ((running || 0) >= 3) return sendError(res, 'Maximum 3 campagnes simultanees', 400)

    await supabase.from('dialer_campaigns').update({ status: 'running' }).eq('id', id)
    const { count: pending } = await supabase.from('dialer_contacts')
      .select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'pending')

    sendSuccess(res, { started: true, contactsQueued: pending || 0 })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/pause ────────────────────────────
router.post('/campaigns/:id/pause', async (req: AuthRequest, res: Response) => {
  try { const orgId = getOrgId(req); await supabase.from('dialer_campaigns').update({ status: 'paused' }).eq('id', String(req.params.id)).eq('organization_id', orgId); sendSuccess(res, { paused: true }) }
  catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/resume ───────────────────────────
router.post('/campaigns/:id/resume', async (req: AuthRequest, res: Response) => {
  try { const orgId = getOrgId(req); await supabase.from('dialer_campaigns').update({ status: 'running' }).eq('id', String(req.params.id)).eq('organization_id', orgId); sendSuccess(res, { resumed: true }) }
  catch (err: any) { sendError(res, err.message) }
})

// ── POST /campaigns/:id/cancel ───────────────────────────
router.post('/campaigns/:id/cancel', async (req: AuthRequest, res: Response) => {
  try { const orgId = getOrgId(req); await supabase.from('dialer_campaigns').update({ status: 'canceled' }).eq('id', String(req.params.id)).eq('organization_id', orgId); sendSuccess(res, { canceled: true }) }
  catch (err: any) { sendError(res, err.message) }
})

// ── GET /campaigns/:id/export ────────────────────────────
router.get('/campaigns/:id/export', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data: contacts } = await supabase.from('dialer_contacts')
      .select('phone, first_name, last_name, status, call_attempts, call_duration_seconds, notes, last_attempt_at')
      .eq('campaign_id', String(req.params.id)).eq('organization_id', orgId)
    let csv = 'phone,first_name,last_name,status,call_attempts,call_duration_seconds,notes,last_attempt_at\n'
    for (const c of contacts || []) csv += `${c.phone},${c.first_name || ''},${c.last_name || ''},${c.status},${c.call_attempts},${c.call_duration_seconds},${(c.notes || '').replace(/,/g, ';')},${c.last_attempt_at || ''}\n`
    res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', `attachment; filename=dialer-campaign-${req.params.id}.csv`); res.send(csv)
  } catch (err: any) { sendError(res, err.message) }
})

// ── GET /blacklist ───────────────────────────────────────
router.get('/blacklist', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req); const page = parseInt(String(req.query.page || '1')); const limit = 50
    const { data, count } = await supabase.from('dialer_blacklist').select('*, user:added_by(name, email)', { count: 'exact' })
      .eq('organization_id', orgId).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1)
    sendSuccess(res, { items: data || [], total: count || 0, page })
  } catch (err: any) { sendError(res, err.message) }
})

// ── POST /blacklist ──────────────────────────────────────
router.post('/blacklist', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req); const userId = (req as any).user?.userId; const { phones, reason } = req.body
    const list = (Array.isArray(phones) ? phones : [phones]).filter(Boolean).map((p: string) => ({
      organization_id: orgId, phone: p.replace(/[^+\d]/g, ''), reason: reason || null, added_by: userId,
    }))
    if (list.length === 0) return sendError(res, 'Numeros requis', 400)
    const { data } = await supabase.from('dialer_blacklist').upsert(list, { onConflict: 'organization_id,phone' }).select()
    sendSuccess(res, data, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// ── DELETE /blacklist/:id ────────────────────────────────
router.delete('/blacklist/:id', async (req: AuthRequest, res: Response) => {
  try { const orgId = getOrgId(req); await supabase.from('dialer_blacklist').delete().eq('id', String(req.params.id)).eq('organization_id', orgId); sendSuccess(res, { deleted: true }) }
  catch (err: any) { sendError(res, err.message) }
})

// ── POST /blacklist/import ───────────────────────────────
router.post('/blacklist/import', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req); const userId = (req as any).user?.userId; const { phones } = req.body
    if (!Array.isArray(phones)) return sendError(res, 'phones array requis', 400)
    const list = phones.filter(Boolean).map((p: string) => ({ organization_id: orgId, phone: p.replace(/[^+\d]/g, ''), added_by: userId }))
    await supabase.from('dialer_blacklist').upsert(list, { onConflict: 'organization_id,phone' })
    sendSuccess(res, { added: list.length })
  } catch (err: any) { sendError(res, err.message) }
})

// ── GET /stats ───────────────────────────────────────────
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { count: totalCampaigns } = await supabase.from('dialer_campaigns').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
    const { count: activeCampaigns } = await supabase.from('dialer_campaigns').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'running')
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const { count: campaignsThisMonth } = await supabase.from('dialer_campaigns').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).gte('created_at', monthStart.toISOString())

    const { data: agg } = await supabase.from('dialer_campaigns').select('total_contacts, called, answered_human, talk_time_seconds').eq('organization_id', orgId)
    let totalContacts = 0, totalCalled = 0, totalAnswered = 0, totalTalkTime = 0
    for (const c of agg || []) { totalContacts += c.total_contacts || 0; totalCalled += c.called || 0; totalAnswered += c.answered_human || 0; totalTalkTime += c.talk_time_seconds || 0 }

    sendSuccess(res, {
      totalCampaigns: totalCampaigns || 0, totalContacts, totalCalled,
      avgAnswerRate: totalCalled > 0 ? Math.round((totalAnswered / totalCalled) * 100) : 0,
      totalTalkTimeHours: Math.round((totalTalkTime / 3600) * 10) / 10,
      campaignsThisMonth: campaignsThisMonth || 0, activeCampaigns: activeCampaigns || 0,
    })
  } catch (err: any) { sendError(res, err.message) }
})

export default router
