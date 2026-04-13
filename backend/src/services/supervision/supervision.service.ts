import { supabaseAdmin } from "../../config/supabase"
import { twilioService } from "../twilio/twilio.service"

export class SupervisionService {

    // Snapshot complet temps reel de toute l organisation
    async getRealtimeSnapshot(organizationId: string) {
        const now = new Date()
        const today = now.toISOString().split("T")[0]

        const { data: agents } = await supabaseAdmin
            .from("agents")
            .select("user_id, status, users!inner(id, name, email)")
            .eq("organization_id", organizationId)

        const { data: activeCalls } = await supabaseAdmin
            .from("calls")
            .select("id, from_number, to_number, direction, status, started_at, agent_id, duration, contacts(first_name, last_name, company)")
            .eq("organization_id", organizationId)
            .in("status", ["RINGING", "IN_PROGRESS", "ON_HOLD"])
            .order("started_at", { ascending: false })

        const { data: todayCalls } = await supabaseAdmin
            .from("calls")
            .select("id, status, duration, direction, started_at")
            .eq("organization_id", organizationId)
            .gte("started_at", today + "T00:00:00Z")

        const allToday = todayCalls || []
        const completed = allToday.filter((c: any) => c.status === "COMPLETED")
        const missed = allToday.filter((c: any) => ["NO_ANSWER", "FAILED"].includes(c.status))
        const totalDur = completed.reduce((s: number, c: any) => s + (c.duration || 0), 0)
        const avgDur = completed.length ? Math.round(totalDur / completed.length) : 0

        const { data: queues } = await supabaseAdmin
            .from("queues")
            .select("id, name, strategy, sla_threshold, is_vip")
            .eq("organization_id", organizationId)
            .eq("status", "ACTIVE")

        const { count: pendingCallbacks } = await supabaseAdmin
            .from("callbacks")
            .select("id", { count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "PENDING")

        // Dernier appel par agent (pour detecter inactivite)
        const { data: lastCallsPerAgent } = await supabaseAdmin
            .from("calls")
            .select("agent_id, started_at")
            .eq("organization_id", organizationId)
            .order("started_at", { ascending: false })
            .limit(200)

        const lastCallMap: Record<string, string> = {}
        for (const c of (lastCallsPerAgent || [])) {
            if (c.agent_id && !lastCallMap[c.agent_id]) lastCallMap[c.agent_id] = c.started_at
        }

        const agentStatuses = (agents || []).map((a: any) => {
            const user = a.users as any
            const agentCalls = (activeCalls || []).filter((c: any) => c.agent_id === a.user_id)
            const activeCall = agentCalls[0] || null
            const callDuration = activeCall
                ? Math.floor((now.getTime() - new Date(activeCall.started_at).getTime()) / 1000)
                : 0

            return {
                agentId: a.user_id,
                name: user?.name || "Agent",
                email: user?.email || "",
                status: a.status,
                callStatus: activeCall ? activeCall.status : null,
                callId: activeCall?.id || null,
                callFrom: activeCall?.from_number || null,
                callTo: activeCall?.to_number || null,
                callDirection: activeCall?.direction || null,
                callDuration,
                callStarted: activeCall?.started_at || null,
                lastActivityAt: activeCall?.started_at || lastCallMap[a.user_id] || null,
                contactName: activeCall?.contacts
                    ? (activeCall.contacts as any).first_name + " " + (activeCall.contacts as any).last_name
                    : null,
            }
        })

        const slaRate = allToday.length > 0
            ? Math.round((completed.length / allToday.length) * 100)
            : 100

        return {
            timestamp: now.toISOString(),
            organizationId,
            agents: agentStatuses,
            queues: queues || [],
            activeCalls: activeCalls || [],
            pendingCallbacks: pendingCallbacks || 0,
            kpis: {
                totalToday: allToday.length,
                completedToday: completed.length,
                missedToday: missed.length,
                avgDuration: avgDur,
                slaRate,
                onlineAgents: agentStatuses.filter((a) => (a.status === "ONLINE" || a.status === "ACTIVE")).length,
                busyAgents: agentStatuses.filter((a) => a.status === "BUSY" || a.callId).length,
                totalAgents: agentStatuses.length,
                activeCalls: (activeCalls || []).length,
            },
        }
    }

    // Forcer statut agent
    async forceAgentStatus(agentId: string, status: string) {
        await supabaseAdmin
            .from("agents")
            .update({ status })
            .eq("user_id", agentId)
        return { updated: true, agentId, status }
    }

    // Rejoindre un appel via Twilio Conference (listen/whisper/barge)
    async joinCall(callId: string, supervisorId: string, mode: "listen" | "whisper" | "barge") {
        const { data: call } = await supabaseAdmin
            .from("calls")
            .select("id, twilio_sid, from_number, agent_id, status")
            .eq("id", callId)
            .single()

        if (!call) throw new Error("Appel non trouvé")

        // Si pas de twilio_sid → simulé (appel de test)
        if (!call.twilio_sid) {
            return {
                mode,
                callId,
                supervisorId,
                twilioSid: null,
                simulated: true,
                message: `Mode ${mode} actif (simulé — appel sans SID Twilio)`,
            }
        }

        try {
            // Rejoindre via Twilio Conference
            const result = await twilioService.joinCallAsSupervisor({
                callSid: call.twilio_sid,
                supervisorId,
                mode,
            })

            return {
                mode,
                callId,
                supervisorId,
                twilioSid: call.twilio_sid,
                simulated: false,
                participantSid: result.participantSid,
                conferenceName: result.conferenceName,
                message: `Mode ${mode.toUpperCase()} activé — votre dialer va sonner`,
            }
        } catch (err: any) {
            // Fallback simulé si Twilio non configuré
            console.warn("[Supervision] Fallback simulé:", err.message)
            return {
                mode,
                callId,
                supervisorId,
                twilioSid: call.twilio_sid,
                simulated: true,
                message: `Mode ${mode} actif (simulé — ${err.message})`,
            }
        }
    }

    // Alertes SLA
    async getSLAAlerts(organizationId: string) {
        const alerts: any[] = []

        const { count: waitingCalls } = await supabaseAdmin
            .from("calls")
            .select("id", { count: "exact" })
            .eq("organization_id", organizationId)
            .eq("status", "RINGING")

        if ((waitingCalls || 0) > 5) {
            alerts.push({
                type: "HIGH_QUEUE",
                message: (waitingCalls || 0) + " appels en attente",
                level: "warning",
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
