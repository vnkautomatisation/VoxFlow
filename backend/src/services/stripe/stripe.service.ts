import Stripe from "stripe"
import { config } from "../../config/env"

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: "2024-06-20",
})

export const PLANS = {
  STARTER: {
    name:        "Starter",
    price:       9900,   // 99$ en cents
    currency:    "cad",
    maxAgents:   5,
    maxNumbers:  1,
    features:    ["5 agents", "1 numero", "Appels entrants/sortants", "Historique 30 jours"],
  },
  PRO: {
    name:        "Pro",
    price:       29900,  // 299$
    currency:    "cad",
    maxAgents:   25,
    maxNumbers:  5,
    features:    ["25 agents", "5 numeros", "IVR avance", "Enregistrement appels", "Analytics"],
  },
  ENTERPRISE: {
    name:        "Enterprise",
    price:       79900,  // 799$
    currency:    "cad",
    maxAgents:   100,
    maxNumbers:  20,
    features:    ["100 agents", "20 numeros", "IA transcription", "API acces", "Support prioritaire"],
  },
}

export class StripeService {

  // Creer un client Stripe pour un admin
  async createCustomer(email: string, name: string, organizationId: string) {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { organizationId },
    })
    return customer
  }

  // Creer un abonnement
  async createSubscription(customerId: string, plan: keyof typeof PLANS) {
    const priceId = config.stripe.prices[plan.toLowerCase() as keyof typeof config.stripe.prices]

    if (!priceId) {
      // Mode test sans prix Stripe configure — simulation
      return {
        id:     "sub_test_" + Date.now(),
        status: "active",
        plan,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        simulated: true,
      }
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    })

    return {
      id:              subscription.id,
      status:          subscription.status,
      plan,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      clientSecret:    (subscription.latest_invoice as any)?.payment_intent?.client_secret,
    }
  }

  // Annuler un abonnement
  async cancelSubscription(subscriptionId: string) {
    if (subscriptionId.startsWith("sub_test_")) {
      return { cancelled: true, simulated: true }
    }
    const sub = await stripe.subscriptions.cancel(subscriptionId)
    return { cancelled: true, status: sub.status }
  }

  // Statistiques revenus (simule en mode test)
  async getRevenueStats() {
    try {
      const now     = Math.floor(Date.now() / 1000)
      const monthAgo = now - 30 * 24 * 60 * 60

      const charges = await stripe.charges.list({
        created: { gte: monthAgo },
        limit: 100,
      })

      const mrr = charges.data
        .filter((c: any) => c.paid)
        .reduce((sum: number, c: any) => sum + c.amount, 0) / 100

      return { mrr, currency: "cad", period: "30d" }
    } catch {
      return { mrr: 0, currency: "cad", period: "30d", simulated: true }
    }
  }

  // Verifier un webhook Stripe
  verifyWebhook(payload: Buffer, signature: string) {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret
    )
  }
}

export const stripeService = new StripeService()
