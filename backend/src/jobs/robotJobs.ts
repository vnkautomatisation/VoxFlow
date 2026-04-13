/**
 * Robot cron jobs:
 * 1. Overage billing — 1st of month at 00:10
 * 2. Scheduled campaigns — every minute
 * 3. Credits expiry — daily at 01:00
 */
import { createClient } from '@supabase/supabase-js'
import { invoiceRobotOverage } from '../routes/billing/robot'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

let cronLib: any = null
try { cronLib = require('node-cron') } catch {}

export function startRobotJobs(): void {
  if (!cronLib) {
    console.warn('[Robot Jobs] node-cron not installed — skipping')
    return
  }

  // 1. Overage billing — 1st of month at 00:10
  cronLib.schedule('10 0 1 * *', async () => {
    console.log('[Robot Overage] Running monthly billing...')
    try {
      const count = await invoiceRobotOverage()
      console.log(`[Robot Overage] Invoiced ${count} org(s)`)
    } catch (err: any) { console.error('[Robot Overage] Error:', err.message) }
  })

  // 2. Scheduled campaigns — every minute
  cronLib.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString()
      const { data: campaigns } = await supabase
        .from('robot_campaigns_v2')
        .select('id, organization_id')
        .eq('status', 'scheduled')
        .lte('scheduled_at', now)

      for (const c of campaigns || []) {
        await supabase.from('robot_campaigns_v2').update({ status: 'running' }).eq('id', c.id)
        console.log(`[Robot Scheduler] Campaign ${c.id} started`)
      }
    } catch (err: any) { console.error('[Robot Scheduler] Error:', err.message) }
  })

  // 3. Credits expiry — daily at 01:00
  cronLib.schedule('0 1 * * *', async () => {
    try {
      const { data: expired } = await supabase
        .from('robot_credits')
        .select('id, organization_id, minutes_remaining')
        .eq('status', 'active')
        .lt('expires_at', new Date().toISOString())

      if (expired && expired.length > 0) {
        const ids = expired.map((c: any) => c.id)
        await supabase.from('robot_credits').update({ status: 'expired' }).in('id', ids)
        console.log(`[Robot Credits] Expired ${ids.length} credit pack(s)`)
      }
    } catch (err: any) { console.error('[Robot Credits Expiry] Error:', err.message) }
  })

  console.log('[Robot Jobs] Scheduled: overage billing, campaign launcher, credits expiry')
}
