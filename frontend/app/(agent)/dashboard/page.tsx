'use client'

import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AgentDashboard() {
  const { user, isAuth, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuth) router.push('/login')
  }, [isAuth, router])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">
            Vox<span className="text-blue-500">Flow</span>
            <span className="text-gray-500 text-lg font-normal ml-3">Agent</span>
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-green-400 text-sm">Disponible</span>
            </div>
            <p className="text-gray-400 text-sm">{user.name}</p>
            <button
              onClick={() => { logout(); router.push('/login') }}
              className="border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Softphone placeholder */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center mb-4">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">Softphone WebRTC</p>
          <p className="text-gray-600 text-xs mt-1">Phase 4 — À venir</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-2">Interface Agent</h2>
          <p className="text-gray-400 text-sm">Phase 4 — Softphone WebRTC + CRM à venir</p>
        </div>

      </div>
    </div>
  )
}
