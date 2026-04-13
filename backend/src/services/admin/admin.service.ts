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
      .select("id, email, name, role, status, extension, phone, goals, created_at, updated_at")
      .eq("organization_id", organizationId)
      .in("role", ["AGENT", "ADMIN", "SUPERVISOR"])
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  async createAgent(organizationId: string, dto: {
    name: string
    email: string
    password: string
    role?: string
    extension?: string
  }) {
    const { data: existing } = await supabaseAdmin
      .from("users").select("id").eq("email", dto.email).single()
    if (existing) throw new Error("Email deja utilise")

    const passwordHash = await hashPassword(dto.password)

    const insert: any = {
      email:           dto.email,
      name:            dto.name,
      role:            dto.role || "AGENT",
      password_hash:   passwordHash,
      organization_id: organizationId,
      status:          "ACTIVE",
    }
    if (dto.extension) insert.extension = dto.extension

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .insert(insert)
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

  async updateAgent(agentId: string, organizationId: string, dto: any) {
    // Extraire et hasher le mot de passe séparément
    const { password, queues, ...rest } = dto
    const update: any = { updated_at: new Date().toISOString() }

    // Whitelist des colonnes autorisees sur users
    const ALLOWED = ['name','first_name','last_name','email','role','status','extension','phone','avatar_url','goals','agent_status','settings']
    for (const key of ALLOWED) {
      if (rest[key] !== undefined) update[key] = rest[key]
    }

    // Hasher le mot de passe si fourni
    if (password && password.trim()) {
      const { hashPassword } = await import("../../utils/hash")
      update.password_hash = await hashPassword(password)
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(update)
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

  async deleteIVR(ivrId: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from("ivr_configs")
      .delete()
      .eq("id", ivrId)
      .eq("organization_id", organizationId)
    if (error) throw new Error(error.message)
    return { deleted: true }
  }

  // ── AUDIO FILES ───────────────────────────────────────────────
  async getAudioFiles(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from("audio_files")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  }

  async createAudioFile(organizationId: string, dto: { name: string; url: string; type?: string; duration?: number }) {
    const { data, error } = await supabaseAdmin
      .from("audio_files")
      .insert({
        name:            dto.name,
        url:             dto.url,
        type:            dto.type || "hold_music",
        duration:        dto.duration || 0,
        organization_id: organizationId,
      })
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateAudioFile(id: string, organizationId: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from("audio_files")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async deleteAudioFile(id: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from("audio_files")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)
    if (error) throw new Error(error.message)
    return { deleted: true }
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

  async updateScript(id: string, organizationId: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from("call_scripts")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id).eq("organization_id", organizationId)
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async deleteScript(id: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from("call_scripts").delete()
      .eq("id", id).eq("organization_id", organizationId)
    if (error) throw new Error(error.message)
    return { deleted: true }
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
      .select("id, duration, status, direction, started_at, agent_id, from_number, to_number, recording_url, notes, contact:contacts(id, first_name, last_name, company)")
      .eq("organization_id", organizationId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })

    const allCalls    = calls || []
    const completed   = allCalls.filter((c: any) => c.status === "COMPLETED")
    const inbound     = allCalls.filter((c: any) => c.direction === "INBOUND")
    const outbound    = allCalls.filter((c: any) => c.direction === "OUTBOUND")
    const totalDur    = completed.reduce((s: number, c: any) => s + (c.duration || 0), 0)

    // Stats par agent
    const agentMap: Record<string, { id: string; calls: number; completed: number; duration: number }> = {}
    allCalls.forEach((c: any) => {
      if (!c.agent_id) return
      if (!agentMap[c.agent_id]) agentMap[c.agent_id] = { id: c.agent_id, calls: 0, completed: 0, duration: 0 }
      agentMap[c.agent_id].calls++
      if (c.status === "COMPLETED") agentMap[c.agent_id].completed++
      agentMap[c.agent_id].duration += c.duration || 0
    })

    // Enrichir avec les noms des agents
    const agentIds = Object.keys(agentMap)
    let agentNames: Record<string, string> = {}
    if (agentIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users").select("id, name, email").in("id", agentIds)
      ;(users || []).forEach((u: any) => { agentNames[u.id] = u.name || u.email })
    }

    const byAgent = Object.values(agentMap).map(a => ({
      agent_id:   a.id,
      name:       agentNames[a.id] || a.id.substring(0, 8),
      calls:      a.calls,
      completed:  a.completed,
      duration:   a.duration,
      avgDuration: a.calls > 0 ? Math.round(a.duration / a.calls) : 0,
      resolution: a.calls > 0 ? Math.round((a.completed / a.calls) * 100) : 0,
    })).sort((a, b) => b.calls - a.calls)

    return {
      period,
      totalCalls:       allCalls.length,
      completedCalls:   completed.length,
      inboundCalls:     inbound.length,
      outboundCalls:    outbound.length,
      avgDuration:      completed.length > 0 ? Math.round(totalDur / completed.length) : 0,
      resolutionRate:   allCalls.length > 0 ? Math.round((completed.length / allCalls.length) * 100) : 0,
      recentCalls:      allCalls.slice(0, 50),
      byAgent,
    }
  }
}

export const adminService = new AdminService()

