'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

/**
 * usePlanPoller — poll /auth/me toutes les N minutes pour détecter
 * les changements de plan faits par le OWNER (upgrade/downgrade).
 *
 * Skip si :
 *  - l'utilisateur n'est pas authentifié
 *  - la page est cachée (document.hidden) — économie de requêtes
 *
 * Default interval : 2 minutes (120000 ms).
 *
 * Monté une seule fois dans le layout admin/owner/client, PAS dans
 * le dialer (qui écoute via storage event + BroadcastChannel).
 */
export function usePlanPoller(intervalMs: number = 120_000) {
  const { isAuth, accessToken, refreshUser } = useAuthStore()

  useEffect(() => {
    if (!isAuth || !accessToken) return

    let timer: any = null

    const tick = () => {
      // Skip si la page est cachée (économie de requêtes)
      if (typeof document !== 'undefined' && document.hidden) return
      refreshUser()
    }

    // Premier tick après 5s (laisser le temps à l'app de monter)
    const initial = setTimeout(tick, 5000)
    timer = setInterval(tick, intervalMs)

    // Refresh quand la page redevient visible
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        refreshUser()
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      clearTimeout(initial)
      if (timer) clearInterval(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [isAuth, accessToken, refreshUser, intervalMs])
}
