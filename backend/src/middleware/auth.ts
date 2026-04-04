import { Request, Response, NextFunction } from "express"
import { verifyAccessToken } from "../utils/jwt"
import { JwtPayload, Role } from "../types"

export interface AuthRequest extends Request {
  user?: JwtPayload
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token manquant - connectez-vous",
    })
  }

  const token = authHeader.split(" ")[1]

  try {
    req.user = verifyAccessToken(token)
    next()
  } catch {
    return res.status(401).json({
      success: false,
      error: "Token invalide ou expire",
    })
  }
}

export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Non authentifie" })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Acces refuse - role insuffisant",
      })
    }
    next()
  }
}

export const authorizeOrg = (req: AuthRequest, res: Response, next: NextFunction) => {
  const orgId = req.params.orgId || req.body.organizationId

  if (req.user?.role === "OWNER") return next()

  if (orgId && req.user?.organizationId !== orgId) {
    return res.status(403).json({
      success: false,
      error: "Acces refuse - mauvaise organisation",
    })
  }
  next()
}
