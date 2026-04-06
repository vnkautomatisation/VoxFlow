import { apiRequest } from "./api"

const base = "/api/v1/telephony"
const agentBase = "/api/v1/agent"

export const agentApi = {
  getToken:    (token: string) => apiRequest<any>(agentBase + "/token", { token }),
  getMe:       (token: string) => apiRequest<any>(agentBase + "/me",    { token }),
  getCalls:    (token: string, limit = 20) => apiRequest<any>(base + "/calls?limit=" + limit, { token }),
  getScripts:  (token: string) => apiRequest<any>(agentBase + "/scripts", { token }),
  getContacts: (token: string, search = "") => {
    const q = search ? "?search="+encodeURIComponent(search) : "?limit=50"
    return apiRequest<any>("/api/v1/crm/contacts"+q, { token })
  },
  setStatus: (token: string, status: string) =>
    apiRequest<any>(base + "/status", { method: "PATCH", body: { status }, token }),
  makeCall: (token: string, to: string, from?: string) =>
    apiRequest<any>(base + "/call/outbound", { method: "POST", body: { to, from }, token }),
  addNotes: (token: string, callId: string, notes: string) =>
    apiRequest<any>(base + "/call/" + callId + "/notes", { method: "PATCH", body: { notes }, token }),
}