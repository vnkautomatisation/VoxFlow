import { Router, Request, Response } from "express"
import { authService } from "../../services/auth/auth.service"
import { tokenService } from "../../services/auth/token.service"
import { emailService } from "../../services/email/email.service"
import { supabaseAdmin } from "../../config/supabase"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { validate, loginSchema, registerSchema } from "../../utils/validate"
import { sendSuccess, sendError } from "../../utils/response"
import { hashPassword } from "../../utils/hash"

const router = Router()

// POST /api/v1/auth/register
router.post("/register", validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body)

    // Envoyer email de verification
    try {
      const token = await tokenService.createToken(result.user.id, "EMAIL_VERIFY")
      await emailService.sendVerificationEmail(result.user.email, result.user.name, token)
    } catch (e) { console.warn("Email de verification non envoye:", e) }

    sendSuccess(res, result, 201, "Compte cree - verifiez votre email")
  } catch (err: any) {
    sendError(res, err.message, 400)
  }
})

// POST /api/v1/auth/login
router.post("/login", validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body)

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   30 * 24 * 60 * 60 * 1000,
    })

    sendSuccess(res, {
      user:        result.user,
      accessToken: result.accessToken,
    }, 200, "Connexion reussie")
  } catch (err: any) {
    sendError(res, err.message, 401)
  }
})

// GET /api/v1/auth/me
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await authService.getMe(req.user!.userId)
    sendSuccess(res, user)
  } catch (err: any) {
    sendError(res, err.message, 404)
  }
})

// POST /api/v1/auth/refresh
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { verifyRefreshToken } = await import("../../utils/jwt")
    const token = req.cookies?.refreshToken || req.body?.refreshToken
    if (!token) return sendError(res, "Refresh token manquant", 401)

    const payload = verifyRefreshToken(token)
    const result  = await authService.refreshToken(payload.userId)

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   30 * 24 * 60 * 60 * 1000,
    })

    sendSuccess(res, { accessToken: result.accessToken })
  } catch (err: any) {
    sendError(res, "Token invalide ou expire", 401)
  }
})

// POST /api/v1/auth/logout
router.post("/logout", authenticate, (req: AuthRequest, res: Response) => {
  res.clearCookie("refreshToken")
  sendSuccess(res, null, 200, "Deconnexion reussie")
})

// POST /api/v1/auth/verify-email
router.post("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.body
    if (!token) return sendError(res, "Token requis", 400)

    const { userId } = await tokenService.verifyToken(token, "EMAIL_VERIFY")

    await supabaseAdmin
      .from("users")
      .update({ email_verified: true })
      .eq("id", userId)

    sendSuccess(res, null, 200, "Email verifie avec succes")
  } catch (err: any) {
    sendError(res, err.message, 400)
  }
})

// POST /api/v1/auth/forgot-password
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return sendError(res, "Email requis", 400)

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .eq("email", email)
      .single()

    // Toujours repondre OK pour la securite (ne pas reveler si l email existe)
    if (user) {
      try {
        const token = await tokenService.createToken(user.id, "PASSWORD_RESET")
        await emailService.sendPasswordResetEmail(user.email, user.name, token)
      } catch (e) { console.warn("Email reset non envoye:", e) }
    }

    sendSuccess(res, null, 200, "Si cet email existe, un lien de reinitialisation a ete envoye")
  } catch (err: any) {
    sendError(res, err.message, 400)
  }
})

// POST /api/v1/auth/reset-password
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return sendError(res, "Token et mot de passe requis", 400)
    if (password.length < 8) return sendError(res, "Mot de passe minimum 8 caracteres", 400)

    const { userId } = await tokenService.verifyToken(token, "PASSWORD_RESET")
    const passwordHash = await hashPassword(password)

    await supabaseAdmin
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", userId)

    sendSuccess(res, null, 200, "Mot de passe reinitialise avec succes")
  } catch (err: any) {
    sendError(res, err.message, 400)
  }
})

// PATCH /api/v1/auth/profile
router.patch("/profile", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, timezone, language, notifications } = req.body

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({
        ...(name && { name }),
        ...(phone && { phone }),
        ...(timezone && { timezone }),
        ...(language && { language }),
        ...(notifications && { notifications }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.user!.userId)
      .select().single()

    if (error) throw new Error(error.message)
    sendSuccess(res, data, 200, "Profil mis a jour")
  } catch (err: any) {
    sendError(res, err.message)
  }
})

export default router
