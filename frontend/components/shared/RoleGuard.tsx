'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, getDashboardRoute } from '@/store/authStore'

interface Props {
    allowedRoles: string[]
    children: React.ReactNode
}

const DASHBOARD: Record<string, string> = {
    OWNER: '/owner/dashboard',
    ADMIN: '/admin/dashboard',
    SUPERVISOR: '/agent/dashboard',
    AGENT: '/agent/dashboard',
}

export default function RoleGuard({ allowedRoles, children }: Props) {
    const router = useRouter()
    const { isAuth, user } = useAuthStore()

    useEffect(() => {
        // Non connecté → login
        if (!isAuth || !user) {
            router.replace('/login')
            return
        }
        // Rôle non autorisé → son propre dashboard
        if (!allowedRoles.includes(user.role)) {
            router.replace(DASHBOARD[user.role] || '/login')
        }
    }, [isAuth, user])

    // Ne pas rendre si non autorisé
    if (!isAuth || !user) return null
    if (!allowedRoles.includes(user.role)) return null

    return <>{children}</>
}