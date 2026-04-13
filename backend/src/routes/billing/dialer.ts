import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let stripe: any = null
try { if (process.env.STRIPE_SECRET_KEY) { const S = require('stripe'); stripe = new S(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) } } catch {}

const VALID_DIALER_PLANS = ['DIALER_CA_US', 'DIALER_CA_US_FR', 'DIALER_INTL']

function getOrgId(req: Request): string {
  const o = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!o) throw new Error('Organisation introuvable')
  return String(o)
}

// ── GET /plans — public ──────────────────────────────────
export async function dialerPlansHandler(_req: Request, res: Response) {
  try {
    const { data: plans } = await supabase
      .from('plan_definitions')
      .select('id, name, description, price_monthly, price_yearly, features_list, destinations, max_concurrent_calls, max_lines_per_agent, sort_order, highlight')
      .in('id', VALID_DIALER_PLANS)
      .order('sort_order', { ascending: true })

    res.json({
      success: true,
      data: (plans || []).map((p: any) => ({
        plan_code: p.id, name: p.name, description: p.description,
        price_monthly: p.price_monthly, price_yearly: p.price_yearly,
        features: p.features_list || [], destinations: p.destinations || [],
        max_concurrent_calls: p.max_concurrent_calls || 5,
        max_lines_per_agent: p.max_lines_per_agent || 3,
        sort_order: p.sort_order, popular: p.highlight || p.id === 'DIALER_CA_US_FR',
      })),
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
}
router.get('/plans', dialerPlansHandler)

// ── GET /summary ─────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const { data: sub } = await supabase.from('org_dialer_subscriptions')
      .select('*').eq('organization_id', orgId).in('status', ['active', 'trialing', 'past_due', 'canceling']).maybeSingle()

    let activePlan: any = null
    if (sub?.plan_code) {
      const { data: plan } = await supabase.from('plan_definitions')
        .select('id, name, price_monthly, price_yearly, destinations, max_concurrent_calls, max_lines_per_agent')
        .eq('id', sub.plan_code).single()
      if (plan) activePlan = {
        plan_code: plan.id, name: plan.name, price_monthly: plan.price_monthly,
        destinations: plan.destinations || [], max_concurrent_calls: plan.max_concurrent_calls,
        max_lines_per_agent: plan.max_lines_per_agent,
      }
    }

    const { count: nbAgents } = await supabase.from('users')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')
    const agentCount = nbAgents || 0

    const pricePerAgent = activePlan ? (sub?.billing_cycle === 'yearly' ? Math.round((activePlan.price_monthly * 10) / 12) : activePlan.price_monthly) : 0
    const { data: org } = await supabase.from('organizations').select('created_at').eq('id', orgId).single()

    res.json({
      success: true,
      data: {
        activePlan, billingCycle: sub?.billing_cycle || 'monthly', status: sub?.status || null,
        nbAgentsActive: agentCount, monthlyTotal: pricePerAgent * agentCount,
        registeredAt: org?.created_at || null, nextPaymentAt: sub?.current_period_end || null,
        trialEndsAt: sub?.trial_ends_at || null, cancelAt: sub?.canceled_at || null,
        stripeSubscriptionId: sub?.stripe_subscription_id || null,
      },
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /agents ──────────────────────────────────────────
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data: extensions } = await supabase.from('extensions')
      .select('id, extension_number, plan_id, user:user_id(id, email, name)')
      .eq('organization_id', orgId).in('status', ['active', 'ACTIVE', 'registered'])
      .order('extension_number', { ascending: true })

    const { data: sub } = await supabase.from('org_dialer_subscriptions')
      .select('plan_code').eq('organization_id', orgId).in('status', ['active', 'trialing']).maybeSingle()

    const { data: planDefs } = sub?.plan_code
      ? await supabase.from('plan_definitions').select('id, name, price_monthly').eq('id', sub.plan_code)
      : { data: [] }
    const planMap: Record<string, { name: string; price: number }> = {}
    for (const p of planDefs || []) planMap[p.id] = { name: p.name, price: p.price_monthly }

    const agents = (extensions || []).map((e: any) => {
      const info = sub?.plan_code ? planMap[sub.plan_code] : null
      return {
        id: e.id, firstName: e.user?.name?.split(' ')[0] || '', lastName: e.user?.name?.split(' ').slice(1).join(' ') || '',
        email: e.user?.email || '', extension: e.extension_number,
        planCode: sub?.plan_code || null, planName: info?.name || 'Aucun', unitPrice: info?.price || 0,
      }
    })
    res.json({ success: true, data: agents })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /prorata ─────────────────────────────────────────
router.get('/prorata', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const planCode = String(req.query.planCode || '')
    const billingCycle = String(req.query.billingCycle || 'monthly')
    if (!VALID_DIALER_PLANS.includes(planCode)) return res.status(400).json({ success: false, error: 'Plan invalide' })

    const { data: plan } = await supabase.from('plan_definitions').select('price_monthly, price_yearly').eq('id', planCode).single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    const { count: nbAgents } = await supabase.from('users')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)

    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1)
    const price = billingCycle === 'yearly' ? Math.round((plan.price_yearly || plan.price_monthly * 10) / 12) : plan.price_monthly
    const prorataAmount = Math.round((daysRemaining / daysInMonth) * price * agentCount)

    res.json({ success: true, data: { prorataAmount, nextPaymentDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(), nextPaymentAmount: price * agentCount, nbAgents: agentCount } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── POST /subscribe ──────────────────────────────────────
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { planCode, billingCycle = 'monthly' } = req.body
    if (!VALID_DIALER_PLANS.includes(planCode)) return res.status(400).json({ success: false, error: 'Plan invalide' })

    const { data: plan } = await supabase.from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly').eq('id', planCode).single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    const { count: nbAgents } = await supabase.from('users')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)

    const { data: org } = await supabase.from('organizations').select('stripe_customer_id, name, email').eq('id', orgId).single()
    let customerId = org?.stripe_customer_id
    if (stripe && !customerId) {
      const customer = await stripe.customers.create({ email: org?.email || '', name: org?.name || '', metadata: { organization_id: orgId } })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
    }

    const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly

    const { data: existing } = await supabase.from('org_dialer_subscriptions')
      .select('*').eq('organization_id', orgId).in('status', ['active', 'trialing', 'past_due']).maybeSingle()

    if (!existing) {
      let stripeSubId: string | null = null; let clientSecret: string | null = null
      const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString()

      if (stripe && priceId) {
        const subscription = await stripe.subscriptions.create({
          customer: customerId, items: [{ price: priceId, quantity: agentCount }],
          trial_period_days: 14, payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'], currency: 'cad',
          metadata: { orgId, planCode, serviceType: 'dialer' },
        })
        stripeSubId = subscription.id
        clientSecret = (subscription as any).latest_invoice?.payment_intent?.client_secret || null
      } else { stripeSubId = 'demo_dialer_' + Date.now() }

      await supabase.from('org_dialer_subscriptions').upsert({
        organization_id: orgId, plan_code: planCode, stripe_subscription_id: stripeSubId,
        stripe_customer_id: customerId, billing_cycle: billingCycle, status: 'trialing',
        quantity: agentCount, trial_ends_at: trialEnd,
        current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(), canceled_at: null,
      }, { onConflict: 'organization_id' })

      const unitPrice = billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly
      return res.json({ success: true, data: { subscriptionId: stripeSubId, clientSecret, planCode, amount: unitPrice * agentCount, trialEnd } })
    }

    // Plan change
    if (stripe && existing.stripe_subscription_id && priceId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(existing.stripe_subscription_id)
        const itemId = stripeSub.items.data[0]?.id
        if (itemId) await stripe.subscriptionItems.update(itemId, { price: priceId, quantity: agentCount, proration_behavior: 'create_prorations' })
      } catch {}
    }
    await supabase.from('org_dialer_subscriptions').update({ plan_code: planCode, billing_cycle: billingCycle, quantity: agentCount }).eq('id', existing.id)

    const unitPrice = billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly
    res.json({ success: true, data: { planCode, newMonthlyTotal: unitPrice * agentCount, prorataToday: 0 } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── PUT /plan ────────────────────────────────────────────
router.put('/plan', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { planCode, billingCycle = 'monthly' } = req.body
    if (!VALID_DIALER_PLANS.includes(planCode)) return res.status(400).json({ success: false, error: 'Plan invalide' })

    const { data: plan } = await supabase.from('plan_definitions')
      .select('id, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly').eq('id', planCode).single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    const { data: sub } = await supabase.from('org_dialer_subscriptions')
      .select('*').eq('organization_id', orgId).in('status', ['active', 'trialing', 'past_due']).maybeSingle()
    if (!sub) return res.status(400).json({ success: false, error: 'Aucun abonnement dialer actif' })

    const { count: nbAgents } = await supabase.from('users')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)
    const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly

    if (stripe && sub.stripe_subscription_id && priceId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
        const itemId = stripeSub.items.data[0]?.id
        if (itemId) await stripe.subscriptionItems.update(itemId, { price: priceId, quantity: agentCount, proration_behavior: 'create_prorations' })
      } catch {}
    }

    await supabase.from('org_dialer_subscriptions').update({ plan_code: planCode, billing_cycle: billingCycle, quantity: agentCount }).eq('id', sub.id)
    const price = billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly
    res.json({ success: true, data: { planCode, newAmount: price * agentCount } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── DELETE /cancel ───────────────────────────────────────
router.delete('/cancel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data: sub } = await supabase.from('org_dialer_subscriptions')
      .select('*').eq('organization_id', orgId).in('status', ['active', 'trialing']).maybeSingle()
    if (!sub) return res.status(400).json({ success: false, error: 'Aucun abonnement actif' })

    if (stripe && sub.stripe_subscription_id) {
      try { await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true }) } catch {}
    }
    const cancelAt = sub.current_period_end || new Date(Date.now() + 30 * 86400000).toISOString()
    await supabase.from('org_dialer_subscriptions').update({ status: 'canceling', canceled_at: cancelAt }).eq('id', sub.id)

    // Cancel running campaigns
    await supabase.from('dialer_campaigns').update({ status: 'canceled' }).eq('organization_id', orgId).in('status', ['running', 'scheduled'])

    res.json({ success: true, data: { cancelAt } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── POST /sync-quantity ──────────────────────────────────
router.post('/sync-quantity', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { count: nbAgents } = await supabase.from('users')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)

    const { data: sub } = await supabase.from('org_dialer_subscriptions')
      .select('id, stripe_subscription_id').eq('organization_id', orgId).in('status', ['active', 'trialing', 'past_due']).maybeSingle()
    if (sub) {
      if (stripe && sub.stripe_subscription_id) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
          const itemId = stripeSub.items.data[0]?.id
          if (itemId) await stripe.subscriptionItems.update(itemId, { quantity: agentCount })
        } catch {}
      }
      await supabase.from('org_dialer_subscriptions').update({ quantity: agentCount }).eq('id', sub.id)
    }
    res.json({ success: true, data: { nbAgents: agentCount, synced: true } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── Export sync helper for agent routes ───────────────────
export async function syncDialerQuantity(orgId: string): Promise<void> {
  try {
    const { count: nbAgents } = await supabase.from('users')
      .select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)
    const { data: sub } = await supabase.from('org_dialer_subscriptions')
      .select('id, stripe_subscription_id').eq('organization_id', orgId).in('status', ['active', 'trialing', 'past_due']).maybeSingle()
    if (sub) {
      if (stripe && sub.stripe_subscription_id) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
          const itemId = stripeSub.items.data[0]?.id
          if (itemId) await stripe.subscriptionItems.update(itemId, { quantity: agentCount })
        } catch {}
      }
      await supabase.from('org_dialer_subscriptions').update({ quantity: agentCount }).eq('id', sub.id)
    }
  } catch {}
}

export default router
