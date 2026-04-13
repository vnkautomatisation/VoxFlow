'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const POLL_INTERVAL = 5000 // 5 secondes

/**
 * Hook global qui poll les nouveaux messages inbox toutes les 5s
 * et affiche une notification browser + son instantanement.
 * Monte dans le layout admin pour etre actif sur toutes les pages.
 */
export function useInboxNotifications() {
  const { accessToken, isAuth } = useAuthStore()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCountRef = useRef<number>(-1) // -1 = pas encore charge
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const checkNewMessages = useCallback(async () => {
    if (!accessToken) return
    try {
      const r = await fetch(API_URL + '/api/v1/omni/stats', {
        headers: { Authorization: 'Bearer ' + accessToken },
      })
      const data = await r.json()
      if (!data.success) return

      const unread = data.data?.unread || data.data?.open || 0

      // Premier chargement — juste stocker le compteur
      if (lastCountRef.current === -1) {
        lastCountRef.current = unread
        return
      }

      // Nouveau message detecte
      if (unread > lastCountRef.current) {
        const diff = unread - lastCountRef.current

        // Notification browser
        try {
          if (Notification.permission === 'granted') {
            const n = new Notification('Nouveau message', {
              body: `${diff} nouveau${diff > 1 ? 'x' : ''} message${diff > 1 ? 's' : ''} dans la boite unifiee`,
              icon: '/icons/icon-192.png',
              tag: 'vf-inbox',
            })
            n.onclick = () => { window.focus(); window.location.href = '/admin/inbox'; n.close() }
            setTimeout(() => n.close(), 8000)
          }
        } catch {}

        // Son de notification
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio('/sounds/notification.mp3')
            audioRef.current.volume = 0.5
          }
          audioRef.current.currentTime = 0
          audioRef.current.play().catch(() => {})
        } catch {}

        // Titre clignotant
        const origTitle = document.title
        let blink: ReturnType<typeof setInterval> | null = null
        let on = false
        blink = setInterval(() => {
          document.title = on ? `(${unread}) Nouveau message` : origTitle
          on = !on
        }, 1000)
        setTimeout(() => { if (blink) clearInterval(blink); document.title = origTitle }, 10000)

        // Dispatch event pour le badge FAB dialer
        window.dispatchEvent(new CustomEvent('vf:inbox-count', { detail: { count: unread } }))
      }

      lastCountRef.current = unread
    } catch {}
  }, [accessToken])

  useEffect(() => {
    if (!isAuth || !accessToken) return

    // Demander permission notification
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch {}

    checkNewMessages()
    pollRef.current = setInterval(checkNewMessages, POLL_INTERVAL)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isAuth, accessToken, checkNewMessages])
}
