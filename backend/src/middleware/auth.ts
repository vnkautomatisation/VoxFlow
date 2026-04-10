import { Request, Response, NextFunction } from "express"
import { verifyAccessToken } from "../utils/jwt"
import { JwtPayload, Role } from "../types"
import { integrationsService } from "../services/integrations/integrations.service"

export interface AuthRequest extends Request {
  user?: JwtPayload
  // Populated when authenticated via API key (instead of JWT)
  apiKey?: {
    organizationId: string
    permissions:    string[]
  }
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

/**
 * Middleware d'authentification par clé API publique (vf_*).
 * Attendu dans le header X-API-Key ou le query ?api_key=.
 * Si `requiredPermission` est fourni, vérifie que la clé possède cette permission.
 *
 * Les permissions supportées sont:
 * - calls:read, calls:write
 * - contacts:read, contacts:write
 * - conversations:read
 * - analytics:read
 */
export const apiKeyAuth = (requiredPermission?: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const rawKey = String(req.headers["x-api-key"] || req.query.api_key || "")

    if (!rawKey.startsWith("vf_")) {
      return res.status(401).json({
        success: false,
        error:   "Clé API requise (header X-API-Key ou ?api_key=vf_...)",
      })
    }

    const auth = await integrationsService.validateAPIKey(rawKey)
    if (!auth) {
      return res.status(401).json({
        success: false,
        error:   "Clé API invalide, révoquée ou expirée",
      })
    }

    // Vérifie la permission si exigée
    if (requiredPermission && !(auth.permissions || []).includes(requiredPermission)) {
      return res.status(403).json({
        success: false,
        error:   `Permission manquante: ${requiredPermission}`,
      })
    }

    req.apiKey = {
      organizationId: auth.organizationId,
      permissions:    auth.permissions || [],
    }
    next()
  }
}
