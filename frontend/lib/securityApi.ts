import { apiRequest } from "./api"

const base = "/api/v1/security"

export const securityApi = {
  get2FAStatus:  (token: string) => apiRequest<any>(base + "/2fa/status", { token }),
  setup2FA:      (token: string) => apiRequest<any>(base + "/2fa/setup", { method: "POST", token }),
  enable2FA:     (token: string, code: string) =>
    apiRequest<any>(base + "/2fa/enable", { method: "POST", body: { code }, token }),
  disable2FA:    (token: string) => apiRequest<any>(base + "/2fa/disable", { method: "POST", token }),
  verify2FA:     (token: string, code: string) =>
    apiRequest<any>(base + "/2fa/verify", { method: "POST", body: { code }, token }),
  getSessions:   (token: string) => apiRequest<any>(base + "/sessions", { token }),
  revokeSession: (token: string, id: string) =>
    apiRequest<any>(base + "/sessions/" + id, { method: "DELETE", token }),
  revokeAll:     (token: string) => apiRequest<any>(base + "/sessions", { method: "DELETE", token }),
  getAuditLogs:  (token: string, limit?: number) =>
    apiRequest<any>(base + "/audit" + (limit ? "?limit=" + limit : ""), { token }),
}
