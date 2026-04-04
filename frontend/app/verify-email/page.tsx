"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { authApi } from "@/lib/authApi"

export default function VerifyEmailPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get("token") || ""
  const [status, setStatus] = useState<"loading"|"success"|"error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("Token manquant"); return }
    authApi.verifyEmail(token).then((res) => {
      if (res.success) { setStatus("success"); setMessage("Email verifie avec succes !") }
      else { setStatus("error"); setMessage(res.error || "Erreur de verification") }
    }).catch((err) => {
      setStatus("error"); setMessage(err.message)
    })
  }, [token])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-6">Vox<span className="text-purple-500">Flow</span></h1>
        {status === "loading" && <p className="text-gray-400 animate-pulse">Verification en cours...</p>}
        {status === "success" && (
          <div>
            <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-400 font-semibold mb-4">{message}</p>
            <button onClick={() => router.push("/login")}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm"
            >
              Se connecter
            </button>
          </div>
        )}
        {status === "error" && (
          <div>
            <p className="text-red-400 mb-4">{message}</p>
            <button onClick={() => router.push("/login")} className="text-purple-400 hover:text-purple-300 text-sm">
              Retour a la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
