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
}
