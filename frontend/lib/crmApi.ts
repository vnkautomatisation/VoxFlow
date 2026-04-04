import { apiRequest } from "./api"

const base = "/api/v1/crm"

export const crmApi = {
  // Contacts
  getContacts: (token: string, params?: any) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : ""
    return apiRequest<any>(base + "/contacts" + q, { token })
  },
  searchContacts: (token: string, q: string) =>
    apiRequest<any>(base + "/contacts/search?q=" + encodeURIComponent(q), { token }),
  getPipeline: (token: string) =>
    apiRequest<any>(base + "/contacts/pipeline", { token }),
  getContact: (token: string, id: string) =>
    apiRequest<any>(base + "/contacts/" + id, { token }),
  createContact: (token: string, body: any) =>
    apiRequest<any>(base + "/contacts", { method: "POST", body, token }),
  updateContact: (token: string, id: string, body: any) =>
    apiRequest<any>(base + "/contacts/" + id, { method: "PATCH", body, token }),
  deleteContact: (token: string, id: string) =>
    apiRequest<any>(base + "/contacts/" + id, { method: "DELETE", token }),

  // Activites
  addActivity: (token: string, contactId: string, body: any) =>
    apiRequest<any>(base + "/contacts/" + contactId + "/activities", { method: "POST", body, token }),

  // Import
  importContacts: (token: string, contacts: any[]) =>
    apiRequest<any>(base + "/contacts/import", { method: "POST", body: { contacts }, token }),

  // Tags
  getTags: (token: string) =>
    apiRequest<any>(base + "/tags", { token }),
  createTag: (token: string, name: string, color?: string) =>
    apiRequest<any>(base + "/tags", { method: "POST", body: { name, color }, token }),

  // Softphone
  findByPhone: (token: string, phone: string) =>
    apiRequest<any>(base + "/phone/" + encodeURIComponent(phone), { token }),
  linkCall: (token: string, callId: string, contactId: string) =>
    apiRequest<any>(base + "/calls/" + callId + "/link", { method: "POST", body: { contactId }, token }),
}
