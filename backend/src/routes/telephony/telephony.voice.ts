import { Router, Request, Response } from 'express'
import twilio from 'twilio'
import { supabaseAdmin } from '../../config/supabase'

const router = Router()

// ────────────────────────────────────────────────────────────────────────────
//  Twilio Voice — Routes VoxFlow
//  Monter sur : app.use('/api/v1/telephony', voiceRouter)
//
//  Pipeline data :
//   - /voice             → Twilio TwiML pour appels sortants (click-to-dial)
//   - /voice/incoming    → Twilio TwiML pour appels entrants (distribution agent)
//   - /voice/recording   → Twilio callback : INSERT/UPDATE calls.recording_url
//   - /voice/status      → Twilio callback : UPDATE calls.status + duration
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
// Appelé par Twilio pour les appels entrants (configurer sur le numéro Twilio).
// Workflow :
//  1. Identifier l'org via le numéro appelé (To = +1514...)
//  2. Chercher un agent ONLINE + pas en appel dans cette org
//  3. Si trouvé, dial.client(extension) ; sinon, enqueue dans la queue par défaut
router.post('/voice/incoming', async (req: Request, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse()
  const calledNumber = String(req.body.To || req.body.Called || '')
  const fromNumber   = String(req.body.From || req.body.Caller || '')
  const callSid      = String(req.body.CallSid || '')

  try {
    // 1. Trouver l'org propriétaire du numéro appelé
    const { data: phone } = await supabaseAdmin
      .from('phone_numbers')
      .select('organization_id')
      .eq('number', calledNumber)
      .eq('status', 'ACTIVE')
      .single()

    if (!phone) {
      twiml.say({ language: 'fr-FR' }, 'Numero non configure. Veuillez reessayer.')
      twiml.hangup()
      return res.type('text/xml').send(twiml.toString())
    }

    // 2. Créer la row calls AVANT le dial (pour le tracking live)
    if (callSid) {
      await supabaseAdmin.from('calls').insert({
        twilio_sid:       callSid,
        from_number:      fromNumber,
        to_number:        calledNumber,
        direction:        'INBOUND',
        status:           'RINGING',
        organization_id:  phone.organization_id,
        started_at:       new Date().toISOString(),
      })
    }

    // 3. Chercher un agent ONLINE disponible (pas en appel)
    const { data: availableAgent } = await supabaseAdmin
      .from('agent_sessions')
      .select('agent_id, users:users!inner(extension)')
      .eq('organization_id', phone.organization_id)
      .eq('status', 'ONLINE')
      .is('current_call_id', null)
      .order('updated_at', { ascending: true }) // FIFO : le plus longtemps idle
      .limit(1)
      .single()

    const extension = (availableAgent as any)?.users?.extension
    if (extension) {
      const dial = twiml.dial({
        timeout: 20,
        action:  '/api/v1/telephony/voice/status',
        callerId: fromNumber,
      })
      dial.client(String(extension))
    } else {
      // Aucun agent disponible → voicemail fallback
      twiml.say({ language: 'fr-FR' }, 'Tous nos agents sont occupes. Laissez un message apres le bip.')
      twiml.record({
        maxLength: 120,
        playBeep:  true,
        recordingStatusCallback: '/api/v1/telephony/voice/recording',
      })
    }
  } catch (err: any) {
    console.error('[voice/incoming]', err.message)
    twiml.say({ language: 'fr-FR' }, 'Une erreur est survenue. Reessayez plus tard.')
    twiml.hangup()
  }

  res.type('text/xml').send(twiml.toString())
})

// ── POST /voice/recording ─────────────────────────────────────────────────────
// Callback Twilio quand un enregistrement est prêt. Twilio envoie :
//   CallSid, RecordingSid, RecordingUrl, RecordingDuration, RecordingStatus
// On update la row calls correspondante via twilio_sid.
router.post('/voice/recording', async (req: Request, res: Response) => {
  const {
    CallSid,
    RecordingSid,
    RecordingUrl,
    RecordingDuration,
    RecordingStatus,
  } = req.body

  try {
    if (!CallSid || !RecordingUrl) {
      return res.sendStatus(400)
    }

    const { error } = await supabaseAdmin
      .from('calls')
      .update({
        recording_url:      RecordingUrl,
        recording_sid:      RecordingSid || null,
        recording_duration: RecordingDuration ? Number(RecordingDuration) : null,
        recording_status:   RecordingStatus || 'completed',
        recorded:           true,
      })
      .eq('twilio_sid', CallSid)

    if (error) console.error('[voice/recording] DB error:', error.message)
  } catch (err: any) {
    console.error('[voice/recording]', err.message)
  }
  res.sendStatus(200)
})

// ── POST /voice/status ────────────────────────────────────────────────────────
// Callback Twilio pour les changements de statut d'appel. Twilio envoie :
//   CallSid, CallStatus (ringing|in-progress|completed|busy|failed|no-answer),
//   CallDuration, From, To, Direction
// On map CallStatus Twilio → status VoxFlow et on update calls.
router.post('/voice/status', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration, From, To } = req.body

  try {
    if (!CallSid) return res.sendStatus(400)

    const statusMap: Record<string, string> = {
      'queued':      'RINGING',
      'ringing':     'RINGING',
      'in-progress': 'IN_PROGRESS',
      'answered':    'IN_PROGRESS',
      'completed':   'COMPLETED',
      'busy':        'BUSY',
      'failed':      'FAILED',
      'no-answer':   'NO_ANSWER',
      'canceled':    'MISSED',
    }
    const vfStatus = statusMap[String(CallStatus).toLowerCase()] || String(CallStatus).toUpperCase()

    const updates: Record<string, unknown> = {
      status: vfStatus,
    }
    if (CallDuration) updates.duration = Number(CallDuration)
    if (vfStatus === 'COMPLETED' || vfStatus === 'FAILED' || vfStatus === 'NO_ANSWER' || vfStatus === 'BUSY' || vfStatus === 'MISSED') {
      updates.ended_at = new Date().toISOString()
    }

    // Upsert : si la row n'existe pas encore (appel sortant rapide), la crée
    const { data: existing } = await supabaseAdmin
      .from('calls')
      .select('id, organization_id')
      .eq('twilio_sid', CallSid)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin
        .from('calls')
        .update(updates)
        .eq('twilio_sid', CallSid)
    } else if (From && To) {
      // Appel sortant dont la row n'a pas encore été créée — on la crée
      // (sans organization_id ici puisqu'on ne sait pas quelle org possède
      // le CallerId sortant ; un job de réconciliation complète ça later).
      await supabaseAdmin
        .from('calls')
        .insert({
          twilio_sid:   CallSid,
          from_number:  String(From),
          to_number:    String(To),
          direction:    'OUTBOUND',
          status:       vfStatus,
          duration:     CallDuration ? Number(CallDuration) : 0,
          started_at:   new Date().toISOString(),
          ended_at:     updates.ended_at || null,
        })
    }
  } catch (err: any) {
    console.error('[voice/status]', err.message)
  }

  res.sendStatus(200)
})

export default router
