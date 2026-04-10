'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

/**
 * Hook de synchronisation auth portail ↔ dialer
 * À placer dans le layout principal pour qu'il soit actif partout
 *
 * Synchronise vers localStorage (lu par le dialer Electron) :
 *  - vf_tok     : JWT d'accès
 *  - vf_url     : URL de l'API backend
 *  - vf_role    : rôle utilisateur (AGENT, ADMIN, SUPERVISOR...)
 *  - vf_ext     : extension SIP de l'agent (si assignée)
 *  - vf_plan    : plan dialer (FULL ou INBOUND_ONLY) — drive les
 *                 restrictions d'appels sortants dans le dialer
 *  - vf_name    : nom complet affiché dans le dialer
 */
export function useDialerAuthSync() {
    const { accessToken, isAuth, user } = useAuthStore()

    useEffect(() => {
        if (isAuth && accessToken && user) {
            // Portail connecté → sync vers dialer
            try {
                localStorage.setItem('vf_tok',  accessToken)
                localStorage.setItem('vf_url',  API_URL)
                localStorage.setItem('vf_role', user.role)

                // Extension SIP (peut être null pour OWNER/ADMIN sans extension)
                if (user.extension) localStorage.setItem('vf_ext', user.extension)
                else                localStorage.removeItem('vf_ext')

                // Plan dialer (FULL ou INBOUND_ONLY) — drive les restrictions
                // d'appels sortants. STARTER/BASIC → INBOUND_ONLY.
                if (user.plan) localStorage.setItem('vf_plan', user.plan)
                else           localStorage.removeItem('vf_plan')

                // Nom affiché
                const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || ''
                if (name) localStorage.setItem('vf_name', name)
            } catch { }
        } else if (!isAuth) {
            // Portail déconnecté → nettoyer tout
            try {
                ['vf_tok', 'vf_url', 'vf_role', 'vf_ext', 'vf_plan', 'vf_name'].forEach(k =>
                    localStorage.removeItem(k)
                )
            } catch { }
        }
    }, [isAuth, accessToken, user])
}