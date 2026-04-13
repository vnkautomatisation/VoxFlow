import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
let cronLib: any = null
try { cronLib = require('node-cron') } catch {}

export function startDialerJobs(): void {
  if (!cronLib) { console.warn('[Dialer Jobs] node-cron not installed — skipping'); return }

  // Scheduled campaigns — every minute
  cronLib.schedule('* * * * *', async () => {
    try {
      const now = new Date().toISOString()
      const { data: campaigns } = await supabase.from('dialer_campaigns')
        .select('id, organization_id').eq('status', 'scheduled').lte('scheduled_at', now)
      for (const c of campaigns || []) {
        await supabase.from('dialer_campaigns').update({ status: 'running' }).eq('id', c.id)
        console.log(`[Dialer Scheduler] Campaign ${c.id} started`)
      }
    } catch (err: any) { console.error('[Dialer Scheduler] Error:', err.message) }
  })

  console.log('[Dialer Jobs] Scheduled campaign launcher running every minute')
}
