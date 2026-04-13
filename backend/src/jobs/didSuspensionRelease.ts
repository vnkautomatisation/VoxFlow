/**
 * DID Suspension Release Job — daily at 02:00
 * Releases DID numbers suspended for more than 14 days.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let twilioClient: any = null
try { if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) { twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) } } catch {}

let cronLib: any = null
try { cronLib = require('node-cron') } catch {}

export function startDidSuspensionJob(): void {
  if (!cronLib) {
    console.warn('[DID Suspension Job] node-cron not installed — skipping')
    return
  }

  cronLib.schedule('0 2 * * *', async () => {
    console.log('[DID Suspension] Running daily check...')
    try {
      const cutoff = new Date(Date.now() - 14 * 86400000).toISOString()
      const { data: suspended } = await supabase.from('did_orders')
        .select('id, twilio_sid, phone_number, organization_id')
        .eq('status', 'suspended')
        .lt('suspended_at', cutoff)

      let released = 0
      for (const did of suspended || []) {
        if (twilioClient && did.twilio_sid && !did.twilio_sid.startsWith('demo_')) {
          try { await twilioClient.incomingPhoneNumbers(did.twilio_sid).remove() } catch {}
        }
        await supabase.from('did_orders').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', did.id)
        released++
      }

      if (released > 0) console.log(`[DID Suspension] Released ${released} number(s)`)
    } catch (err: any) { console.error('[DID Suspension] Error:', err.message) }
  })

  console.log('[DID Suspension Job] Scheduled daily at 02:00')
}
