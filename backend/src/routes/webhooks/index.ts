import { Router, Request, Response } from "express"
import { stripeService } from "../../services/stripe/stripe.service"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess } from "../../utils/response"

const router = Router()

// POST /api/v1/webhooks/twilio/voice — Appel entrant
router.post("/twilio/voice", (req: Request, res: Response) => {
  console.log("Webhook Twilio voice:", req.body)
  res.set("Content-Type", "text/xml")
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR" voice="alice">
    Bienvenue sur VoxFlow. Veuillez patienter.
  </Say>
  <Enqueue waitUrl="/api/v1/webhooks/twilio/wait">support</Enqueue>
</Response>`)
})

// POST /api/v1/webhooks/twilio/status — Statut appel
router.post("/twilio/status", async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration } = req.body
  console.log("Statut appel Twilio:", CallSid, CallStatus)

  if (CallSid && ["completed", "failed", "busy", "no-answer"].includes(CallStatus)) {
    await supabaseAdmin.from("calls")
      .update({
        status:   CallStatus.toUpperCase().replace("-", "_"),
        duration: parseInt(CallDuration || "0"),
        ended_at: new Date().toISOString(),
      })
      .eq("twilio_sid", CallSid)
  }

  sendSuccess(res, { received: true })
})

// POST /api/v1/webhooks/stripe — Paiements
router.post("/stripe", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string

  try {
    const event = stripeService.verifyWebhook(req.body as Buffer, signature)

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub     = event.data.object as any
        const orgId   = sub.metadata?.organizationId
        const plan    = sub.items?.data[0]?.price?.nickname || "STARTER"

        if (orgId) {
          await supabaseAdmin.from("subscriptions").upsert({
            stripe_id:          sub.id,
            status:             sub.status,
            plan:               plan.toUpperCase(),
            organization_id:    orgId,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as any
        await supabaseAdmin.from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_id", sub.id)
        break
      }

      case "invoice.payment_succeeded":
        console.log("Paiement recu:", event.data.object)
        break

      case "invoice.payment_failed":
        console.log("Paiement echoue:", event.data.object)
        break
    }

    sendSuccess(res, { received: true })
  } catch (err: any) {
    console.error("Webhook Stripe invalide:", err.message)
    res.status(400).json({ error: "Webhook invalide" })
  }
})

export default router
