import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Role = "OWNER" | "ADMIN" | "SUPERVISOR" | "AGENT"

export interface AuthUser {
  id:             string
  email:          string
  name:           string
  role:           Role
  organizationId: string | null
  organization?:  { name: string; plan: string; seats: number | null; status: string }
  extension?:     string
  first_name?:    string
  last_name?:     string
  agent_status?:  string
  plan?:          string
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

// ── Cookies via route API (lisibles par middleware) ───────────────
async function setSessionCookies(token: string, role: string) {
  try {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, role }),
    })
  } catch {}
}

async function clearSessionCookies() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' })
  } catch {}
}

// ── Notify Electron via HTTP (localhost:9876) ────────────────────
async function notifyElectron(action: string, token?: string, role?: string) {
  try {
    await fetch('http://127.0.0.1:9876/auth-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        token: token || null,
        role: role || null,
        url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      }),
    })
  } catch {} // Electron pas ouvert — ignorer silencieusement
}

// ── Sync localStorage pour le dialer Electron ────────────────────
function syncToDialer(user: AuthUser, token: string) {
  if (typeof window === "undefined") return
  try {
    const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
    localStorage.setItem("vf_tok",  token)
    localStorage.setItem("vf_url",  url)
    localStorage.setItem("vf_role", user.role)
    if (user.extension) localStorage.setItem("vf_ext",  user.extension)
    else                localStorage.removeItem("vf_ext")
    if (user.plan)      localStorage.setItem("vf_plan", user.plan)
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || ''
    if (name)           localStorage.setItem("vf_name", name)
    // BroadcastChannel pour sync temps reel avec Electron
    try {
      const bc = new BroadcastChannel('voxflow_sync')
      bc.postMessage({ type: 'AUTH_SYNC', token, role: user.role, url })
      bc.close()
    } catch {}
  } catch {}
}

function clearDialerSync() {
  if (typeof window === "undefined") return
  try {
    ['vf_tok','vf_role','vf_ext','vf_plan','vf_name'].forEach(k => localStorage.removeItem(k))
    try {
      const bc = new BroadcastChannel('voxflow_sync')
      bc.postMessage({ type: 'LOGOUT' })
      bc.close()
    } catch {}
  } catch {}
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:        null,
      accessToken: null,
      isLoading:   false,
      isAuth:      false,

      setAuth: (user, accessToken) => {
        setSessionCookies(accessToken, user.role)
        syncToDialer(user, accessToken)
        notifyElectron('login', accessToken, user.role)
        set({ user, accessToken, isAuth: true, isLoading: false })
      },

      logout: async () => {
        notifyElectron('logout')
        const state = useAuthStore.getState()
        // 1. Appel backend pour invalider le token
        try {
          const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
          await fetch(url + '/api/v1/auth/logout', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + (state.accessToken || '') }
          })
        } catch {}
        // 2. Effacer cookies et localStorage
        clearSessionCookies()
        clearDialerSync()
        // 3. Notifier le dialer Electron via storage event explicite
        if (typeof window !== "undefined") {
          localStorage.setItem('vf_logout', Date.now().toString())
          localStorage.removeItem('vf_logout')
        }
        set({ user: null, accessToken: null, isAuth: false })
        if (typeof window !== "undefined") {
          window.location.href = '/login'
        }
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
      // Re-sync au rechargement de page
      onRehydrateStorage: () => (state) => {
        if (state?.isAuth && state.accessToken && state.user) {
          setSessionCookies(state.accessToken, state.user.role)
          syncToDialer(state.user, state.accessToken)
        }
      },
    }
  )
)

// Sync dialer -> portail (appele depuis le dialer apres son login)
if (typeof window !== "undefined") {
  ;(window as any).vfSyncAuthFromDialer = (token: string, role: string, name?: string) => {
    try {
      localStorage.setItem("vf_tok",  token)
      localStorage.setItem("vf_role", role)
      if (name) localStorage.setItem("vf_name", name)
      setSessionCookies(token, role)
    } catch {}
  }
}

export const getDashboardRoute = (role: Role): string => {
  const map: Record<Role, string> = {
    OWNER:      '/owner/dashboard',
    ADMIN:      '/admin/dashboard',
    SUPERVISOR: '/agent/dashboard',
    AGENT:      '/agent/dashboard',
  }
  return map[role] || '/login'
}