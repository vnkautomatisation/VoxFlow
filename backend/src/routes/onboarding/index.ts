import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { twilioService } from "../../services/twilio/twilio.service"
import { sendSuccess, sendError } from "../../utils/response"
import { emailService } from "../../services/email/email.service"
import { hashPassword } from "../../utils/hash"

const router = Router()
router.use(authenticate)

// GET /api/v1/onboarding/status
router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendSuccess(res, { step: 0, completed: false })

    const { data } = await supabaseAdmin
      .from("onboarding_progress")
      .select("*")
      .eq("organization_id", orgId)
      .single()

    if (!data) {
      const { data: created } = await supabaseAdmin
        .from("onboarding_progress")
        .insert({ organization_id: orgId, current_step: 1 })
        .select().single()
      return sendSuccess(res, created || { current_step: 1, completed: false })
    }

    sendSuccess(res, data)
  } catch (err: any) {
    sendError(res, err.message)
  }
})

// POST /api/v1/onboarding/step/1 -- Info organisation
router.post("/step/1", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendError(res, "Organisation requise", 400)

    const { name, phone, website, address, city } = req.body

    await supabaseAdmin.from("organizations")
      .update({ name, phone, website, address, city, updated_at: new Date().toISOString() })
      .eq("id", orgId)

    await updateStep(orgId, 1)
    sendSuccess(res, null, 200, "Etape 1 completee - Information organisation")
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/onboarding/step/2 -- Choisir un numero
router.post("/step/2", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendError(res, "Organisation requise", 400)

    const { phoneNumber } = req.body
    if (!phoneNumber) return sendError(res, "Numero requis", 400)

    // Achat du numero sur Twilio (ou simulation)
    try {
      const num = await twilioService.purchasePhoneNumber(phoneNumber, orgId)
      await supabaseAdmin.from("phone_numbers").insert({
        number: num.phoneNumber, twilio_sid: num.sid, organization_id: orgId, country: "CA"
      })
    } catch {
      // Mode simulation si Twilio pas configure
      await supabaseAdmin.from("phone_numbers").insert({
        number: phoneNumber, twilio_sid: "simulated_" + Date.now(), organization_id: orgId, country: "CA"
      })
    }

    await updateStep(orgId, 2)
    sendSuccess(res, { phoneNumber }, 200, "Etape 2 completee - Numero assigne")
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/onboarding/step/3 -- Creer premier agent
router.post("/step/3", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendError(res, "Organisation requise", 400)

    const { name, email, password } = req.body
    if (!name || !email) return sendError(res, "Nom et email requis", 400)

    const pwHash = await hashPassword(password || "VoxFlow123!")

    const { data: agent } = await supabaseAdmin.from("users").insert({
      email, name, role: "AGENT",
      password_hash:   pwHash,
      organization_id: orgId,
      status:          "ACTIVE",
      email_verified:  true,
    }).select().single()

    if (agent) {
      await supabaseAdmin.from("agents").insert({
        user_id: agent.id, organization_id: orgId, status: "OFFLINE"
      }).then(() => {})
    }

    await updateStep(orgId, 3)
    sendSuccess(res, { agent }, 201, "Etape 3 completee - Premier agent cree")
  } catch (err: any) { sendError(res, err.message, 400) }
})

// POST /api/v1/onboarding/step/4 -- Configurer IVR basique
router.post("/step/4", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendError(res, "Organisation requise", 400)

    const { welcomeMessage, businessHours } = req.body

    // Creer IVR par defaut
    await supabaseAdmin.from("ivr_configs").insert({
      name:            "Menu principal",
      organization_id: orgId,
      welcome_message: welcomeMessage || "Bienvenue. Appuyez sur 1 pour le support.",
      nodes: [
        { key: "1", label: "Support",  action: "QUEUE", value: "" },
        { key: "0", label: "Operateur", action: "AGENT", value: "" },
      ],
    })

    // Creer file d attente par defaut
    await supabaseAdmin.from("queues").insert({
      name: "Support general", organization_id: orgId, strategy: "ROUND_ROBIN"
    })

    // Creer horaires
    await supabaseAdmin.from("schedules").insert({
      name: "Heures ouverture",
      organization_id: orgId,
      timezone: "America/Toronto",
      hours: businessHours || {
        monday:    { open: "09:00", close: "17:00", enabled: true },
        tuesday:   { open: "09:00", close: "17:00", enabled: true },
        wednesday: { open: "09:00", close: "17:00", enabled: true },
        thursday:  { open: "09:00", close: "17:00", enabled: true },
        friday:    { open: "09:00", close: "17:00", enabled: true },
        saturday:  { open: "10:00", close: "14:00", enabled: false },
        sunday:    { open: "10:00", close: "14:00", enabled: false },
      },
    })

    await updateStep(orgId, 4)
    sendSuccess(res, null, 200, "Etape 4 completee - IVR et files configures")
  } catch (err: any) { sendError(res, err.message) }
})

// POST /api/v1/onboarding/step/5 -- Finaliser
router.post("/step/5", async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId
    if (!orgId) return sendError(res, "Organisation requise", 400)

    await supabaseAdmin.from("organizations")
      .update({ onboarding_completed: true })
      .eq("id", orgId)

    await supabaseAdmin.from("onboarding_progress")
      .update({ current_step: 5, completed: true, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)

    // Email de bienvenue
    const { data: user } = await supabaseAdmin
      .from("users").select("name, email").eq("id", req.user!.userId).single()
    const { data: org } = await supabaseAdmin
      .from("organizations").select("name").eq("id", orgId).single()

    if (user && org) {
      try {
        await emailService.sendWelcomeEmail(user.email, user.name, org.name)
      } catch {}
    }

    sendSuccess(res, null, 200, "Onboarding complete ! Bienvenue sur VoxFlow.")
  } catch (err: any) { sendError(res, err.message) }
})

// GET /api/v1/onboarding/numbers -- Chercher numeros disponibles
router.get("/numbers", async (req: AuthRequest, res: Response) => {
  try {
    const country  = String(req.query.country || "CA")
    const areaCode = req.query.areaCode ? String(req.query.areaCode) : undefined

    try {
      const numbers = await twilioService.searchAvailableNumbers(country, areaCode)
      return sendSuccess(res, { numbers })
    } catch {
      // Numeros simules si Twilio pas configure
      const simulated = [
        { phoneNumber: "+15141234567", friendlyName: "+1 (514) 123-4567", locality: "Montreal", region: "QC" },
        { phoneNumber: "+15149876543", friendlyName: "+1 (514) 987-6543", locality: "Montreal", region: "QC" },
        { phoneNumber: "+14381234567", friendlyName: "+1 (438) 123-4567", locality: "Montreal", region: "QC" },
        { phoneNumber: "+15818765432", friendlyName: "+1 (581) 876-5432", locality: "Quebec City", region: "QC" },
        { phoneNumber: "+14189876543", friendlyName: "+1 (418) 987-6543", locality: "Quebec City", region: "QC" },
      ].filter((n) => !areaCode || n.phoneNumber.includes(areaCode))
      return sendSuccess(res, { numbers: simulated, simulated: true })
    }
  } catch (err: any) { sendError(res, err.message) }
})

async function updateStep(orgId: string, step: number) {
  const { data: existing } = await supabaseAdmin
    .from("onboarding_progress")
    .select("completed_steps")
    .eq("organization_id", orgId)
    .single()

  const steps: number[] = existing?.completed_steps || []
  if (!steps.includes(step)) steps.push(step)

  await supabaseAdmin.from("onboarding_progress").upsert({
    organization_id: orgId,
    current_step:    step + 1,
    completed_steps: steps,
    updated_at:      new Date().toISOString(),
  })
}

export default router

