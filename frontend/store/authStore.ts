import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'AGENT'

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

  setAuth:     (user: AuthUser, token: string) => void
  logout:      () => void
  setLoading:  (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:        null,
      accessToken: null,
      isLoading:   false,
      isAuth:      false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuth: true, isLoading: false }),

      logout: () =>
        set({ user: null, accessToken: null, isAuth: false }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name:    'voxflow-auth',
      partialize: (state) => ({
        user:        state.user,
        accessToken: state.accessToken,
        isAuth:      state.isAuth,
      }),
    }
  )
)

// Helper — retourne la route dashboard selon le rôle
export const getDashboardRoute = (role: Role): string => {
  switch (role) {
    case 'OWNER':      return '/owner/dashboard'
    case 'ADMIN':      return '/admin/dashboard'
    case 'SUPERVISOR': return '/agent/dashboard'
    case 'AGENT':      return '/agent/dashboard'
    default:           return '/login'
  }
}
