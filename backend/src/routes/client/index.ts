import { Router } from "express"
import { authenticate } from "../../middleware/auth"
import extensionsRouter from "./extensions"
import numbersRouter    from "./numbers"
import robotRouter      from "./robot"
import twilioConfigRouter from "./twilio-config"

// ══════════════════════════════════════════════════════════════
//  VoxFlow -- /api/v1/client/*
//  Routes Phase B pour le portail client (org-scoped).
//
//  Tous les sub-routers heritent du middleware authenticate ci-dessous.
//  getOrgId() extrait req.user.organizationId (JWT) — aucun fallback.
// ══════════════════════════════════════════════════════════════

const router = Router()

router.use(authenticate)

router.use("/extensions",    extensionsRouter)
router.use("/numbers",       numbersRouter)
router.use("/robot",         robotRouter)
router.use("/twilio-config", twilioConfigRouter)

export default router
