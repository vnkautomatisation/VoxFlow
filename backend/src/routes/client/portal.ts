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
function getUserId(req: Request): string {
  const userId = (req as any).user?.userId || (req as any).user?.id
  if (!userId) throw new Error('Utilisateur introuvable')
  return String(userId)
}

// ══════════════════════════════════════════════════════════
// GET /plans-catalog — catalogue public des plans par service
// ══════════════════════════════════════════════════════════
router.get('/plans-catalog', async (_req, res) => {
  try {
    const { data: plans } = await supabase
      .from('plan_definitions')
      .select('*')
      .eq('is_public', true)
      .order('sort_order')

    const { data: addons } = await supabase
      .from('products')
      .select('*')
      .eq('category', 'ADDON')
      .eq('is_active', true)
      .order('sort_order')

    const grouped: Record<string, any[]> = {}
    for (const p of plans || []) {
      const st = p.service_type || 'TELEPHONY'
      if (!grouped[st]) grouped[st] = []
      grouped[st].push({
        id: p.id, name: p.name, description: p.description,
        price_monthly: p.price_monthly, price_yearly: p.price_yearly,
        currency: p.currency || 'CAD', max_agents: p.max_agents,
        max_dids: p.max_dids, features: p.features || {},
        features_list: p.features_list || [],
        service_type: st, sort_order: p.sort_order,
        highlight: p.highlight || false,
      })
    }

    res.json({
      success: true,
      data: {
        services: grouped,
        addons: (addons || []).map((a: any) => {
          const [desc, unit] = (a.description || '|per_unit').split('|')
          return {
            sku: a.sku, name: a.name, description: desc.trim(),
            price_monthly: a.price_monthly,
            price_yearly: (a.price_monthly || 0) * 10,
            billing_unit: unit?.trim() || 'per_unit',
          }
        }),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// GET /dashboard — client portal home stats
// ══════════════════════════════════════════════════════════
router.get('/dashboard', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { data: org } = await supabase.from('organizations').select('*').eq('id', org_id).single()
    if (!org) return res.status(404).json({ success: false, error: 'Org introuvable' })

    const { data: subs } = await supabase
      .from('org_subscriptions')
      .select('*, plan:plan_id(name, price_monthly, price_yearly, service_type, features_list)')
      .eq('organization_id', org_id)
      .in('status', ['active', 'trialing', 'past_due'])

    const { data: addons } = await supabase
      .from('organization_modules')
      .select('*, product:product_sku(name, price_monthly)')
      .eq('organization_id', org_id)
      .eq('status', 'ACTIVE')

    const { count: agentCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org_id)
      .in('role', ['AGENT', 'SUPERVISOR'])

    const { count: didCount } = await supabase
      .from('phone_numbers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org_id)

    const subscriptions = (subs || []).map((s: any) => ({
      id: s.id, plan_id: s.plan_id, plan_name: s.plan?.name || s.plan_id,
      service_type: s.service_type, quantity: s.quantity,
      billing_cycle: s.billing_cycle, status: s.status,
      unit_price: s.unit_price,
      monthly_total: s.unit_price * s.quantity,
      features_list: s.plan?.features_list || [],
      current_period_end: s.current_period_end,
      trial_ends_at: s.trial_ends_at,
    }))

    const monthlyRecurring = subscriptions.reduce((s: number, sub: any) => s + sub.monthly_total, 0)
    const addonsTotal = (addons || []).reduce((s: number, a: any) => s + ((a.product?.price_monthly || 0) * (a.quantity || 1)), 0)
    const nextDate = subscriptions.length > 0
      ? subscriptions.reduce((m: string, s: any) => s.current_period_end && s.current_period_end < m ? s.current_period_end : m, subscriptions[0]?.current_period_end || new Date().toISOString())
      : null

    res.json({
      success: true,
      data: {
        org: { id: org.id, name: org.name, status: org.status || org.subscription_status, trial_ends_at: org.trial_ends_at, stripe_customer_id: org.stripe_customer_id },
        metrics: {
          active_services: subscriptions.length,
          next_invoice_amount: (monthlyRecurring + addonsTotal) / 100,
          next_invoice_date: nextDate,
          active_agents: agentCount || 0,
          did_numbers: didCount || 0,
        },
        subscriptions,
        addons: (addons || []).map((a: any) => ({
          sku: a.product_sku, name: a.product?.name || a.product_sku,
          quantity: a.quantity, unit_price: (a.product?.price_monthly || 0) / 100,
          total: ((a.product?.price_monthly || 0) * (a.quantity || 1)) / 100,
        })),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Subscriptions CRUD (multi-service)
// ══════════════════════════════════════════════════════════
router.get('/subscriptions', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { data } = await supabase
      .from('org_subscriptions')
      .select('*, plan:plan_id(name, price_monthly, price_yearly, service_type, features, features_list, highlight)')
      .eq('organization_id', org_id)
      .order('created_at')
    res.json({ success: true, data: data || [] })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/subscribe', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { plan_id, quantity = 1, billing_cycle = 'monthly', is_trial = false } = req.body
    const { data: plan } = await supabase.from('plan_definitions').select('*').eq('id', plan_id).single()
    if (!plan) return res.status(400).json({ success: false, error: 'Plan introuvable' })

    const unit_price = billing_cycle === 'yearly' && plan.price_yearly
      ? Math.round(plan.price_yearly / 12) : plan.price_monthly
    const trialEnd = is_trial ? new Date(Date.now() + 14 * 86400000).toISOString() : null

    // Check if subscription already exists for this service type
    const { data: existing } = await supabase
      .from('org_subscriptions')
      .select('id')
      .eq('organization_id', org_id)
      .eq('service_type', plan.service_type)
      .in('status', ['active', 'trialing'])
      .maybeSingle()

    let sub
    if (existing) {
      const { data } = await supabase.from('org_subscriptions')
        .update({ plan_id: plan.id, quantity, billing_cycle, unit_price, updated_at: new Date().toISOString() })
        .eq('id', existing.id).select().single()
      sub = data
    } else {
      const { data } = await supabase.from('org_subscriptions')
        .insert({
          organization_id: org_id, plan_id: plan.id,
          service_type: plan.service_type, quantity, billing_cycle,
          status: is_trial ? 'trialing' : 'active', unit_price,
          trial_ends_at: trialEnd,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        }).select().single()
      sub = data
    }

    await supabase.from('billing_events').insert({
      organization_id: org_id,
      event_type: is_trial ? 'trial_started' : 'subscription_created',
      description: `${plan.name} x${quantity} (${billing_cycle})`,
      amount: unit_price * quantity, currency: 'CAD',
    })

    res.json({ success: true, data: sub })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.patch('/subscriptions/:id', async (req, res) => {
  try {
    const { quantity, billing_cycle, plan_id } = req.body
    const updates: any = { updated_at: new Date().toISOString() }
    if (quantity !== undefined) updates.quantity = Math.max(1, quantity)
    if (billing_cycle) updates.billing_cycle = billing_cycle
    if (plan_id) updates.plan_id = plan_id

    const { data, error } = await supabase.from('org_subscriptions')
      .update(updates).eq('id', req.params.id).select().single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.post('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { error } = await supabase.from('org_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('organization_id', org_id)
    if (error) throw error

    await supabase.from('billing_events').insert({
      organization_id: org_id, event_type: 'subscription_cancelled',
      description: `Subscription ${req.params.id} annulee`,
    })
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// DID Numbers
// ══════════════════════════════════════════════════════════
router.get('/numbers', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { data } = await supabase.from('phone_numbers').select('*')
      .eq('organization_id', org_id).order('created_at', { ascending: false })
    res.json({ success: true, data: data || [] })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/numbers/order', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { country, region, area_code, action_type, action_target, description } = req.body
    const { data, error } = await supabase.from('phone_numbers').insert({
      organization_id: org_id,
      phone_number: `+1${area_code || '514'}${Math.random().toString().slice(2, 9)}`,
      country: country || 'CA', region: region || 'Quebec',
      action_type, action_target, description,
      monthly_cost: 700, status: 'provisioning',
    }).select().single()
    if (error) throw error

    await supabase.from('billing_events').insert({
      organization_id: org_id, event_type: 'did_ordered',
      description: `DID ${country}/${region}`, amount: 700,
    })
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.patch('/numbers/:id', async (req, res) => {
  try {
    const { action_type, action_target, description } = req.body
    const { data } = await supabase.from('phone_numbers')
      .update({ action_type, action_target, description })
      .eq('id', req.params.id).select().single()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.delete('/numbers/:id', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    await supabase.from('phone_numbers').update({ status: 'released' })
      .eq('id', req.params.id).eq('organization_id', org_id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Robot campaigns
// ══════════════════════════════════════════════════════════
router.get('/robot/campaigns', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { data } = await supabase.from('dialer_campaigns').select('*')
      .eq('organization_id', org_id).eq('type', 'robot')
      .order('created_at', { ascending: false })
    res.json({ success: true, data: data || [] })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/robot/campaigns/:id', async (req, res) => {
  try {
    const { data } = await supabase.from('dialer_campaigns').select('*').eq('id', req.params.id).single()
    res.json({ success: true, data })
  } catch { res.status(404).json({ success: false, error: 'Campagne introuvable' }) }
})

router.post('/robot/campaigns', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const user_id = getUserId(req)
    const { name, config, contacts_count = 0 } = req.body
    const { data } = await supabase.from('dialer_campaigns').insert({
      organization_id: org_id, created_by: user_id,
      name, type: 'robot', config: JSON.stringify(config || {}),
      status: 'draft', contacts_count,
    }).select().single()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.patch('/robot/campaigns/:id', async (req, res) => {
  try {
    const updates: any = {}
    if (req.body.status) updates.status = req.body.status
    if (req.body.config) updates.config = JSON.stringify(req.body.config)
    if (req.body.name) updates.name = req.body.name
    const { data } = await supabase.from('dialer_campaigns').update(updates)
      .eq('id', req.params.id).select().single()
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Support tickets
// ══════════════════════════════════════════════════════════
router.get('/support/tickets', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { data } = await supabase.from('support_tickets').select('*')
      .eq('organization_id', org_id).order('created_at', { ascending: false })
    res.json({ success: true, data: data || [] })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/support/tickets/:id', async (req, res) => {
  try {
    const { data } = await supabase.from('support_tickets')
      .select('*, messages:support_messages(*)').eq('id', req.params.id).single()
    res.json({ success: true, data })
  } catch { res.status(404).json({ success: false, error: 'Ticket introuvable' }) }
})

router.post('/support/tickets', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const user_id = getUserId(req)
    const { subject, category = 'general', priority = 'normal', message, attachment_url } = req.body
    const { data: ticket } = await supabase.from('support_tickets').insert({
      organization_id: org_id, user_id, subject, category, priority, status: 'open', attachment_url,
    }).select().single()
    if (ticket && message) {
      await supabase.from('support_messages').insert({ ticket_id: ticket.id, user_id, message, from_role: 'client' })
    }
    res.json({ success: true, data: ticket })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

router.post('/support/tickets/:id/messages', async (req, res) => {
  try {
    const user_id = getUserId(req)
    const { data } = await supabase.from('support_messages')
      .insert({ ticket_id: req.params.id, user_id, message: req.body.message, from_role: 'client' })
      .select().single()
    await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', req.params.id)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Invoices
// ══════════════════════════════════════════════════════════
router.get('/invoices', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { data } = await supabase.from('invoices').select('*')
      .eq('organization_id', org_id).order('issued_at', { ascending: false })
    res.json({
      success: true,
      data: (data || []).map((inv: any) => ({
        ...inv, lines: typeof inv.lines === 'string' ? JSON.parse(inv.lines) : (inv.lines || []),
      })),
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ══════════════════════════════════════════════════════════
// Stripe portal + payment
// ══════════════════════════════════════════════════════════
router.post('/portal-session', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id').eq('id', org_id).single()
    if (!stripe || !org?.stripe_customer_id) return res.json({ success: true, data: { url: null, demo: true } })
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: req.body.return_url || `${process.env.APP_URL}/client/invoices`,
    })
    res.json({ success: true, data: { url: session.url } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/setup-intent', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    if (!stripe) return res.json({ success: true, data: { client_secret: null, demo: true } })
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id, name').eq('id', org_id).single()
    let cid = org?.stripe_customer_id
    if (!cid) {
      const c = await stripe.customers.create({ name: org?.name, metadata: { organization_id: org_id } })
      cid = c.id
      await supabase.from('organizations').update({ stripe_customer_id: cid }).eq('id', org_id)
    }
    const intent = await stripe.setupIntents.create({ customer: cid, payment_method_types: ['card'] })
    res.json({ success: true, data: { client_secret: intent.client_secret } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/payment-intent', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { amount, description } = req.body
    if (!stripe) return res.json({ success: true, data: { client_secret: null, demo: true } })
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id, name').eq('id', org_id).single()
    let cid = org?.stripe_customer_id
    if (!cid) {
      const c = await stripe.customers.create({ name: org?.name, metadata: { organization_id: org_id } })
      cid = c.id
      await supabase.from('organizations').update({ stripe_customer_id: cid }).eq('id', org_id)
    }
    const intent = await stripe.paymentIntents.create({ amount, currency: 'cad', customer: cid, description, metadata: { organization_id: org_id } })
    res.json({ success: true, data: { client_secret: intent.client_secret } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/promo/validate', async (req, res) => {
  try {
    const { code } = req.body
    const { data: promo } = await supabase.from('promo_codes').select('*')
      .eq('code', String(code).toUpperCase()).eq('is_active', true).single()
    if (!promo) return res.status(404).json({ success: false, error: 'Code promo invalide' })
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return res.status(400).json({ success: false, error: 'Code expire' })
    if (promo.max_uses && promo.current_uses >= promo.max_uses) return res.status(400).json({ success: false, error: 'Code epuise' })
    res.json({
      success: true,
      data: { code: promo.code, type: promo.type, value: promo.value,
        description: promo.type === 'percent' ? `${promo.value}% de reduction` : `${(promo.value / 100).toFixed(2)} CAD$ de reduction` },
    })
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message })
  }
})

export default router
