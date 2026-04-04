"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { ownerApi } from "@/lib/ownerApi"

interface Props {
  onClose:   () => void
  onSuccess: () => void
}

export default function CreateAdminModal({ onClose, onSuccess }: Props) {
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [form, setForm] = useState({
    name:     "",
    email:    "",
    password: "VoxFlow123!",
    orgName:  "",
    plan:     "STARTER",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await ownerApi.createAdmin(accessToken!, form)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Nouvel admin</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">x</button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Nom complet</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Nom de l entreprise</label>
            <input
              value={form.orgName}
              onChange={(e) => setForm({ ...form, orgName: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Plan</label>
            <select
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="STARTER">Starter — 99 $/mois</option>
              <option value="PRO">Pro — 299 $/mois</option>
              <option value="ENTERPRISE">Enterprise — 799 $/mois</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Mot de passe initial</label>
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-700 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-2 rounded-lg text-sm font-medium"
            >
              {loading ? "Creation..." : "Creer le compte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
