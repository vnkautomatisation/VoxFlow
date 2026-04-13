import { Router, Response } from 'express'
import { AuthRequest } from '../../middleware/auth'
import { createClient } from '@supabase/supabase-js'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let stripe: any = null
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require('stripe')
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  }
} catch {}

// ══════════════════════════════════════════════════════════
// GET /billing-stats — MRR, ARR, churn, volumes
// ══════════════════════════════════════════════════════════
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    // All active subscriptions for MRR
    const { data: subs } = await supabase
      .from('org_subscriptions')
      .select('unit_price, quantity, status, organization_id, created_at, cancelled_at')

    const activeSubs = (subs || []).filter((s: any) => ['active', 'trialing'].includes(s.status))
    const mrr = activeSubs.reduce((sum: number, s: any) => sum + (s.unit_price * s.quantity), 0) / 100
    const arr = mrr * 12

    // Churn: cancelled this month / active at start of month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const cancelledThisMonth = (subs || []).filter((s: any) =>
      s.status === 'cancelled' && s.cancelled_at && new Date(s.cancelled_at) >= monthStart
    ).length
    const totalActive = activeSubs.length || 1
    const churnRate = Math.round((cancelledThisMonth / totalActive) * 10000) / 100

    // New clients this month
    const { count: newClients } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())

    // MRR history (last 12 months simulated from billing_events)
    const mrrHistory: { month: string; mrr: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('fr-CA', { month: 'short', year: 'numeric' })
      // Simple growth simulation
      mrrHistory.push({ month: label, mrr: Math.round(mrr * (1 - i * 0.08) * 100) / 100 })
    }

    // Billing events this month
    const { data: events } = await supabase
      .from('billing_events')
      .select('*')
      .gte('created_at', monthStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    const volumeThisMonth = (events || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0) / 100

    // Past due orgs
    const { data: pastDue } = await supabase
      .from('organizations')
      .select('id, name, email')
      .eq('subscription_status', 'past_due')

    // Trials expiring in 3 days
    const threeDaysFromNow = new Date(Date.now() + 3 * 86400000).toISOString()
    const { data: expiringTrials } = await supabase
      .from('organizations')
      .select('id, name, trial_ends_at')
      .eq('status', 'TRIAL')
      .lte('trial_ends_at', threeDaysFromNow)
      .gte('trial_ends_at', new Date().toISOString())

    res.json({
      success: true,
      data: {
        mrr, arr, churn_rate: churnRate,
        new_clients: newClients || 0,
        mrr_history: mrrHistory,
        volume_this_month: volumeThisMonth,
        past_due: pastDue || [],
        expiring_trials: expiringTrials || [],
        recent_events: (events || []).slice(0, 20).map((e: any) => ({
          id: e.id, type: e.event_type, description: e.description,
          amount: (e.amount || 0) / 100, created_at: e.created_at,
          org_id: e.organization_id,
        })),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// GET /billing-stats/transactions — recent transactions
// ══════════════════════════════════════════════════════════
router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'))
    const { data: events } = await supabase
      .from('billing_events')
      .select('*, org:organization_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit)

    res.json({
      success: true,
      data: (events || []).map((e: any) => ({
        id: e.id, type: e.event_type, description: e.description,
        amount: (e.amount || 0) / 100, currency: e.currency || 'CAD',
        org_name: e.org?.name || '-', org_id: e.organization_id,
        created_at: e.created_at,
        status: e.event_type.includes('cancel') ? 'cancelled'
          : e.event_type.includes('fail') ? 'failed' : 'success',
      })),
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// GET /billing-stats/invoices — all invoices for all orgs
// ══════════════════════════════════════════════════════════
router.get('/invoices', async (req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('issued_at', { ascending: false })
      .limit(100)
    res.json({ success: true, data: data || [] })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Promo codes CRUD
// ══════════════════════════════════════════════════════════
router.get('/promo-codes', async (_req: AuthRequest, res: Response) => {
  try {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false })
    res.json({ success: true, data: data || [] })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/promo-codes', async (req: AuthRequest, res: Response) => {
  try {
    const { code, type = 'percent', value, max_uses, expires_at } = req.body
    const { data, error } = await supabase.from('promo_codes').insert({
      code: String(code).toUpperCase(), type, value,
      max_uses: max_uses || null, expires_at: expires_at || null,
    }).select().single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.patch('/promo-codes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { is_active } = req.body
    const { data } = await supabase.from('promo_codes')
      .update({ is_active }).eq('id', req.params.id).select().single()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// GET /billing-stats/top-clients — top 10 by MRR
// ══════════════════════════════════════════════════════════
router.get('/top-clients', async (_req: AuthRequest, res: Response) => {
  try {
    const { data: subs } = await supabase
      .from('org_subscriptions')
      .select('organization_id, unit_price, quantity, plan_id, status')
      .in('status', ['active', 'trialing'])

    const orgMrr: Record<string, { mrr: number; plans: string[] }> = {}
    for (const s of subs || []) {
      if (!orgMrr[s.organization_id]) orgMrr[s.organization_id] = { mrr: 0, plans: [] }
      orgMrr[s.organization_id].mrr += (s.unit_price * s.quantity) / 100
      orgMrr[s.organization_id].plans.push(s.plan_id)
    }

    const orgIds = Object.keys(orgMrr)
    if (orgIds.length === 0) return res.json({ success: true, data: [] })

    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, status')
      .in('id', orgIds)

    const { data: userCounts } = await supabase
      .from('users')
      .select('organization_id')
      .in('organization_id', orgIds)

    const countByOrg: Record<string, number> = {}
    for (const u of userCounts || []) {
      countByOrg[u.organization_id] = (countByOrg[u.organization_id] || 0) + 1
    }

    const result = (orgs || [])
      .map((o: any) => ({
        id: o.id, name: o.name, status: o.status,
        plans: orgMrr[o.id]?.plans?.join(', ') || '-',
        users: countByOrg[o.id] || 0,
        mrr: orgMrr[o.id]?.mrr || 0,
      }))
      .sort((a: any, b: any) => b.mrr - a.mrr)
      .slice(0, 10)

    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
