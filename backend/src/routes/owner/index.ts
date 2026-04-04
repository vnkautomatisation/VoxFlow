import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth'
import { sendSuccess } from '../../utils/response'

const router = Router()

router.use(authenticate)
router.use(authorize('OWNER'))

router.get('/stats', async (req, res) => {
  // TODO Phase 2 — Stats globales owner
  sendSuccess(res, {
    totalAdmins: 0,
    totalAgents: 0,
    totalCalls:  0,
    mrr:         0,
  })
})

router.get('/organizations', async (req, res) => {
  // TODO Phase 2 — Liste des organisations
  sendSuccess(res, { organizations: [] })
})

export default router
