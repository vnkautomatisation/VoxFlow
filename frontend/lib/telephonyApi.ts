import { apiRequest } from "./api"

const base = "/api/v1/telephony"

export const telephonyApi = {
  getToken:   (token: string) => apiRequest<any>(base + "/token", { token }),
  setStatus:  (token: string, status: string) => apiRequest<any>(base + "/status", { method: "PATCH", body: { status }, token }),
  getCalls:   (token: string, limit = 30) => apiRequest<any>(base + "/calls?limit=" + limit, { token }),

  startCall:  (token: string, to: string, contactId?: string) =>
    apiRequest<any>(base + "/call/outbound", { method: "POST", body: { to, contactId }, token }),

  endCall:    (token: string, callId: string, duration: number, notes?: string) =>
    apiRequest<any>(base + "/call/" + callId + "/end", { method: "PATCH", body: { duration, notes }, token }),

  transfer:   (token: string, callId: string, to: string, type = "blind") =>
    apiRequest<any>(base + "/call/" + callId + "/transfer", { method: "POST", body: { to, type }, token }),

  conference: (token: string, callId: string, participant: string) =>
    apiRequest<any>(base + "/call/" + callId + "/conference", { method: "POST", body: { participant }, token }),

  saveNotes:  (token: string, callId: string, notes: string) =>
    apiRequest<any>(base + "/call/" + callId + "/notes", { method: "PATCH", body: { notes }, token }),

  lookup:     (token: string, phone: string) =>
    apiRequest<any>(base + "/lookup/" + encodeURIComponent(phone), { token }),
}
