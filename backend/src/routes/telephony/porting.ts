import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { sendSuccess, sendError } from '../../utils/response'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!orgId) throw new Error('Organisation introuvable')
  return String(orgId)
}

// GET /porting — list org's porting requests
router.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data } = await supabase.from('did_porting_requests')
      .select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
    sendSuccess(res, data || [])
  } catch (err: any) { sendError(res, err.message) }
})

// POST /porting — submit porting request
router.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { phoneNumber, currentCarrier, accountNumber, pin, authorizedName, address, city, state, postalCode, countryCode = 'CA', documentUrl } = req.body

    if (!phoneNumber || !currentCarrier || !authorizedName || !address) {
      return sendError(res, 'Champs requis: phoneNumber, currentCarrier, authorizedName, address', 400)
    }

    const { data, error } = await supabase.from('did_porting_requests').insert({
      organization_id: orgId, phone_number: phoneNumber, current_carrier: currentCarrier,
      account_number: accountNumber || null, pin: pin || null, authorized_name: authorizedName,
      address, city, state, postal_code: postalCode, country_code: countryCode,
      document_url: documentUrl || null, status: 'submitted',
    }).select().single()

    if (error) throw error
    sendSuccess(res, { ...data, estimatedDays: 10 }, 201)
  } catch (err: any) { sendError(res, err.message) }
})

// DELETE /porting/:id — cancel submitted request
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const id = String(req.params.id)

    const { data: req2 } = await supabase.from('did_porting_requests')
      .select('status').eq('id', id).eq('organization_id', orgId).single()
    if (!req2) return sendError(res, 'Demande introuvable', 404)
    if (req2.status !== 'submitted') return sendError(res, 'Seules les demandes soumises peuvent etre annulees', 400)

    await supabase.from('did_porting_requests').update({ status: 'canceled' }).eq('id', id)
    sendSuccess(res, { canceled: true })
  } catch (err: any) { sendError(res, err.message) }
})

export default router
