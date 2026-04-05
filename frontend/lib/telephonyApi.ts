import { apiRequest } from "./api"

const base = "/api/v1/telephony"

export const telephonyApi = {
  getToken:    (token: string) => apiRequest<any>(base + "/token", { token }),
  setStatus:   (token: string, status: string) =>
    apiRequest<any>(base + "/status", { method: "PATCH", body: { status }, token }),
  getCalls:    (token: string, limit = 30) =>
    apiRequest<any>(base + "/calls?limit=" + limit, { token }),

  startCall:   (token: string, to: string, contactId?: string) =>
    apiRequest<any>(base + "/call/outbound", { method: "POST", body: { to, contactId }, token }),

  endCall:     (token: string, callId: string, duration: number, notes?: string, twilioSid?: string) =>
    apiRequest<any>(base + "/call/" + callId + "/end", { method: "PATCH", body: { duration, notes, twilioSid }, token }),

  muteCall:    (token: string, callId: string, mute: boolean, twilioSid?: string) =>
    apiRequest<any>(base + "/call/" + callId + "/mute", { method: "PATCH", body: { mute, twilioSid }, token }),

  holdCall:    (token: string, callId: string, hold: boolean, twilioSid?: string) =>
    apiRequest<any>(base + "/call/" + callId + "/hold", { method: "PATCH", body: { hold, twilioSid }, token }),

  transfer:    (token: string, callId: string, to: string, type = "blind", twilioSid?: string) =>
    apiRequest<any>(base + "/call/" + callId + "/transfer", { method: "POST", body: { to, type, twilioSid }, token }),

  conference:  (token: string, callId: string, participant: string) =>
    apiRequest<any>(base + "/call/" + callId + "/conference", { method: "POST", body: { participant }, token }),

  supervise:   (token: string, callId: string, mode: string, twilioSid?: string) =>
    apiRequest<any>(base + "/call/" + callId + "/supervise", { method: "POST", body: { mode, twilioSid }, token }),

  saveNotes:   (token: string, callId: string, notes: string) =>
    apiRequest<any>(base + "/call/" + callId + "/notes", { method: "PATCH", body: { notes }, token }),

  lookup:      (token: string, phone: string) =>
    apiRequest<any>(base + "/lookup/" + encodeURIComponent(phone), { token }),

  getRecordings: (token: string, callId: string) =>
    apiRequest<any>(base + "/call/" + callId + "/recordings", { token }),

  getNumbers:  (token: string) => apiRequest<any>(base + "/numbers", { token }),
  searchNumbers:(token: string, areaCode: string, country = "CA") =>
    apiRequest<any>(base + "/numbers/search?areaCode=" + areaCode + "&country=" + country, { token }),
  purchaseNumber:(token: string, phoneNumber: string) =>
    apiRequest<any>(base + "/numbers/purchase", { method: "POST", body: { phoneNumber }, token }),
}
