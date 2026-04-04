import { supabaseAdmin } from "../../config/supabase"

export class ACDService {

  // Trouver le meilleur agent pour un appel (skill-based routing)
  async findBestAgent(queueId: string, organizationId: string, requiredSkills: string[] = []): Promise<any | null> {
    // Chercher agents disponibles dans la file
    const { data: queueAgents } = await supabaseAdmin
      .from("queue_agents")
      .select("user_id, skill_level, priority, users!inner(id, name, status)")
      .eq("queue_id", queueId)
      .order("priority", { ascending: false })

    if (!queueAgents?.length) return null

    // Filtrer agents ONLINE
    const available = queueAgents.filter((qa: any) =>
      (qa.users as any)?.status === "ACTIVE"
    )

    if (!available.length) return null

    // Si skills requis — filtrer
    if (requiredSkills.length > 0) {
      const { data: agents } = await supabaseAdmin
        .from("agents")
        .select("user_id, skills, status")
        .eq("organization_id", organizationId)
        .eq("status", "ONLINE")
        .contains("skills", requiredSkills)

      if (agents?.length) {
        const skilledAgent = available.find((qa: any) =>
          agents.some((a: any) => a.user_id === qa.user_id)
        )
        if (skilledAgent) return skilledAgent
      }
    }

    // Round robin par defaut — agent avec plus haute priorite disponible
    return available[0] || null
  }

  // Verifier si dans les heures d ouverture
  async isWithinBusinessHours(organizationId: string): Promise<{
    open: boolean
    message?: string
    nextOpen?: string
  }> {
    const { data: schedule } = await supabaseAdmin
      .from("schedules")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .single()

    if (!schedule) return { open: true }

    const now      = new Date()
    const tz       = schedule.timezone || "America/Toronto"
    const tzNow    = new Date(now.toLocaleString("en-US", { timeZone: tz }))
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    const dayName  = dayNames[tzNow.getDay()]
    const hours    = (schedule.hours as any) || {}
    const dayHours = hours[dayName]

    if (!dayHours?.enabled) {
      return {
        open:    false,
        message: schedule.closed_message || "Nous sommes fermes aujourd hui.",
      }
    }

    const currentTime = tzNow.getHours() * 60 + tzNow.getMinutes()
    const [openH, openM]   = (dayHours.open  || "09:00").split(":").map(Number)
    const [closeH, closeM] = (dayHours.close || "17:00").split(":").map(Number)
    const openMinutes  = openH  * 60 + openM
    const closeMinutes = closeH * 60 + closeM

    if (currentTime >= openMinutes && currentTime < closeMinutes) {
      return { open: true }
    }

    return {
      open:    false,
      message: schedule.closed_message || "Nous sommes presentement fermes.",
      nextOpen: dayHours.open,
    }
  }

  // Obtenir stats temps reel d une file
  async getQueueRealtime(queueId: string) {
    // Appels en attente (pas encore assignes)
    const { count: waiting } = await supabaseAdmin
      .from("calls")
      .select("id", { count: "exact" })
      .eq("queue_id", queueId)
      .eq("status", "RINGING")

    // Agents disponibles
    const { data: agents } = await supabaseAdmin
      .from("queue_agents")
      .select("user_id, agents!inner(status)")
      .eq("queue_id", queueId)

    const onlineAgents = (agents || []).filter((a: any) =>
      (a.agents as any)?.status === "ONLINE"
    ).length

    const busyAgents = (agents || []).filter((a: any) =>
      (a.agents as any)?.status === "BUSY"
    ).length

    // Stats du jour
    const { data: stats } = await supabaseAdmin
      .from("queue_stats")
      .select("*")
      .eq("queue_id", queueId)
      .eq("date", new Date().toISOString().split("T")[0])
      .single()

    return {
      queueId,
      waiting:       waiting || 0,
      onlineAgents,
      busyAgents,
      totalAgents:   (agents || []).length,
      todayOffered:  stats?.calls_offered  || 0,
      todayAnswered: stats?.calls_answered || 0,
      todayAbandoned:stats?.calls_abandoned || 0,
      slaRate:       stats?.calls_offered
        ? Math.round((stats.calls_sla / stats.calls_offered) * 100)
        : 100,
      avgWaitTime:   stats?.avg_wait_time || 0,
    }
  }

  // Creer un callback
  async createCallback(organizationId: string, dto: {
    phoneNumber: string
    callerName?: string
    queueId?:    string
    priority?:   number
  }) {
    const { data, error } = await supabaseAdmin
      .from("callbacks")
      .insert({
        organization_id: organizationId,
        phone_number:    dto.phoneNumber,
        caller_name:     dto.callerName || null,
        queue_id:        dto.queueId   || null,
        priority:        dto.priority  || 1,
        status:          "PENDING",
      })
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  async getCallbacks(organizationId: string, status?: string) {
    let query = supabaseAdmin
      .from("callbacks")
      .select("*, agent:users!callbacks_agent_id_fkey(id,name), queue:queues!callbacks_queue_id_fkey(id,name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)

    const { data } = await query
    return data || []
  }

  async completeCallback(id: string, agentId: string) {
    await supabaseAdmin.from("callbacks").update({
      status:       "COMPLETED",
      agent_id:     agentId,
      completed_at: new Date().toISOString(),
    }).eq("id", id)
    return { completed: true }
  }

  // Obtenir les files avec stats
  async getQueuesWithStats(organizationId: string) {
    const { data: queues } = await supabaseAdmin
      .from("queues")
      .select("*")
      .eq("organization_id", organizationId)
      .order("priority", { ascending: false })

    if (!queues?.length) return []

    const result = await Promise.all(queues.map(async (q: any) => {
      const stats = await this.getQueueRealtime(q.id)
      return { ...q, realtime: stats }
    }))

    return result
  }

  // Regles de routage avancees
  async getRoutingRules(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("routing_rules")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("priority", { ascending: false })
    return data || []
  }

  async createRoutingRule(organizationId: string, dto: {
    name:         string
    priority:     number
    conditions:   any
    action:       string
    actionValue?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from("routing_rules")
      .insert({ organization_id: organizationId, ...dto, action_value: dto.actionValue })
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // Mettre a jour stats file
  async updateQueueStats(queueId: string, organizationId: string, type: "offered" | "answered" | "abandoned" | "sla") {
    const date = new Date().toISOString().split("T")[0]

    const field = type === "offered"   ? "calls_offered"   :
                  type === "answered"  ? "calls_answered"  :
                  type === "abandoned" ? "calls_abandoned"  : "calls_sla"

    await supabaseAdmin.from("queue_stats").upsert({
      queue_id: queueId, organization_id: organizationId, date,
      [field]: supabaseAdmin.rpc as any,
    }, { onConflict: "queue_id,date" })
  }
}

export const acdService = new ACDService()
