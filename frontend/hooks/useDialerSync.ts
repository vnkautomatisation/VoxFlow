'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export function useDialerSync() {
    const { accessToken, isAuth, user } = useAuthStore()

    useEffect(() => {
        if (isAuth && accessToken && user) {
            // Portail connecté → synchroniser le dialer
            try {
                localStorage.setItem('vf_tok', accessToken)
                localStorage.setItem('vf_url', API_URL)
                localStorage.setItem('vf_role', user.role)
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
            }).catch(() => { }) // Electron peut ne pas tourner

        } else if (!isAuth) {
            // Portail déconnecté → déconnecter le dialer
            try {
                localStorage.removeItem('vf_tok')
                localStorage.removeItem('vf_role')
            } catch { }

            // Notifier Electron
            fetch('http://127.0.0.1:9876/auth-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'logout' })
            }).catch(() => { })
        }
    }, [isAuth, accessToken, user])
}