"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/authApi"

export default function ForgotPasswordPage() {
  const router  = useRouter()
  const [email,   setEmail]   = useState("")
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">Vox<span className="text-purple-500">Flow</span></h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-white font-semibold mb-2">Email envoye !</h2>
              <p className="text-gray-400 text-sm mb-4">Si cet email existe, un lien de reinitialisation a ete envoye.</p>
              <button onClick={() => router.push("/login")} className="text-purple-400 hover:text-purple-300 text-sm">
                Retour a la connexion
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Mot de passe oublie</h2>
              <p className="text-gray-400 text-sm mb-5">Entrez votre email pour recevoir un lien de reinitialisation.</p>

              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <button type="submit" disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-2.5 rounded-lg text-sm font-medium"
                >
                  {loading ? "Envoi..." : "Envoyer le lien"}
                </button>
              </form>

              <button onClick={() => router.push("/login")} className="block text-center text-gray-500 text-sm mt-4 hover:text-gray-400">
                Retour a la connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
