import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Role = "OWNER" | "ADMIN" | "SUPERVISOR" | "AGENT"

export interface AuthUser {
    id: string
    email: string
    name: string
    role: Role
    organizationId: string | null
    organization?: { name: string; plan: string; seats: number | null; status: string }
    extension?: string
    first_name?: string
    last_name?: string
    agent_status?: string
    plan?: string
}

interface AuthState {
    user: AuthUser | null
    accessToken: string | null
    isLoading: boolean
    isAuth: boolean
    setAuth: (user: AuthUser, token: string) => void
    logout: () => void
    setLoading: (v: boolean) => void
}

function setCookie(name: string, value: string, days = 7) {
    if (typeof document === "undefined") return
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

function deleteCookie(name: string) {
    if (typeof document === "undefined") return
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
}

function syncToDialer(token: string, role: string) {
    if (typeof window === "undefined") return
    try {
        const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
        localStorage.setItem("vf_tok", token)
        localStorage.setItem("vf_url", url)
        localStorage.setItem("vf_role", role)
    } catch { }
}

function clearDialerSync() {
    if (typeof window === "undefined") return
    try {
        localStorage.removeItem("vf_tok")
        localStorage.removeItem("vf_role")
    } catch { }
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            isLoading: false,
            isAuth: false,

            setAuth: (user, accessToken) => {
                setCookie("vf_access_token", accessToken)
                setCookie("vf_role", user.role)
                syncToDialer(accessToken, user.role)
                set({ user, accessToken, isAuth: true, isLoading: false })
            },

            logout: () => {
                deleteCookie("vf_access_token")
                deleteCookie("vf_role")
                clearDialerSync()
                try {
                    if (typeof window !== "undefined") {
                        window.location.href = "voxflow://logout"
                    }
                } catch { }
                set({ user: null, accessToken: null, isAuth: false })
            },

            setLoading: (isLoading) => set({ isLoading }),
        }),
        {
            name: "voxflow-auth",
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                isAuth: state.isAuth,
            }),
            onRehydrateStorage: () => (state) => {
                if (state?.isAuth && state.accessToken && state.user) {
                    syncToDialer(state.accessToken, state.user.role)
                }
            },
        }
    )
)

export const getDashboardRoute = (role: Role): string => {
    switch (role) {
        case "OWNER": return "/owner/dashboard"
        case "ADMIN": return "/admin/dashboard"
        case "SUPERVISOR": return "/agent/dashboard"
        case "AGENT": return "/agent/dashboard"
        default: return "/login"
    }
}