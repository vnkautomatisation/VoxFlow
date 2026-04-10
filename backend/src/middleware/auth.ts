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

  if (req.user?.role === "OWNER" || req.user?.role === "OWNER_STAFF") return next()

  if (orgId && req.user?.organizationId !== orgId) {
    return res.status(403).json({
      success: false,
      error: "Acces refuse - mauvaise organisation",
    })
  }
  next()
}

/**
 * Résout l'organisation cible pour une requête authentifiée.
 * Règles de sécurité:
 *  - Pour ADMIN / SUPERVISOR / AGENT : utilise STRICTEMENT leur propre
 *    organizationId depuis le JWT. Ignore tout ?orgId passé en query.
 *  - Pour OWNER / OWNER_STAFF : accepte ?orgId=X en query (impersonation
 *    contrôlée pour support/analytics cross-org). Fallback au JWT sinon.
 *
 * À utiliser partout au lieu de `req.user?.organizationId || req.query.orgId`
 * qui est dangereux (un ADMIN pourrait passer ?orgId=OTHER_ORG).
 */
export const resolveOrgId = (req: AuthRequest): string => {
  const role = req.user?.role
  const jwtOrgId = String(req.user?.organizationId || "")

  if (role === "OWNER" || role === "OWNER_STAFF") {
    // OWNER peut spécifier une org cible via ?orgId ou body.organizationId
    const override = req.query.orgId || req.body?.organizationId
    return String(override || jwtOrgId)
  }

  // ADMIN / SUPERVISOR / AGENT : JWT uniquement, jamais de query override
  return jwtOrgId
}

/**
 * Middleware qui vérifie qu'une organisation en essai n'est pas expirée.
 * À appliquer sur les routes qui créent du contenu (POST/PATCH/DELETE).
 * Les routes lecture (GET) restent accessibles même en essai expiré pour
 * permettre au user de voir ses données et upgrader.
 *
 * L'OWNER / OWNER_STAFF est exempté (staff VNK).
 */
export const checkTrialActive = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const role = req.user?.role
  if (role === "OWNER" || role === "OWNER_STAFF") return next()

  const orgId = req.user?.organizationId
  if (!orgId) return next()

  try {
    const { supabaseAdmin } = await import("../config/supabase")
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("status, trial_ends_at")
      .eq("id", orgId)
      .maybeSingle()

    if (!org) return next()

    if (org.status === "SUSPENDED" || org.status === "CANCELLED") {
      return res.status(403).json({
        success: false,
        error: "Compte suspendu — contactez le support",
        code: "ORG_SUSPENDED",
      })
    }

    if (org.status === "TRIAL" && org.trial_ends_at) {
      const trialEnd = new Date(org.trial_ends_at)
      if (trialEnd < new Date()) {
        return res.status(402).json({
          success: false,
          error: "Essai gratuit expiré — veuillez choisir un plan",
          code: "TRIAL_EXPIRED",
          trialEndedAt: org.trial_ends_at,
        })
      }
    }

    next()
  } catch {
    // En cas d'erreur DB, on laisse passer (fail-open pour éviter de bloquer l'app)
    next()
  }
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
