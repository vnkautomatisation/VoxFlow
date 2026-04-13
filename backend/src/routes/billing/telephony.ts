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

const VALID_PLAN_CODES = ['TELCO_INBOUND', 'TELCO_CA_US', 'TELCO_CA_US_FR', 'TELCO_INTL']

function getOrgId(req: Request): string {
  const orgId = (req as any).user?.organizationId || (req as any).user?.organization_id
  if (!orgId) throw new Error('Organisation introuvable')
  return String(orgId)
}

// ──────────────────────────────────────────────────────────
// GET /plans — public, retourne les 4 plans TELCO_*
// ──────────────────────────────────────────────────────────
export async function telcoPlansHandler(_req: Request, res: Response) {
  try {
    const { data: plans, error } = await supabase
      .from('plan_definitions')
      .select('id, name, description, price_monthly, price_yearly, destinations, features_list, sms_included, sort_order, highlight')
      .in('id', VALID_PLAN_CODES)
      .order('sort_order', { ascending: true })

    if (error) throw error

    res.json({
      success: true,
      data: (plans || []).map((p: any) => ({
        plan_code: p.id,
        name: p.name,
        description: p.description,
        price_monthly: p.price_monthly,
        price_yearly: p.price_yearly,
        destinations: p.destinations || [],
        features: p.features_list || [],
        sms_included: p.sms_included || 0,
        sort_order: p.sort_order,
        popular: p.highlight || p.id === 'TELCO_CA_US_FR',
      })),
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}
router.get('/plans', telcoPlansHandler)

// ──────────────────────────────────────────────────────────
// GET /summary — resume billing telephonie pour l'org
// ──────────────────────────────────────────────────────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    // Active subscription for telephony
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('service_type', 'TELEPHONY')
      .in('status', ['active', 'trialing', 'past_due', 'canceling'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Count active agents (users with active status in org)
    const { count: nbAgents } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')

    const agentCount = nbAgents || 0

    // Get plan details if subscription exists
    let activePlan: any = null
    if (sub?.plan_id) {
      const { data: plan } = await supabase
        .from('plan_definitions')
        .select('id, name, price_monthly, price_yearly, destinations, features_list')
        .eq('id', sub.plan_id)
        .single()
      if (plan) {
        activePlan = {
          plan_code: plan.id,
          name: plan.name,
          price_monthly: plan.price_monthly,
          price_yearly: plan.price_yearly,
          destinations: plan.destinations || [],
        }
      }
    }

    const pricePerAgent = activePlan ? (sub?.billing_cycle === 'yearly' ? Math.round(activePlan.price_yearly / 12) : activePlan.price_monthly) : 0

    // Org info
    const { data: org } = await supabase
      .from('organizations')
      .select('created_at')
      .eq('id', orgId)
      .single()

    res.json({
      success: true,
      data: {
        activePlan,
        billingCycle: sub?.billing_cycle || 'monthly',
        status: sub?.status || null,
        nbAgentsActive: agentCount,
        monthlyTotal: pricePerAgent * agentCount,
        registeredAt: org?.created_at || null,
        nextPaymentAt: sub?.current_period_end || null,
        trialEndsAt: sub?.trial_ends_at || null,
        cancelAt: sub?.cancelled_at || null,
        stripeSubscriptionId: sub?.stripe_subscription_id || null,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /agents — liste agents actifs avec forfait
// ──────────────────────────────────────────────────────────
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    // Get extensions with user info and plan
    const { data: extensions } = await supabase
      .from('extensions')
      .select('id, extension_number, plan_id, status, cost_per_month, user:user_id(id, email, name)')
      .eq('organization_id', orgId)
      .in('status', ['active', 'ACTIVE', 'registered'])
      .order('extension_number', { ascending: true })

    // Get org subscription for default plan
    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('plan_id')
      .eq('organization_id', orgId)
      .eq('service_type', 'TELEPHONY')
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle()

    // Plan name lookup
    const planCodes = new Set<string>()
    for (const ext of extensions || []) {
      planCodes.add(ext.plan_id || sub?.plan_id || '')
    }
    const { data: planDefs } = await supabase
      .from('plan_definitions')
      .select('id, name, price_monthly')
      .in('id', [...planCodes].filter(Boolean))

    const planMap: Record<string, { name: string; price: number }> = {}
    for (const p of planDefs || []) {
      planMap[p.id] = { name: p.name, price: p.price_monthly }
    }

    const agents = (extensions || []).map((e: any) => {
      const effectivePlan = e.plan_id || sub?.plan_id || null
      const info = effectivePlan ? planMap[effectivePlan] : null
      return {
        id: e.id,
        firstName: e.user?.name?.split(' ')[0] || '',
        lastName: e.user?.name?.split(' ').slice(1).join(' ') || '',
        email: e.user?.email || '',
        extension: e.extension_number,
        planCode: effectivePlan,
        planName: info?.name || 'Aucun',
        unitPrice: info?.price || 0,
      }
    })

    res.json({ success: true, data: agents })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// GET /prorata — calcul prorata pour changement de plan
// ──────────────────────────────────────────────────────────
router.get('/prorata', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const planCode = String(req.query.planCode || '')
    const billingCycle = String(req.query.billingCycle || 'monthly')

    if (!VALID_PLAN_CODES.includes(planCode)) {
      return res.status(400).json({ success: false, error: 'Plan code invalide' })
    }

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
    const year = now.getFullYear()
    const month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const periodEnd = new Date(year, month + 1, 0)
    const daysRemaining = Math.max(1, Math.ceil((periodEnd.getTime() - now.getTime()) / 86400000))

    const pricePerAgent = billingCycle === 'yearly'
      ? Math.round((plan.price_yearly || plan.price_monthly * 10) / 12)
      : plan.price_monthly

    const prorataAmount = Math.round((daysRemaining / daysInMonth) * pricePerAgent * agentCount)

    const nextPaymentDate = new Date(year, month + 1, 1).toISOString()
    const nextPaymentAmount = pricePerAgent * agentCount

    res.json({
      success: true,
      data: {
        prorataAmount,
        nextPaymentDate,
        nextPaymentAmount,
        nbAgents: agentCount,
        daysRemaining,
        daysInMonth,
        pricePerAgent,
        periodStart: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /subscribe — nouvel abonnement ou changement de plan
// ──────────────────────────────────────────────────────────
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { planCode, billingCycle = 'monthly' } = req.body

    if (!VALID_PLAN_CODES.includes(planCode)) {
      return res.status(400).json({ success: false, error: 'Plan code invalide' })
    }

    // Get plan
    const { data: plan } = await supabase
      .from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly, stripe_product_id')
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

    // Get or create Stripe customer
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name, email')
      .eq('id', orgId)
      .single()

    let customerId = org?.stripe_customer_id
    if (stripe && !customerId) {
      const { data: adminUser } = await supabase
        .from('users')
        .select('email, name')
        .eq('organization_id', orgId)
        .eq('role', 'ADMIN')
        .limit(1)
        .maybeSingle()

      const customer = await stripe.customers.create({
        email: adminUser?.email || org?.email || '',
        name: org?.name || '',
        metadata: { organization_id: orgId },
      })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
    }

    // Check existing active subscription
    const { data: existingSub } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('service_type', 'TELEPHONY')
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle()

    const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly

    if (!existingSub) {
      // NEW SUBSCRIPTION
      if (stripe && priceId) {
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId, quantity: agentCount }],
          trial_period_days: 14,
          payment_behavior: 'default_incomplete',
          expand: ['latest_invoice.payment_intent'],
          currency: 'cad',
          metadata: { orgId, planCode, serviceType: 'telephony' },
        })

        const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await supabase.from('org_subscriptions').insert({
          organization_id: orgId,
          plan_id: planCode,
          service_type: 'TELEPHONY',
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          quantity: agentCount,
          billing_cycle: billingCycle,
          status: 'trialing',
          unit_price: billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly,
          trial_ends_at: trialEnd.toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
        })

        const clientSecret = (subscription as any).latest_invoice?.payment_intent?.client_secret || null

        return res.json({
          success: true,
          data: {
            subscriptionId: subscription.id,
            clientSecret,
            planCode,
            trialEnd: trialEnd.toISOString(),
            prorataAmount: 0,
          },
        })
      }

      // Demo mode (no Stripe)
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      await supabase.from('org_subscriptions').insert({
        organization_id: orgId,
        plan_id: planCode,
        service_type: 'TELEPHONY',
        quantity: agentCount,
        billing_cycle: billingCycle,
        status: 'trialing',
        unit_price: billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly,
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
      })

      return res.json({
        success: true,
        data: {
          subscriptionId: 'demo_sub_' + Date.now(),
          clientSecret: null,
          planCode,
          trialEnd: trialEnd.toISOString(),
          prorataAmount: 0,
        },
      })
    }

    // EXISTING SUBSCRIPTION — plan change
    if (stripe && existingSub.stripe_subscription_id && priceId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id)
        const itemId = stripeSub.items.data[0]?.id

        if (itemId) {
          await stripe.subscriptionItems.update(itemId, {
            price: priceId,
            quantity: agentCount,
            proration_behavior: 'create_prorations',
          })
        }
      } catch (stripeErr: any) {
        console.error('[telephony/subscribe] Stripe update error:', stripeErr.message)
      }
    }

    await supabase
      .from('org_subscriptions')
      .update({
        plan_id: planCode,
        billing_cycle: billingCycle,
        stripe_price_id: priceId || null,
        quantity: agentCount,
        unit_price: billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly,
      })
      .eq('id', existingSub.id)

    const pricePerAgent = billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly

    res.json({
      success: true,
      data: {
        planCode,
        newMonthlyTotal: pricePerAgent * agentCount,
        prorataToday: 0,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// PUT /plan — modifier le plan (alias de subscribe pour plan actif)
// ──────────────────────────────────────────────────────────
router.put('/plan', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)
    const { planCode, billingCycle = 'monthly' } = req.body

    if (!VALID_PLAN_CODES.includes(planCode)) {
      return res.status(400).json({ success: false, error: 'Plan code invalide' })
    }

    const { data: plan } = await supabase
      .from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, stripe_price_id_monthly, stripe_price_id_yearly')
      .eq('id', planCode)
      .single()
    if (!plan) return res.status(404).json({ success: false, error: 'Plan introuvable' })

    const { data: existingSub } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('service_type', 'TELEPHONY')
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle()

    if (!existingSub) {
      return res.status(400).json({ success: false, error: 'Aucun abonnement telephonie actif' })
    }

    const { count: nbAgents } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)

    const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly

    if (stripe && existingSub.stripe_subscription_id && priceId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id)
        const itemId = stripeSub.items.data[0]?.id
        if (itemId) {
          await stripe.subscriptionItems.update(itemId, {
            price: priceId,
            quantity: agentCount,
            proration_behavior: 'create_prorations',
          })
        }
      } catch (stripeErr: any) {
        console.error('[telephony/plan] Stripe error:', stripeErr.message)
      }
    }

    const pricePerAgent = billingCycle === 'yearly' ? Math.round((plan.price_yearly || 0) / 12) : plan.price_monthly

    await supabase
      .from('org_subscriptions')
      .update({
        plan_id: planCode,
        billing_cycle: billingCycle,
        stripe_price_id: priceId || null,
        quantity: agentCount,
        unit_price: pricePerAgent,
      })
      .eq('id', existingSub.id)

    // Prorata calc
    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysRemaining = Math.max(1, Math.ceil((endOfMonth.getTime() - now.getTime()) / 86400000))
    const daysInMonth = endOfMonth.getDate()
    const prorataToday = Math.round((daysRemaining / daysInMonth) * pricePerAgent * agentCount)
    const nextPaymentDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

    res.json({
      success: true,
      data: {
        planCode,
        newMonthlyTotal: pricePerAgent * agentCount,
        prorataToday,
        nextPaymentDate,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// DELETE /cancel — annuler a la fin de la periode
// ──────────────────────────────────────────────────────────
router.delete('/cancel', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req)

    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('service_type', 'TELEPHONY')
      .in('status', ['active', 'trialing'])
      .limit(1)
      .maybeSingle()

    if (!sub) {
      return res.status(400).json({ success: false, error: 'Aucun abonnement actif' })
    }

    if (stripe && sub.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: true,
        })
      } catch (stripeErr: any) {
        console.error('[telephony/cancel] Stripe error:', stripeErr.message)
      }
    }

    const cancelAt = sub.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await supabase
      .from('org_subscriptions')
      .update({ status: 'canceling', cancelled_at: cancelAt })
      .eq('id', sub.id)

    res.json({ success: true, data: { cancelAt } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// POST /sync-quantity — synchronise quantite agents <> Stripe
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

    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('service_type', 'TELEPHONY')
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle()

    if (sub) {
      if (stripe && sub.stripe_subscription_id) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
          const itemId = stripeSub.items.data[0]?.id
          if (itemId) {
            await stripe.subscriptionItems.update(itemId, { quantity: agentCount })
          }
        } catch (stripeErr: any) {
          console.error('[telephony/sync-quantity] Stripe error:', stripeErr.message)
        }
      }

      await supabase
        .from('org_subscriptions')
        .update({ quantity: agentCount })
        .eq('id', sub.id)
    }

    res.json({ success: true, data: { nbAgents: agentCount, synced: true } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ──────────────────────────────────────────────────────────
// Backward compat: GET /destinations/:planCode
// ──────────────────────────────────────────────────────────
const DESTINATIONS: Record<string, { country: string; fixed: boolean; mobile: boolean }[]> = {
  TELCO_INBOUND: [],
  TELCO_CA_US: [
    { country: 'Canada', fixed: true, mobile: true },
    { country: 'Etats-Unis', fixed: true, mobile: true },
  ],
  TELCO_CA_US_FR: [
    { country: 'Canada', fixed: true, mobile: true },
    { country: 'Etats-Unis', fixed: true, mobile: true },
    { country: 'France', fixed: true, mobile: true },
  ],
  TELCO_INTL: [
    { country: 'Canada', fixed: true, mobile: true },
    { country: 'Etats-Unis', fixed: true, mobile: true },
    { country: 'France', fixed: true, mobile: true },
    { country: 'Allemagne', fixed: true, mobile: true },
    { country: 'Royaume-Uni', fixed: true, mobile: true },
    { country: 'Espagne', fixed: true, mobile: true },
    { country: 'Italie', fixed: true, mobile: true },
    { country: 'Portugal', fixed: true, mobile: true },
    { country: 'Pays-Bas', fixed: true, mobile: true },
    { country: 'Belgique', fixed: true, mobile: true },
    { country: 'Suisse', fixed: true, mobile: true },
    { country: 'Autriche', fixed: true, mobile: true },
    { country: 'Suede', fixed: true, mobile: true },
    { country: 'Norvege', fixed: true, mobile: true },
    { country: 'Danemark', fixed: true, mobile: true },
    { country: 'Finlande', fixed: true, mobile: true },
    { country: 'Irlande', fixed: true, mobile: true },
    { country: 'Pologne', fixed: true, mobile: true },
    { country: 'Republique tcheque', fixed: true, mobile: true },
    { country: 'Roumanie', fixed: true, mobile: true },
    { country: 'Hongrie', fixed: true, mobile: true },
    { country: 'Grece', fixed: true, mobile: true },
    { country: 'Croatie', fixed: true, mobile: true },
    { country: 'Bulgarie', fixed: true, mobile: true },
    { country: 'Slovaquie', fixed: true, mobile: true },
    { country: 'Slovenie', fixed: true, mobile: true },
    { country: 'Lituanie', fixed: true, mobile: true },
    { country: 'Lettonie', fixed: true, mobile: true },
    { country: 'Estonie', fixed: true, mobile: true },
    { country: 'Luxembourg', fixed: true, mobile: true },
    { country: 'Malte', fixed: true, mobile: true },
    { country: 'Chypre', fixed: true, mobile: true },
    { country: 'Islande', fixed: true, mobile: true },
  ],
}

router.get('/destinations/:planCode', async (req: Request, res: Response) => {
  const code = String(req.params.planCode).toUpperCase()
  const destinations = DESTINATIONS[code]
  if (!destinations) return res.status(404).json({ success: false, error: 'Plan introuvable' })
  res.json({ success: true, data: { plan_code: code, destinations } })
})

// ── Export sync-quantity helper for agent routes ──────────
export async function syncOrgQuantity(orgId: string): Promise<void> {
  try {
    const { count: nbAgents } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')
    const agentCount = Math.max(1, nbAgents || 1)

    const { data: sub } = await supabase
      .from('org_subscriptions')
      .select('id, stripe_subscription_id')
      .eq('organization_id', orgId)
      .eq('service_type', 'TELEPHONY')
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle()

    if (sub) {
      if (stripe && sub.stripe_subscription_id) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
          const itemId = stripeSub.items.data[0]?.id
          if (itemId) {
            await stripe.subscriptionItems.update(itemId, { quantity: agentCount })
          }
        } catch {}
      }
      await supabase.from('org_subscriptions').update({ quantity: agentCount }).eq('id', sub.id)
    }
  } catch {}
}

export default router
