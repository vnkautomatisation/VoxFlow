import { Router, Request, Response } from 'express'
import twilio from 'twilio'

const router = Router()

// ────────────────────────────────────────────────────────────────────────────
//  Twilio Voice — Routes VoxFlow
//  Monter sur : app.use('/api/v1/telephony', voiceRouter)
// ────────────────────────────────────────────────────────────────────────────

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY,
  TWILIO_API_SECRET,
  TWILIO_TWIML_APP_SID,
  TWILIO_PHONE_NUMBER,
} = process.env

// ── GET /voice/token ─────────────────────────────────────────────────────────
// Appelé par le dialer au login pour initialiser Twilio.Device
router.get('/voice/token', async (req: any, res: Response) => {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET) {
      return res.status(503).json({
        success: false,
        error: 'Twilio non configuré — ajouter les variables dans .env',
      })
    }

    const { AccessToken } = twilio.jwt
    const { VoiceGrant }  = AccessToken

    const identity = req.user?.id || req.user?.email || 'agent'

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity, ttl: 3600 }
    )

    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: TWILIO_TWIML_APP_SID,
        incomingAllow: true,
      })
    )

    return res.json({ success: true, data: { token: token.toJwt(), identity } })
  } catch (err: any) {
    console.error('[Twilio] token error:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

// ── POST /voice ───────────────────────────────────────────────────────────────
// Appelé par Twilio quand un agent initie un appel sortant (TwiML App webhook)
router.post('/voice', (req: Request, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse()
  const { To } = req.body

  if (To) {
    const dial = twiml.dial({
      callerId: TWILIO_PHONE_NUMBER,
      record:   'record-from-answer',
      recordingStatusCallback: '/api/v1/telephony/voice/recording',
    })

    if (To.startsWith('client:')) {
      // Appel vers un autre agent VoxFlow
      dial.client(To.replace('client:', ''))
    } else {
      // Vrai numéro de téléphone
      dial.number(To)
    }
  } else {
    twiml.say({ language: 'fr-FR' }, 'Bienvenue chez VoxFlow.')
  }

  res.type('text/xml').send(twiml.toString())
})

// ── POST /voice/incoming ──────────────────────────────────────────────────────
// Appelé par Twilio pour les appels entrants (configurer sur le numéro Twilio)
router.post('/voice/incoming', (req: Request, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse()

  // TODO : trouver l'agent disponible dans la DB
  const dial = twiml.dial({ timeout: 20 })
  dial.client(req.body.To || 'agent')

  res.type('text/xml').send(twiml.toString())
})

// ── POST /voice/recording ─────────────────────────────────────────────────────
// Callback Twilio quand un enregistrement est prêt
router.post('/voice/recording', async (req: Request, res: Response) => {
  const { CallSid, RecordingUrl, RecordingDuration } = req.body
  console.log('[Twilio] Enregistrement prêt:', { CallSid, RecordingUrl, RecordingDuration })
  // TODO : sauvegarder RecordingUrl dans la table calls (colonne recording_url)
  res.sendStatus(200)
})

// ── POST /voice/status ────────────────────────────────────────────────────────
// Callback Twilio pour les changements de statut d'appel
router.post('/voice/status', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration } = req.body
  console.log('[Twilio] Status:', { CallSid, CallStatus, CallDuration })
  // TODO : mettre à jour le statut dans la table calls
  res.sendStatus(200)
})

export default router
