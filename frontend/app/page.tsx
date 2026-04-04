'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, getDashboardRoute } from '@/store/authStore'

export default function Home() {
  const router = useRouter()
  const { isAuth, user } = useAuthStore()

  useEffect(() => {
    if (isAuth && user) {
      router.push(getDashboardRoute(user.role))
    } else {
      router.push('/login')
    }
  }, [isAuth, user, router])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          Vox<span className="text-purple-500">Flow</span>
        </h1>
        <p className="text-gray-400 text-sm animate-pulse">Chargement...</p>
      </div>
    </div>
  )
}
