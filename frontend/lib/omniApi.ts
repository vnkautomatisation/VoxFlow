import { apiRequest } from "./api"

const base = "/api/v1/omni"

export const omniApi = {
  getConversations: (token: string, params?: any) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return apiRequest<any>(base + "/conversations" + q, { token })
  },
  getStats:         (token: string) => apiRequest<any>(base + "/conversations/stats", { token }),
  getConversation:  (token: string, id: string) => apiRequest<any>(base + "/conversations/" + id, { token }),
  createConversation:(token: string, body: any) => apiRequest<any>(base + "/conversations", { method: "POST", body, token }),
  updateConversation:(token: string, id: string, body: any) => apiRequest<any>(base + "/conversations/" + id, { method: "PATCH", body, token }),
  sendMessage:      (token: string, convId: string, content: string, contentType?: string) =>
    apiRequest<any>(base + "/conversations/" + convId + "/messages", { method: "POST", body: { content, contentType }, token }),
  getCanned:        (token: string, channel?: string) =>
    apiRequest<any>(base + "/canned" + (channel ? "?channel=" + channel : ""), { token }),
  createCanned:     (token: string, body: any) => apiRequest<any>(base + "/canned", { method: "POST", body, token }),
  getEmailTickets:  (token: string, status?: string) =>
    apiRequest<any>(base + "/email" + (status ? "?status=" + status : ""), { token }),
  createEmailTicket:(token: string, body: any) => apiRequest<any>(base + "/email", { method: "POST", body, token }),
}
