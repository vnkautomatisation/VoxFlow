import { Resend } from "resend"
import { config } from "../../config/env"

const resend = new Resend(config.email.apiKey)

export class EmailService {

  async sendVerificationEmail(email: string, name: string, token: string) {
    const verifyUrl = config.app.url + "/verify-email?token=" + token

    if (!config.email.apiKey || config.email.apiKey.startsWith("re_xxx")) {
      console.log("[Email simule] Verification email pour:", email)
      console.log("[Email simule] URL:", verifyUrl)
      return { simulated: true }
    }

    await resend.emails.send({
      from:    config.email.fromName + " <" + config.email.from + ">",
      to:      [email],
      subject: "Verifiez votre compte VoxFlow",
      html:    this.verifyEmailTemplate(name, verifyUrl),
    })
    return { sent: true }
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    const resetUrl = config.app.url + "/reset-password?token=" + token

    if (!config.email.apiKey || config.email.apiKey.startsWith("re_xxx")) {
      console.log("[Email simule] Reset password pour:", email)
      console.log("[Email simule] URL:", resetUrl)
      return { simulated: true }
    }

    await resend.emails.send({
      from:    config.email.fromName + " <" + config.email.from + ">",
      to:      [email],
      subject: "Reinitialisation de votre mot de passe VoxFlow",
      html:    this.resetPasswordTemplate(name, resetUrl),
    })
    return { sent: true }
  }

  async sendWelcomeEmail(email: string, name: string, orgName: string) {
    if (!config.email.apiKey || config.email.apiKey.startsWith("re_xxx")) {
      console.log("[Email simule] Welcome email pour:", email)
      return { simulated: true }
    }

    await resend.emails.send({
      from:    config.email.fromName + " <" + config.email.from + ">",
      to:      [email],
      subject: "Bienvenue sur VoxFlow - " + orgName,
      html:    this.welcomeTemplate(name, orgName),
    })
    return { sent: true }
  }

  private verifyEmailTemplate(name: string, url: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
  <h1 style="margin:0 0 8px;font-size:24px;">Vox<span style="color:#7c3aed;">Flow</span></h1>
  <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Un produit de VNK Automatisation Inc.</p>
  <h2 style="font-size:18px;margin:0 0 12px;">Bonjour ${name},</h2>
  <p style="color:#374151;margin:0 0 24px;">Veuillez verifier votre adresse email pour activer votre compte VoxFlow.</p>
  <a href="${url}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">Verifier mon email</a>
  <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">Ce lien expire dans 24 heures.</p>
</div>
</body></html>`
  }

  private resetPasswordTemplate(name: string, url: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
  <h1 style="margin:0 0 8px;font-size:24px;">Vox<span style="color:#7c3aed;">Flow</span></h1>
  <h2 style="font-size:18px;margin:0 0 12px;">Reinitialisation mot de passe</h2>
  <p style="color:#374151;margin:0 0 24px;">Bonjour ${name}, vous avez demande a reinitialiser votre mot de passe.</p>
  <a href="${url}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">Reinitialiser mon mot de passe</a>
  <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">Ce lien expire dans 1 heure. Si vous n avez pas fait cette demande, ignorez cet email.</p>
</div>
</body></html>`
  }

  private welcomeTemplate(name: string, orgName: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:40px 20px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
  <h1 style="margin:0 0 8px;font-size:24px;">Vox<span style="color:#7c3aed;">Flow</span></h1>
  <h2 style="font-size:18px;margin:0 0 12px;">Bienvenue ${name} !</h2>
  <p style="color:#374151;margin:0 0 12px;">Votre compte pour <strong>${orgName}</strong> est pret.</p>
  <p style="color:#374151;margin:0 0 24px;">Completez votre configuration pour commencer a recevoir des appels.</p>
  <a href="https://app.voxflow.io/onboarding" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">Configurer mon call center</a>
</div>
</body></html>`
  }
}

export const emailService = new EmailService()
