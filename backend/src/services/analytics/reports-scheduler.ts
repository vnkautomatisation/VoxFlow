/**
 * Reports Scheduler — envoi automatique de rapports par email
 *
 * Cron qui s'execute tous les jours a 8h pour envoyer les rapports
 * journaliers/hebdomadaires aux admins configures.
 *
 * Types de rapports :
 *  - daily   : resume de la veille (calls, agents, KPI)
 *  - weekly  : resume de la semaine (tendances, top agents)
 *  - monthly : resume du mois (revenue, churn, growth)
 */

import { supabaseAdmin } from "../../config/supabase"
import { analyticsService } from "./analytics.service"
import nodemailer from "nodemailer"

const SMTP_HOST = process.env.SMTP_HOST || ""
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587")
const SMTP_USER = process.env.SMTP_USER || ""
const SMTP_PASS = process.env.SMTP_PASS || ""
const FROM_EMAIL = process.env.EMAIL_FROM || "reports@voxflow.io"

let transporter: nodemailer.Transporter | null = null
if (SMTP_HOST && SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
}

export async function sendDailyReport(orgId: string): Promise<void> {
  if (!transporter) return

  try {
    const stats = await analyticsService.getAdvancedStats(orgId, "day")

    // Trouver les admins de l'org
    const { data: admins } = await supabaseAdmin
      .from("users")
      .select("email, name")
      .eq("organization_id", orgId)
      .in("role", ["ADMIN", "SUPERVISOR"])

    if (!admins?.length) return

    const html = `
      <h2>VoxFlow — Rapport journalier</h2>
      <p>Voici le resume de la journee pour votre organisation.</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Appels total</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${stats.totalCalls || 0}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Appels completes</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${stats.completedCalls || 0}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Duree moyenne</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${stats.avgDuration || 0}s</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee"><strong>Taux resolution</strong></td><td style="padding:8px;border-bottom:1px solid #eee">${stats.resolutionRate || 0}%</td></tr>
      </table>
      <p style="color:#888;font-size:12px;margin-top:20px">VoxFlow par VNK Automatisation Inc.</p>
    `

    for (const admin of admins) {
      await transporter.sendMail({
        from: FROM_EMAIL,
        to:   admin.email,
        subject: `VoxFlow — Rapport du ${new Date().toLocaleDateString('fr-CA')}`,
        html,
      })
    }
  } catch (e: any) {
    console.error("[Reports Scheduler]", e.message)
  }
}

export function startReportsScheduler(): void {
  // Verifier toutes les heures si un rapport est du
  setInterval(async () => {
    const now = new Date()
    // Rapport journalier a 8h
    if (now.getHours() === 8 && now.getMinutes() < 5) {
      const { data: orgs } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("status", "ACTIVE")
      for (const org of orgs || []) {
        sendDailyReport(org.id).catch(e => console.error("[Scheduler]", e.message))
      }
    }
  }, 60_000 * 5) // Check toutes les 5 minutes
}
