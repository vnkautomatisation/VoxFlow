'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

/**
 * Hook de synchronisation auth portail ↔ dialer
 * À placer dans le layout principal pour qu'il soit actif partout
 */
export function useDialerAuthSync() {
    const { accessToken, isAuth, user } = useAuthStore()

    useEffect(() => {
        if (isAuth && accessToken && user) {
            // Portail connecté → sync vers dialer (localStorage + cookie déjà fait par authStore)
            try {
                localStorage.setItem('vf_tok', accessToken)
                localStorage.setItem('vf_url', API_URL)
                localStorage.setItem('vf_role', user.role)
            } catch { }
        } else if (!isAuth) {
            // Portail déconnecté → nettoyer
            try {
                localStorage.removeItem('vf_tok')
                localStorage.removeItem('vf_role')
            } catch { }
        }
    }, [isAuth, accessToken, user])
}