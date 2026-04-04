import { apiRequest } from "./api"

const base = "/api/v1/admin"

export const adminApi = {
  getStats:   (token: string) => apiRequest<any>(base + "/stats", { token }),
  getReports: (token: string, period = "30d") => apiRequest<any>(base + "/reports?period=" + period, { token }),

  // Agents
  getAgents:    (token: string) => apiRequest<any>(base + "/agents", { token }),
  createAgent:  (token: string, body: any) => apiRequest<any>(base + "/agents", { method: "POST", body, token }),
  updateAgent:  (token: string, id: string, body: any) => apiRequest<any>(base + "/agents/" + id, { method: "PATCH", body, token }),
  deleteAgent:  (token: string, id: string) => apiRequest<any>(base + "/agents/" + id, { method: "DELETE", token }),

  // Queues
  getQueues:    (token: string) => apiRequest<any>(base + "/queues", { token }),
  createQueue:  (token: string, body: any) => apiRequest<any>(base + "/queues", { method: "POST", body, token }),
  updateQueue:  (token: string, id: string, body: any) => apiRequest<any>(base + "/queues/" + id, { method: "PATCH", body, token }),
  deleteQueue:  (token: string, id: string) => apiRequest<any>(base + "/queues/" + id, { method: "DELETE", token }),

  // IVR
  getIVR:    (token: string) => apiRequest<any>(base + "/ivr", { token }),
  createIVR: (token: string, body: any) => apiRequest<any>(base + "/ivr", { method: "POST", body, token }),
  updateIVR: (token: string, id: string, body: any) => apiRequest<any>(base + "/ivr/" + id, { method: "PATCH", body, token }),

  // Scripts
  getScripts:   (token: string) => apiRequest<any>(base + "/scripts", { token }),
  createScript: (token: string, body: any) => apiRequest<any>(base + "/scripts", { method: "POST", body, token }),
}
