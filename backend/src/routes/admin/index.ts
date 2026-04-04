import { Router } from 'express'
import { authenticate, authorize } from '../../middleware/auth'
import { sendSuccess } from '../../utils/response'

const router = Router()

router.use(authenticate)
router.use(authorize('ADMIN', 'OWNER'))

router.get('/agents', async (req, res) => {
  // TODO Phase 3 — Liste agents
  sendSuccess(res, { agents: [] })
})

router.get('/queues', async (req, res) => {
  // TODO Phase 3 — Files d'attente
  sendSuccess(res, { queues: [] })
})

export default router
