/**
 * Stripe Product & Price auto-provisioning for TELCO_* plans.
 * Idempotent — only creates Stripe objects when stripe_price_id_monthly IS NULL.
 * Called once at backend startup after DB is available.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let stripe: any = null
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require('stripe')
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  }
} catch {}

export async function syncAddonStripeProducts(): Promise<void> {
  if (!stripe) return
  try {
    const { data: plans } = await supabase
      .from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, service_type, module_type, stripe_price_id_monthly, stripe_product_id')
      .eq('is_addon', true)

    if (!plans) return

    for (const plan of plans) {
      if (plan.stripe_price_id_monthly) continue

      console.log(`[Stripe Setup] Creating Stripe product for addon ${plan.id}...`)

      const product = await stripe.products.create({
        name: plan.name,
        metadata: { plan_code: plan.id, service_type: 'addon', module_type: plan.module_type },
      })

      const monthlyPrice = await stripe.prices.create({
        unit_amount: plan.price_monthly,
        currency: 'cad',
        recurring: { interval: 'month' },
        product: product.id,
        metadata: { plan_code: plan.id, cycle: 'monthly' },
      })

      const yearlyPrice = await stripe.prices.create({
        unit_amount: plan.price_yearly || plan.price_monthly * 10,
        currency: 'cad',
        recurring: { interval: 'year' },
        product: product.id,
        metadata: { plan_code: plan.id, cycle: 'yearly' },
      })

      await supabase
        .from('plan_definitions')
        .update({
          stripe_product_id: product.id,
          stripe_price_id_monthly: monthlyPrice.id,
          stripe_price_id_yearly: yearlyPrice.id,
        })
        .eq('id', plan.id)

      console.log(`[Stripe Setup] ${plan.id} -> product=${product.id}`)
    }

    console.log('[Stripe Setup] Addon product sync complete')
  } catch (err: any) {
    console.warn('[Stripe Setup] Addon sync error:', err.message)
  }
}

export async function syncRobotStripeProducts(): Promise<void> {
  if (!stripe) return
  try {
    const { data: plans } = await supabase
      .from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, service_type, stripe_price_id_monthly, stripe_product_id')
      .like('id', 'ROBOT_%')
      .not('id', 'like', 'ROBOT_CREDITS_%')

    if (!plans) return

    for (const plan of plans) {
      if (plan.stripe_price_id_monthly) continue
      console.log(`[Stripe Setup] Creating Stripe product for robot ${plan.id}...`)

      const product = await stripe.products.create({
        name: plan.name,
        metadata: { plan_code: plan.id, service_type: 'robot' },
      })
      const monthlyPrice = await stripe.prices.create({
        unit_amount: plan.price_monthly, currency: 'cad',
        recurring: { interval: 'month' }, product: product.id,
      })
      const yearlyPrice = await stripe.prices.create({
        unit_amount: plan.price_yearly || plan.price_monthly * 10, currency: 'cad',
        recurring: { interval: 'year' }, product: product.id,
      })

      await supabase.from('plan_definitions').update({
        stripe_product_id: product.id,
        stripe_price_id_monthly: monthlyPrice.id,
        stripe_price_id_yearly: yearlyPrice.id,
      }).eq('id', plan.id)

      console.log(`[Stripe Setup] ${plan.id} -> product=${product.id}`)
    }
    console.log('[Stripe Setup] Robot product sync complete')
  } catch (err: any) {
    console.warn('[Stripe Setup] Robot sync error:', err.message)
  }
}

// Robot credits one-time price IDs (in-memory, created on first startup)
export const ROBOT_CREDITS_PACKS = [
  { code: 'ROBOT_CREDITS_1000', minutes: 1000, amount: 2900, name: '1000 minutes' },
  { code: 'ROBOT_CREDITS_5000', minutes: 5000, amount: 12000, name: '5000 minutes' },
  { code: 'ROBOT_CREDITS_15000', minutes: 15000, amount: 30000, name: '15000 minutes' },
  { code: 'ROBOT_CREDITS_50000', minutes: 50000, amount: 85000, name: '50000 minutes' },
] as const

const creditsPriceIds: Record<string, string> = {}

export async function syncRobotCreditProducts(): Promise<void> {
  if (!stripe) return
  try {
    for (const pack of ROBOT_CREDITS_PACKS) {
      // Check if already exists via product search
      const products = await stripe.products.list({ limit: 1, active: true })
      // Simple: use metadata search
      const existing = await stripe.products.search({ query: `metadata["plan_code"]:"${pack.code}"` }).catch(() => ({ data: [] }))
      if (existing.data?.length > 0) {
        const prices = await stripe.prices.list({ product: existing.data[0].id, active: true, limit: 1 })
        if (prices.data?.length > 0) { creditsPriceIds[pack.code] = prices.data[0].id; continue }
      }

      const product = await stripe.products.create({
        name: `Robot Credits — ${pack.name}`, metadata: { plan_code: pack.code, type: 'robot_credits' },
      })
      const price = await stripe.prices.create({
        unit_amount: pack.amount, currency: 'cad', product: product.id,
      })
      creditsPriceIds[pack.code] = price.id
      console.log(`[Stripe Setup] ${pack.code} -> price=${price.id}`)
    }
  } catch (err: any) {
    console.warn('[Stripe Setup] Robot credits sync error:', err.message)
  }
}

export function getRobotCreditsPriceId(code: string): string | null {
  return creditsPriceIds[code] || null
}

export async function syncTelcoStripeProducts(): Promise<void> {
  if (!stripe) {
    console.log('[Stripe Setup] No STRIPE_SECRET_KEY — skipping product sync')
    return
  }

  try {
    const { data: plans, error } = await supabase
      .from('plan_definitions')
      .select('id, name, price_monthly, price_yearly, service_type, stripe_price_id_monthly, stripe_product_id')
      .like('id', 'TELCO_%')

    if (error || !plans) {
      console.warn('[Stripe Setup] Could not load TELCO plans:', error?.message)
      return
    }

    for (const plan of plans) {
      if (plan.stripe_price_id_monthly) continue // already provisioned

      console.log(`[Stripe Setup] Creating Stripe product for ${plan.id}...`)

      // 1. Create Stripe Product
      const product = await stripe.products.create({
        name: plan.name,
        metadata: { plan_code: plan.id, service_type: plan.service_type },
      })

      // 2. Monthly Price
      const monthlyPrice = await stripe.prices.create({
        unit_amount: plan.price_monthly,
        currency: 'cad',
        recurring: { interval: 'month' },
        product: product.id,
        metadata: { plan_code: plan.id, cycle: 'monthly' },
      })

      // 3. Yearly Price
      const yearlyPrice = await stripe.prices.create({
        unit_amount: plan.price_yearly || plan.price_monthly * 10,
        currency: 'cad',
        recurring: { interval: 'year' },
        product: product.id,
        metadata: { plan_code: plan.id, cycle: 'yearly' },
      })

      // 4. Update plan_definitions
      await supabase
        .from('plan_definitions')
        .update({
          stripe_product_id: product.id,
          stripe_price_id_monthly: monthlyPrice.id,
          stripe_price_id_yearly: yearlyPrice.id,
        })
        .eq('id', plan.id)

      console.log(`[Stripe Setup] ${plan.id} -> product=${product.id}`)
    }

    console.log('[Stripe Setup] TELCO product sync complete')
  } catch (err: any) {
    console.warn('[Stripe Setup] Error during sync:', err.message)
  }
}
