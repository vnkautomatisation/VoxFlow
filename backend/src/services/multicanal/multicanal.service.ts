import { supabaseAdmin } from "../../config/supabase"

export class MulticanalService {

  // ── CONVERSATIONS ─────────────────────────────────────────────

  async getConversations(organizationId: string, opts: {
    channel?:    string
    status?:     string
    agentId?:    string
    page?:       number
    limit?:      number
  } = {}) {
    const { channel, status, agentId, page = 1, limit = 20 } = opts
    const from = (page - 1) * limit

    let query = supabaseAdmin
      .from("conversations")
      .select(`
        *,
        contact:contacts(id, first_name, last_name, phone, email, company),
        agent:users!conversations_assigned_to_fkey(id, name, email)
      `, { count: "exact" })
      .eq("organization_id", organizationId)
      .order("last_message_at", { ascending: false })
      .range(from, from + limit - 1)

    if (channel) query = query.eq("channel", channel)
    if (status)  query = query.eq("status", status)
    if (agentId) query = query.eq("assigned_to", agentId)

    const { data, count } = await query
    return { conversations: data || [], total: count || 0, page, limit }
  }

  async getConversation(id: string, organizationId: string) {
    const { data } = await supabaseAdmin
      .from("conversations")
      .select(`
        *,
        contact:contacts(id, first_name, last_name, phone, email, company, tags),
        agent:users!conversations_assigned_to_fkey(id, name, email)
      `)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (!data) throw new Error("Conversation non trouvee")

    // Messages de la conversation
    const { data: messages } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(100)

    return { ...data, messages: messages || [] }
  }

  async createConversation(organizationId: string, dto: {
    channel:    string
    contactId?: string
    subject?:   string
    priority?:  string
    agentId?:   string
    metadata?:  any
  }) {
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        organization_id: organizationId,
        channel:         dto.channel,
        contact_id:      dto.contactId || null,
        subject:         dto.subject   || null,
        priority:        dto.priority  || "NORMAL",
        assigned_to:     dto.agentId   || null,
        metadata:        dto.metadata  || {},
        status:          "OPEN",
      })
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  async updateConversation(id: string, organizationId: string, dto: {
    status?:      string
    priority?:    string
    assignedTo?:  string
    tags?:        string[]
  }) {
    const update: any = { updated_at: new Date().toISOString() }
    if (dto.status !== undefined)     update.status      = dto.status
    if (dto.priority !== undefined)   update.priority    = dto.priority
    if (dto.assignedTo !== undefined) update.assigned_to = dto.assignedTo
    if (dto.tags !== undefined)       update.tags        = dto.tags
    if (dto.status === "RESOLVED")    update.resolved_at = new Date().toISOString()
    if (dto.status === "CLOSED")      update.closed_at   = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .update(update)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select().single()

    if (error) throw new Error(error.message)
    return data
  }

  // ── MESSAGES ──────────────────────────────────────────────────

  async sendMessage(conversationId: string, organizationId: string, dto: {
    content:      string
    contentType?: string
    senderType:   string
    senderId?:    string
  }) {
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("channel, contact_id, metadata")
      .eq("id", conversationId)
      .single()

    if (!conv) throw new Error("Conversation non trouvee")

    // Inserer le message
    const { data: message, error } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        organization_id: organizationId,
        sender_type:     dto.senderType,
        sender_id:       dto.senderId || null,
        content:         dto.content,
        content_type:    dto.contentType || "TEXT",
        status:          "SENT",
      })
      .select().single()

    if (error) throw new Error(error.message)

    // Mettre a jour last_message_at + status OPEN si PENDING
    await supabaseAdmin
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status:          conv ? "OPEN" : "OPEN",
        updated_at:      new Date().toISOString(),
      })
      .eq("id", conversationId)

    // Envoyer via le bon canal
    await this.dispatchMessage(conv.channel, conv, dto.content)

    return message
  }

  private async dispatchMessage(channel: string, conv: any, content: string) {
    switch (channel) {
      case "WHATSAPP":
        console.log("[WhatsApp] Envoi vers", conv.metadata?.phone, ":", content)
        break
      case "SMS":
        console.log("[SMS] Envoi vers", conv.metadata?.phone, ":", content)
        break
      case "EMAIL":
        console.log("[Email] Reponse vers", conv.metadata?.email, ":", content)
        break
      case "CHAT":
        console.log("[Chat] Message vers session", conv.metadata?.sessionId, ":", content)
        break
    }
  }

  // ── STATS OMNICANAL ───────────────────────────────────────────

  async getOmnichannelStats(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("conversations")
      .select("channel, status, priority")
      .eq("organization_id", organizationId)

    const all = data || []
    const byChannel: Record<string, any> = {}
    const channels = ["WHATSAPP", "CHAT", "EMAIL", "SMS", "CALL"]

    channels.forEach((ch) => {
      const convs = all.filter((c: any) => c.channel === ch)
      byChannel[ch] = {
        total:    convs.length,
        open:     convs.filter((c: any) => c.status === "OPEN").length,
        pending:  convs.filter((c: any) => c.status === "PENDING").length,
        resolved: convs.filter((c: any) => c.status === "RESOLVED").length,
      }
    })

    return {
      total:       all.length,
      open:        all.filter((c: any) => c.status === "OPEN").length,
      pending:     all.filter((c: any) => c.status === "PENDING").length,
      resolved:    all.filter((c: any) => c.status === "RESOLVED").length,
      urgent:      all.filter((c: any) => c.priority === "URGENT").length,
      byChannel,
    }
  }

  // ── REPONSES PREDEFINIES ──────────────────────────────────────

  async getCannedResponses(organizationId: string, channel?: string) {
    let query = supabaseAdmin
      .from("canned_responses")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name")

    if (channel) query = query.or("channel.is.null,channel.eq." + channel)

    const { data } = await query
    return data || []
  }

  async createCannedResponse(organizationId: string, userId: string, dto: {
    name:      string
    shortcut?: string
    content:   string
    channel?:  string
  }) {
    const { data, error } = await supabaseAdmin
      .from("canned_responses")
      .insert({ ...dto, organization_id: organizationId, created_by: userId })
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // ── EMAIL TICKETS ─────────────────────────────────────────────

  async createEmailTicket(organizationId: string, dto: {
    fromEmail:  string
    fromName?:  string
    toEmail?:   string
    subject?:   string
    bodyText?:  string
    bodyHtml?:  string
    messageId?: string
  }) {
    // Creer la conversation associee
    const conv = await this.createConversation(organizationId, {
      channel:  "EMAIL",
      subject:  dto.subject,
      metadata: { email: dto.fromEmail, fromName: dto.fromName },
    })

    const { data, error } = await supabaseAdmin
      .from("email_tickets")
      .insert({
        organization_id: organizationId,
        conversation_id: conv.id,
        message_id:      dto.messageId || "manual_" + Date.now(),
        from_email:      dto.fromEmail,
        from_name:       dto.fromName || null,
        to_email:        dto.toEmail  || null,
        subject:         dto.subject  || "Sans sujet",
        body_text:       dto.bodyText || null,
        body_html:       dto.bodyHtml || null,
      })
      .select().single()

    if (error) throw new Error(error.message)

    // Ajouter le message initial
    if (dto.bodyText) {
      await this.sendMessage(conv.id, organizationId, {
        content:    dto.bodyText,
        senderType: "CONTACT",
      })
    }

    return { ticket: data, conversation: conv }
  }

  async getEmailTickets(organizationId: string, status?: string) {
    let query = supabaseAdmin
      .from("email_tickets")
      .select("*, agent:users!email_tickets_assigned_to_fkey(id,name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)
    const { data } = await query
    return data || []
  }
}

export const multicanalService = new MulticanalService()
