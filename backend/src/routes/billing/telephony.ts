import { Router, Request, Response } from 'express'
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

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!orgId) throw new Error('Organisation introuvable')
  return String(orgId)
}

// ── Plan codes & pricing ──────────────────────────────────
const TELEPHONY_PLANS = [
  { code: 'ENTRANTS',           name: 'Entrants',           price: 1900,  description: 'Appels entrants uniquement' },
  { code: 'CANADA_USA',         name: 'Canada/USA',         price: 3500,  description: 'Illimite fixes et mobiles : Canada et USA' },
  { code: 'CANADA_USA_FRANCE',  name: 'Canada/USA/France',  price: 5000,  description: 'Illimite fixes et mobiles : Canada, USA et France' },
  { code: 'INTERNATIONAL',      name: 'International',      price: 7500,  description: 'Illimite fixes et mobiles : pays Europeens' },
] as const

type PlanCode = typeof TELEPHONY_PLANS[number]['code']

const PLAN_BY_CODE = Object.fromEntries(TELEPHONY_PLANS.map(p => [p.code, p]))

// ── Destinations by plan ──────────────────────────────────
const DESTINATIONS: Record<string, { country: string; fixed: boolean; mobile: boolean }[]> = {
  ENTRANTS: [],
  CANADA_USA: [
    { country: 'Canada',    fixed: true, mobile: true },
    { country: 'Etats-Unis', fixed: true, mobile: true },
  ],
  CANADA_USA_FRANCE: [
    { country: 'Canada',    fixed: true, mobile: true },
    { country: 'Etats-Unis', fixed: true, mobile: true },
    { country: 'France',    fixed: true, mobile: true },
  ],
  INTERNATIONAL: [
    { country: 'Canada',       fixed: true, mobile: true },
    { country: 'Etats-Unis',  fixed: true, mobile: true },
    { country: 'France',      fixed: true, mobile: true },
    { country: 'Allemagne',   fixed: true, mobile: true },
    { country: 'Royaume-Uni', fixed: true, mobile: true },
    { country: 'Espagne',     fixed: true, mobile: true },
    { country: 'Italie',      fixed: true, mobile: true },
    { country: 'Portugal',    fixed: true, mobile: true },
    { country: 'Pays-Bas',    fixed: true, mobile: true },
    { country: 'Belgique',    fixed: true, mobile: true },
    { country: 'Suisse',      fixed: true, mobile: true },
    { country: 'Autriche',    fixed: true, mobile: true },
    { country: 'Suede',       fixed: true, mobile: true },
    { country: 'Norvege',     fixed: true, mobile: true },
    { country: 'Danemark',    fixed: true, mobile: true },
    { country: 'Finlande',    fixed: true, mobile: true },
    { country: 'Irlande',     fixed: true, mobile: true },
    { country: 'Pologne',     fixed: true, mobile: true },
    { country: 'Republique tcheque', fixed: true, mobile: true },
    { country: 'Roumanie',    fixed: true, mobile: true },
    { country: 'Hongrie',     fixed: true, mobile: true },
    { country: 'Grece',       fixed: true, mobile: true },
    { country: 'Croatie',     fixed: true, mobile: true },
    { country: 'Bulgarie',    fixed: true, mobile: true },
    { country: 'Slovaquie',   fixed: true, mobile: true },
    { country: 'Slovenie',    fixed: true, mobile: true },
    { country: 'Lituanie',    fixed: true, mobile: true },
    { country: 'Lettonie',    fixed: true, mobile: true },
    { country: 'Estonie',     fixed: true, mobile: true },
    { country: 'Luxembourg',  fixed: true, mobile: true },
    { country: 'Malte',       fixed: true, mobile: true },
    { country: 'Chypre',      fixed: true, mobile: true },
    { country: 'Islande',     fixed: true, mobile: true },
  ],
}

// ──────────────────────────────────────────────────────────
// GET /summary — forfaits actifs de l'org, nb agents par plan
// ──────────────────────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const org_id = getOrgId(req)

    // Extensions with telephony plan
    const { data: extensions } = await supabase
      .from('extensions')
      .select('id, extension_number, plan_id, status, cost_per_month, user_id')
      .eq('organization_id', org_id)
      .in('status', ['active', 'ACTIVE', 'registered'])

    const exts = extensions || []

    // Count per plan
    const planSummary = TELEPHONY_PLANS.map(p => {
      const agents = exts.filter(e => e.plan_id === p.code)
      return {
        plan_code: p.code,
        plan_name: p.name,
        description: p.description,
        price_per_agent: p.price, // cents
        active_agents: agents.length,
        monthly_total: agents.length * p.price, // cents
      }
    })

    const totalMonthly = planSummary.reduce((s, p) => s + p.monthly_total, 0)
    const totalAgents = planSummary.reduce((s, p) => s + p.active_agents, 0)

    // Org info for dates
    const { data: org } = await supabase
      .from('organizations')
      .select('created_at, billing_cycle_end')
      .eq('id', org_id)
      .single()

    res.json({
      success: true,
      data: {
        plans: planSummary,
        total_agents: totalAgents,
        total_monthly: totalMonthly, // cents
        currency: 'CAD',
        registration_date: org?.created_at || null,
        next_payment_date: org?.billing_cycle_end || null,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /agents — liste agents de l'org avec extension, plan
// ──────────────────────────────────────────────────────────
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const org_id = getOrgId(req)

    const { data: extensions } = await supabase
      .from('extensions')
      .select('id, extension_number, label, plan_id, status, cost_per_month, user_id, user:user_id(id, email, name)')
      .eq('organization_id', org_id)
      .order('extension_number', { ascending: true })

    const agents = (extensions || []).map((e: any) => ({
      id: e.id,
      extension: e.extension_number,
      label: e.label || '',
      email: e.user?.email || '',
      name: e.user?.name || '',
      plan_code: e.plan_id || null,
      plan_name: e.plan_id ? (PLAN_BY_CODE[e.plan_id]?.name || e.plan_id) : 'Aucun',
      price: e.plan_id ? (PLAN_BY_CODE[e.plan_id]?.price || 0) : 0,
      status: e.status,
    }))

    res.json({ success: true, data: agents })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /upgrade — batch update: assign/change plans
// Body: { changes: [{ agentId, planCode }] }
// ──────────────────────────────────────────────────────────
router.post('/upgrade', async (req: Request, res: Response) => {
  try {
    const org_id = getOrgId(req)
    const { changes } = req.body as { changes: { agentId: string; planCode: string }[] }

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun changement specifie' })
    }

    // Validate plan codes
    for (const c of changes) {
      if (!PLAN_BY_CODE[c.planCode]) {
        return res.status(400).json({ success: false, error: `Plan invalide: ${c.planCode}` })
      }
    }

    // Load current extensions
    const extIds = changes.map(c => c.agentId)
    const { data: currentExts } = await supabase
      .from('extensions')
      .select('id, plan_id, cost_per_month')
      .eq('organization_id', org_id)
      .in('id', extIds)

    // Calculate prorata
    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysRemaining = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / 86400000))
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const proRataFactor = daysRemaining / daysInMonth

    let proRataTotal = 0
    const updatedAgents: any[] = []

    for (const change of changes) {
      const plan = PLAN_BY_CODE[change.planCode]!
      const current = (currentExts || []).find(e => e.id === change.agentId)
      const oldPrice = current?.cost_per_month || 0
      const newPrice = plan.price
      const diff = newPrice - oldPrice

      // Update extension
      await supabase
        .from('extensions')
        .update({
          plan_id: change.planCode,
          cost_per_month: newPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('id', change.agentId)
        .eq('organization_id', org_id)

      const proRata = Math.round(diff * proRataFactor)
      proRataTotal += proRata

      updatedAgents.push({
        agentId: change.agentId,
        planCode: change.planCode,
        planName: plan.name,
        price: newPrice,
        proRata,
      })
    }

    // Handle Stripe if available
    if (stripe) {
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id, stripe_subscription_id')
        .eq('id', org_id)
        .single()

      if (org?.stripe_subscription_id) {
        try {
          // Retrieve subscription to update items
          const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id)

          // Build quantity per plan code
          const { data: allExts } = await supabase
            .from('extensions')
            .select('plan_id')
            .eq('organization_id', org_id)
            .in('status', ['active', 'ACTIVE', 'registered'])

          const qtyByPlan: Record<string, number> = {}
          for (const e of allExts || []) {
            if (e.plan_id) qtyByPlan[e.plan_id] = (qtyByPlan[e.plan_id] || 0) + 1
          }

          // Fetch plan stripe_price_ids
          const planCodes = Object.keys(qtyByPlan)
          if (planCodes.length > 0) {
            const { data: planDefs } = await supabase
              .from('plan_definitions')
              .select('id, stripe_price_id')
              .in('id', planCodes)

            // Update subscription items
            const items = sub.items.data
            for (const pd of planDefs || []) {
              if (!pd.stripe_price_id) continue
              const qty = qtyByPlan[pd.id] || 0
              const existingItem = items.find((i: any) => i.price.id === pd.stripe_price_id)

              if (existingItem && qty > 0) {
                await stripe.subscriptionItems.update(existingItem.id, {
                  quantity: qty,
                  proration_behavior: 'create_prorations',
                })
              } else if (!existingItem && qty > 0) {
                await stripe.subscriptionItems.create({
                  subscription: org.stripe_subscription_id,
                  price: pd.stripe_price_id,
                  quantity: qty,
                  proration_behavior: 'create_prorations',
                })
              } else if (existingItem && qty === 0) {
                await stripe.subscriptionItems.del(existingItem.id, {
                  proration_behavior: 'create_prorations',
                })
              }
            }
          }
        } catch (stripeErr: any) {
          console.error('[telephony/upgrade] Stripe error:', stripeErr.message)
        }
      }
    }

    // Billing event
    await supabase.from('billing_events').insert({
      organization_id: org_id,
      event_type: 'telephony_upgrade',
      description: `Mise a jour forfaits telephonie: ${changes.length} agent(s)`,
      amount: proRataTotal,
      currency: 'CAD',
      metadata: { changes: updatedAgents },
    })

    const taxRate = 0.14975 // TPS 5% + TVQ 9.975%
    const taxAmount = Math.round(proRataTotal * taxRate)

    res.json({
      success: true,
      data: {
        agents: updatedAgents,
        prorata: proRataTotal,
        tax: taxAmount,
        total: proRataTotal + taxAmount,
        currency: 'CAD',
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// PUT /agent/:agentId — update plan for one agent
// Body: { planCode }
// ──────────────────────────────────────────────────────────
router.put('/agent/:agentId', async (req: Request, res: Response) => {
  try {
    const org_id = getOrgId(req)
    const { planCode } = req.body
    const plan = PLAN_BY_CODE[planCode]
    if (!plan) return res.status(400).json({ success: false, error: 'Plan invalide' })

    const { data, error } = await supabase
      .from('extensions')
      .update({
        plan_id: planCode,
        cost_per_month: plan.price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.agentId)
      .eq('organization_id', org_id)
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// DELETE /agent/:agentId — retire l'agent du forfait
// ──────────────────────────────────────────────────────────
router.delete('/agent/:agentId', async (req: Request, res: Response) => {
  try {
    const org_id = getOrgId(req)

    const { data, error } = await supabase
      .from('extensions')
      .update({
        plan_id: null,
        cost_per_month: 0,
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.agentId)
      .eq('organization_id', org_id)
      .select()
      .single()

    if (error) throw error

    await supabase.from('billing_events').insert({
      organization_id: org_id,
      event_type: 'telephony_agent_removed',
      description: `Agent ${data.extension_number} retire du forfait`,
    })

    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /destinations/:planCode — pays inclus dans le plan
// ──────────────────────────────────────────────────────────
router.get('/destinations/:planCode', async (req: Request, res: Response) => {
  const code = req.params.planCode.toUpperCase()
  const destinations = DESTINATIONS[code]
  if (!destinations) {
    return res.status(404).json({ success: false, error: 'Plan introuvable' })
  }
  res.json({
    success: true,
    data: {
      plan_code: code,
      plan_name: PLAN_BY_CODE[code]?.name || code,
      destinations,
    },
  })
})

export default router
