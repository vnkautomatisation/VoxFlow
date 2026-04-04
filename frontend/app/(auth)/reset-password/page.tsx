"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { authApi } from "@/lib/authApi"

export default function ResetPasswordPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get("token") || ""

  const [password,  setPassword]  = useState("")
  const [password2, setPassword2] = useState("")
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== password2) return setError("Les mots de passe ne correspondent pas")
    if (password.length < 8) return setError("Minimum 8 caracteres")
    setError("")
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-red-400">Token invalide ou manquant.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">Vox<span className="text-purple-500">Flow</span></h1>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {done ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-white font-semibold mb-2">Mot de passe reinitialise !</h2>
              <button onClick={() => router.push("/login")}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm mt-3"
              >
                Se connecter
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white mb-5">Nouveau mot de passe</h2>
              {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nouveau mot de passe (min 8 car.)" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Confirmer le mot de passe" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
                <button type="submit" disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-2.5 rounded-lg text-sm font-medium"
                >
                  {loading ? "Reinitialisation..." : "Reinitialiser le mot de passe"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
