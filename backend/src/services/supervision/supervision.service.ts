import { supabaseAdmin } from "../../config/supabase"

export class SupervisionService {

  // Snapshot complet temps reel de toute l organisation
  async getRealtimeSnapshot(organizationId: string) {
    const now   = new Date()
    const today = now.toISOString().split("T")[0]

    // Agents et leur statut
    const { data: agents } = await supabaseAdmin
      .from("agents")
      .select("user_id, status, users!inner(id, name, email)")
      .eq("organization_id", organizationId)

    // Appels actifs
    const { data: activeCalls } = await supabaseAdmin
      .from("calls")
      .select("id, from_number, to_number, direction, status, started_at, agent_id, duration, contacts(first_name, last_name, company)")
      .eq("organization_id", organizationId)
      .in("status", ["RINGING", "IN_PROGRESS", "ON_HOLD"])
      .order("started_at", { ascending: false })

    // Stats du jour
    const { data: todayCalls } = await supabaseAdmin
      .from("calls")
      .select("id, status, duration, direction, started_at")
      .eq("organization_id", organizationId)
      .gte("started_at", today + "T00:00:00Z")

    const allToday    = todayCalls || []
    const completed   = allToday.filter((c: any) => c.status === "COMPLETED")
    const missed      = allToday.filter((c: any) => ["NO_ANSWER", "FAILED"].includes(c.status))
    const totalDur    = completed.reduce((s: number, c: any) => s + (c.duration || 0), 0)
    const avgDur      = completed.length ? Math.round(totalDur / completed.length) : 0

    // Files actives avec attente
    const { data: queues } = await supabaseAdmin
      .from("queues")
      .select("id, name, strategy, sla_threshold, is_vip")
      .eq("organization_id", organizationId)
      .eq("status", "ACTIVE")

    // Callbacks en attente
    const { count: pendingCallbacks } = await supabaseAdmin
      .from("callbacks")
      .select("id", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("status", "PENDING")

    // Construire statuts agents
    const agentStatuses = (agents || []).map((a: any) => {
      const user        = a.users as any
      const agentCalls  = (activeCalls || []).filter((c: any) => c.agent_id === a.user_id)
      const activeCall  = agentCalls[0] || null
      const callDuration = activeCall
        ? Math.floor((now.getTime() - new Date(activeCall.started_at).getTime()) / 1000)
        : 0

      return {
        agentId:       a.user_id,
        name:          user?.name || "Agent",
        email:         user?.email || "",
        status:        a.status,
        callStatus:    activeCall ? activeCall.status : null,
        callId:        activeCall?.id || null,
        callFrom:      activeCall?.from_number || null,
        callTo:        activeCall?.to_number || null,
        callDirection: activeCall?.direction || null,
        callDuration:  callDuration,
        contactName:   activeCall?.contacts
          ? (activeCall.contacts as any).first_name + " " + (activeCall.contacts as any).last_name
          : null,
      }
    })

    // SLA 24h
    const slaCompliant = completed.filter((c: any) => {
      const waitMs = new Date(c.started_at).getTime()
      return waitMs > 0
    }).length
    const slaRate = allToday.length > 0
      ? Math.round((slaCompliant / allToday.length) * 100)
      : 100

    return {
      timestamp:        now.toISOString(),
      organizationId,
      agents:           agentStatuses,
      queues:           queues || [],
      activeCalls:      activeCalls || [],
      pendingCallbacks: pendingCallbacks || 0,
      kpis: {
        totalToday:    allToday.length,
        completedToday: completed.length,
        missedToday:   missed.length,
        avgDuration:   avgDur,
        slaRate,
        onlineAgents:  agentStatuses.filter((a) => a.status === "ONLINE").length,
        busyAgents:    agentStatuses.filter((a) => a.status === "BUSY" || a.callId).length,
        totalAgents:   agentStatuses.length,
        activeCalls:   (activeCalls || []).length,
      },
    }
  }

  // Forcer statut agent (superviseur)
  async forceAgentStatus(agentId: string, status: string) {
    await supabaseAdmin
      .from("agents")
      .update({ status })
      .eq("user_id", agentId)
    return { updated: true, agentId, status }
  }

  // Rejoindre un appel (listen/whisper/barge)
  async joinCall(callId: string, supervisorId: string, mode: "listen" | "whisper" | "barge") {
    // En mode reel Twilio utilise les Conference rooms
    // Pour l instant on logue la supervision
    const { data: call } = await supabaseAdmin
      .from("calls")
      .select("id, twilio_sid, from_number, agent_id")
      .eq("id", callId)
      .single()

    if (!call) throw new Error("Appel non trouve")

    console.log("Supervision " + mode.toUpperCase() + " - Appel " + callId + " - Sup " + supervisorId)

    return {
      mode,
      callId,
      supervisorId,
      twilioSid:  call.twilio_sid,
      simulated:  true,
      message:    "Mode " + mode + " active (simule - necessite Twilio Conference en prod)",
    }
  }

  // Alertes SLA
  async getSLAAlerts(organizationId: string) {
    const { data: queues } = await supabaseAdmin
      .from("queues")
      .select("id, name, sla_threshold")
      .eq("organization_id", organizationId)

    const alerts: any[] = []
    const { count: waitingCalls } = await supabaseAdmin
      .from("calls")
      .select("id", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("status", "RINGING")

    if ((waitingCalls || 0) > 5) {
      alerts.push({
        type:    "HIGH_QUEUE",
        message: (waitingCalls || 0) + " appels en attente",
        level:   "warning",
      })
    }

    return alerts
  }

  // Historique sessions supervision
  async getSupervisionLog(organizationId: string, limit = 20) {
    const { data } = await supabaseAdmin
      .from("calls")
      .select("id, from_number, agent_id, direction, duration, status, started_at, users!calls_agent_id_fkey(name)")
      .eq("organization_id", organizationId)
      .not("agent_id", "is", null)
      .order("started_at", { ascending: false })
      .limit(limit)
    return data || []
  }
}

export const supervisionService = new SupervisionService()
