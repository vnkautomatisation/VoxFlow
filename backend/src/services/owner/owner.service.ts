import { supabaseAdmin } from "../../config/supabase"
import { stripeService } from "../stripe/stripe.service"
import { twilioService } from "../twilio/twilio.service"
import { hashPassword } from "../../utils/hash"

type OrgStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED"

export class OwnerService {

  async getGlobalStats() {
    const [orgsRes, usersRes, callsRes] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, plan, status", { count: "exact" }),
      supabaseAdmin.from("users").select("id, role", { count: "exact" }),
      supabaseAdmin.from("calls").select("id, duration", { count: "exact" }),
    ])

    const orgs  = orgsRes.data  || []
    const users = usersRes.data || []
    const calls = callsRes.data || []
    const revenue = await stripeService.getRevenueStats()

    return {
      totalOrganizations: orgsRes.count  || 0,
      activeOrgs:         orgs.filter((o: any) => o.status === "ACTIVE").length,
      totalUsers:         usersRes.count || 0,
      totalAgents:        users.filter((u: any) => u.role === "AGENT").length,
      totalCalls:         callsRes.count || 0,
      totalMinutes:       calls.reduce((s: number, c: any) => s + (c.duration || 0), 0),
      mrr:                revenue.mrr,
      planBreakdown: {
        starter:    orgs.filter((o: any) => o.plan === "STARTER").length,
        pro:        orgs.filter((o: any) => o.plan === "PRO").length,
        enterprise: orgs.filter((o: any) => o.plan === "ENTERPRISE").length,
      },
    }
  }

  async getAllOrganizations(page: number = 1, limit: number = 20) {
    const from = (page - 1) * limit
    const to   = from + limit - 1

    const { data, count, error } = await supabaseAdmin
      .from("organizations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) throw new Error(error.message)
    return { organizations: data || [], total: count || 0, page, limit }
  }

  async createAdmin(dto: {
    name: string
    email: string
    password: string
    plan: string
    orgName: string
  }) {
    const slug = dto.orgName.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    const { data: existing } = await supabaseAdmin
      .from("users").select("id").eq("email", dto.email).single()
    if (existing) throw new Error("Email deja utilise")

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({ name: dto.orgName, slug, plan: dto.plan, status: "ACTIVE" })
      .select().single()
    if (orgErr) throw new Error(orgErr.message)

    const passwordHash = await hashPassword(dto.password)

    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .insert({
        email:           dto.email,
        name:            dto.name,
        role:            "ADMIN",
        password_hash:   passwordHash,
        organization_id: org.id,
        status:          "ACTIVE",
      })
      .select().single()
    if (userErr) throw new Error(userErr.message)

    return { organization: org, user: { id: user.id, email: user.email, name: user.name } }
  }

  async updateOrgStatus(orgId: string, status: OrgStatus) {
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orgId)
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async assignNumber(phoneNumber: string, organizationId: string) {
    const twilioNum = await twilioService.purchasePhoneNumber(phoneNumber, organizationId)
    const { data, error } = await supabaseAdmin
      .from("phone_numbers")
      .insert({
        number:          twilioNum.phoneNumber,
        twilio_sid:      twilioNum.sid,
        organization_id: organizationId,
        country:         "CA",
      })
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async searchAvailableNumbers(country: string = "CA", areaCode?: string) {
    return twilioService.searchAvailableNumbers(country, areaCode)
  }

  async getRevenueDetails() {
    const stats = await stripeService.getRevenueStats()
    const { data: orgs } = await supabaseAdmin
      .from("organizations")
      .select("plan")
      .eq("status", "ACTIVE")

    return {
      ...stats,
      breakdown: {
        starter:    (orgs || []).filter((o: any) => o.plan === "STARTER").length * 99,
        pro:        (orgs || []).filter((o: any) => o.plan === "PRO").length * 299,
        enterprise: (orgs || []).filter((o: any) => o.plan === "ENTERPRISE").length * 799,
      }
    }
  }
}

export const ownerService = new OwnerService()


