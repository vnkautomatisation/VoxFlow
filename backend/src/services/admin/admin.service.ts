import { supabaseAdmin } from "../../config/supabase"
import { hashPassword } from "../../utils/hash"

export class AdminService {

  // ── STATS ─────────────────────────────────────────────────────
  async getDashboardStats(organizationId: string) {
    const [agentsRes, queuesRes, callsRes] = await Promise.all([
      supabaseAdmin.from("agents").select("id, status", { count: "exact" }).eq("organization_id", organizationId),
      supabaseAdmin.from("queues").select("id", { count: "exact" }).eq("organization_id", organizationId),
      supabaseAdmin.from("calls").select("id, duration, status", { count: "exact" })
        .eq("organization_id", organizationId)
        .gte("started_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    const agents = agentsRes.data || []
    const calls  = callsRes.data || []

    return {
      totalAgents:    agentsRes.count || 0,
      onlineAgents:   agents.filter((a: any) => a.status === "ONLINE" || a.status === "ON_CALL").length,
      totalQueues:    queuesRes.count || 0,
      totalCalls30d:  callsRes.count || 0,
      avgDuration:    calls.length > 0
        ? Math.round(calls.reduce((s: number, c: any) => s + (c.duration || 0), 0) / calls.length)
        : 0,
      resolvedCalls:  calls.filter((c: any) => c.status === "COMPLETED").length,
    }
  }

  // ── AGENTS ────────────────────────────────────────────────────
  async getAgents(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, role, status, created_at")
      .eq("organization_id", organizationId)
      .neq("role", "ADMIN")
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  async createAgent(organizationId: string, dto: {
    name: string
    email: string
    password: string
    role: string
  }) {
    const { data: existing } = await supabaseAdmin
      .from("users").select("id").eq("email", dto.email).single()
    if (existing) throw new Error("Email deja utilise")

    const passwordHash = await hashPassword(dto.password)

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .insert({
        email:           dto.email,
        name:            dto.name,
        role:            dto.role || "AGENT",
        password_hash:   passwordHash,
        organization_id: organizationId,
        status:          "ACTIVE",
      })
      .select().single()

    if (error) throw new Error(error.message)

    // Creer le profil agent
    await supabaseAdmin.from("agents").insert({
      user_id:         user.id,
      organization_id: organizationId,
      status:          "OFFLINE",
    })

    return user
  }

  async updateAgent(agentId: string, organizationId: string, dto: {
    name?: string
    role?: string
    status?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  async deleteAgent(agentId: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ status: "INACTIVE" })
      .eq("id", agentId)
      .eq("organization_id", organizationId)

    if (error) throw new Error(error.message)
    return { deactivated: true }
  }

  // ── QUEUES ────────────────────────────────────────────────────
  async getQueues(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from("queues")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  async createQueue(organizationId: string, dto: {
    name: string
    description?: string
    strategy?: string
    maxWaitTime?: number
    welcomeMessage?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from("queues")
      .insert({
        name:            dto.name,
        description:     dto.description || "",
        organization_id: organizationId,
        strategy:        dto.strategy || "ROUND_ROBIN",
        max_wait_time:   dto.maxWaitTime || 300,
        welcome_message: dto.welcomeMessage || "",
      })
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  async updateQueue(queueId: string, organizationId: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from("queues")
      .update(dto)
      .eq("id", queueId)
      .eq("organization_id", organizationId)
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  async deleteQueue(queueId: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from("queues")
      .delete()
      .eq("id", queueId)
      .eq("organization_id", organizationId)

    if (error) throw new Error(error.message)
    return { deleted: true }
  }

  // ── IVR ───────────────────────────────────────────────────────
  async getIVRConfigs(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from("ivr_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  async createIVR(organizationId: string, dto: {
    name: string
    welcomeMessage?: string
    nodes?: any[]
  }) {
    const { data, error } = await supabaseAdmin
      .from("ivr_configs")
      .insert({
        name:            dto.name,
        organization_id: organizationId,
        welcome_message: dto.welcomeMessage || "Bienvenue. Appuyez sur 1 pour le support.",
        nodes:           dto.nodes || [],
      })
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  async updateIVR(ivrId: string, organizationId: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from("ivr_configs")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", ivrId)
      .eq("organization_id", organizationId)
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  // ── SCRIPTS ───────────────────────────────────────────────────
  async getScripts(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from("call_scripts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  async createScript(organizationId: string, dto: {
    name: string
    content: string
    queueId?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from("call_scripts")
      .insert({
        name:            dto.name,
        content:         dto.content,
        organization_id: organizationId,
        queue_id:        dto.queueId || null,
      })
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  // ── RAPPORTS ──────────────────────────────────────────────────
  async getReports(organizationId: string, period: string = "30d") {
    const days   = period === "7d" ? 7 : period === "90d" ? 90 : 30
    const since  = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("id, duration, status, direction, started_at, agent_id")
      .eq("organization_id", organizationId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })

    const allCalls    = calls || []
    const completed   = allCalls.filter((c: any) => c.status === "COMPLETED")
    const inbound     = allCalls.filter((c: any) => c.direction === "INBOUND")
    const outbound    = allCalls.filter((c: any) => c.direction === "OUTBOUND")
    const totalDur    = completed.reduce((s: number, c: any) => s + (c.duration || 0), 0)

    return {
      period,
      totalCalls:       allCalls.length,
      completedCalls:   completed.length,
      inboundCalls:     inbound.length,
      outboundCalls:    outbound.length,
      avgDuration:      completed.length > 0 ? Math.round(totalDur / completed.length) : 0,
      resolutionRate:   allCalls.length > 0 ? Math.round((completed.length / allCalls.length) * 100) : 0,
      recentCalls:      allCalls.slice(0, 10),
    }
  }
}

export const adminService = new AdminService()
