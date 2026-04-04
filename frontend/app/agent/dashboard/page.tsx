"use client"

import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AgentDashboard() {
  const { user, isAuth, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuth) router.push("/login")
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
              onClick={() => { logout(); router.push("/login") }}
              className="border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm"
            >
              Deconnexion
            </button>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center mb-4">
          <p className="text-gray-400 text-sm">Softphone WebRTC</p>
          <p className="text-gray-600 text-xs mt-1">Phase 4 a venir</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-2">Interface Agent</h2>
          <p className="text-gray-400 text-sm">Phase 4 — Softphone WebRTC + CRM a venir</p>
        </div>
      </div>
    </div>
  )
}
