import { apiRequest } from "./api"

export const ownerApi = {

  // Stats
  getStats: (token: string) =>
    apiRequest<any>("/api/v1/owner/stats", { token }),

  // Organisations
  getOrganizations: (token: string, page = 1) =>
    apiRequest<any>("/api/v1/owner/organizations?page=" + page, { token }),

  createAdmin: (token: string, body: any) =>
    apiRequest<any>("/api/v1/owner/organizations", { method: "POST", body, token }),

  updateOrgStatus: (token: string, orgId: string, status: string) =>
    apiRequest<any>("/api/v1/owner/organizations/" + orgId + "/status", {
      method: "PATCH", body: { status }, token
    }),

  // Numeros
  searchNumbers: (token: string, country = "CA", areaCode?: string) => {
    const url = "/api/v1/owner/numbers/search?country=" + country +
      (areaCode ? "&areaCode=" + areaCode : "")
    return apiRequest<any>(url, { token })
  },

  assignNumber: (token: string, phoneNumber: string, organizationId: string) =>
    apiRequest<any>("/api/v1/owner/numbers/assign", {
      method: "POST", body: { phoneNumber, organizationId }, token
    }),

  // Revenus
  getRevenue: (token: string) =>
    apiRequest<any>("/api/v1/owner/revenue", { token }),

  // ── Plans (forfaits) ─────────────────────────────────────────
  // CRUD des plan_definitions pilotées par le owner (avec features)
  getPlans: (token: string) =>
    apiRequest<any>("/api/v1/owner/plans", { token }),

  getPlan: (token: string, id: string) =>
    apiRequest<any>("/api/v1/owner/plans/" + id, { token }),

  createPlan: (token: string, body: any) =>
    apiRequest<any>("/api/v1/owner/plans", { method: "POST", body, token }),

  updatePlan: (token: string, id: string, body: any) =>
    apiRequest<any>("/api/v1/owner/plans/" + id, { method: "PATCH", body, token }),

  deletePlan: (token: string, id: string) =>
    apiRequest<any>("/api/v1/owner/plans/" + id, { method: "DELETE", token }),

  getPlanUsage: (token: string, id: string) =>
    apiRequest<any>("/api/v1/owner/plans/" + id + "/usage", { token }),

  // Changer le forfait d'une org
  setOrgPlan: (token: string, orgId: string, plan: string) =>
    apiRequest<any>("/api/v1/owner/organizations/" + orgId + "/plan", {
      method: "PATCH", body: { plan }, token
    }),
}
