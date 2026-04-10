import twilio from "twilio"
import { config } from "../../config/env"
import { supabaseAdmin } from "../../config/supabase"

const accountSid = process.env.TWILIO_ACCOUNT_SID || ""
const authToken  = process.env.TWILIO_AUTH_TOKEN  || ""
const apiKey     = process.env.TWILIO_API_KEY     || accountSid
const apiSecret  = process.env.TWILIO_API_SECRET  || authToken
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID || ""
const phoneNumber = process.env.TWILIO_PHONE_NUMBER || ""

const isTwilioConfigured = () =>
  accountSid.startsWith("AC") && authToken.length > 10

const client = isTwilioConfigured()
  ? twilio(accountSid, authToken)
  : null

export class TwilioService {

  // ── TOKEN WEBRTC (pour le softphone navigateur) ───────────

  async generateToken(identity: string, organizationId: string): Promise<string> {
    if (!isTwilioConfigured()) {
      throw new Error("Twilio non configure — ajoutez les cles dans .env")
    }

    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant  = AccessToken.VoiceGrant

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow:          true,
    })

    const token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity, ttl: 3600 }
    )

    token.addGrant(voiceGrant)
    return token.toJwt()
  }

  // ── APPEL SORTANT via TwiML ────────────────────────────────

  async makeOutboundCall(opts: {
    to:          string
    from:        string
    callbackUrl: string
    statusUrl:   string
  }) {
    if (!client) throw new Error("Twilio non configure")

    const call = await client.calls.create({
      to:                 opts.to,
      from:               opts.from || phoneNumber,
      url:                opts.callbackUrl,
      statusCallback:     opts.statusUrl,
      statusCallbackEvent:["initiated","ringing","answered","completed"],
      record:             true,
      recordingChannels:  "dual",
    })

    return call
  }

  // ── GERER APPEL ENTRANT (TwiML webhook) ───────────────────

  generateIncomingTwiML(opts: {
    agentIdentity: string
    queueName?:    string
    waitUrl?:      string
  }): string {
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response      = new VoiceResponse()

    if (opts.queueName) {
      // Mettre en file d attente
      response.say({ language: "fr-CA", voice: "alice" },
        "Votre appel est important. Un agent va vous repondre.")

      const enqueue = response.enqueue({ waitUrl: opts.waitUrl || "" })
      enqueue.task(JSON.stringify({ agentIdentity: opts.agentIdentity }))
    } else {
      // Connecter directement au client navigateur
      const backendUrl = process.env.BACKEND_URL || "http://localhost:4000"
      const orgParam = ""
      const dial = response.dial({
        callerId: phoneNumber,
        record: "record-from-answer-dual",
        action: `${backendUrl}/api/v1/telephony/webhook/status`,
        timeout: 30,
      } as any)
      dial.client(opts.agentIdentity as any)
    }

    return response.toString()
  }

  // ── CONFÉRENCE 3 VOIES ────────────────────────────────────

  async addParticipantToConference(opts: {
    conferenceName: string
    participantPhone: string
    label?:         string
  }) {
    if (!client) throw new Error("Twilio non configure")

    const baseUrl = process.env.BACKEND_URL || "https://api.voxflow.io"

    const participant = await client.conferences(opts.conferenceName)
      .participants.create({
        from:          phoneNumber,
        to:            opts.participantPhone,
        label:         opts.label || "participant",
        statusCallback:`${baseUrl}/api/v1/telephony/webhook/participant`,
      })

    return participant
  }

  generateConferenceTwiML(conferenceName: string, isSupervisor = false): string {
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response      = new VoiceResponse()
    const dial          = response.dial()

    const confOpts: any = {
      record:              "record-from-start",
      statusCallback:      `${process.env.BACKEND_URL}/api/v1/telephony/webhook/conference`,
      statusCallbackEvent: "start end join leave mute hold",
    }

    if (isSupervisor) {
      confOpts.muted = true  // Superviseur en ecoute seulement
    }

    dial.conference(conferenceName as any, confOpts)
    return response.toString()
  }

  // ── TRANSFERT D APPEL ─────────────────────────────────────

  async transferCall(opts: {
    callSid: string
    to:      string
    type:    "blind" | "attended"
  }) {
    if (!client) throw new Error("Twilio non configure")

    const baseUrl = process.env.BACKEND_URL || "https://api.voxflow.io"

    if (opts.type === "blind") {
      // Transfert aveugle — rediriger l appel directement
      const VoiceResponse = twilio.twiml.VoiceResponse
      const twiml         = new VoiceResponse()
      const dial          = twiml.dial({ callerId: phoneNumber })

      if (opts.to.startsWith("+")) {
        dial.number(opts.to)
      } else {
        dial.client(opts.to)
      }

      await client.calls(opts.callSid).update({
        twiml: twiml.toString()
      })
    } else {
      // Transfert assiste — creer conference et ajouter les deux parties
      const confName = "transfer-" + Date.now()
      await client.calls(opts.callSid).update({
        url: `${baseUrl}/api/v1/telephony/twiml/conference/${confName}`
      })
    }

    return { transferred: true, type: opts.type }
  }

  // ── MUTE / HOLD ───────────────────────────────────────────

  async muteCall(callSid: string, mute: boolean) {
    if (!client) throw new Error("Twilio non configure")

    // Chercher la participation en conference
    const confs = await client.conferences.list({ status: "in-progress", limit: 10 })
    for (const conf of confs) {
      const parts = await client.conferences(conf.sid).participants.list()
      const part  = parts.find((p: any) => p.callSid === callSid)
      if (part) {
        await client.conferences(conf.sid)
          .participants(part.callSid)
          .update({ muted: mute })
        return { muted: mute }
      }
    }

    return { muted: mute, simulated: true }
  }

  async holdCall(callSid: string, hold: boolean) {
    if (!client) throw new Error("Twilio non configure")

    const baseUrl = process.env.BACKEND_URL || "https://api.voxflow.io"

    const confs = await client.conferences.list({ status: "in-progress", limit: 10 })
    for (const conf of confs) {
      const parts = await client.conferences(conf.sid).participants.list()
      const part  = parts.find((p: any) => p.callSid === callSid)
      if (part) {
        await client.conferences(conf.sid)
          .participants(part.callSid)
          .update({
            hold,
            holdUrl: hold ? `${baseUrl}/api/v1/telephony/twiml/hold-music` : undefined,
          })
        return { onHold: hold }
      }
    }

    return { onHold: hold, simulated: true }
  }

  // ── VOICEMAIL ─────────────────────────────────────────────

  generateVoicemailTwiML(organizationId: string, agentId?: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response      = new VoiceResponse()
    const baseUrl       = process.env.BACKEND_URL || "https://api.voxflow.io"

    response.say({ language: "fr-CA", voice: "alice" },
      "Nous sommes absents ou en dehors des heures de travail. " +
      "Veuillez laisser votre message apres le bip. Merci.")

    response.record({
      action:         `${baseUrl}/api/v1/telephony/webhook/voicemail?orgId=${organizationId}`,
      maxLength:       120,
      playBeep:        true,
      transcribe:      true,
      transcribeCallback: `${baseUrl}/api/v1/telephony/webhook/voicemail-transcription`,
      recordingStatusCallback: `${baseUrl}/api/v1/telephony/webhook/recording-status`,
    })

    response.say({ language: "fr-CA", voice: "alice" },
      "Merci pour votre message. Au revoir.")

    return response.toString()
  }

  // ── IVR (menu interactif) ─────────────────────────────────

  /**
   * Génère le TwiML pour le niveau racine d'un IVR.
   * Lit welcome_message + Gather avec redirection vers /twiml/ivr/:id/gather pour la sélection.
   */
  generateIvrTwiML(ivr: {
    id:              string
    welcome_message?: string
    timeout?:        number
    max_retries?:    number
    nodes?:          any[]
  }, orgId: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response      = new VoiceResponse()
    const baseUrl       = process.env.BACKEND_URL || "https://api.voxflow.io"
    const timeout       = Math.max(3, Math.min(30, ivr.timeout || 5))

    const rootNodes = (ivr.nodes || []).filter((n: any) => n.digit)
    const validDigits = rootNodes.map((n: any) => String(n.digit)).filter(Boolean).join("")

    const gather = response.gather({
      numDigits: 1,
      timeout,
      action:    `${baseUrl}/api/v1/telephony/twiml/ivr/${ivr.id}/gather?orgId=${orgId}`,
      method:    "POST",
      input:     ["dtmf"] as any,
    } as any)

    if (ivr.welcome_message) {
      gather.say({ language: "fr-CA", voice: "alice" } as any, ivr.welcome_message)
    } else {
      gather.say({ language: "fr-CA", voice: "alice" } as any,
        "Bienvenue. Veuillez faire votre choix.")
    }

    // Fallback si rien n'est entré — re-jouer une fois puis voicemail
    response.say({ language: "fr-CA", voice: "alice" } as any,
      "Aucune sélection détectée. Au revoir.")
    response.hangup()

    // Side effect: mention des digits valides uniquement pour logs
    void validDigits

    return response.toString()
  }

  /**
   * Génère le TwiML d'action pour un nœud IVR sélectionné par l'utilisateur.
   * Appelé par Twilio après un Gather avec le paramètre Digits.
   */
  generateIvrActionTwiML(ivr: any, digit: string, orgId: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response      = new VoiceResponse()
    const baseUrl       = process.env.BACKEND_URL || "https://api.voxflow.io"

    const nodes: any[] = ivr.nodes || []
    const selected     = nodes.find((n: any) => String(n.digit) === String(digit))

    if (!selected) {
      response.say({ language: "fr-CA", voice: "alice" } as any,
        "Sélection invalide. Veuillez réessayer.")
      response.redirect(`${baseUrl}/api/v1/telephony/twiml/ivr/${ivr.id}?orgId=${orgId}`)
      return response.toString()
    }

    switch (selected.type) {
      case "message": {
        if (selected.message) {
          response.say({ language: "fr-CA", voice: "alice" } as any, selected.message)
        }
        // Après le message, retour au menu principal ou raccroche
        if (selected.children && selected.children.length > 0) {
          response.redirect(`${baseUrl}/api/v1/telephony/twiml/ivr/${ivr.id}?orgId=${orgId}`)
        } else {
          response.hangup()
        }
        break
      }

      case "queue": {
        if (selected.message) {
          response.say({ language: "fr-CA", voice: "alice" } as any, selected.message)
        }
        const queueId = selected.target
        if (queueId) {
          response.redirect(`${baseUrl}/api/v1/telephony/twiml/queue/${queueId}?orgId=${orgId}`)
        } else {
          response.say({ language: "fr-CA", voice: "alice" } as any,
            "Aucune file d'attente configurée.")
          response.hangup()
        }
        break
      }

      case "voicemail": {
        if (selected.message) {
          response.say({ language: "fr-CA", voice: "alice" } as any, selected.message)
        }
        response.redirect(`${baseUrl}/api/v1/telephony/twiml/voicemail?orgId=${orgId}`)
        break
      }

      case "transfer": {
        if (selected.message) {
          response.say({ language: "fr-CA", voice: "alice" } as any, selected.message)
        }
        const target = selected.target
        if (target) {
          const dial = response.dial({ callerId: phoneNumber, timeout: 30 } as any)
          if (target.startsWith("+")) {
            dial.number(target as any)
          } else {
            dial.client(target as any)
          }
        } else {
          response.say({ language: "fr-CA", voice: "alice" } as any,
            "Aucun destinataire configuré.")
          response.hangup()
        }
        break
      }

      case "menu": {
        // Sous-menu — re-gather avec les enfants
        const subTimeout = 5
        const gather = response.gather({
          numDigits: 1,
          timeout:   subTimeout,
          action:    `${baseUrl}/api/v1/telephony/twiml/ivr/${ivr.id}/gather?orgId=${orgId}`,
          method:    "POST",
          input:     ["dtmf"] as any,
        } as any)
        if (selected.message) {
          gather.say({ language: "fr-CA", voice: "alice" } as any, selected.message)
        } else {
          gather.say({ language: "fr-CA", voice: "alice" } as any, selected.label || "Sous-menu")
        }
        response.redirect(`${baseUrl}/api/v1/telephony/twiml/ivr/${ivr.id}?orgId=${orgId}`)
        break
      }

      case "hangup":
      default: {
        if (selected.message) {
          response.say({ language: "fr-CA", voice: "alice" } as any, selected.message)
        }
        response.say({ language: "fr-CA", voice: "alice" } as any, "Au revoir.")
        response.hangup()
        break
      }
    }

    return response.toString()
  }

  // ── QUEUE (file d'attente ACD) ────────────────────────────

  /**
   * Génère le TwiML pour enqueue un appel dans une file d'attente.
   * Joue le message d'accueil puis enqueue avec musique d'attente.
   */
  generateQueueTwiML(queue: {
    id:              string
    name:            string
    welcome_message?: string
    music_on_hold?:  string
  }, orgId: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse
    const response      = new VoiceResponse()
    const baseUrl       = process.env.BACKEND_URL || "https://api.voxflow.io"

    if (queue.welcome_message) {
      response.say({ language: "fr-CA", voice: "alice" } as any, queue.welcome_message)
    } else {
      response.say({ language: "fr-CA", voice: "alice" } as any,
        "Votre appel est important. Un agent va vous répondre sous peu.")
    }

    // Enqueue dans une file nommée (Twilio TaskRouter-like, basé sur le nom)
    response.enqueue({
      waitUrl:   `${baseUrl}/api/v1/telephony/twiml/hold-music`,
      action:    `${baseUrl}/api/v1/telephony/webhook/status?orgId=${orgId}&queueId=${queue.id}`,
    } as any, queue.name as any)

    return response.toString()
  }

  // ── LISTEN / WHISPER / BARGE (supervision) ────────────────

  async joinCallAsSupervisor(opts: {
    callSid:      string
    supervisorId: string
    mode:         "listen" | "whisper" | "barge"
  }) {
    if (!client) throw new Error("Twilio non configure")

    const baseUrl   = process.env.BACKEND_URL || "https://api.voxflow.io"
    const confName  = "supervision-" + opts.callSid

    // Ajouter le superviseur dans la conference
    const participant = await client.conferences(confName)
      .participants.create({
        from:   phoneNumber,
        to:     `client:supervisor-${opts.supervisorId}`,
        label:  opts.mode,
        muted:  opts.mode === "listen",  // listen = muted, whisper/barge = pas muted
        coaching: opts.mode === "whisper",
        callSidToCoach: opts.mode === "whisper" ? opts.callSid : undefined,
      })

    return {
      mode:          opts.mode,
      participantSid: participant.callSid,
      conferenceName: confName,
    }
  }

  // ── ENREGISTREMENTS ───────────────────────────────────────

  async getRecordings(callSid: string) {
    if (!client) return []
    const recordings = await client.recordings.list({ callSid, limit: 10 })
    return recordings.map((r: any) => ({
      sid:       r.sid,
      duration:  r.duration,
      url:       `https://api.twilio.com${r.uri.replace(".json", ".mp3")}`,
      createdAt: r.dateCreated,
    }))
  }

  async deleteRecording(recordingSid: string) {
    if (!client) return
    await client.recordings(recordingSid).remove()
  }

  // ── NUMEROS TWILIO DID ────────────────────────────────────

  async getPhoneNumbers() {
    if (!client) return []
    const numbers = await client.incomingPhoneNumbers.list({ limit: 50 })
    return numbers.map((n: any) => ({
      sid:          n.sid,
      phoneNumber:  n.phoneNumber,
      friendlyName: n.friendlyName,
      voiceUrl:     n.voiceUrl,
      statusCallback: n.statusCallback,
    }))
  }

  async configurePhoneNumber(phoneNumberSid: string, voiceUrl: string, statusUrl: string) {
    if (!client) throw new Error("Twilio non configure")

    await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl,
      voiceMethod:    "POST",
      statusCallback: statusUrl,
      statusCallbackMethod: "POST",
    })

    return { configured: true }
  }

  async searchAvailableNumbers(areaCode: string, country = "CA") {
    if (!client) throw new Error("Twilio non configure")

    const available = await client.availablePhoneNumbers(country)
      .local.list({ areaCode: parseInt(areaCode), limit: 10 })

    return available.map((n: any) => ({
      phoneNumber:  n.phoneNumber,
      friendlyName: n.friendlyName,
      region:       n.region,
      locality:     n.locality,
    }))
  }

  async purchasePhoneNumber(phoneNumber: string, organizationId: string) {
    if (!client) throw new Error("Twilio non configure")

    const baseUrl = process.env.BACKEND_URL || "https://api.voxflow.io"

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl:       `${baseUrl}/api/v1/telephony/webhook/voice?orgId=${organizationId}`,
      statusCallback: `${baseUrl}/api/v1/telephony/webhook/status`,
      smsUrl:         `${baseUrl}/api/v1/telephony/webhook/sms?orgId=${organizationId}`,
    })

    // Sauvegarder en BDD
    await supabaseAdmin.from("phone_numbers").insert({
      organization_id: organizationId,
      twilio_sid:      purchased.sid,
      number:          purchased.phoneNumber,
      friendly_name:   purchased.friendlyName,
      status:          "active",
    })

    return purchased
  }

  // ── TRANSCRIPTION WHISPER ─────────────────────────────────

  async transcribeAudio(audioUrl: string, callId: string): Promise<string> {
    try {
      const openaiKey = process.env.OPENAI_API_KEY
      if (!openaiKey) return ""

      // Telecharger l audio depuis Twilio
      const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64")
      const audioRes   = await fetch(audioUrl, { headers: { Authorization: authHeader } })
      const audioBlob  = await audioRes.arrayBuffer()

      // Envoyer a Whisper
      const form = new FormData()
      form.append("file", new Blob([audioBlob], { type: "audio/mpeg" }), "recording.mp3")
      form.append("model", "whisper-1")
      form.append("language", "fr")
      form.append("response_format", "text")

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method:  "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body:    form,
      })

      const transcription = await whisperRes.text()

      // Sauvegarder en BDD
      if (callId && transcription) {
        await supabaseAdmin.from("calls")
          .update({ transcription, ai_summary: transcription.substring(0, 500) })
          .eq("id", callId)
      }

      return transcription
    } catch (err) {
      console.error("Whisper transcription error:", err)
      return ""
    }
  }
}

export const twilioService = new TwilioService()

