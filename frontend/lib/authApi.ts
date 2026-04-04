import { apiRequest } from "./api"

const base = "/api/v1/auth"

export const authApi = {
  login:          (email: string, password: string) =>
    apiRequest<any>(base + "/login", { method: "POST", body: { email, password } }),

  register:       (body: any) =>
    apiRequest<any>(base + "/register", { method: "POST", body }),

  me:             (token: string) =>
    apiRequest<any>(base + "/me", { token }),

  logout:         (token: string) =>
    apiRequest<any>(base + "/logout", { method: "POST", token }),

  refresh:        () =>
    apiRequest<any>(base + "/refresh", { method: "POST" }),

  verifyEmail:    (token: string) =>
    apiRequest<any>(base + "/verify-email", { method: "POST", body: { token } }),

  forgotPassword: (email: string) =>
    apiRequest<any>(base + "/forgot-password", { method: "POST", body: { email } }),

  resetPassword:  (token: string, password: string) =>
    apiRequest<any>(base + "/reset-password", { method: "POST", body: { token, password } }),

  updateProfile:  (accessToken: string, body: any) =>
    apiRequest<any>(base + "/profile", { method: "PATCH", body, token: accessToken }),
}

export const onboardingApi = {
  getStatus:  (token: string) =>
    apiRequest<any>("/api/v1/onboarding/status", { token }),

  getNumbers: (token: string, country = "CA", areaCode?: string) => {
    const url = "/api/v1/onboarding/numbers?country=" + country + (areaCode ? "&areaCode=" + areaCode : "")
    return apiRequest<any>(url, { token })
  },

  step1: (token: string, body: any) =>
    apiRequest<any>("/api/v1/onboarding/step/1", { method: "POST", body, token }),

  step2: (token: string, phoneNumber: string) =>
    apiRequest<any>("/api/v1/onboarding/step/2", { method: "POST", body: { phoneNumber }, token }),

  step3: (token: string, body: any) =>
    apiRequest<any>("/api/v1/onboarding/step/3", { method: "POST", body, token }),

  step4: (token: string, body: any) =>
    apiRequest<any>("/api/v1/onboarding/step/4", { method: "POST", body, token }),

  step5: (token: string) =>
    apiRequest<any>("/api/v1/onboarding/step/5", { method: "POST", token }),
}
