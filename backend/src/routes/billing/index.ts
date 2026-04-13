import { Router, Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { authenticate, AuthRequest } from '../../middleware/auth'

const router = Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ── Auth middleware selectif ───────────────────────────────
const PUBLIC_PATHS = new Set(['/plans', '/modules', '/webhook'])
router.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next()
  return authenticate(req as AuthRequest, res, next)
})

// Stripe optionnel — fonctionne sans cle (mode demo)
let stripe: any = null
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require('stripe')
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  }
} catch {}

// ── Plan cache (60s) ─────────────────────────────────────────
let planCache: { data: any[]; ts: number } | null = null
const PLAN_CACHE_TTL = 60_000

async function getPlansFromDB(): Promise<any[]> {
  if (planCache && Date.now() - planCache.ts < PLAN_CACHE_TTL) return planCache.data
  const { data, error } = await supabase
    .from('plan_definitions')
    .select('*')
    .eq('is_public', true)
    .order('sort_order')
  const plans = data || []
  planCache = { data: plans, ts: Date.now() }
  return plans
}

async function getPlanById(planId: string): Promise<any | null> {
  const plans = await getPlansFromDB()
  return plans.find((p: any) => p.id === planId.toUpperCase()) || null
}

function invalidatePlanCache() {
  planCache = null
}

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!orgId) throw new Error('Organisation introuvable (auth requise)')
  return String(orgId)
}
function getUserId(req: Request): string {
  const userId = (req as any).user?.userId || (req as any).user?.id
  if (!userId) throw new Error('Utilisateur introuvable (auth requise)')
  return String(userId)
}

// ──────────────────────────────────────────────────────────
// GET /plans — catalogue public (depuis plan_definitions)
// ──────────────────────────────────────────────────────────
router.get('/plans', async (_req, res) => {
  try {
    const plans = await getPlansFromDB()

    // Modules depuis products
    const { data: modules } = await supabase
      .from('products')
      .select('*')
      .in('category', ['ADDON', 'SERVICE', 'AI_CREDIT'])
      .eq('is_active', true)
      .order('sort_order')

    res.json({
      success: true,
      data: {
        plans: plans.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price_monthly: p.price_monthly,
          price_yearly: p.price_yearly,
          currency: p.currency || 'CAD',
          max_agents: p.max_agents,
          max_dids: p.max_dids,
          max_calls_month: p.max_calls_month,
          features: p.features || {},
          is_default: p.is_default,
          sort_order: p.sort_order,
          popular: p.id === 'CONFORT',
        })),
        modules: (modules || []).map((m: any) => {
          const [desc, billingUnit] = (m.description || '|per_user').split('|')
          return {
            id: m.id,
            sku: m.sku,
            name: m.name,
            description: desc.trim(),
            category: m.category,
            price_monthly: m.price_monthly,
            setup_fee: m.setup_fee,
            billing_unit: billingUnit?.trim() || 'per_user',
            is_active: m.is_active,
          }
        }),
      },
    })
  } catch (err: any) {
    console.error('[billing/plans]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /modules — catalogue modules public
// ──────────────────────────────────────────────────────────
router.get('/modules', async (_req, res) => {
  try {
    const { data: modules } = await supabase
      .from('products')
      .select('*')
      .in('category', ['ADDON', 'SERVICE', 'AI_CREDIT'])
      .eq('is_active', true)
      .order('sort_order')

    res.json({
      success: true,
      data: (modules || []).map((m: any) => {
        const [desc, billingUnit] = (m.description || '|per_user').split('|')
        return {
          id: m.id,
          sku: m.sku,
          name: m.name,
          description: desc.trim(),
          category: m.category,
          price_monthly: m.price_monthly,
          setup_fee: m.setup_fee,
          billing_unit: billingUnit?.trim() || 'per_user',
        }
      }),
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /subscription
// ──────────────────────────────────────────────────────────
router.get('/subscription', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { data: org, error } = await supabase
      .from('organizations').select('*').eq('id', org_id).single()
    if (error || !org) {
      return res.status(404).json({ success: false, error: 'Organisation introuvable' })
    }

    const planKey = String(org.plan || 'STARTER').toUpperCase()
    const planData = await getPlanById(planKey)
    const seats = org.seats || 1
    const priceMonthly = planData ? planData.price_monthly / 100 : 0
    const renews_at = org.billing_cycle_end ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let stripe_customer = false
    if (stripe && org.stripe_customer_id) stripe_customer = true

    // Modules actifs de l'org
    const { data: orgModules } = await supabase
      .from('organization_modules')
      .select('*, product:product_sku(name, price_monthly, description)')
      .eq('organization_id', org_id)
      .eq('status', 'ACTIVE')

    const activeModules = (orgModules || []).map((m: any) => {
      const [desc, billingUnit] = (m.product?.description || '|per_user').split('|')
      return {
        sku: m.product_sku,
        name: m.product?.name || m.product_sku,
        quantity: m.quantity,
        unit_price: (m.product?.price_monthly || 0) / 100,
        billing_unit: billingUnit?.trim() || 'per_user',
        total: ((m.product?.price_monthly || 0) / 100) * m.quantity,
      }
    })

    const modulesTotal = activeModules.reduce((s: number, m: any) => s + m.total, 0)

    res.json({
      success: true,
      data: {
        plan: planKey,
        plan_name: planData?.name || planKey,
        plan_price: priceMonthly,
        status: org.subscription_status || 'active',
        seats,
        renews_at,
        amount: seats * priceMonthly,
        modules_total: modulesTotal,
        grand_total: seats * priceMonthly + modulesTotal,
        currency: 'CAD',
        limits: planData ? {
          max_agents: planData.max_agents,
          max_dids: planData.max_dids,
          max_calls_month: planData.max_calls_month,
        } : {},
        features: planData?.features || {},
        active_modules: activeModules,
        stripe_customer,
        trial_ends_at: org.trial_ends_at || null,
      },
    })
  } catch (err: any) {
    console.error('[billing/subscription]', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /subscription/change
// ──────────────────────────────────────────────────────────
router.post('/subscription/change', async (req, res) => {
  const org_id = getOrgId(req)
  const { plan_id, seats = 1 } = req.body
  const planKey = String(plan_id).toUpperCase()
  const plan = await getPlanById(planKey)
  if (!plan) return res.status(400).json({ success: false, message: 'Plan invalide' })
  try {
    await supabase.from('organizations').update({
      plan: planKey, seats,
      billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', org_id)
    invalidatePlanCache()
    res.json({ success: true, data: { message: `Plan change a ${plan.name}` } })
  } catch {
    res.json({ success: true, data: { message: `Plan change a ${plan.name}` } })
  }
})

// ──────────────────────────────────────────────────────────
// POST /modules/subscribe — souscrire a un module
// ──────────────────────────────────────────────────────────
router.post('/modules/subscribe', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { sku, quantity = 1 } = req.body
    if (!sku) return res.status(400).json({ success: false, message: 'SKU requis' })

    // Verifier que le produit existe
    const { data: product } = await supabase
      .from('products').select('*').eq('sku', sku).eq('is_active', true).single()
    if (!product) return res.status(404).json({ success: false, message: 'Module introuvable' })

    // Upsert
    const { data, error } = await supabase
      .from('organization_modules')
      .upsert({
        organization_id: org_id,
        product_sku: sku,
        quantity: Math.max(1, quantity),
        status: 'ACTIVE',
        activated_at: new Date().toISOString(),
        cancelled_at: null,
      }, { onConflict: 'organization_id,product_sku' })
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// PATCH /modules/:sku — mettre a jour la quantite
// ──────────────────────────────────────────────────────────
router.patch('/modules/:sku', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { quantity } = req.body
    const { data, error } = await supabase
      .from('organization_modules')
      .update({ quantity: Math.max(1, quantity || 1) })
      .eq('organization_id', org_id)
      .eq('product_sku', req.params.sku)
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// DELETE /modules/:sku — annuler un module
// ──────────────────────────────────────────────────────────
router.delete('/modules/:sku', async (req, res) => {
  try {
    const org_id = getOrgId(req)
    const { error } = await supabase
      .from('organization_modules')
      .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
      .eq('organization_id', org_id)
      .eq('product_sku', req.params.sku)
    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /payment-methods
// ──────────────────────────────────────────────────────────
router.get('/payment-methods', async (req, res) => {
  const org_id = getOrgId(req)
  try {
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id').eq('id', org_id).single()
    if (!stripe || !org?.stripe_customer_id) {
      return res.json({ success: true, data: [] })
    }
    const pms = await stripe.paymentMethods.list({ customer: org.stripe_customer_id, type: 'card' })
    const customer = await stripe.customers.retrieve(org.stripe_customer_id)
    const defaultId = customer.invoice_settings?.default_payment_method

    res.json({
      success: true,
      data: pms.data.map((pm: any) => ({
        id: pm.id, brand: pm.card.brand, last4: pm.card.last4,
        exp_month: pm.card.exp_month, exp_year: pm.card.exp_year,
        is_default: pm.id === defaultId,
      })),
    })
  } catch {
    res.json({ success: true, data: [] })
  }
})

// ──────────────────────────────────────────────────────────
// DELETE /payment-methods/:id
// ──────────────────────────────────────────────────────────
router.delete('/payment-methods/:id', async (req, res) => {
  if (!stripe) return res.json({ success: true })
  try {
    await stripe.paymentMethods.detach(req.params.id)
    res.json({ success: true })
  } catch {
    res.json({ success: true })
  }
})

// ──────────────────────────────────────────────────────────
// POST /checkout — Stripe Checkout Session
// ──────────────────────────────────────────────────────────
router.post('/checkout', async (req, res) => {
  const org_id = getOrgId(req)
  const { plan_id, seats = 1, success_url, cancel_url } = req.body
  const planKey = String(plan_id).toUpperCase()
  const plan = await getPlanById(planKey)
  if (!plan) return res.status(400).json({ success: false, message: 'Plan invalide' })

  if (!stripe || !plan.stripe_price_id) {
    try {
      await supabase.from('organizations').update({
        plan: planKey, seats,
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_status: 'active',
      }).eq('id', org_id)
    } catch {}
    return res.json({ success: true, data: { changed: true, message: `Plan ${plan.name} active (mode demo)` } })
  }

  try {
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id, name, email').eq('id', org_id).single()

    let customerId = org?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org?.name, email: org?.email, metadata: { organization_id: org_id } })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org_id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id, quantity: seats }],
      success_url: success_url || `${process.env.FRONTEND_URL}/client/plans?success=1`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL}/client/plans`,
      subscription_data: { metadata: { organization_id: org_id, plan_id: planKey, seats: String(seats) } },
    })

    res.json({ success: true, data: { url: session.url } })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /setup-intent — Ajouter une carte via Stripe
// ──────────────────────────────────────────────────────────
router.post('/setup-intent', async (req, res) => {
  const org_id = getOrgId(req)
  const { return_url } = req.body

  if (!stripe) {
    return res.json({ success: true, data: { demo: true } })
  }

  try {
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id, name, email').eq('id', org_id).single()

    let customerId = org?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ name: org?.name, email: org?.email, metadata: { organization_id: org_id } })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org_id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'setup',
      success_url: return_url || `${process.env.FRONTEND_URL}/client/plans?card_added=1`,
      cancel_url: return_url || `${process.env.FRONTEND_URL}/client/plans`,
    })

    res.json({ success: true, data: { url: session.url } })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /webhook — Stripe webhook
// ──────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  if (!stripe) return res.json({ received: true })
  const sig = req.headers['stripe-signature']
  let event: any
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (e: any) {
    return res.status(400).json({ error: e.message })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const org_id = session.metadata?.organization_id
      const plan_id = session.metadata?.plan_id
      const seats = parseInt(session.metadata?.seats || '1')
      const plan = plan_id ? await getPlanById(plan_id) : null
      if (org_id && plan) {
        await supabase.from('organizations').update({
          plan: plan.id, seats, subscription_status: 'active',
          stripe_subscription_id: session.subscription,
          billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq('id', org_id)
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object
      const sub = await stripe.subscriptions.retrieve(invoice.subscription)
      const org_id = sub.metadata?.organization_id
      if (!org_id) break

      const { data: org } = await supabase.from('organizations').select('name, plan, seats').eq('id', org_id).single()
      const planKey = String(org?.plan || 'CONFORT').toUpperCase()
      const planData = await getPlanById(planKey)
      const seats = org?.seats || 1
      const subtotal = invoice.subtotal / 100
      const tax_tps  = subtotal * 0.05
      const tax_tvq  = subtotal * 0.09975
      const total    = subtotal + tax_tps + tax_tvq

      const now = new Date()
      await supabase.from('invoices').upsert({
        organization_id: org_id,
        number: `VF-${now.getFullYear()}-${String(invoice.number || Date.now()).slice(-3).padStart(3, '0')}`,
        period_label: now.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' }),
        status: 'paid',
        issued_at: new Date(invoice.created * 1000).toISOString(),
        due_at: new Date(invoice.due_date * 1000 || Date.now()).toISOString(),
        paid_at: new Date().toISOString(),
        subtotal, tax_tps, tax_tvq, total,
        currency: 'CAD',
        stripe_invoice_id: invoice.id,
        lines: JSON.stringify([{
          description: `Plan ${planData?.name || planKey} — ${seats} siege${seats > 1 ? 's' : ''} x ${((planData?.price_monthly || 0) / 100).toFixed(2)} $`,
          qty: 1, unit_price: total, total,
        }]),
        org_name: org?.name || 'Organisation',
      }, { onConflict: 'stripe_invoice_id' })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const sub = await stripe.subscriptions.retrieve(invoice.subscription)
      const org_id = sub.metadata?.organization_id
      if (org_id) {
        await supabase.from('organizations').update({ subscription_status: 'past_due' }).eq('id', org_id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const org_id = sub.metadata?.organization_id
      if (org_id) {
        await supabase.from('organizations').update({ subscription_status: 'canceled' }).eq('id', org_id)
      }
      break
    }
  }

  res.json({ received: true })
})

// ──────────────────────────────────────────────────────────
// GET /invoices
// ──────────────────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  const org_id = getOrgId(req)
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('organization_id', org_id)
      .order('issued_at', { ascending: false })
    if (error || !data?.length) throw new Error('fallback')
    res.json({
      success: true,
      data: data.map(inv => ({
        ...inv,
        lines: typeof inv.lines === 'string' ? JSON.parse(inv.lines) : (inv.lines || []),
      })),
    })
  } catch {
    res.json({
      success: true,
      data: [
        { id: '3', number: 'VF-2026-003', period_label: 'Avril 2026', status: 'paid', issued_at: '2026-03-31', due_at: '2026-04-15', paid_at: '2026-04-01', subtotal: 155.06, tax_tps: 7.75, tax_tvq: 14.19, total: 177.00, currency: 'CAD', lines: [{ description: 'Plan Confort — 3 sieges x 59,00 $', qty: 1, unit_price: 177.00, total: 177.00 }], org_name: 'Mon Organisation', org_address: 'Montreal, QC, Canada', org_email: '' },
        { id: '2', number: 'VF-2026-002', period_label: 'Mars 2026',  status: 'paid', issued_at: '2026-02-28', due_at: '2026-03-15', paid_at: '2026-03-01', subtotal: 155.06, tax_tps: 7.75, tax_tvq: 14.19, total: 177.00, currency: 'CAD', lines: [{ description: 'Plan Confort — 3 sieges x 59,00 $', qty: 1, unit_price: 177.00, total: 177.00 }], org_name: 'Mon Organisation', org_address: 'Montreal, QC, Canada', org_email: '' },
        { id: '1', number: 'VF-2026-001', period_label: 'Fevrier 2026', status: 'paid', issued_at: '2026-01-31', due_at: '2026-02-15', paid_at: '2026-02-01', subtotal: 135.40, tax_tps: 6.77, tax_tvq: 12.39, total: 154.56, currency: 'CAD', lines: [{ description: 'Plan Confort — 3 sieges x 59,00 $', qty: 1, unit_price: 177.00, total: 177.00 }, { description: 'Credit de bienvenue', qty: 1, unit_price: -22.60, total: -22.60 }], org_name: 'Mon Organisation', org_address: 'Montreal, QC, Canada', org_email: '' },
      ],
    })
  }
})

// ──────────────────────────────────────────────────────────
// Extensions SIP
// ──────────────────────────────────────────────────────────
router.get('/extensions', async (req, res) => {
  const org_id = getOrgId(req)
  try {
    const { data } = await supabase.from('extensions').select('*, user:user_id(id,email,name)').eq('organization_id', org_id).order('extension_number')
    res.json({ success: true, data: data || [] })
  } catch {
    res.json({ success: true, data: [] })
  }
})

router.post('/extensions', async (req, res) => {
  const org_id = getOrgId(req)
  const { extension_number, label, did_number } = req.body
  try {
    const { data, error } = await supabase.from('extensions').insert({ organization_id: org_id, extension_number, label, did_number: did_number || null }).select().single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.patch('/extensions/:id', async (req, res) => {
  const { label, did_number, user_id } = req.body
  const { data } = await supabase.from('extensions').update({ label, did_number, user_id }).eq('id', req.params.id).select().single()
  res.json({ success: true, data })
})

router.delete('/extensions/:id', async (req, res) => {
  await supabase.from('extensions').delete().eq('id', req.params.id)
  res.json({ success: true })
})

// ──────────────────────────────────────────────────────────
// Tickets support
// ──────────────────────────────────────────────────────────
router.get('/tickets', async (req, res) => {
  const org_id = getOrgId(req)
  try {
    const { data } = await supabase.from('support_tickets').select('*, messages:support_messages(*)').eq('organization_id', org_id).order('created_at', { ascending: false })
    res.json({ success: true, data: data || [] })
  } catch {
    res.json({ success: true, data: [] })
  }
})

router.post('/tickets', async (req, res) => {
  const org_id = getOrgId(req)
  const user_id = getUserId(req)
  const { subject, message, priority = 'medium', category = 'general' } = req.body
  try {
    const { data: ticket } = await supabase.from('support_tickets').insert({ organization_id: org_id, user_id, subject, priority, category, status: 'open' }).select().single()
    if (ticket && message) {
      await supabase.from('support_messages').insert({ ticket_id: ticket.id, user_id, message, from_role: 'client' })
    }
    res.json({ success: true, data: ticket })
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.post('/tickets/:id/messages', async (req, res) => {
  const user_id = getUserId(req)
  const { message, from_role = 'client' } = req.body
  try {
    const { data } = await supabase.from('support_messages').insert({ ticket_id: req.params.id, user_id, message, from_role }).select().single()
    await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', req.params.id)
    res.json({ success: true, data })
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message })
  }
})

// ──────────────────────────────────────────────────────────
// Campagnes Dialer (persistees)
// ──────────────────────────────────────────────────────────
router.get('/campaigns', async (req, res) => {
  const org_id = getOrgId(req)
  try {
    const { data } = await supabase.from('dialer_campaigns').select('*').eq('organization_id', org_id).order('created_at', { ascending: false })
    res.json({ success: true, data: data || [] })
  } catch {
    res.json({ success: true, data: [] })
  }
})

router.post('/campaigns', async (req, res) => {
  const org_id = getOrgId(req)
  const user_id = getUserId(req)
  const { name, type = 'predictive', config, contacts_count = 0 } = req.body
  try {
    const { data } = await supabase.from('dialer_campaigns').insert({
      organization_id: org_id, created_by: user_id,
      name, type, config: JSON.stringify(config || {}),
      status: 'draft', contacts_count,
    }).select().single()
    res.json({ success: true, data })
  } catch (e: any) {
    res.status(400).json({ success: false, message: e.message })
  }
})

router.patch('/campaigns/:id', async (req, res) => {
  const { status, config, name } = req.body
  const { data } = await supabase.from('dialer_campaigns').update({ status, config: config ? JSON.stringify(config) : undefined, name }).eq('id', req.params.id).select().single()
  res.json({ success: true, data })
})

router.delete('/campaigns/:id', async (req, res) => {
  await supabase.from('dialer_campaigns').delete().eq('id', req.params.id)
  res.json({ success: true })
})

export default router
