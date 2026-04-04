import { apiRequest } from "./api"

const base = "/api/v1/ai2"

export const ai2Api = {
  scoreCall:      (token: string, callId: string, transcription: string, duration: number) =>
    apiRequest<any>(base + "/score/" + callId, { method: "POST", body: { transcription, duration }, token }),
  generateCoaching:(token: string, agentId: string, period?: string) =>
    apiRequest<any>(base + "/coaching/" + agentId, { method: "POST", body: { period }, token }),
  getCoaching:    (token: string) => apiRequest<any>(base + "/coaching", { token }),
  getSuggestions: (token: string, keywords: string[]) =>
    apiRequest<any>(base + "/suggestions", { method: "POST", body: { keywords }, token }),
  getStats:       (token: string) => apiRequest<any>(base + "/stats", { token }),

  getCampaigns:   (token: string) => apiRequest<any>(base + "/campaigns", { token }),
  createCampaign: (token: string, body: any) => apiRequest<any>(base + "/campaigns", { method: "POST", body, token }),
  getCampaign:    (token: string, id: string) => apiRequest<any>(base + "/campaigns/" + id, { token }),
  setCampaignStatus:(token: string, id: string, status: string) =>
    apiRequest<any>(base + "/campaigns/" + id + "/status", { method: "PATCH", body: { status }, token }),
  addContacts:    (token: string, id: string, contacts: any[]) =>
    apiRequest<any>(base + "/campaigns/" + id + "/contacts", { method: "POST", body: { contacts }, token }),
  getCampaignStats:(token: string, id: string) => apiRequest<any>(base + "/campaigns/" + id + "/stats", { token }),
  getNextContact: (token: string, id: string) => apiRequest<any>(base + "/campaigns/" + id + "/next", { token }),
}
