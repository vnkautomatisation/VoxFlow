import { Router, Request, Response } from "express"
import { stripeService } from "../../services/stripe/stripe.service"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess } from "../../utils/response"
import { cancelAllAddons } from "../billing/addons"
import { trackRobotMinutes } from "../billing/robot"

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

// POST /api/v1/webhooks/twilio/robot-result — Robot call result
router.post("/twilio/robot-result", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, Duration, To, AnsweredBy } = req.body
    if (!CallSid) return sendSuccess(res, { received: true })

    // Find contact by twilio_call_sid
    const { data: contact } = await supabaseAdmin
      .from("robot_contacts")
      .select("id, campaign_id, organization_id, call_attempts, status")
      .eq("twilio_call_sid", CallSid)
      .maybeSingle()

    if (!contact) return sendSuccess(res, { received: true })

    // Determine result
    let newStatus = contact.status
    if (CallStatus === "completed") {
      if (AnsweredBy === "human") newStatus = "answered_human"
      else if (["machine_start", "machine_end_beep", "machine_end_silence", "fax"].includes(AnsweredBy)) newStatus = "answered_machine"
    } else if (CallStatus === "no-answer") { newStatus = "no_answer" }
    else if (["failed", "busy"].includes(CallStatus)) { newStatus = "failed" }

    const durationMin = parseFloat(Duration || "0") / 60

    // Update contact
    await supabaseAdmin.from("robot_contacts").update({
      status: newStatus,
      call_duration_seconds: parseFloat(Duration || "0"),
      last_attempt_at: new Date().toISOString(),
      call_attempts: (contact.call_attempts || 0) + 1,
    }).eq("id", contact.id)

    // Update campaign counters
    const counterField = newStatus === "answered_human" ? "answered_human"
      : newStatus === "answered_machine" ? "answered_machine"
      : newStatus === "no_answer" ? "no_answer" : "failed"

    const { data: camp } = await supabaseAdmin.from("robot_campaigns_v2")
      .select("called, answered_human, answered_machine, no_answer, failed, minutes_used, max_attempts, status, total_contacts")
      .eq("id", contact.campaign_id).single()

    if (camp) {
      const c = camp as any
      await supabaseAdmin.from("robot_campaigns_v2").update({
        called: (c.called || 0) + 1,
        [counterField]: (c[counterField] || 0) + 1,
        minutes_used: parseFloat(c.minutes_used || "0") + durationMin,
      }).eq("id", contact.campaign_id)

      // Track minutes for billing
      if (durationMin > 0) {
        trackRobotMinutes(contact.organization_id, durationMin).catch(() => {})
      }

      // Recycle no_answer contacts
      if (newStatus === "no_answer" && (contact.call_attempts || 0) + 1 < (c.max_attempts || 3) && c.status === "running") {
        await supabaseAdmin.from("robot_contacts").update({ status: "pending" }).eq("id", contact.id)
      }

      // Check if campaign complete
      const { count: pendingCount } = await supabaseAdmin.from("robot_contacts")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", contact.campaign_id)
        .in("status", ["pending", "calling"])
      if ((pendingCount || 0) === 0) {
        await supabaseAdmin.from("robot_campaigns_v2").update({ status: "completed" }).eq("id", contact.campaign_id)
      }
    }

    sendSuccess(res, { received: true })
  } catch (err: any) {
    console.error("[Robot Webhook] Error:", err.message)
    sendSuccess(res, { received: true })
  }
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

        // Check if this is a telephony subscription — cancel all addons
        const { data: telSub } = await supabaseAdmin
          .from("org_subscriptions")
          .select("organization_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle()
        if (telSub) {
          await supabaseAdmin.from("org_subscriptions")
            .update({ status: "canceled", cancelled_at: new Date().toISOString() })
            .eq("stripe_subscription_id", sub.id)
          cancelAllAddons(telSub.organization_id).catch(() => {})
        }

        // Check if this is an addon subscription
        const { data: addonSub } = await supabaseAdmin
          .from("org_addons")
          .select("id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle()
        if (addonSub) {
          await supabaseAdmin.from("org_addons")
            .update({ status: "canceled", canceled_at: new Date().toISOString() })
            .eq("id", addonSub.id)
        }
        break
      }

      case "invoice.payment_succeeded":
        console.log("Paiement recu:", event.data.object)
        break

      case "invoice.payment_failed": {
        console.log("Paiement echoue:", event.data.object)
        const failedInvoice = event.data.object as any
        if (failedInvoice.subscription) {
          await supabaseAdmin.from("org_addons").update({ status: "past_due" }).eq("stripe_subscription_id", failedInvoice.subscription)
          await supabaseAdmin.from("org_robot_subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", failedInvoice.subscription)
        }
        break
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as any
        if (pi.metadata?.type === "robot_credits") {
          const orgId = pi.metadata.orgId
          const minutes = parseInt(pi.metadata.minutes || "0")
          if (orgId && minutes > 0) {
            const { data: existing } = await supabaseAdmin.from("robot_credits")
              .select("id").eq("stripe_payment_intent_id", pi.id).maybeSingle()
            if (!existing) {
              await supabaseAdmin.from("robot_credits").insert({
                organization_id: orgId, minutes_purchased: minutes, amount_paid: pi.amount / 100,
                stripe_payment_intent_id: pi.id, status: "active", minutes_remaining: minutes,
              })
            }
          }
        }
        break
      }
    }

    sendSuccess(res, { received: true })
  } catch (err: any) {
    console.error("Webhook Stripe invalide:", err.message)
    res.status(400).json({ error: "Webhook invalide" })
  }
})

export default router
