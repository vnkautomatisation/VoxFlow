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
    // Ancien code retournait un faux token 'demo_<timestamp>' ici, ce qui
    // faisait echouer le dialer silencieusement. Maintenant on renvoie une
    // vraie erreur 503 : le client voit "Twilio non configure" au lieu
    // d'essayer d'utiliser un token bidon.
    console.error('[voice/token] Twilio generateToken failed:', err.message)
    return res.status(503).json({
      success: false,
      error: 'Twilio non configure pour cette organisation',
      details: err.message,
    })
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
// ════════════════════════════════════════════════════════════
//  POST /voice/incoming — DID incoming call routing
//  Called by Twilio when a purchased DID receives a call.
// ════════════════════════════════════════════════════════════
router.post('/voice/incoming', async (req: Request, res: Response) => {
  try {
    const { To } = req.body
    if (!To) { res.set('Content-Type', 'text/xml'); return res.send('<Response><Hangup/></Response>') }

    const { data: did } = await supabaseAdmin.from('did_orders')
      .select('assigned_action_type, assigned_action_id, organization_id')
      .eq('phone_number', To).eq('status', 'active').maybeSingle()

    if (!did || !did.assigned_action_type) {
      res.set('Content-Type', 'text/xml')
      return res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-CA">Ce numero n\'est pas configure.</Say><Hangup/></Response>')
    }

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>'
    switch (did.assigned_action_type) {
      case 'extension': {
        const { data: ext } = await supabaseAdmin.from('extensions').select('extension_number').eq('id', did.assigned_action_id).single()
        twiml += ext ? `<Dial timeout="30"><Sip>sip:${ext.extension_number}@${process.env.TWILIO_SIP_DOMAIN || 'voxflow.sip.twilio.com'}</Sip></Dial>` : '<Hangup/>'
        break
      }
      case 'queue': {
        const { data: q } = await supabaseAdmin.from('queues').select('name').eq('id', did.assigned_action_id).single()
        twiml += `<Enqueue>${q?.name || 'support'}</Enqueue>`
        break
      }
      case 'voicemail':
        twiml += '<Say language="fr-CA">Veuillez laisser un message apres le bip.</Say><Record maxLength="120" transcribe="true" />'
        break
      case 'recording':
        twiml += `<Play>${did.assigned_action_id}</Play>`
        break
      default: twiml += '<Hangup/>'
    }
    twiml += '</Response>'
    res.set('Content-Type', 'text/xml')
    res.send(twiml)
  } catch (err: any) {
    console.error('[Voice Incoming] Error:', err.message)
    res.set('Content-Type', 'text/xml')
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>')
  }
})

export default router

