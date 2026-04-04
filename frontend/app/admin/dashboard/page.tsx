"use client"

import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminDashboard() {
  const { user, isAuth, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuth) router.push("/login")
    if (user?.role === "OWNER") router.push("/owner/dashboard")
  }, [isAuth, user, router])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">
            Vox<span className="text-teal-500">Flow</span>
            <span className="text-gray-500 text-lg font-normal ml-3">Admin</span>
          </h1>
          <div className="flex items-center gap-4">
            <p className="text-white text-sm">{user.name}</p>
            <button
              onClick={() => { logout(); router.push("/login") }}
              className="border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm"
            >
              Deconnexion
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Agents", value: "0", color: "text-teal-400" },
            { label: "Files attente", value: "0", color: "text-blue-400" },
            { label: "Appels actifs", value: "0", color: "text-green-400" },
          ].map((m) => (
            <div key={m.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-500 text-xs mb-2">{m.label}</p>
              <p className={"text-2xl font-bold " + m.color}>{m.value}</p>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-2">Dashboard Admin</h2>
          <p className="text-gray-400 text-sm">Phase 3 a venir — Gestion agents et IVR</p>
        </div>
      </div>
    </div>
  )
}
