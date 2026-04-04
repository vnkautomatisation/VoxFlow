'use client'

import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function OwnerDashboard() {
  const { user, isAuth, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuth || user?.role !== 'OWNER') {
      router.push('/login')
    }
  }, [isAuth, user, router])

  const handleLogout = async () => {
    logout()
    router.push('/login')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Vox<span className="text-purple-500">Flow</span>
              <span className="text-gray-500 text-lg font-normal ml-3">Owner</span>
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">VNK Automatisation Inc.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white text-sm font-medium">{user.name}</p>
              <p className="text-purple-400 text-xs">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="border border-gray-700 hover:border-gray-500 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Métriques */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Admins actifs',    value: '0',     color: 'text-purple-400' },
            { label: 'Agents total',     value: '0',     color: 'text-blue-400' },
            { label: 'MRR',             value: '0 $',   color: 'text-green-400' },
            { label: 'Appels ce mois',  value: '0',     color: 'text-amber-400' },
          ].map((m) => (
            <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-wide">{m.label}</p>
              <p className={	ext-2xl font-bold }>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Contenu */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Phase 1 — Authentification ✅</h2>
          <div className="space-y-2">
            {[
              '✅ Backend Express opérationnel',
              '✅ Frontend Next.js opérationnel',
              '✅ JWT + Rôles configurés',
              '✅ Supabase connecté',
              '⏳ Phase 2 — Dashboard Owner complet (à venir)',
              '⏳ Phase 3 — Gestion agents et IVR',
              '⏳ Phase 4 — Softphone WebRTC',
            ].map((item) => (
              <p key={item} className="text-gray-400 text-sm">{item}</p>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
