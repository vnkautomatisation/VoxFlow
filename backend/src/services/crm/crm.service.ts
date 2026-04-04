import { supabaseAdmin } from "../../config/supabase"

export class CRMService {

  // ── CONTACTS ─────────────────────────────────────────────────

  async getContacts(organizationId: string, opts: {
    search?:  string
    status?:  string
    stage?:   string
    tag?:     string
    agentId?: string
    page?:    number
    limit?:   number
    sortBy?:  string
    sortDir?: string
  } = {}) {
    const { search, status, stage, tag, agentId, page = 1, limit = 20, sortBy = "created_at", sortDir = "desc" } = opts
    const from = (page - 1) * limit
    const to   = from + limit - 1

    let query = supabaseAdmin
      .from("contacts")
      .select("*, assigned_user:users!contacts_assigned_to_fkey(id,name,email)", { count: "exact" })
      .eq("organization_id", organizationId)
      .order(sortBy, { ascending: sortDir === "asc" })
      .range(from, to)

    if (search) {
      query = query.or(
        "first_name.ilike.%" + search + "%," +
        "last_name.ilike.%" + search + "%," +
        "email.ilike.%" + search + "%," +
        "phone.ilike.%" + search + "%," +
        "company.ilike.%" + search + "%"
      )
    }
    if (status)  query = query.eq("status", status)
    if (stage)   query = query.eq("pipeline_stage", stage)
    if (agentId) query = query.eq("assigned_to", agentId)
    if (tag)     query = query.contains("tags", [tag])

    const { data, count, error } = await query
    if (error) throw new Error(error.message)
    return { contacts: data || [], total: count || 0, page, limit }
  }

  async getContactById(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .select("*, assigned_user:users!contacts_assigned_to_fkey(id,name,email)")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (error || !data) throw new Error("Contact non trouve")

    // Historique 360
    const { data: activities } = await supabaseAdmin
      .from("contact_activities")
      .select("*, agent:users!contact_activities_agent_id_fkey(id,name)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false })
      .limit(50)

    // Appels lies
    const { data: calls } = await supabaseAdmin
      .from("calls")
      .select("id, from_number, to_number, duration, status, direction, started_at, ai_summary")
      .eq("contact_id", id)
      .order("started_at", { ascending: false })
      .limit(20)

    return { ...data, activities: activities || [], calls: calls || [] }
  }

  async createContact(organizationId: string, userId: string, dto: any) {
    // Detection doublons par phone ou email
    if (dto.phone || dto.email) {
      let dupQuery = supabaseAdmin
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("organization_id", organizationId)

      if (dto.phone && dto.email) {
        dupQuery = dupQuery.or("phone.eq." + dto.phone + ",email.eq." + dto.email)
      } else if (dto.phone) {
        dupQuery = dupQuery.eq("phone", dto.phone)
      } else {
        dupQuery = dupQuery.eq("email", dto.email)
      }

      const { data: dup } = await dupQuery.single()
      if (dup) throw new Error("Contact existant: " + dup.first_name + " " + dup.last_name)
    }

    const { data, error } = await supabaseAdmin
      .from("contacts")
      .insert({ ...dto, organization_id: organizationId, created_by: userId })
      .select().single()

    if (error) throw new Error(error.message)

    // Activite de creation
    await this.addActivity(data.id, organizationId, {
      type:    "NOTE",
      content: "Contact cree",
      agentId: userId,
    })

    return data
  }

  async updateContact(id: string, organizationId: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from("contacts")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  async deleteContact(id: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from("contacts")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)

    if (error) throw new Error(error.message)
    return { deleted: true }
  }

  // ── ACTIVITES ─────────────────────────────────────────────────

  async addActivity(contactId: string, organizationId: string, dto: {
    type:       string
    content?:   string
    direction?: string
    duration?:  number
    agentId?:   string
    callId?:    string
    scheduledAt?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from("contact_activities")
      .insert({
        contact_id:      contactId,
        organization_id: organizationId,
        type:            dto.type,
        content:         dto.content || "",
        direction:       dto.direction,
        duration:        dto.duration || 0,
        agent_id:        dto.agentId,
        call_id:         dto.callId,
        scheduled_at:    dto.scheduledAt,
      })
      .select().single()

    if (error) throw new Error(error.message)

    // Mettre a jour last_contact_at
    await supabaseAdmin.from("contacts")
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", contactId)

    return data
  }

  // ── PIPELINE ──────────────────────────────────────────────────

  async getPipelineStats(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("pipeline_stage, deal_value, status")
      .eq("organization_id", organizationId)

    const stages = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]
    const pipeline: Record<string, any> = {}

    stages.forEach((s) => {
      const contacts = (data || []).filter((c: any) => c.pipeline_stage === s)
      pipeline[s] = {
        count:      contacts.length,
        totalValue: contacts.reduce((sum: number, c: any) => sum + (parseFloat(c.deal_value) || 0), 0),
      }
    })

    const totalValue = (data || []).reduce((sum: number, c: any) => sum + (parseFloat(c.deal_value) || 0), 0)
    const wonValue   = pipeline["WON"]?.totalValue || 0

    return { pipeline, totalValue, wonValue, conversionRate: data?.length
      ? Math.round((pipeline["WON"]?.count || 0) / data.length * 100) : 0 }
  }

  // ── IMPORT CSV ────────────────────────────────────────────────

  async importContacts(organizationId: string, userId: string, contacts: any[]) {
    let imported = 0
    let skipped  = 0
    const errors: string[] = []

    for (const c of contacts) {
      try {
        if (!c.first_name && !c.last_name && !c.phone && !c.email) {
          skipped++
          continue
        }

        // Verifier doublons
        if (c.phone || c.email) {
          let q = supabaseAdmin.from("contacts").select("id").eq("organization_id", organizationId)
          if (c.phone && c.email) q = q.or("phone.eq." + c.phone + ",email.eq." + c.email)
          else if (c.phone) q = q.eq("phone", c.phone)
          else q = q.eq("email", c.email)
          const { data: dup } = await q.single()
          if (dup) { skipped++; continue }
        }

        await supabaseAdmin.from("contacts").insert({
          organization_id: organizationId,
          created_by:      userId,
          first_name:      c.first_name || c.prenom || "",
          last_name:       c.last_name  || c.nom    || "",
          email:           c.email      || null,
          phone:           c.phone      || c.telephone || null,
          company:         c.company    || c.entreprise || null,
          job_title:       c.job_title  || c.poste || null,
          status:          c.status     || "LEAD",
          pipeline_stage:  c.stage      || "NEW",
          tags:            c.tags ? c.tags.split(",").map((t: string) => t.trim()) : [],
        })
        imported++
      } catch (err: any) {
        errors.push(c.email || c.phone || "?")
      }
    }

    return { imported, skipped, errors, total: contacts.length }
  }

  // ── TAGS ──────────────────────────────────────────────────────

  async getTags(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("contact_tags")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name")
    return data || []
  }

  async createTag(organizationId: string, name: string, color: string) {
    const { data, error } = await supabaseAdmin
      .from("contact_tags")
      .insert({ organization_id: organizationId, name, color })
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // ── RECHERCHE GLOBALE ─────────────────────────────────────────

  async searchContacts(organizationId: string, query: string, limit = 5) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, phone, email, company, pipeline_stage")
      .eq("organization_id", organizationId)
      .or(
        "first_name.ilike.%" + query + "%," +
        "last_name.ilike.%"  + query + "%," +
        "phone.ilike.%"      + query + "%," +
        "email.ilike.%"      + query + "%," +
        "company.ilike.%"    + query + "%"
      )
      .limit(limit)
    return data || []
  }

  // ── LIER APPEL A CONTACT ──────────────────────────────────────

  async linkCallToContact(callId: string, contactId: string, organizationId: string) {
    await supabaseAdmin.from("calls")
      .update({ contact_id: contactId })
      .eq("id", callId)

    // Ajouter activite
    const { data: call } = await supabaseAdmin
      .from("calls").select("duration, direction, agent_id, ai_summary").eq("id", callId).single()

    if (call) {
      await this.addActivity(contactId, organizationId, {
        type:      "CALL",
        direction: call.direction,
        duration:  call.duration,
        agentId:   call.agent_id,
        callId,
        content:   call.ai_summary || "",
      })
    }
    return { linked: true }
  }

  // ── TROUVER CONTACT PAR NUMERO ────────────────────────────────

  async findByPhone(phone: string, organizationId: string) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id, first_name, last_name, phone, email, company, pipeline_stage, score, tags")
      .eq("organization_id", organizationId)
      .or("phone.eq." + phone + ",phone_2.eq." + phone)
      .single()
    return data || null
  }
}

export const crmService = new CRMService()
