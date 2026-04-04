import { supabaseAdmin } from "../../config/supabase"

export class DialerService {

  async getCampaigns(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("dialer_campaigns")
      .select("*, script:call_scripts(id,name), creator:users!dialer_campaigns_created_by_fkey(id,name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
    return data || []
  }

  async getCampaign(id: string, organizationId: string) {
    const { data } = await supabaseAdmin
      .from("dialer_campaigns")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()
    if (!data) throw new Error("Campagne non trouvee")

    const { data: contacts } = await supabaseAdmin
      .from("dialer_contacts")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at")
      .limit(100)

    return { ...data, contacts: contacts || [] }
  }

  async createCampaign(organizationId: string, userId: string, dto: {
    name:         string
    type?:        string
    fromNumber?:  string
    maxAttempts?: number
    scriptId?:    string
    dialRatio?:   number
  }) {
    const { data, error } = await supabaseAdmin
      .from("dialer_campaigns")
      .insert({
        organization_id: organizationId,
        created_by:      userId,
        name:            dto.name,
        type:            dto.type        || "POWER",
        from_number:     dto.fromNumber  || null,
        max_attempts:    dto.maxAttempts || 3,
        script_id:       dto.scriptId   || null,
        dial_ratio:      dto.dialRatio  || 1.0,
        status:          "DRAFT",
      })
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateCampaignStatus(id: string, organizationId: string, status: string) {
    const { data, error } = await supabaseAdmin
      .from("dialer_campaigns")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async addContacts(campaignId: string, contacts: Array<{
    phoneNumber: string
    name?:       string
    contactId?:  string
  }>) {
    const rows = contacts.map((c) => ({
      campaign_id:  campaignId,
      phone_number: c.phoneNumber,
      name:         c.name    || null,
      contact_id:   c.contactId || null,
      status:       "PENDING",
    }))

    const { data, error } = await supabaseAdmin
      .from("dialer_contacts")
      .insert(rows)
      .select()

    if (error) throw new Error(error.message)

    // Mettre a jour total_contacts
    const { count } = await supabaseAdmin
      .from("dialer_contacts")
      .select("id", { count: "exact" })
      .eq("campaign_id", campaignId)

    await supabaseAdmin.from("dialer_campaigns")
      .update({ total_contacts: count || 0 })
      .eq("id", campaignId)

    return data
  }

  async getNextContact(campaignId: string): Promise<any | null> {
    const { data } = await supabaseAdmin
      .from("dialer_contacts")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "PENDING")
      .order("created_at")
      .limit(1)
      .single()
    return data || null
  }

  async markContactDialed(contactId: string, callId: string, status: string) {
    await supabaseAdmin.from("dialer_contacts")
      .update({
        status,
        call_id:         callId,
        attempts:        supabaseAdmin.rpc as any,
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", contactId)
  }

  async getCampaignStats(campaignId: string) {
    const { data } = await supabaseAdmin
      .from("dialer_contacts")
      .select("status")
      .eq("campaign_id", campaignId)

    const all = data || []
    const byStatus: Record<string, number> = {}
    all.forEach((c: any) => { byStatus[c.status] = (byStatus[c.status] || 0) + 1 })

    return {
      total:     all.length,
      pending:   byStatus["PENDING"]   || 0,
      answered:  byStatus["ANSWERED"]  || 0,
      noAnswer:  byStatus["NO_ANSWER"] || 0,
      busy:      byStatus["BUSY"]      || 0,
      failed:    byStatus["FAILED"]    || 0,
      dnc:       byStatus["DNC"]       || 0,
      contactRate: all.length
        ? Math.round(((byStatus["ANSWERED"] || 0) / all.length) * 100)
        : 0,
    }
  }
}

export const dialerService = new DialerService()
