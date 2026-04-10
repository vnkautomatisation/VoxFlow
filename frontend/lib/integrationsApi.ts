import { apiRequest } from "./api"

const base = "/api/v1/integrations"

export const integrationsApi = {
  getKeys:      (token: string) => apiRequest<any>(base + "/keys", { token }),
  createKey:    (token: string, name: string, permissions?: string[], expiresInDays?: number) =>
    apiRequest<any>(base + "/keys", { method: "POST", body: { name, permissions, expiresInDays }, token }),
  revokeKey:    (token: string, id: string) =>
    apiRequest<any>(base + "/keys/" + id, { method: "DELETE", token }),

  getWebhooks:  (token: string) => apiRequest<any>(base + "/webhooks", { token }),
  createWebhook:(token: string, body: any) => apiRequest<any>(base + "/webhooks", { method: "POST", body, token }),
  updateWebhook:(token: string, id: string, body: any) =>
    apiRequest<any>(base + "/webhooks/" + id, { method: "PATCH", body, token }),
  deleteWebhook:(token: string, id: string) =>
    apiRequest<any>(base + "/webhooks/" + id, { method: "DELETE", token }),
  testWebhook:  (token: string, id: string) =>
    apiRequest<any>(base + "/webhooks/" + id + "/test", { method: "POST", token }),
  getWebhookLogs:(token: string, id: string) =>
    apiRequest<any>(base + "/webhooks/" + id + "/logs", { token }),

  getIntegrations:   (token: string) => apiRequest<any>(base, { token }),
  connectIntegration:(token: string, body: any) =>
    apiRequest<any>(base + "/connect", { method: "POST", body, token }),
  disconnectIntegration:(token: string, id: string) =>
    apiRequest<any>(base + "/" + id + "/disconnect", { method: "POST", token }),
  syncHubSpot:       (token: string) =>
    apiRequest<any>(base + "/hubspot/sync", { method: "POST", token }),
  syncSalesforce:    (token: string) =>
    apiRequest<any>(base + "/salesforce/sync", { method: "POST", token }),
  syncZendesk:       (token: string) =>
    apiRequest<any>(base + "/zendesk/sync", { method: "POST", token }),
  testSlack:         (token: string) =>
    apiRequest<any>(base + "/slack/test", { method: "POST", token }),
  syncGoogleCalendar:(token: string) =>
    apiRequest<any>(base + "/google-calendar/sync", { method: "POST", token }),
}
