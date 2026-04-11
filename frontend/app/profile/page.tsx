"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { authApi } from "@/lib/authApi"
import { getDashboardRoute } from "@/store/authStore"
import { Shield } from "lucide-react"

export default function ProfilePage() {
  const { user, isAuth, accessToken } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState("")
  const [form, setForm] = useState({
    name: "", phone: "", timezone: "America/Toronto", language: "fr"
  })

  useEffect(() => {
    if (!isAuth || !user) { router.push("/login"); return }
    setForm({
      name:     user.name     || "",
      phone:    (user as any).phone    || "",
      timezone: (user as any).timezone || "America/Toronto",
      language: (user as any).language || "fr",
    })
  }, [user, isAuth])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await authApi.updateProfile(accessToken!, form)
      if (res.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (!user) return null

  return (
    <div className="h-screen overflow-y-auto bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push(getDashboardRoute(user.role))}
            className="text-gray-400 hover:text-white text-sm"
          >
            Dashboard
          </button>
          <span className="text-gray-700">/</span>
          <h1 className="text-white font-semibold">Mon profil</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center text-purple-300 text-2xl font-bold">
              {user.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{user.name}</p>
              <p className="text-gray-400 text-sm">{user.email}</p>
              <span className="text-xs bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full mt-1 inline-block">{user.role}</span>
            </div>
          </div>

          {error  && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}
          {saved  && <div className="bg-green-900/30 border border-green-800 text-green-300 rounded-lg px-3 py-2 mb-4 text-sm">Profil sauvegarde !</div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nom complet</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Telephone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (514) 000-0000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Fuseau horaire</label>
                <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="America/Toronto">Est (Toronto / Montreal)</option>
                  <option value="America/Vancouver">Pacifique (Vancouver)</option>
                  <option value="America/New_York">Est (New York)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Langue</label>
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="fr">Francais</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                {loading ? "Sauvegarde..." : "Sauvegarder le profil"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <p className="text-white font-medium text-sm mb-1">Email</p>
          <p className="text-gray-400 text-sm">{user.email}</p>
          <p className="text-gray-600 text-xs mt-1">L email ne peut pas etre change. Contactez le support.</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <button
            onClick={() => router.push("/profile/security")}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-900/50 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Securite du compte</p>
                <p className="text-gray-500 text-xs">2FA, sessions, journal d activite</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
