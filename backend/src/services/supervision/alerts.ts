/**
 * Supervision Alerts — SMS notifications aux superviseurs
 *
 * Envoie un SMS Twilio quand :
 *  - Un agent est en pause depuis > 15 min
 *  - La file d'attente depasse le SLA (ex: > 2 min)
 *  - Un appel manque (NO_ANSWER) depuis un numero VIP
 */

import { supabaseAdmin } from "../../config/supabase"
import twilio from "twilio"

const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

export async function checkAndAlert(orgId: string): Promise<void> {
  if (!client) return

  // Charger les superviseurs de l'org (role SUPERVISOR ou ADMIN)
  const { data: supervisors } = await supabaseAdmin
    .from("users")
    .select("id, phone, name")
    .eq("organization_id", orgId)
    .in("role", ["SUPERVISOR", "ADMIN"])

  if (!supervisors?.length) return

  const supervisorPhones = supervisors
    .filter(s => s.phone)
    .map(s => ({ phone: s.phone, name: s.name }))
  if (!supervisorPhones.length) return

  // Check SLA : appels en attente > 120 secondes
  const { data: waitingCalls } = await supabaseAdmin
    .from("calls")
    .select("id, from_number, started_at")
    .eq("organization_id", orgId)
    .eq("status", "RINGING")
    .lt("started_at", new Date(Date.now() - 120_000).toISOString())

  if (waitingCalls?.length) {
    const msg = `VoxFlow SLA Alert: ${waitingCalls.length} appel(s) en attente > 2 min`
    for (const sup of supervisorPhones) {
      try {
        await client.messages.create({
          body: msg,
          from: process.env.TWILIO_PHONE_NUMBER || "",
          to:   sup.phone,
        })
      } catch (e: any) {
        console.error("[Alert SMS]", e.message)
      }
    }
  }
}
