import { Router, Response } from 'express'
import { AuthRequest } from '../../middleware/auth'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

// ══════════════════════════════════════════════════════════
// GET /admins — liste des organisations avec stats
// ══════════════════════════════════════════════════════════
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const search = String(req.query.search || '')
    const status = String(req.query.status || '')
    const page = parseInt(String(req.query.page || '1'))
    const limit = parseInt(String(req.query.limit || '50'))
    const offset = (page - 1) * limit

    let query = supabase
      .from('organizations')
      .select('*, users!users_organization_id_fkey(id, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) query = query.ilike('name', `%${search}%`)
    if (status && status !== 'all') query = query.eq('status', status)

    const { data: orgs, count } = await query

    // Get subscriptions for each org
    const orgIds = (orgs || []).map((o: any) => o.id)
    const { data: allSubs } = await supabase
      .from('org_subscriptions')
      .select('organization_id, plan_id, service_type, quantity, unit_price, status')
      .in('organization_id', orgIds)
      .in('status', ['active', 'trialing', 'past_due'])

    const subsByOrg: Record<string, any[]> = {}
    for (const s of allSubs || []) {
      if (!subsByOrg[s.organization_id]) subsByOrg[s.organization_id] = []
      subsByOrg[s.organization_id].push(s)
    }

    const result = (orgs || []).map((org: any) => {
      const subs = subsByOrg[org.id] || []
      const mrr = subs.reduce((sum: number, s: any) => sum + (s.unit_price * s.quantity), 0) / 100
      const userCount = (org.users || []).length
      const planNames = subs.map((s: any) => s.plan_id).join(', ') || org.plan || '-'

      return {
        id: org.id, name: org.name, email: org.email,
        plan: planNames, status: org.status || org.subscription_status || 'active',
        user_count: userCount, mrr,
        trial_ends_at: org.trial_ends_at,
        created_at: org.created_at,
        last_activity: org.updated_at || org.created_at,
        stripe_customer_id: org.stripe_customer_id,
      }
    })

    res.json({ success: true, data: { organizations: result, total: count || 0, page, limit } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// POST /admins/:orgId/impersonate — login as org admin
// ══════════════════════════════════════════════════════════
router.post('/:orgId/impersonate', async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.params.orgId

    // Get org
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .single()
    if (!org) return res.status(404).json({ success: false, error: 'Organisation introuvable' })

    // Get first admin user of this org
    const { data: admin } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('organization_id', orgId)
      .eq('role', 'ADMIN')
      .limit(1)
      .single()

    if (!admin) return res.status(404).json({ success: false, error: 'Aucun admin pour cette org' })

    // Generate temporary token for impersonation
    const token = jwt.sign(
      {
        userId: admin.id,
        email: admin.email,
        name: admin.name,
        role: 'ADMIN',
        organizationId: orgId,
        org_name: org.name,
        impersonated: true,
        impersonatedBy: req.user?.userId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '2h' }
    )

    res.json({
      success: true,
      data: {
        token,
        org_id: orgId,
        org_name: org.name,
        admin_email: admin.email,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// POST /admins/:orgId/suspend — suspendre une org
// ══════════════════════════════════════════════════════════
router.post('/:orgId/suspend', async (req: AuthRequest, res: Response) => {
  try {
    await supabase.from('organizations').update({ status: 'SUSPENDED' }).eq('id', req.params.orgId)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// POST /admins/:orgId/reactivate — reactiver une org
// ══════════════════════════════════════════════════════════
router.post('/:orgId/reactivate', async (req: AuthRequest, res: Response) => {
  try {
    await supabase.from('organizations').update({ status: 'ACTIVE' }).eq('id', req.params.orgId)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
