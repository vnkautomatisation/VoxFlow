'use client'
import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const HEARTBEAT_INTERVAL = 30_000 // 30 secondes

export function useDialerSync() {
    const { accessToken, isAuth, user } = useAuthStore()
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (isAuth && accessToken && user) {
            // Portail connecte → synchroniser le dialer
            try {
                localStorage.setItem('vf_tok', accessToken)
                localStorage.setItem('vf_url', API_URL)
                localStorage.setItem('vf_role', user.role)
                if ((user as any).extension) localStorage.setItem('vf_ext', (user as any).extension)
                else localStorage.removeItem('vf_ext')
                if (user.name) localStorage.setItem('vf_name', user.name)
            } catch { }

            // Notifier Electron via port 9876
            fetch('http://127.0.0.1:9876/auth-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'login',
                    token: accessToken,
                    role: user.role,
                    email: user.email,
                    url: API_URL,
                })
            }).catch(() => { })

            // Heartbeat presence — ping le backend toutes les 30s
            const sendHeartbeat = () => {
                fetch(API_URL + '/api/v1/supervision/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
                    body: JSON.stringify({ status: 'ONLINE' }),
                }).then(() => {
                    // Notifier le dialer iframe de recharger ses donnees
                    const iframe = document.querySelector('iframe[title="VoxFlow Dialer"]') as HTMLIFrameElement
                    if (iframe?.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'vf:refresh' }, '*')
                    }
                }).catch(() => { })
            }
            sendHeartbeat()
            setTimeout(sendHeartbeat, 3000)
            heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

        } else if (!isAuth) {
            // Portail deconnecte → deconnecter le dialer
            try {
                localStorage.removeItem('vf_tok')
                localStorage.removeItem('vf_role')
            } catch { }

            fetch('http://127.0.0.1:9876/auth-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'logout' })
            }).catch(() => { })

            // Arreter le heartbeat
            if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
        }

        return () => {
            if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null }
        }
    }, [isAuth, accessToken, user])
}