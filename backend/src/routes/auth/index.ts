import { Router, Request, Response } from 'express'
import { authService } from '../../services/auth/auth.service'
import { authenticate, AuthRequest } from '../../middleware/auth'
import { validate, loginSchema, registerSchema } from '../../utils/validate'
import { sendSuccess, sendError } from '../../utils/response'

const router = Router()

// POST /api/v1/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body)
    sendSuccess(res, result, 201, 'Compte cree avec succes')
  } catch (err: any) {
    sendError(res, err.message, 400)
  }
})

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body)

    // Cookie httpOnly pour le refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000, // 30 jours
    })

    sendSuccess(res, {
      user:        result.user,
      accessToken: result.accessToken,
    }, 200, 'Connexion reussie')
  } catch (err: any) {
    sendError(res, err.message, 401)
  }
})

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await authService.getMe(req.user!.userId)
    sendSuccess(res, user)
  } catch (err: any) {
    sendError(res, err.message, 404)
  }
})

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { verifyRefreshToken } = await import('../../utils/jwt')
    const token = req.cookies?.refreshToken || req.body?.refreshToken

    if (!token) {
      return sendError(res, 'Refresh token manquant', 401)
    }

    const payload = verifyRefreshToken(token)
    const result  = await authService.refreshToken(payload.userId)

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000,
    })

    sendSuccess(res, { accessToken: result.accessToken })
  } catch (err: any) {
    sendError(res, 'Token invalide ou expire', 401)
  }
})

// POST /api/v1/auth/logout
router.post('/logout', authenticate, (req: AuthRequest, res: Response) => {
  res.clearCookie('refreshToken')
  sendSuccess(res, null, 200, 'DéConnexion reussie')
})

export default router

