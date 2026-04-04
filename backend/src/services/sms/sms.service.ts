import twilio from "twilio"
import { config } from "../../config/env"
import { supabaseAdmin } from "../../config/supabase"

const client = twilio(config.twilio.accountSid, config.twilio.authToken)

export class SMSService {

  async sendSMS(to: string, from: string, body: string, organizationId: string) {
    try {
      let sid = "simulated_" + Date.now()

      if (config.twilio.accountSid && !config.twilio.accountSid.includes("xxxx")) {
        const message = await client.messages.create({ to, from, body })
        sid = message.sid
      }

      // Sauvegarder le SMS en BDD
      const { data } = await supabaseAdmin
        .from("sms_messages")
        .insert({
          twilio_sid:      sid,
          from_number:     from,
          to_number:       to,
          body,
          direction:       "OUTBOUND",
          status:          "SENT",
          organization_id: organizationId,
        })
        .select().single()

      return data
    } catch (err: any) {
      throw new Error("Erreur envoi SMS: " + err.message)
    }
  }

  async getConversations(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("sms_messages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50)

    return data || []
  }

  async getThread(phoneNumber: string, organizationId: string) {
    const { data } = await supabaseAdmin
      .from("sms_messages")
      .select("*")
      .eq("organization_id", organizationId)
      .or("from_number.eq." + phoneNumber + ",to_number.eq." + phoneNumber)
      .order("created_at", { ascending: true })

    return data || []
  }
}

export const smsService = new SMSService()
