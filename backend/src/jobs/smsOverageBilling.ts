/**
 * SMS Overage Billing Job
 * Runs on the 1st of each month at 00:05.
 * Invoices orgs that exceeded their SMS quota last month.
 */
import { invoiceSmsOverage } from '../routes/billing/addons'

let cronLib: any = null
try { cronLib = require('node-cron') } catch {}

export function startSmsOverageJob(): void {
  if (!cronLib) {
    console.warn('[SMS Overage Job] node-cron not installed — skipping')
    return
  }

  // 1st of each month at 00:05
  cronLib.schedule('5 0 1 * *', async () => {
    console.log('[SMS Overage Job] Running monthly SMS overage billing...')
    try {
      const count = await invoiceSmsOverage()
      console.log(`[SMS Overage Job] Invoiced ${count} org(s)`)
    } catch (err: any) {
      console.error('[SMS Overage Job] Error:', err.message)
    }
  })

  console.log('[SMS Overage Job] Scheduled for 1st of each month at 00:05')
}
