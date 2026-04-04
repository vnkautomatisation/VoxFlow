import { Router } from 'express'
import { sendSuccess } from '../../utils/response'

const router = Router()

router.post('/login', async (req, res) => {
  // TODO Phase 1 — Implémenter login Supabase
  sendSuccess(res, { message: 'Login endpoint — à implémenter' })
})

router.post('/register', async (req, res) => {
  // TODO Phase 1 — Implémenter register Supabase
  sendSuccess(res, { message: 'Register endpoint — à implémenter' })
})

router.post('/logout', async (req, res) => {
  // TODO Phase 1 — Implémenter logout
  sendSuccess(res, { message: 'Logout endpoint — à implémenter' })
})

export default router
