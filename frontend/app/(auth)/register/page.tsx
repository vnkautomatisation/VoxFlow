"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/authApi"

export default function RegisterPage() {
  const router = useRouter()
  const [step,    setStep]    = useState<"form"|"success">("form")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [form, setForm] = useState({
    name: "", email: "", password: "", orgName: "", plan: "STARTER"
  })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await authApi.register({
        name:     form.name,
        email:    form.email,
        password: form.password,
        orgName:  form.orgName,
        plan:     form.plan,
        role:     "ADMIN",
      })
      setStep("success")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Compte cree !</h1>
          <p className="text-gray-400 mb-6">Verifiez votre email pour activer votre compte.</p>
          <p className="text-gray-500 text-sm mb-6">Un email a ete envoye a <span className="text-white">{form.email}</span></p>
          <button onClick={() => router.push("/login")}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            Aller a la connexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-1">
            Vox<span className="text-purple-500">Flow</span>
          </h1>
          <p className="text-gray-400 text-sm">Creer votre call center</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Creer un compte</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-2 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Votre nom</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jean Tremblay" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nom de l entreprise</label>
                <input value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                  placeholder="Acme Inc." required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Email professionnel</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vous@entreprise.com" required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Mot de passe</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 8 caracteres" required minLength={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Plan</label>
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="STARTER">Starter — 99 $/mois (5 agents)</option>
                <option value="PRO">Pro — 299 $/mois (25 agents)</option>
                <option value="ENTERPRISE">Enterprise — 799 $/mois (100 agents)</option>
              </select>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-2.5 rounded-lg text-sm font-medium mt-1"
            >
              {loading ? "Creation..." : "Creer mon call center"}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-4">
            Deja un compte ?{" "}
            <button onClick={() => router.push("/login")} className="text-purple-400 hover:text-purple-300">
              Se connecter
            </button>
          </p>
        </div>

        <p className="text-center text-gray-700 text-xs mt-4">
          2026 VNK Automatisation Inc. — Aucune carte requise pour commencer
        </p>
      </div>
    </div>
  )
}
