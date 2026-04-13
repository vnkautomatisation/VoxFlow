import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { invalidateModuleCache } from '../../middleware/requireModule'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let stripe: any = null
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require('stripe')
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  }
} catch {}

const VALID_MODULES = ['ia_basic', 'ia_coaching', 'campaigns', 'analytics', 'sms']
const PER_ORG_MODULES = ['sms']

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!orgId) throw new Error('Organisation introuvable')
  return String(orgId)
}

// ──────────────────────────────────────────────────────────
// GET /plans — public, retourne les 5 modules addon
// ──────────────────────────────────────────────────────────
export async function addonPlansHandler(_req: Request, res: Response) {
  try {
    const { data: plans, error } = await supabase
      .from('plan_definitions')
      .select('id, name, description, price_monthly, price_yearly, features_list, module_type, sms_overage_rate, sort_order')
      .eq('is_addon', true)
      .order('sort_order', { ascending: true })

    if (error) throw error

    res.json({
      success: true,
      data: (plans || []).map((p: any) => ({
        plan_code: p.id,
        name: p.name,
        module_type: p.module_type,
        price_monthly: p.price_monthly,
        price_yearly: p.price_yearly,
        features: p.features_list || [],
        description: p.description,
        sms_overage_rate: parseFloat(p.sms_overage_rate) || 0,
        sort_order: p.sort_order,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}
router.get('/plans', addonPlansHandler)

// ──────────────────────────────────────────────────────────
// GET /summary — modules actifs de l'org
// ──────────────────────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const { data: addons } = await supabase
      .from('org_addons')
      .select('module_type, plan_code, status, billing_cycle, quantity, trial_ends_at, current_period_end, canceled_at')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing', 'past_due', 'canceling'])

    // Get plan prices
    const planCodes = (addons || []).map((a: any) => a.plan_code).filter(Boolean)
    const { data: planDefs } = planCodes.length > 0
      ? await supabase.from('plan_definitions').select('id, price_monthly, module_type').in('id', planCodes)
      : { data: [] }
    const priceMap: Record<string, number> = {}
    for (const p of planDefs || []) priceMap[p.id] = p.price_monthly

    // Count agents
    const { count: nbAgents } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')
    const agentCount = nbAgents || 1

    let monthlyTotal = 0
    const activeModules = (addons || []).map((a: any) => {
      const price = priceMap[a.plan_code] || 0
      const isPerOrg = PER_ORG_MODULES.includes(a.module_type)
      const lineTotal = isPerOrg ? price : price * agentCount
      monthlyTotal += lineTotal
      return {
        module_type: a.module_type,
        plan_code: a.plan_code,
        status: a.status,
        billingCycle: a.billing_cycle,
        price_monthly: price,
        quantity: a.quantity,
        trialEndsAt: a.trial_ends_at,
        currentPeriodEnd: a.current_period_end,
        cancelAt: a.canceled_at,
      }
    })

    // SMS usage current month
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const { data: smsRow } = await supabase
      .from('sms_usage')
      .select('*')
      .eq('organization_id', orgId)
      .eq('month', monthStr)
      .maybeSingle()

    const smsSent = smsRow?.sms_sent || 0
    const smsReceived = smsRow?.sms_received || 0
    const smsIncluded = smsRow?.sms_included || 1000
    const totalSms = smsSent + smsReceived
    const smsOverage = Math.max(0, totalSms - smsIncluded)

    res.json({
      success: true,
      data: {
        activeModules,
        monthlyTotal,
        nbAgents: agentCount,
        smsUsage: {
          smsIncluded,
          smsSent,
          smsReceived,
          smsOverage,
          overageAmount: parseFloat((smsRow?.overage_amount || 0).toString()),
          percentUsed: smsIncluded > 0 ? Math.round((totalSms / smsIncluded) * 100) : 0,
          month: monthStr,
        },
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /prorata
// ──────────────────────────────────────────────────────────
router.get('/prorata', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const moduleType = String(req.query.moduleType || '')
    const billingCycle = String(req.query.billingCycle || 'monthly')

    if (!VALID_MODULES.includes(moduleType)) {
      return res.status(400).json({ success: false, error: 'Module type invalide' })
    }

    const planCode = 'MODULE_' + moduleType.toUpperCase()
    const { data: plan } = await supabase
      .from('plan_definitions')
      .select('price_monthly, price_yearly')
      .eq('id', planCode)
      .single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    const { count: nbAgents } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)

    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysRemaining = Math.max(1, Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000))

    const pricePerUnit = billingCycle === 'yearly'
      ? Math.round((plan.price_yearly || plan.price_monthly * 10) / 12)
      : plan.price_monthly

    const isPerOrg = PER_ORG_MODULES.includes(moduleType)
    const qty = isPerOrg ? 1 : agentCount
    const prorataAmount = Math.round((daysRemaining / daysInMonth) * pricePerUnit * qty)
    const nextPaymentDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

    res.json({
      success: true,
      data: {
        prorataAmount,
        nextPaymentDate,
        nextPaymentAmount: pricePerUnit * qty,
        nbAgents: agentCount,
        billingUnit: isPerOrg ? 'per_org' : 'per_agent',
        pricePerUnit,
        daysRemaining,
        daysInMonth,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /sms/usage
// ──────────────────────────────────────────────────────────
router.get('/sms/usage', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const { data: smsRow } = await supabase
      .from('sms_usage')
      .select('*')
      .eq('organization_id', orgId)
      .eq('month', monthStr)
      .maybeSingle()

    const smsSent = smsRow?.sms_sent || 0
    const smsReceived = smsRow?.sms_received || 0
    const smsIncluded = smsRow?.sms_included || 1000
    const totalSms = smsSent + smsReceived

    res.json({
      success: true,
      data: {
        smsIncluded,
        smsSent,
        smsReceived,
        smsOverage: Math.max(0, totalSms - smsIncluded),
        overageAmount: parseFloat((smsRow?.overage_amount || 0).toString()),
        percentUsed: smsIncluded > 0 ? Math.round((totalSms / smsIncluded) * 100) : 0,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /sms/history — last 6 months
// ──────────────────────────────────────────────────────────
router.get('/sms/history', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data } = await supabase
      .from('sms_usage')
      .select('month, sms_sent, sms_received, sms_overage, overage_amount')
      .eq('organization_id', orgId)
      .order('month', { ascending: false })
      .limit(6)

    res.json({ success: true, data: data || [] })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /subscribe — activer un module addon
// ──────────────────────────────────────────────────────────
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { moduleType, billingCycle = 'monthly' } = req.body

    if (!VALID_MODULES.includes(moduleType)) {
      return res.status(400).json({ success: false, error: 'Module type invalide' })
    }

    // Require active telephony plan
    const { data: telSub } = await supabase
      .from('org_subscriptions')
      .select('id')
      .eq('organization_id', orgId)
      .eq('service_type', 'TELEPHONY')
      .in('status', ['active', 'trialing'])
      .limit(1)
      .maybeSingle()

    if (!telSub) {
      return res.status(403).json({ success: false, error: 'Un forfait telephonie actif est requis pour ajouter des modules.' })
    }

    // Check not already active
    const { data: existing } = await supabase
      .from('org_addons')
      .select('id, status')
      .eq('organization_id', orgId)
      .eq('module_type', moduleType)
      .in('status', ['active', 'trialing'])
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ success: false, error: 'Module deja actif' })
    }

    // IA logic: ia_coaching includes ia_basic
    if (moduleType === 'ia_basic') {
      const { data: coaching } = await supabase
        .from('org_addons')
        .select('id')
        .eq('organization_id', orgId)
        .eq('module_type', 'ia_coaching')
        .in('status', ['active', 'trialing'])
        .maybeSingle()
      if (coaching) {
        return res.status(400).json({ success: false, error: 'IA Coaching Live inclut deja IA Basique.' })
      }
    }

    if (moduleType === 'ia_coaching') {
      // Cancel ia_basic if active
      const { data: basicAddon } = await supabase
        .from('org_addons')
        .select('id, stripe_subscription_id')
        .eq('organization_id', orgId)
        .eq('module_type', 'ia_basic')
        .in('status', ['active', 'trialing'])
        .maybeSingle()
      if (basicAddon) {
        if (stripe && basicAddon.stripe_subscription_id) {
          try { await stripe.subscriptions.cancel(basicAddon.stripe_subscription_id) } catch {}
        }
        await supabase.from('org_addons').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', basicAddon.id)
      }
    }

    // Get plan
    const planCode = 'MODULE_' + moduleType.toUpperCase()
    const { data: plan } = await supabase
      .from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly')
      .eq('id', planCode)
      .single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    // Count agents
    const { count: nbAgents } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)
    const isPerOrg = PER_ORG_MODULES.includes(moduleType)
    const qty = isPerOrg ? 1 : agentCount

    // Get or create Stripe customer
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name, email')
      .eq('id', orgId)
      .single()

    let customerId = org?.stripe_customer_id
    if (stripe && !customerId) {
      const customer = await stripe.customers.create({
        email: org?.email || '',
        name: org?.name || '',
        metadata: { organization_id: orgId },
      })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
    }

    const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly

    // Check if first addon ever (for trial)
    const { count: addonCount } = await supabase
      .from('org_addons')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
    const isFirstAddon = (addonCount || 0) === 0

    let stripeSubId: string | null = null
    let stripeItemId: string | null = null
    let clientSecret: string | null = null
    let trialEnd: string | null = null

    if (stripe && priceId) {
      const subParams: any = {
        customer: customerId,
        items: [{ price: priceId, quantity: qty }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        currency: 'cad',
        metadata: { orgId, moduleType, serviceType: 'addon' },
      }
      if (isFirstAddon) subParams.trial_period_days = 14

      const subscription = await stripe.subscriptions.create(subParams)
      stripeSubId = subscription.id
      stripeItemId = subscription.items.data[0]?.id || null
      clientSecret = (subscription as any).latest_invoice?.payment_intent?.client_secret || null
      if (isFirstAddon) trialEnd = new Date(Date.now() + 14 * 86400000).toISOString()
    } else {
      // Demo mode
      stripeSubId = 'demo_addon_' + Date.now()
      if (isFirstAddon) trialEnd = new Date(Date.now() + 14 * 86400000).toISOString()
    }

    const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString()
    await supabase.from('org_addons').upsert({
      organization_id: orgId,
      module_type: moduleType,
      plan_code: planCode,
      stripe_subscription_id: stripeSubId,
      stripe_subscription_item_id: stripeItemId,
      stripe_customer_id: customerId,
      billing_cycle: billingCycle,
      status: isFirstAddon ? 'trialing' : 'active',
      quantity: qty,
      trial_ends_at: trialEnd,
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd,
      canceled_at: null,
    }, { onConflict: 'organization_id,module_type' })

    invalidateModuleCache(orgId)

    const unitPrice = billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly

    res.json({
      success: true,
      data: {
        subscriptionId: stripeSubId,
        clientSecret,
        moduleType,
        amount: unitPrice * qty,
        trialEnd,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// PUT /:moduleType/upgrade — change billing cycle
// ──────────────────────────────────────────────────────────
router.put('/:moduleType/upgrade', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const moduleType = String(req.params.moduleType)
    const { newBillingCycle } = req.body

    if (!VALID_MODULES.includes(moduleType)) {
      return res.status(400).json({ success: false, error: 'Module type invalide' })
    }

    const { data: addon } = await supabase
      .from('org_addons')
      .select('*')
      .eq('organization_id', orgId)
      .eq('module_type', moduleType)
      .in('status', ['active', 'trialing'])
      .maybeSingle()

    if (!addon) return res.status(404).json({ success: false, error: 'Module non actif' })

    const planCode = addon.plan_code || 'MODULE_' + moduleType.toUpperCase()
    const { data: plan } = await supabase
      .from('plan_definitions')
      .select('price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly')
      .eq('id', planCode)
      .single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    const newPriceId = newBillingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly

    if (stripe && addon.stripe_subscription_item_id && newPriceId) {
      try {
        await stripe.subscriptionItems.update(addon.stripe_subscription_item_id, {
          price: newPriceId,
          proration_behavior: 'create_prorations',
        })
      } catch (err: any) {
        console.error('[addons/upgrade] Stripe error:', err.message)
      }
    }

    await supabase
      .from('org_addons')
      .update({ billing_cycle: newBillingCycle })
      .eq('id', addon.id)

    const newPrice = newBillingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly
    const nextPaymentDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()

    res.json({ success: true, data: { newAmount: newPrice * addon.quantity, nextPaymentDate } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// DELETE /:moduleType/cancel
// ──────────────────────────────────────────────────────────
router.delete('/:moduleType/cancel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const moduleType = String(req.params.moduleType)

    const { data: addon } = await supabase
      .from('org_addons')
      .select('*')
      .eq('organization_id', orgId)
      .eq('module_type', moduleType)
      .in('status', ['active', 'trialing'])
      .maybeSingle()

    if (!addon) return res.status(404).json({ success: false, error: 'Module non actif' })

    if (stripe && addon.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(addon.stripe_subscription_id, { cancel_at_period_end: true })
      } catch (err: any) {
        console.error('[addons/cancel] Stripe error:', err.message)
      }
    }

    const cancelAt = addon.current_period_end || new Date(Date.now() + 30 * 86400000).toISOString()
    await supabase
      .from('org_addons')
      .update({ status: 'canceling', canceled_at: cancelAt })
      .eq('id', addon.id)

    invalidateModuleCache(orgId)

    res.json({ success: true, data: { cancelAt } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /sync-quantity
// ──────────────────────────────────────────────────────────
router.post('/sync-quantity', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const { count: nbAgents } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)

    const { data: addons } = await supabase
      .from('org_addons')
      .select('id, module_type, stripe_subscription_item_id')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing', 'past_due'])

    const synced: { moduleType: string; quantity: number }[] = []

    for (const addon of addons || []) {
      if (PER_ORG_MODULES.includes(addon.module_type)) continue

      if (stripe && addon.stripe_subscription_item_id) {
        try {
          await stripe.subscriptionItems.update(addon.stripe_subscription_item_id, { quantity: agentCount })
        } catch {}
      }
      await supabase.from('org_addons').update({ quantity: agentCount }).eq('id', addon.id)
      synced.push({ moduleType: addon.module_type, quantity: agentCount })
    }

    res.json({ success: true, data: { synced } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /sms/track — track SMS usage
// ──────────────────────────────────────────────────────────
router.post('/sms/track', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { direction, count = 1 } = req.body
    if (!['sent', 'received'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'direction doit etre sent ou received' })
    }

    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    // Upsert sms_usage
    const { data: existing } = await supabase
      .from('sms_usage')
      .select('*')
      .eq('organization_id', orgId)
      .eq('month', monthStr)
      .maybeSingle()

    let smsSent = (existing?.sms_sent || 0) + (direction === 'sent' ? count : 0)
    let smsReceived = (existing?.sms_received || 0) + (direction === 'received' ? count : 0)
    const smsIncluded = existing?.sms_included || 1000
    const totalSms = smsSent + smsReceived
    const smsOverage = Math.max(0, totalSms - smsIncluded)

    // Get overage rate
    const { data: smsPlan } = await supabase
      .from('plan_definitions')
      .select('sms_overage_rate')
      .eq('id', 'MODULE_SMS')
      .single()
    const rate = parseFloat(smsPlan?.sms_overage_rate) || 0.018
    const overageAmount = parseFloat((smsOverage * rate).toFixed(2))

    await supabase.from('sms_usage').upsert({
      organization_id: orgId,
      month: monthStr,
      sms_sent: smsSent,
      sms_received: smsReceived,
      sms_included: smsIncluded,
      sms_overage: smsOverage,
      overage_amount: overageAmount,
    }, { onConflict: 'organization_id,month' })

    const percentUsed = smsIncluded > 0 ? Math.round((totalSms / smsIncluded) * 100) : 0

    res.json({
      success: true,
      data: {
        smsRemaining: Math.max(0, smsIncluded - totalSms),
        smsOverage,
        overageAmount,
        percentUsed,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /sms/invoice-overage — bill SMS overages
// ──────────────────────────────────────────────────────────
export async function invoiceSmsOverage(): Promise<number> {
  if (!stripe) return 0

  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`
  const monthLabel = prevMonth.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })

  const { data: rows } = await supabase
    .from('sms_usage')
    .select('*, org:organization_id(stripe_customer_id)')
    .eq('month', monthStr)
    .gt('sms_overage', 0)
    .eq('overage_invoiced', false)

  let invoiced = 0
  for (const row of rows || []) {
    const customerId = (row as any).org?.stripe_customer_id
    if (!customerId) continue

    try {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(row.overage_amount * 100),
        currency: 'cad',
        description: `Surplus SMS ${monthLabel} — ${row.sms_overage} SMS x 0,018 CAD$`,
      })

      const invoice = await stripe.invoices.create({ customer: customerId, currency: 'cad', auto_advance: true })
      await stripe.invoices.finalizeInvoice(invoice.id)
      await stripe.invoices.pay(invoice.id)

      await supabase.from('sms_usage').update({ overage_invoiced: true }).eq('id', row.id)
      invoiced++
    } catch (err: any) {
      console.error(`[SMS Overage] Failed for org ${row.organization_id}:`, err.message)
    }
  }

  return invoiced
}

router.post('/sms/invoice-overage', async (_req: Request, res: Response) => {
  try {
    const count = await invoiceSmsOverage()
    res.json({ success: true, data: { invoiced: count } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── Export helper for agent sync ─────────────────────────
export async function syncAddonQuantities(orgId: string): Promise<void> {
  try {
    const { count: nbAgents } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)

    const { data: addons } = await supabase
      .from('org_addons')
      .select('id, module_type, stripe_subscription_item_id')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing', 'past_due'])

    for (const addon of addons || []) {
      if (PER_ORG_MODULES.includes(addon.module_type)) continue
      if (stripe && addon.stripe_subscription_item_id) {
        try { await stripe.subscriptionItems.update(addon.stripe_subscription_item_id, { quantity: agentCount }) } catch {}
      }
      await supabase.from('org_addons').update({ quantity: agentCount }).eq('id', addon.id)
    }
  } catch {}
}

// ── Export helper: cancel all addons for an org ──────────
export async function cancelAllAddons(orgId: string): Promise<void> {
  const { data: addons } = await supabase
    .from('org_addons')
    .select('id, stripe_subscription_id, module_type')
    .eq('organization_id', orgId)
    .in('status', ['active', 'trialing', 'canceling'])

  for (const addon of addons || []) {
    if (stripe && addon.stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(addon.stripe_subscription_id) } catch {}
    }
    await supabase.from('org_addons').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', addon.id)
  }
  invalidateModuleCache(orgId)
}

export default router
