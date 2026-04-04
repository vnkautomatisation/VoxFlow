import { apiRequest } from "./api"

const base = "/api/v1/supervision"

export const supervisionApi = {
  getSnapshot:    (token: string, orgId?: string) => {
    const q = orgId ? "?orgId=" + orgId : ""
    return apiRequest<any>(base + "/snapshot" + q, { token })
  },
  getAlerts:      (token: string) => apiRequest<any>(base + "/alerts", { token }),
  forceStatus:    (token: string, agentId: string, status: string) =>
    apiRequest<any>(base + "/agent/" + agentId + "/status", { method: "POST", body: { status }, token }),
  joinCall:       (token: string, callId: string, mode: "listen" | "whisper" | "barge") =>
    apiRequest<any>(base + "/call/" + callId + "/join", { method: "POST", body: { mode }, token }),
  getLog:         (token: string, limit?: number) =>
    apiRequest<any>(base + "/log" + (limit ? "?limit=" + limit : ""), { token }),
}
