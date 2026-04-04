import { supabaseAdmin } from "../../config/supabase"

export class AnalyticsService {

  async getAdvancedStats(organizationId: string, period: string = "30d") {
    const days  = period === "7d" ? 7 : period === "90d" ? 90 : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("id, duration, status, direction, started_at, agent_id")
      .eq("organization_id", organizationId)
      .gte("started_at", since)

    const allCalls = calls || []

    // Appels par heure (heatmap)
    const byHour: Record<number, number> = {}
    for (let h = 0; h < 24; h++) byHour[h] = 0
    allCalls.forEach((c: any) => {
      const hour = new Date(c.started_at).getHours()
      byHour[hour] = (byHour[hour] || 0) + 1
    })

    // Appels par jour
    const byDay: Record<string, number> = {}
    allCalls.forEach((c: any) => {
      const day = new Date(c.started_at).toISOString().split("T")[0]
      byDay[day] = (byDay[day] || 0) + 1
    })

    // Performance par agent
    const agentStats: Record<string, any> = {}
    allCalls.forEach((c: any) => {
      if (!c.agent_id) return
      if (!agentStats[c.agent_id]) {
        agentStats[c.agent_id] = { total: 0, completed: 0, totalDuration: 0 }
      }
      agentStats[c.agent_id].total++
      if (c.status === "COMPLETED") {
        agentStats[c.agent_id].completed++
        agentStats[c.agent_id].totalDuration += c.duration || 0
      }
    })

    const completed  = allCalls.filter((c: any) => c.status === "COMPLETED")
    const inbound    = allCalls.filter((c: any) => c.direction === "INBOUND")
    const outbound   = allCalls.filter((c: any) => c.direction === "OUTBOUND")
    const totalDur   = completed.reduce((s: number, c: any) => s + (c.duration || 0), 0)
    const peakHour   = Object.entries(byHour).sort(([,a],[,b]) => b - a)[0]

    return {
      period,
      summary: {
        totalCalls:      allCalls.length,
        completedCalls:  completed.length,
        inboundCalls:    inbound.length,
        outboundCalls:   outbound.length,
        avgDuration:     completed.length > 0 ? Math.round(totalDur / completed.length) : 0,
        resolutionRate:  allCalls.length > 0 ? Math.round((completed.length / allCalls.length) * 100) : 0,
        totalMinutes:    Math.round(totalDur / 60),
        peakHour:        peakHour ? parseInt(peakHour[0]) : 0,
        peakHourCount:   peakHour ? peakHour[1] : 0,
      },
      heatmap:    byHour,
      dailyTrend: Object.entries(byDay).map(([date, count]) => ({ date, count })).slice(-30),
      agentStats: Object.entries(agentStats).map(([agentId, stats]: [string, any]) => ({
        agentId,
        total:          stats.total,
        completed:      stats.completed,
        resolutionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        avgDuration:    stats.completed > 0 ? Math.round(stats.totalDuration / stats.completed) : 0,
      })),
    }
  }

  async getSLAMetrics(organizationId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("id, status, duration, started_at")
      .eq("organization_id", organizationId)
      .gte("started_at", since)

    const allCalls = calls || []
    const answered = allCalls.filter((c: any) => c.status === "COMPLETED")
    const missed   = allCalls.filter((c: any) => ["NO_ANSWER", "FAILED"].includes(c.status))

    return {
      period:         "24h",
      totalCalls:     allCalls.length,
      answeredCalls:  answered.length,
      missedCalls:    missed.length,
      answerRate:     allCalls.length > 0 ? Math.round((answered.length / allCalls.length) * 100) : 0,
      slaTarget:      90,
      slaAchieved:    allCalls.length > 0 ? Math.round((answered.length / allCalls.length) * 100) >= 90 : true,
    }
  }
}

export const analyticsService = new AnalyticsService()
