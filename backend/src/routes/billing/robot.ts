import { Router, Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import { ROBOT_CREDITS_PACKS, getRobotCreditsPriceId } from '../../services/stripe/setup'

const router = Router()
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let stripe: any = null
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require('stripe')
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  }
} catch {}

const VALID_ROBOT_PLANS = ['ROBOT_STARTER', 'ROBOT_BUSINESS', 'ROBOT_ENTERPRISE']

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!orgId) throw new Error('Organisation introuvable')
  return String(orgId)
}

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

// ── GET /plans — public ──────────────────────────────────
export async function robotPlansHandler(_req: Request, res: Response) {
  try {
    const { data: plans } = await supabase
      .from('plan_definitions')
      .select('id, name, description, price_monthly, price_yearly, features_list, minutes_included, overage_rate, max_concurrent_calls, max_contacts_per_campaign, sort_order, highlight')
      .in('id', VALID_ROBOT_PLANS)
      .order('sort_order', { ascending: true })

    res.json({
      success: true,
      data: (plans || []).map((p: any) => ({
        plan_code: p.id, name: p.name, description: p.description,
        price_monthly: p.price_monthly, price_yearly: p.price_yearly,
        features: p.features_list || [], minutes_included: p.minutes_included || 0,
        overage_rate: parseFloat(p.overage_rate) || 0,
        max_concurrent_calls: p.max_concurrent_calls || 20,
        max_contacts_per_campaign: p.max_contacts_per_campaign || 10000,
        sort_order: p.sort_order, popular: p.highlight || p.id === 'ROBOT_BUSINESS',
      })),
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
}
router.get('/plans', robotPlansHandler)

// ── GET /credits-plans — public ──────────────────────────
export function creditsPlansHandler(_req: Request, res: Response) {
  res.json({
    success: true,
    data: ROBOT_CREDITS_PACKS.map(p => ({
      code: p.code, minutes: p.minutes, amount: p.amount, name: p.name,
      estimatedCalls30s: Math.round(p.minutes * 2),
    })),
  })
}
router.get('/credits-plans', creditsPlansHandler)

// ── GET /summary ─────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const { data: sub } = await supabase
      .from('org_robot_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing', 'past_due', 'canceling'])
      .maybeSingle()

    let activePlan: any = null
    if (sub?.plan_code) {
      const { data: plan } = await supabase
        .from('plan_definitions')
        .select('id, name, price_monthly, price_yearly, minutes_included, overage_rate, max_concurrent_calls, max_contacts_per_campaign')
        .eq('id', sub.plan_code)
        .single()
      if (plan) activePlan = {
        plan_code: plan.id, name: plan.name, price_monthly: plan.price_monthly,
        minutes_included: plan.minutes_included, overage_rate: parseFloat(plan.overage_rate) || 0,
        max_concurrent_calls: plan.max_concurrent_calls, max_contacts_per_campaign: plan.max_contacts_per_campaign,
      }
    }

    // Minutes usage current month
    const monthStr = currentMonthStr()
    const { data: usage } = await supabase
      .from('robot_minutes_usage')
      .select('*')
      .eq('organization_id', orgId)
      .eq('month', monthStr)
      .maybeSingle()

    const minutesUsed = parseFloat(usage?.minutes_used || '0')
    const minutesIncluded = usage?.minutes_included || activePlan?.minutes_included || 0
    const minutesOverage = parseFloat(usage?.minutes_overage || '0')

    // Credits balance
    const { data: credits } = await supabase
      .from('robot_credits')
      .select('id, minutes_purchased, minutes_remaining, expires_at')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })

    const creditsBalance = (credits || []).reduce((s: number, c: any) => s + (c.minutes_remaining || 0), 0)

    res.json({
      success: true,
      data: {
        activePlan,
        billingCycle: sub?.billing_cycle || 'monthly',
        status: sub?.status || null,
        trialEndsAt: sub?.trial_ends_at || null,
        nextPaymentAt: sub?.current_period_end || null,
        cancelAt: sub?.canceled_at || null,
        minutesUsage: {
          minutesIncluded, minutesUsed,
          minutesRemaining: Math.max(0, minutesIncluded - minutesUsed),
          minutesOverage,
          overageAmount: parseFloat(usage?.overage_amount || '0'),
          percentUsed: minutesIncluded > 0 ? Math.round((minutesUsed / minutesIncluded) * 100) : 0,
          month: monthStr,
        },
        creditsBalance,
        credits: (credits || []).map((c: any) => ({
          id: c.id, minutesPurchased: c.minutes_purchased,
          minutesRemaining: c.minutes_remaining, expiresAt: c.expires_at,
        })),
      },
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /prorata ─────────────────────────────────────────
router.get('/prorata', async (req: Request, res: Response) => {
  try {
    const planCode = String(req.query.planCode || '')
    const billingCycle = String(req.query.billingCycle || 'monthly')

    if (!VALID_ROBOT_PLANS.includes(planCode)) return res.status(400).json({ success: false, error: 'Plan invalide' })

    const { data: plan } = await supabase.from('plan_definitions').select('price_monthly, price_yearly').eq('id', planCode).single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = Math.max(1, daysInMonth - now.getDate() + 1)
    const price = billingCycle === 'yearly' ? Math.round((plan.price_yearly || plan.price_monthly * 10) / 12) : plan.price_monthly
    const prorataAmount = Math.round((daysRemaining / daysInMonth) * price)

    res.json({
      success: true,
      data: {
        prorataAmount, nextPaymentDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
        nextPaymentAmount: price, daysRemaining, daysInMonth,
      },
    })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── GET /minutes-history ─────────────────────────────────
router.get('/minutes-history', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const months = parseInt(String(req.query.months || '6'))
    const { data } = await supabase
      .from('robot_minutes_usage')
      .select('month, minutes_used, minutes_included, minutes_overage, overage_amount')
      .eq('organization_id', orgId)
      .order('month', { ascending: false })
      .limit(months)
    res.json({ success: true, data: data || [] })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── POST /subscribe ──────────────────────────────────────
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { planCode, billingCycle = 'monthly' } = req.body

    if (!VALID_ROBOT_PLANS.includes(planCode)) return res.status(400).json({ success: false, error: 'Plan invalide' })

    const { data: plan } = await supabase
      .from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, minutes_included, stripe_price_id_monthly, stripe_price_id_yearly')
      .eq('id', planCode).single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    // Get or create Stripe customer
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id, name, email').eq('id', orgId).single()
    let customerId = org?.stripe_customer_id
    if (stripe && !customerId) {
      const customer = await stripe.customers.create({ email: org?.email || '', name: org?.name || '', metadata: { organization_id: orgId } })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
    }

    const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly

    // Check existing subscription
    const { data: existing } = await supabase.from('org_robot_subscriptions')
      .select('*').eq('organization_id', orgId).in('status', ['active', 'trialing', 'past_due']).maybeSingle()

    if (!existing) {
      // New subscription
      let stripeSubId: string | null = null
      let clientSecret: string | null = null
      const trialEnd = new Date(Date.now() + 14 * 86400000).toISOString()

      if (stripe && priceId) {
        const subscription = await stripe.subscriptions.create({
          customer: customerId, items: [{ price: priceId, quantity: 1 }],
          trial_period_days: 14, payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'], currency: 'cad',
          metadata: { orgId, planCode, serviceType: 'robot' },
        })
        stripeSubId = subscription.id
        clientSecret = (subscription as any).latest_invoice?.payment_intent?.client_secret || null
      } else { stripeSubId = 'demo_robot_' + Date.now() }

      await supabase.from('org_robot_subscriptions').upsert({
        organization_id: orgId, plan_code: planCode, stripe_subscription_id: stripeSubId,
        stripe_customer_id: customerId, billing_cycle: billingCycle, status: 'trialing',
        quantity: 1, trial_ends_at: trialEnd,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
        canceled_at: null,
      }, { onConflict: 'organization_id' })

      // Init minutes usage
      await supabase.from('robot_minutes_usage').upsert({
        organization_id: orgId, month: currentMonthStr(),
        minutes_included: plan.minutes_included || 0,
      }, { onConflict: 'organization_id,month' })

      return res.json({
        success: true,
        data: { subscriptionId: stripeSubId, clientSecret, planCode, minutesIncluded: plan.minutes_included, trialEnd },
      })
    }

    // Existing — plan change
    if (stripe && existing.stripe_subscription_id && priceId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(existing.stripe_subscription_id)
        const itemId = stripeSub.items.data[0]?.id
        if (itemId) await stripe.subscriptionItems.update(itemId, { price: priceId, proration_behavior: 'create_prorations' })
      } catch (e: any) { console.error('[robot/subscribe] Stripe error:', e.message) }
    }

    await supabase.from('org_robot_subscriptions').update({
      plan_code: planCode, billing_cycle: billingCycle,
    }).eq('id', existing.id)

    // Update minutes_included for current month
    await supabase.from('robot_minutes_usage').update({ minutes_included: plan.minutes_included || 0 })
      .eq('organization_id', orgId).eq('month', currentMonthStr())

    res.json({ success: true, data: { planCode, minutesIncluded: plan.minutes_included } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── PUT /plan ────────────────────────────────────────────
router.put('/plan', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { planCode, billingCycle = 'monthly' } = req.body
    if (!VALID_ROBOT_PLANS.includes(planCode)) return res.status(400).json({ success: false, error: 'Plan invalide' })

    const { data: plan } = await supabase.from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, minutes_included, max_concurrent_calls, stripe_price_id_monthly, stripe_price_id_yearly')
      .eq('id', planCode).single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    const { data: sub } = await supabase.from('org_robot_subscriptions')
      .select('*').eq('organization_id', orgId).in('status', ['active', 'trialing', 'past_due']).maybeSingle()
    if (!sub) return res.status(400).json({ success: false, error: 'Aucun abonnement robot actif' })

    const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly
    if (stripe && sub.stripe_subscription_id && priceId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
        const itemId = stripeSub.items.data[0]?.id
        if (itemId) await stripe.subscriptionItems.update(itemId, { price: priceId, proration_behavior: 'create_prorations' })
      } catch {}
    }

    await supabase.from('org_robot_subscriptions').update({ plan_code: planCode, billing_cycle: billingCycle }).eq('id', sub.id)
    await supabase.from('robot_minutes_usage').update({ minutes_included: plan.minutes_included || 0 })
      .eq('organization_id', orgId).eq('month', currentMonthStr())

    const price = billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly
    res.json({ success: true, data: { planCode, newMonthlyPrice: price, newMinutesIncluded: plan.minutes_included, newMaxConcurrent: plan.max_concurrent_calls } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── DELETE /cancel ───────────────────────────────────────
router.delete('/cancel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { data: sub } = await supabase.from('org_robot_subscriptions')
      .select('*').eq('organization_id', orgId).in('status', ['active', 'trialing']).maybeSingle()
    if (!sub) return res.status(400).json({ success: false, error: 'Aucun abonnement actif' })

    if (stripe && sub.stripe_subscription_id) {
      try { await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true }) } catch {}
    }
    const cancelAt = sub.current_period_end || new Date(Date.now() + 30 * 86400000).toISOString()
    await supabase.from('org_robot_subscriptions').update({ status: 'canceling', canceled_at: cancelAt }).eq('id', sub.id)
    res.json({ success: true, data: { cancelAt } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── POST /buy-credits ────────────────────────────────────
router.post('/buy-credits', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { creditsPack } = req.body

    const pack = ROBOT_CREDITS_PACKS.find(p => p.code === creditsPack)
    if (!pack) return res.status(400).json({ success: false, error: 'Pack invalide' })

    // Get or create Stripe customer
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id, name, email').eq('id', orgId).single()
    let customerId = org?.stripe_customer_id
    if (stripe && !customerId) {
      const customer = await stripe.customers.create({ email: org?.email || '', name: org?.name || '', metadata: { organization_id: orgId } })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
    }

    if (stripe) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: pack.amount, currency: 'cad', customer: customerId,
        metadata: { orgId, creditsPack: pack.code, minutes: String(pack.minutes), type: 'robot_credits' },
      })
      return res.json({ success: true, data: { clientSecret: paymentIntent.client_secret, amount: pack.amount, minutesPurchased: pack.minutes } })
    }

    // Demo mode — insert credits directly
    await supabase.from('robot_credits').insert({
      organization_id: orgId, minutes_purchased: pack.minutes, amount_paid: pack.amount / 100,
      stripe_payment_intent_id: 'demo_pi_' + Date.now(), status: 'active', minutes_remaining: pack.minutes,
    })
    res.json({ success: true, data: { clientSecret: null, amount: pack.amount, minutesPurchased: pack.minutes } })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── POST /track-minutes (internal) ───────────────────────
router.post('/track-minutes', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { campaignId, minutesUsed } = req.body
    const result = await trackRobotMinutes(orgId, minutesUsed)
    res.json({ success: true, data: result })
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }) }
})

// ── Track minutes helper (exported) ──────────────────────
export async function trackRobotMinutes(orgId: string, minutesUsed: number) {
  const monthStr = currentMonthStr()

  // Get or create usage record
  const { data: existing } = await supabase.from('robot_minutes_usage')
    .select('*').eq('organization_id', orgId).eq('month', monthStr).maybeSingle()

  let used = parseFloat(existing?.minutes_used || '0') + minutesUsed
  const included = existing?.minutes_included || 0

  let overage = Math.max(0, used - included)
  let creditsUsed = 0

  // Consume credits for overage
  if (overage > 0) {
    const { data: credits } = await supabase.from('robot_credits')
      .select('*').eq('organization_id', orgId).eq('status', 'active')
      .gt('expires_at', new Date().toISOString()).gt('minutes_remaining', 0)
      .order('expires_at', { ascending: true })

    let remaining = overage
    for (const credit of credits || []) {
      if (remaining <= 0) break
      const consume = Math.min(remaining, credit.minutes_remaining)
      await supabase.from('robot_credits').update({ minutes_remaining: credit.minutes_remaining - consume }).eq('id', credit.id)
      remaining -= consume
      creditsUsed += consume
    }
    overage = remaining // remaining after credits
  }

  // Get overage rate
  const { data: sub } = await supabase.from('org_robot_subscriptions')
    .select('plan_code').eq('organization_id', orgId).in('status', ['active', 'trialing']).maybeSingle()
  let overageRate = 0.05
  if (sub?.plan_code) {
    const { data: plan } = await supabase.from('plan_definitions').select('overage_rate').eq('id', sub.plan_code).single()
    if (plan) overageRate = parseFloat(plan.overage_rate) || 0.05
  }

  const overageAmount = parseFloat((overage * overageRate).toFixed(2))
  const percentUsed = included > 0 ? Math.round((used / included) * 100) : 0

  await supabase.from('robot_minutes_usage').upsert({
    organization_id: orgId, month: monthStr,
    minutes_used: used, minutes_included: included,
    minutes_overage: overage, overage_amount: overageAmount,
  }, { onConflict: 'organization_id,month' })

  return {
    minutesRemaining: Math.max(0, included - used),
    minutesOverage: overage, overageAmount, creditsUsed, percentUsed,
  }
}

// ── Invoice robot overage (exported for cron) ────────────
export async function invoiceRobotOverage(): Promise<number> {
  if (!stripe) return 0
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`
  const monthLabel = prev.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })

  const { data: rows } = await supabase.from('robot_minutes_usage')
    .select('*, org:organization_id(stripe_customer_id)')
    .eq('month', monthStr).gt('minutes_overage', 0).eq('overage_invoiced', false)

  let count = 0
  for (const row of rows || []) {
    const customerId = (row as any).org?.stripe_customer_id
    if (!customerId) continue
    try {
      await stripe.invoiceItems.create({
        customer: customerId, amount: Math.round(row.overage_amount * 100), currency: 'cad',
        description: `Surplus Robot ${monthLabel} — ${row.minutes_overage} min`,
      })
      const inv = await stripe.invoices.create({ customer: customerId, currency: 'cad', auto_advance: true })
      await stripe.invoices.finalizeInvoice(inv.id)
      await stripe.invoices.pay(inv.id)
      await supabase.from('robot_minutes_usage').update({ overage_invoiced: true }).eq('id', row.id)
      count++
    } catch (err: any) { console.error(`[Robot Overage] Failed for org ${row.organization_id}:`, err.message) }
  }
  return count
}

export default router
