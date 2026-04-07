import { apiRequest } from "./api"

const base = "/api/v1/auth"

// ── Synchronise le localStorage pour le dialer Electron ──────
// Appelé après login et au mount de chaque layout protégé
function saveDialerKeys(user: any) {
  if (typeof window === 'undefined') return
  if (user?.role)      localStorage.setItem('vf_role', user.role)
  if (user?.extension) localStorage.setItem('vf_ext',  user.extension)
  else                 localStorage.removeItem('vf_ext')
  if (user?.plan)      localStorage.setItem('vf_plan', user.plan)
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || ''
  if (name)            localStorage.setItem('vf_name', name)
}

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiRequest<any>(base + "/login", {
      method: "POST",
      body: { email, password },
    })
    // Sauvegarder le token + infos dialer dans localStorage
    if (res?.data?.accessToken) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('vf_tok', res.data.accessToken)
        localStorage.setItem('vf_url', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
      }
      saveDialerKeys(res.data.user)
    }
    return res
  },

  register: (body: any) =>
    apiRequest<any>(base + "/register", { method: "POST", body }),

  me: async (token: string) => {
    const res = await apiRequest<any>(base + "/me", { token })
    // Rafraichir les infos dialer a chaque appel /me
    if (res?.data) saveDialerKeys(res.data)
    return res
  },

  logout: (token: string) => {
    // Nettoyer le localStorage dialer a la deconnexion
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vf_tok')
      localStorage.removeItem('vf_role')
      localStorage.removeItem('vf_ext')
      localStorage.removeItem('vf_plan')
      localStorage.removeItem('vf_name')
    }
    return apiRequest<any>(base + "/logout", { method: "POST", token })
  },

  refresh: () =>
    apiRequest<any>(base + "/refresh", { method: "POST" }),

  verifyEmail: (token: string) =>
    apiRequest<any>(base + "/verify-email", { method: "POST", body: { token } }),

  forgotPassword: (email: string) =>
    apiRequest<any>(base + "/forgot-password", { method: "POST", body: { email } }),

  resetPassword: (token: string, password: string) =>
    apiRequest<any>(base + "/reset-password", { method: "POST", body: { token, password } }),

  updateProfile: (accessToken: string, body: any) =>
    apiRequest<any>(base + "/profile", { method: "PATCH", body, token: accessToken }),
}

export const onboardingApi = {
  getStatus: (token: string) =>
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

