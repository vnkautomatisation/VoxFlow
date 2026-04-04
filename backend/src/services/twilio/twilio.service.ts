import twilio from "twilio"
import { config } from "../../config/env"

const client = twilio(config.twilio.accountSid, config.twilio.authToken)

export class TwilioService {

  // Rechercher les numeros disponibles
  async searchNumbers(countryCode: string = "CA", areaCode?: string) {
    try {
      const params: any = { voiceEnabled: true, smsEnabled: true, limit: 20 }
      if (areaCode) params.areaCode = areaCode

      const numbers = await client.availablePhoneNumbers(countryCode)
        .local.list(params)

      return numbers.map((n: any) => ({
        phoneNumber:  n.phoneNumber,
        friendlyName: n.friendlyName,
        locality:     n.locality,
        region:       n.region,
        country:      countryCode,
        capabilities: n.capabilities,
      }))
    } catch (err: any) {
      throw new Error("Erreur recherche numeros Twilio: " + err.message)
    }
  }

  // Acheter un numero
  async purchaseNumber(phoneNumber: string, organizationId: string) {
    try {
      const number = await client.incomingPhoneNumbers.create({
        phoneNumber,
        voiceUrl:   config.app.apiUrl + "/api/v1/webhooks/twilio/voice",
        statusCallback: config.app.apiUrl + "/api/v1/webhooks/twilio/status",
        friendlyName: "VoxFlow - Org " + organizationId,
      })

      return {
        sid:         number.sid,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        status:      number.status,
      }
    } catch (err: any) {
      throw new Error("Erreur achat numero Twilio: " + err.message)
    }
  }

  // Lister les numeros achetés
  async listPurchasedNumbers() {
    try {
      const numbers = await client.incomingPhoneNumbers.list({ limit: 100 })
      return numbers.map((n: any) => ({
        sid:         n.sid,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        status:      n.status,
      }))
    } catch (err: any) {
      throw new Error("Erreur liste numeros: " + err.message)
    }
  }

  // Liberer un numero
  async releaseNumber(sid: string) {
    try {
      await client.incomingPhoneNumbers(sid).remove()
      return { released: true, sid }
    } catch (err: any) {
      throw new Error("Erreur liberation numero: " + err.message)
    }
  }

  // Generer token WebRTC pour l agent
  async generateToken(identity: string, organizationId: string) {
    const { AccessToken } = twilio.jwt
    const { VoiceGrant }  = AccessToken

    const token = new AccessToken(
      config.twilio.accountSid,
      config.twilio.apiKey,
      config.twilio.apiSecret,
      { identity, ttl: 3600 }
    )

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: config.twilio.appSid,
      incomingAllow: true,
    })

    token.addGrant(voiceGrant)
    return token.toJwt()
  }
}

export const twilioService = new TwilioService()
