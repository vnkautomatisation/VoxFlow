import { Router, Request, Response } from 'express'
import { authenticate, AuthRequest, resolveOrgId } from '../../middleware/auth'
import { twilioService } from '../../services/twilio/twilio.service'
import { supabaseAdmin } from '../../config/supabase'
import { sendSuccess, sendError } from '../../utils/response'

const router = Router()
const BACKEND = () => process.env.BACKEND_URL || 'http://localhost:4000'
const getOrgId = (req: AuthRequest) => resolveOrgId(req)

// ════════════════════════════════════════════════════════════
//  GET /voice/token  — JWT pour Twilio.Device (dialer)
// ════════════════════════════════════════════════════════════
router.get('/voice/token', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const identity = req.user!.userId
    const token    = await twilioService.generateToken(identity, getOrgId(req))
    sendSuccess(res, { token, identity, configured: true })
  } catch (err: any) {
    // Fallback demo si Twilio pas configuré
    sendSuccess(res, { token: 'demo_' + Date.now(), identity: req.user!.userId, configured: false })
  }
})

// ════════════════════════════════════════════════════════════
//  POST /voice  — TwiML appels sortants (appelé par Twilio)
//  Configurer dans TwiML App → Voice Request URL
// ════════════════════════════════════════════════════════════
router.post('/voice', async (req: Request, res: Response) => {
  try {
    const { To, From } = req.body
    const twiml = new (require('twilio').twiml.VoiceResponse)()

    if (To) {
      const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER || From,
        record:   'record-from-answer',
        recordingStatusCallback: BACKEND() + '/api/v1/telephony/voice/recording',
      })

      if (To.startsWith('client:')) {
        dial.client(To.replace('client:', ''))
      } else {
        dial.number(To)
      }
    } else {
      twiml.say({ language: 'fr-FR' }, 'Bienvenue chez VoxFlow.')
    }

    res.set('Content-Type', 'text/xml')
    res.send(twiml.toString())
  } catch (err: any) {
    console.error('[TwiML /voice error]', err.message)
    res.set('Content-Type', 'text/xml')
    res.send('<?xml version="1.0"?><Response><Say>Erreur.</Say></Response>')
  }
})

// ════════════════════════════════════════════════════════════
//  POST /voice/recording  — Callback enregistrement
// ════════════════════════════════════════════════════════════
router.post('/voice/recording', async (req: Request, res: Response) => {
  try {
    const { CallSid, RecordingUrl, RecordingDuration } = req.body
    console.log('[Twilio] Enregistrement prêt:', { CallSid, RecordingUrl, RecordingDuration })

    if (CallSid && RecordingUrl) {
      await supabaseAdmin.from('calls')
        .update({ recording_url: RecordingUrl })
        .eq('twilio_sid', CallSid)
    }

    res.sendStatus(200)
  } catch (err: any) {
    console.error('[Recording callback error]', err.message)
    res.sendStatus(200)
  }
})


// ── GET /telephony/recording-proxy — Proxy enregistrements Twilio ──────
// Évite le popup auth navigateur en proxifiant via le backend authentifié
router.get('/recording-proxy', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.query as { url: string }
    if (!url || !url.includes('twilio')) {
      res.status(400).json({ error: 'URL invalide' }); return
    }
    const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
    const authToken  = process.env.TWILIO_AUTH_TOKEN  || ''
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const upstream = await fetch(url, { headers: { Authorization: authHeader } })
    if (!upstream.ok) { res.status(upstream.status).send('Erreur audio'); return }
    const ct = upstream.headers.get('content-type') || 'audio/mpeg'
    res.set('Content-Type', ct)
    res.set('Cache-Control', 'private, max-age=3600')
    const buf = await upstream.arrayBuffer()
    res.send(Buffer.from(buf))
  } catch (err: any) {
    console.error('[recording-proxy]', err.message)
    res.status(500).send('Erreur proxy')
  }
})
export default router

