import { apiRequest } from "./api"

export const aiApi = {
  transcribeCall: (token: string, callId: string) =>
    apiRequest<any>("/api/v1/ai/transcribe/" + callId, { method: "POST", token }),

  summarize: (token: string, transcription: string, duration: number) =>
    apiRequest<any>("/api/v1/ai/summarize", { method: "POST", body: { transcription, duration }, token }),

  getSummaries: (token: string) =>
    apiRequest<any>("/api/v1/ai/summaries", { token }),
}

export const smsApi = {
  getConversations: (token: string) =>
    apiRequest<any>("/api/v1/sms", { token }),

  getThread: (token: string, phone: string) =>
    apiRequest<any>("/api/v1/sms/thread/" + encodeURIComponent(phone), { token }),

  sendSMS: (token: string, to: string, body: string, from?: string) =>
    apiRequest<any>("/api/v1/sms/send", { method: "POST", body: { to, body, from }, token }),
}

export const analyticsApi = {
  getAdvanced: (token: string, period = "30d", orgId?: string) => {
    const url = "/api/v1/analytics/advanced?period=" + period + (orgId ? "&orgId=" + orgId : "")
    return apiRequest<any>(url, { token })
  },

  getSLA: (token: string) =>
    apiRequest<any>("/api/v1/analytics/sla", { token }),
}
