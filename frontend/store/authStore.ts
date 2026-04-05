import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Role = "OWNER" | "ADMIN" | "SUPERVISOR" | "AGENT"

export interface AuthUser {
  id:             string
  email:          string
  name:           string
  role:           Role
  organizationId: string | null
}

interface AuthState {
  user:        AuthUser | null
  accessToken: string | null
  isLoading:   boolean
  isAuth:      boolean

  setAuth:    (user: AuthUser, token: string) => void
  logout:     () => void
  setLoading: (v: boolean) => void
}

// Helper pour écrire un cookie accessible au middleware
function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:        null,
      accessToken: null,
      isLoading:   false,
      isAuth:      false,

      setAuth: (user, accessToken) => {
        // Sauvegarder dans les cookies pour le middleware
        setCookie("vf_access_token", accessToken)
        setCookie("vf_role", user.role)
        // Aussi dans localStorage pour le dialer
        try {
          localStorage.setItem("vf_tok", accessToken)
          localStorage.setItem("vf_url", process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000")
        } catch {}
        set({ user, accessToken, isAuth: true, isLoading: false })
      },

      logout: () => {
        // Supprimer les cookies et localStorage
        deleteCookie("vf_access_token")
        deleteCookie("vf_role")
        try {
          localStorage.removeItem("vf_tok")
          localStorage.removeItem("vf_role")
        } catch {}
        // Deconnecter le dialer Electron si ouvert
        try {
          if (typeof window !== "undefined") {
            window.location.href = "voxflow://logout"
          }
        } catch {}
        set({ user: null, accessToken: null, isAuth: false })
      },

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "voxflow-auth",
      partialize: (state) => ({
        user:        state.user,
        accessToken: state.accessToken,
        isAuth:      state.isAuth,
      }),
    }
  )
)

// Helper — route dashboard selon le rôle
export const getDashboardRoute = (role: Role): string => {
  switch (role) {
    case "OWNER":      return "/owner/dashboard"
    case "ADMIN":      return "/admin/dashboard"
    case "SUPERVISOR": return "/agent/dashboard"
    case "AGENT":      return "/agent/dashboard"
    default:           return "/login"
  }
}