import { apiRequest } from "./api"

const base = "/api/v1/agent"

export const agentApi = {
  getToken:    (token: string) => apiRequest<any>(base + "/token", { token }),
  getMe:       (token: string) => apiRequest<any>(base + "/me",    { token }),
  getCalls:    (token: string, limit = 20) => apiRequest<any>(base + "/calls?limit=" + limit, { token }),
  getScripts:  (token: string) => apiRequest<any>(base + "/scripts", { token }),
  getContacts: (token: string, search = "") => apiRequest<any>(base + "/contacts?search=" + search, { token }),

  setStatus: (token: string, status: string) =>
    apiRequest<any>(base + "/status", { method: "PATCH", body: { status }, token }),

  makeCall: (token: string, to: string, from?: string) =>
    apiRequest<any>(base + "/calls", { method: "POST", body: { to, from }, token }),

  addNotes: (token: string, callId: string, notes: string) =>
    apiRequest<any>(base + "/calls/" + callId + "/notes", { method: "PATCH", body: { notes }, token }),
}
