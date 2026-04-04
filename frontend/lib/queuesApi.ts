import { apiRequest } from "./api"

const base = "/api/v1/queues"

export const queuesApi = {
  getQueues:     (token: string) => apiRequest<any>(base, { token }),
  createQueue:   (token: string, body: any) => apiRequest<any>(base, { method: "POST", body, token }),
  updateQueue:   (token: string, id: string, body: any) => apiRequest<any>(base + "/" + id, { method: "PATCH", body, token }),
  getRealtime:   (token: string, id: string) => apiRequest<any>(base + "/" + id + "/realtime", { token }),
  addAgent:      (token: string, queueId: string, agentId: string, skillLevel?: number) =>
    apiRequest<any>(base + "/" + queueId + "/agents", { method: "POST", body: { agentId, skillLevel }, token }),
  removeAgent:   (token: string, queueId: string, agentId: string) =>
    apiRequest<any>(base + "/" + queueId + "/agents/" + agentId, { method: "DELETE", token }),

  getSchedules:  (token: string) => apiRequest<any>(base + "/schedules", { token }),
  createSchedule:(token: string, body: any) => apiRequest<any>(base + "/schedules", { method: "POST", body, token }),
  updateSchedule:(token: string, id: string, body: any) =>
    apiRequest<any>(base + "/schedules/" + id, { method: "PATCH", body, token }),
  getHoursStatus:(token: string) => apiRequest<any>(base + "/hours/status", { token }),

  getCallbacks:  (token: string, status?: string) =>
    apiRequest<any>(base + "/callbacks" + (status ? "?status=" + status : ""), { token }),
  createCallback:(token: string, body: any) => apiRequest<any>(base + "/callbacks", { method: "POST", body, token }),
  completeCallback:(token: string, id: string) =>
    apiRequest<any>(base + "/callbacks/" + id + "/complete", { method: "PATCH", token }),

  getRules:      (token: string) => apiRequest<any>(base + "/rules", { token }),
  createRule:    (token: string, body: any) => apiRequest<any>(base + "/rules", { method: "POST", body, token }),
}
