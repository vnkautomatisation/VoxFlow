import { Router } from 'express'
import { sendSuccess } from '../../utils/response'

const router = Router()

// Webhook Twilio — appels entrants
router.post('/twilio/voice', (req, res) => {
  console.log('Webhook Twilio voice reçu:', req.body)
  // TODO Phase 4 — Gérer les appels Twilio
  res.set('Content-Type', 'text/xml')
  res.send('<Response><Say language="fr-FR">VoxFlow est prêt.</Say></Response>')
})

// Webhook Twilio — statut appels
router.post('/twilio/status', (req, res) => {
  console.log('Webhook Twilio status reçu:', req.body)
  sendSuccess(res, { received: true })
})

// Webhook Stripe — paiements
router.post('/stripe', (req, res) => {
  console.log('Webhook Stripe reçu')
  // TODO Phase 2 — Gérer les événements Stripe
  sendSuccess(res, { received: true })
})

export default router
