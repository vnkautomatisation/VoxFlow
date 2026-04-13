import { Router } from "express"
import { authenticate } from "../../middleware/auth"
import extensionsRouter from "./extensions"
import numbersRouter    from "./numbers"
import robotRouter      from "./robot"
import twilioConfigRouter from "./twilio-config"
import portalRouter     from "./portal"

// ══════════════════════════════════════════════════════════════
//  VoxFlow -- /api/v1/client/*
//  Routes Phase B pour le portail client (org-scoped).
//
//  /portal/plans-catalog est public (pas d'auth).
//  Tous les autres sub-routers heritent du middleware authenticate.
// ══════════════════════════════════════════════════════════════

const router = Router()

// Public route for plans catalog (no auth required)
router.get("/portal/plans-catalog", (req, res, next) => {
  // Forward to portal router without auth
  portalRouter(req, res, next)
})

router.use(authenticate)

router.use("/portal",        portalRouter)
router.use("/extensions",    extensionsRouter)
router.use("/numbers",       numbersRouter)
router.use("/robot",         robotRouter)
router.use("/twilio-config", twilioConfigRouter)

export default router
