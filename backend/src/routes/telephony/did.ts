import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { countryFlag } from '../../utils/phone'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let stripe: any = null
try { if (process.env.STRIPE_SECRET_KEY) { const S = require('stripe'); stripe = new S(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) } } catch {}

let twilioClient: any = null
try { if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) { twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) } } catch {}

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!orgId) throw new Error('Organisation introuvable')
  return String(orgId)
}

// ── GET /countries — public, cached ──────────────────────
export async function didCountriesHandler(_req: Request, res: Response) {
  try {
    const { data: rows } = await supabase
      .from('did_pricing')
      .select('country_code, country_name, did_type, price_monthly, requires_address, requires_documents, provisioning_time, provisioning_description')
      .eq('is_available', true)
      .order('sort_order', { ascending: true })

    // Group by country
    const map = new Map<string, any>()
    for (const r of rows || []) {
      if (!map.has(r.country_code)) {
        map.set(r.country_code, {
          countryCode: r.country_code,
          countryName: r.country_name,
          flag: countryFlag(r.country_code),
          types: [],
          minPrice: r.price_monthly,
          requiresAddress: r.requires_address,
          requiresDocuments: r.requires_documents,
          provisioningTime: r.provisioning_time,
          provisioningDescription: r.provisioning_description,
        })
      }
      const entry = map.get(r.country_code)!
      if (!entry.types.includes(r.did_type)) entry.types.push(r.did_type)
      if (r.price_monthly < entry.minPrice) entry.minPrice = r.price_monthly
    }

    // Sort: CA, US first, then alphabetical
    const countries = [...map.values()].sort((a, b) => {
      if (a.countryCode === 'CA') return -1
      if (b.countryCode === 'CA') return 1
      if (a.countryCode === 'US') return -1
      if (b.countryCode === 'US') return 1
      return a.countryName.localeCompare(b.countryName)
    })

    res.json({ success: true, data: countries })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
}
router.get('/countries', didCountriesHandler)

// ── Canadian area codes by province ──────────────────────
const CA_REGIONS = [
  { region: 'Quebec — Montreal', areaCode: '514', friendlyName: 'Montreal (514)' },
  { region: 'Quebec — Montreal', areaCode: '438', friendlyName: 'Montreal (438)' },
  { region: 'Quebec — Rive-Sud/Laval', areaCode: '450', friendlyName: 'Rive-Sud/Laval (450)' },
  { region: 'Quebec — Quebec City', areaCode: '418', friendlyName: 'Quebec City (418)' },
  { region: 'Quebec — Gatineau', areaCode: '819', friendlyName: 'Gatineau/Outaouais (819)' },
  { region: 'Ontario — Toronto', areaCode: '416', friendlyName: 'Toronto (416)' },
  { region: 'Ontario — Toronto', areaCode: '647', friendlyName: 'Toronto (647)' },
  { region: 'Ontario — GTA', areaCode: '905', friendlyName: 'GTA/Hamilton (905)' },
  { region: 'Ontario — Ottawa', areaCode: '613', friendlyName: 'Ottawa (613)' },
  { region: 'Ontario — London', areaCode: '519', friendlyName: 'London/Kitchener (519)' },
  { region: 'Ontario — Sudbury/North', areaCode: '705', friendlyName: 'Sudbury/Barrie (705)' },
  { region: 'Ontario — Thunder Bay', areaCode: '807', friendlyName: 'Thunder Bay (807)' },
  { region: 'Colombie-Britannique — Vancouver', areaCode: '604', friendlyName: 'Vancouver (604)' },
  { region: 'Colombie-Britannique — Victoria', areaCode: '250', friendlyName: 'Victoria/Interior (250)' },
  { region: 'Alberta — Calgary', areaCode: '403', friendlyName: 'Calgary (403)' },
  { region: 'Alberta — Edmonton', areaCode: '780', friendlyName: 'Edmonton (780)' },
  { region: 'Manitoba — Winnipeg', areaCode: '204', friendlyName: 'Winnipeg (204)' },
  { region: 'Saskatchewan — Regina', areaCode: '306', friendlyName: 'Regina/Saskatoon (306)' },
  { region: 'Nouveau-Brunswick', areaCode: '506', friendlyName: 'Nouveau-Brunswick (506)' },
  { region: 'Nouvelle-Ecosse/IPE', areaCode: '902', friendlyName: 'Halifax/Charlottetown (902)' },
  { region: 'Terre-Neuve', areaCode: '709', friendlyName: 'St. John\'s (709)' },
  { region: 'Territoires du Nord', areaCode: '867', friendlyName: 'Yukon/TNO/Nunavut (867)' },
]

const US_REGIONS = [
  { region: 'New York', areaCode: '212', friendlyName: 'New York City (212)' },
  { region: 'New York', areaCode: '718', friendlyName: 'New York — Brooklyn/Queens (718)' },
  { region: 'California', areaCode: '213', friendlyName: 'Los Angeles (213)' },
  { region: 'California', areaCode: '415', friendlyName: 'San Francisco (415)' },
  { region: 'California', areaCode: '310', friendlyName: 'Los Angeles — West (310)' },
  { region: 'Texas', areaCode: '214', friendlyName: 'Dallas (214)' },
  { region: 'Texas', areaCode: '713', friendlyName: 'Houston (713)' },
  { region: 'Illinois', areaCode: '312', friendlyName: 'Chicago (312)' },
  { region: 'Florida', areaCode: '305', friendlyName: 'Miami (305)' },
  { region: 'Florida', areaCode: '407', friendlyName: 'Orlando (407)' },
  { region: 'Massachusetts', areaCode: '617', friendlyName: 'Boston (617)' },
  { region: 'Washington', areaCode: '206', friendlyName: 'Seattle (206)' },
  { region: 'Georgia', areaCode: '404', friendlyName: 'Atlanta (404)' },
  { region: 'Pennsylvania', areaCode: '215', friendlyName: 'Philadelphia (215)' },
  { region: 'DC', areaCode: '202', friendlyName: 'Washington DC (202)' },
  { region: 'Arizona', areaCode: '602', friendlyName: 'Phoenix (602)' },
  { region: 'Colorado', areaCode: '303', friendlyName: 'Denver (303)' },
  { region: 'Michigan', areaCode: '313', friendlyName: 'Detroit (313)' },
]

// ── GET /regions/:countryCode ────────────────────────────
router.get('/regions/:countryCode', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.countryCode).toUpperCase()
    const type = String(req.query.type || 'local')

    // Use hardcoded regions for CA and US (complete and reliable)
    if (code === 'CA' && type === 'local') return res.json({ success: true, data: CA_REGIONS })
    if (code === 'US' && type === 'local') return res.json({ success: true, data: US_REGIONS })

    if (!twilioClient) {
      return res.json({ success: true, data: [{ region: 'Default', areaCode: '', friendlyName: code }] })
    }

    const method = type === 'tollfree' ? 'tollFree' : 'local'
    const numbers = await twilioClient.availablePhoneNumbers(code)[method].list({ limit: 50 })

    const regionsMap = new Map<string, { region: string; areaCode: string; friendlyName: string }>()
    for (const n of numbers) {
      const key = n.region || n.locality || 'Default'
      if (!regionsMap.has(key)) {
        const areaCode = n.phoneNumber?.replace(/^\+\d/, '').substring(0, 3) || ''
        regionsMap.set(key, { region: key, areaCode, friendlyName: n.friendlyName || key })
      }
    }

    res.json({ success: true, data: [...regionsMap.values()] })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /available ───────────────────────────────────────
router.get('/available', async (req: Request, res: Response) => {
  try {
    const code = String(req.query.countryCode || 'CA').toUpperCase()
    const areaCode = String(req.query.areaCode || '')
    const type = String(req.query.type || 'local')

    if (!twilioClient) {
      return res.json({ success: true, data: [{ phoneNumber: `+1${areaCode}5550001`, friendlyName: 'Demo', region: '', locality: '' }] })
    }

    const method = type === 'tollfree' ? 'tollFree' : 'local'
    const params: any = { limit: 5 }
    if (areaCode) params.areaCode = areaCode

    const numbers = await twilioClient.availablePhoneNumbers(code)[method].list(params)

    res.json({
      success: true,
      data: numbers.map((n: any) => ({
        phoneNumber: n.phoneNumber, friendlyName: n.friendlyName,
        region: n.region, locality: n.locality,
      })),
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /pricing/:countryCode ────────────────────────────
router.get('/pricing/:countryCode', async (req: Request, res: Response) => {
  try {
    const code = String(req.params.countryCode).toUpperCase()
    const { data } = await supabase.from('did_pricing').select('*').eq('country_code', code).eq('is_available', true)
    res.json({ success: true, data: data || [] })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /orders ──────────────────────────────────────────
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data } = await supabase.from('did_orders')
      .select('*, identity:identity_id(id, name, status)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })

    res.json({
      success: true,
      data: (data || []).map((d: any) => ({ ...d, usable_as_caller_id: d.status === 'active' })),
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /caller-ids ──────────────────────────────────────
router.get('/caller-ids', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data } = await supabase.from('did_orders')
      .select('id, phone_number, country_code, description')
      .eq('organization_id', orgId)
      .eq('status', 'active')

    res.json({
      success: true,
      data: (data || []).map((d: any) => ({
        id: d.id, phoneNumber: d.phone_number,
        friendlyName: d.description || d.phone_number,
        countryCode: d.country_code,
      })),
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /identities ──────────────────────────────────────
router.get('/identities', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data } = await supabase.from('did_identities')
      .select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
    res.json({ success: true, data: data || [] })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── POST /identities ─────────────────────────────────────
router.post('/identities', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { name, company, addressLine1, addressLine2, city, state, postalCode, countryCode, documentType, documentUrl } = req.body

    if (!name) return res.status(400).json({ success: false, error: 'Nom requis' })

    const { data, error } = await supabase.from('did_identities').insert({
      organization_id: orgId, name, company, address_line1: addressLine1,
      address_line2: addressLine2, city, state, postal_code: postalCode,
      country_code: countryCode, document_type: documentType, document_url: documentUrl || null,
      status: 'pending',
    }).select().single()

    if (error) throw error
    res.json({ success: true, data: { ...data, message: 'Votre identite est en cours de verification (24-48h).' } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /summary ─────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const { count: totalActive } = await supabase.from('did_orders').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')
    const { count: totalPending } = await supabase.from('did_orders').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'pending')
    const { count: freeUsed } = await supabase.from('did_orders').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_free_included', true).eq('status', 'active')

    // Check if org has telephony plan (1 free DID)
    const { data: telSub } = await supabase.from('org_subscriptions').select('id')
      .eq('organization_id', orgId).eq('service_type', 'TELEPHONY').in('status', ['active', 'trialing']).maybeSingle()
    const freeIncluded = telSub ? 1 : 0

    // Monthly cost
    const { data: costRows } = await supabase.from('did_orders')
      .select('monthly_cost').eq('organization_id', orgId).eq('status', 'active').eq('is_free_included', false)
    const monthlyCost = (costRows || []).reduce((s: number, r: any) => s + parseFloat(r.monthly_cost || 0), 0)

    const { count: portingRequests } = await supabase.from('did_porting_requests')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).in('status', ['submitted', 'in_progress'])

    res.json({
      success: true,
      data: { totalActive: totalActive || 0, totalPending: totalPending || 0, freeIncluded, freeUsed: freeUsed || 0, monthlyCost, portingRequests: portingRequests || 0 },
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /actions — available actions for DID routing ─────
router.get('/actions', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const { data: extensions } = await supabase.from('extensions')
      .select('id, extension_number, label').eq('organization_id', orgId).in('status', ['active', 'ACTIVE', 'registered'])
    const { data: queues } = await supabase.from('queues')
      .select('id, name').eq('organization_id', orgId)

    res.json({
      success: true,
      data: {
        extensions: (extensions || []).map((e: any) => ({ id: e.id, label: `Ext ${e.extension_number} — ${e.label || ''}` })),
        ringGroups: [],
        ivrMenus: [],
        voicemails: [{ id: 'default', label: 'Messagerie vocale par defaut' }],
        recordings: [],
        timeConditions: [],
        queues: (queues || []).map((q: any) => ({ id: q.id, label: q.name })),
      },
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── POST /order ──────────────────────────────────────────
router.post('/order', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { countryCode, areaCode, specificPhoneNumber, didType = 'local', assignedActionType, assignedActionId, description, identityId } = req.body

    // Get pricing
    const { data: pricing } = await supabase.from('did_pricing')
      .select('*').eq('country_code', countryCode).eq('did_type', didType).maybeSingle()
    if (!pricing) return res.status(400).json({ success: false, error: 'Tarif introuvable pour ce pays' })

    // Check documents if required
    if (pricing.requires_documents && identityId) {
      const { data: identity } = await supabase.from('did_identities')
        .select('status').eq('id', identityId).eq('organization_id', orgId).single()
      if (!identity || identity.status !== 'approved') {
        return res.status(400).json({ success: false, error: 'Une identite approuvee est requise pour ce pays.' })
      }
    } else if (pricing.requires_documents && !identityId) {
      return res.status(400).json({ success: false, error: 'Une identite approuvee est requise pour ce pays. Soumettez une identite et attendez la validation.' })
    }

    // Check free DID eligibility
    const { count: freeUsed } = await supabase.from('did_orders')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_free_included', true).eq('status', 'active')
    const { data: telSub } = await supabase.from('org_subscriptions')
      .select('id').eq('organization_id', orgId).eq('service_type', 'TELEPHONY').in('status', ['active', 'trialing']).maybeSingle()
    const isFreeIncluded = telSub && (freeUsed || 0) === 0

    // Purchase Twilio number
    let twilioSid: string | null = null
    let phoneNumber = specificPhoneNumber || ''
    const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:4000'

    if (twilioClient) {
      try {
        const params: any = {
          voiceUrl: backendUrl + '/api/v1/telephony/voice/incoming',
          statusCallback: backendUrl + '/api/v1/webhooks/twilio/call-status',
          statusCallbackMethod: 'POST',
        }
        if (specificPhoneNumber) params.phoneNumber = specificPhoneNumber
        else { params.areaCode = areaCode; /* let Twilio pick */ }

        const purchased = await twilioClient.incomingPhoneNumbers.create(params)
        twilioSid = purchased.sid
        phoneNumber = purchased.phoneNumber
      } catch (twErr: any) {
        return res.status(400).json({ success: false, error: 'Impossible d\'acheter ce numero: ' + twErr.message })
      }
    } else {
      // Demo mode
      phoneNumber = specificPhoneNumber || `+1${areaCode || '514'}${Math.floor(1000000 + Math.random() * 9000000)}`
      twilioSid = 'demo_' + Date.now()
    }

    // Insert order
    const { data: order, error } = await supabase.from('did_orders').insert({
      organization_id: orgId, phone_number: phoneNumber, country_code: countryCode,
      region: areaCode ? `Area ${areaCode}` : null, area_code: areaCode, did_type: didType,
      twilio_sid: twilioSid, assigned_action_type: assignedActionType || null,
      assigned_action_id: assignedActionId || null, description: description || null,
      identity_id: identityId || null, monthly_cost: isFreeIncluded ? 0 : pricing.price_monthly,
      is_free_included: !!isFreeIncluded, status: 'active', purchased_at: new Date().toISOString(),
    }).select().single()

    if (error) throw error

    res.json({
      success: true,
      data: { orderId: order.id, phoneNumber, monthlyCost: isFreeIncluded ? 0 : pricing.price_monthly, isFreeIncluded: !!isFreeIncluded, status: 'active' },
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── PUT /orders/:id ──────────────────────────────────────
router.put('/orders/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    const { assignedActionType, assignedActionId, description } = req.body

    const { data: order } = await supabase.from('did_orders')
      .select('twilio_sid').eq('id', id).eq('organization_id', orgId).single()
    if (!order) return res.status(404).json({ success: false, error: 'Commande introuvable' })

    await supabase.from('did_orders').update({
      assigned_action_type: assignedActionType, assigned_action_id: assignedActionId, description,
    }).eq('id', id)

    res.json({ success: true })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── POST /orders/:id/cancel-request ──────────────────────
router.post('/orders/:id/cancel-request', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)
    await supabase.from('did_orders').update({ status: 'cancellation_request' }).eq('id', id).eq('organization_id', orgId)
    res.json({ success: true, data: { status: 'cancellation_request' } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

export default router
