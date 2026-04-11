"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { onboardingApi } from "@/lib/authApi"

const STEPS = [
  { num: 1, title: "Votre entreprise",  icon: "🏢" },
  { num: 2, title: "Votre numero",      icon: "📞" },
  { num: 3, title: "Premier agent",     icon: "👤" },
  { num: 4, title: "Configuration IVR", icon: "🔀" },
  { num: 5, title: "Finalisation",      icon: "🚀" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [mounted,     setMounted]     = useState(false)
  const [token,       setToken]       = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [numbers,     setNumbers]     = useState<any[]>([])

  const [step1Data, setStep1Data] = useState({ name: "", phone: "", website: "", city: "Montreal" })
  const [step2Data, setStep2Data] = useState({ selectedNumber: "" })
  const [step3Data, setStep3Data] = useState({ name: "", email: "", password: "VoxFlow123!" })
  const [step4Data, setStep4Data] = useState({ welcomeMessage: "Bienvenue. Appuyez sur 1 pour le support." })

  // Hydratation cote client uniquement
  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem("voxflow-auth")
      if (!raw) { window.location.href = "/login"; return }
      const parsed = JSON.parse(raw)
      const state  = parsed.state || parsed
      if (!state.accessToken || !state.isAuth) { window.location.href = "/login"; return }
      setToken(state.accessToken)
    } catch {
      window.location.href = "/login"
    }
  }, [])

  useEffect(() => {
    if (!token) return
    loadNumbers()
    loadStatus()
  }, [token])

  const loadStatus = async () => {
    if (!token) return
    try {
      const res = await onboardingApi.getStatus(token)
      if (res.success && res.data?.completed) { router.push("/admin/dashboard"); return }
      if (res.success && res.data?.current_step) {
        setCurrentStep(Math.min(res.data.current_step, 5))
      }
    } catch {}
  }

  const loadNumbers = async () => {
    if (!token) return
    try {
      const res = await onboardingApi.getNumbers(token, "CA")
      if (res.success) setNumbers(res.data.numbers || [])
    } catch {}
  }

  const handleNext = async () => {
    if (!token) return
    setError("")
    setLoading(true)
    try {
      let res: any
      switch (currentStep) {
        case 1: res = await onboardingApi.step1(token, step1Data); break
        case 2:
          if (!step2Data.selectedNumber) { setError("Choisissez un numero"); setLoading(false); return }
          res = await onboardingApi.step2(token, step2Data.selectedNumber); break
        case 3:
          if (!step3Data.name || !step3Data.email) { setError("Nom et email requis"); setLoading(false); return }
          res = await onboardingApi.step3(token, step3Data); break
        case 4: res = await onboardingApi.step4(token, step4Data); break
        case 5:
          res = await onboardingApi.step5(token)
          if (res?.success) { router.push("/admin/dashboard"); return }
          break
      }
      if (res?.success && currentStep < 5) setCurrentStep(currentStep + 1)
      else if (!res?.success) setError(res?.error || "Erreur")
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (!mounted || !token) {
    return (
      <div className="h-screen overflow-y-auto bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 animate-pulse text-sm">Chargement...</p>
      </div>
    )
  }

  const progress = ((currentStep - 1) / 4) * 100

  return (
    <div className="h-screen overflow-y-auto bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Vox<span className="text-purple-500">Flow</span></h1>
          <p className="text-gray-400 text-sm">Configuration de votre call center</p>
        </div>

        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-800 z-0"></div>
          <div className="absolute left-0 top-4 h-0.5 bg-purple-600 z-0 transition-all duration-500" style={{ width: progress + "%" }}></div>
          {STEPS.map((s) => (
            <div key={s.num} className="relative z-10 flex flex-col items-center gap-1">
              <div className={"w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all " + (
                s.num < currentStep ? "bg-purple-600 text-white" :
                s.num === currentStep ? "bg-purple-600 text-white ring-4 ring-purple-900" :
                "bg-gray-800 text-gray-500"
              )}>
                {s.num < currentStep ? "✓" : s.num}
              </div>
              <p className={"text-xs hidden sm:block " + (s.num === currentStep ? "text-white" : "text-gray-500")}>{s.title}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{STEPS[currentStep - 1].icon}</span>
            <h2 className="text-white font-semibold text-lg">{STEPS[currentStep - 1].title}</h2>
          </div>

          {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-4 text-sm">{error}</div>}

          {currentStep === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Nom entreprise</label>
                  <input value={step1Data.name} onChange={(e) => setStep1Data({ ...step1Data, name: e.target.value })}
                    placeholder="Acme Inc."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Telephone</label>
                  <input value={step1Data.phone} onChange={(e) => setStep1Data({ ...step1Data, phone: e.target.value })}
                    placeholder="+1 (514) 000-0000"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Ville</label>
                <input value={step1Data.city} onChange={(e) => setStep1Data({ ...step1Data, city: e.target.value })}
                  placeholder="Montreal"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <p className="text-gray-400 text-sm mb-3">Choisissez un numero pour votre call center :</p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {numbers.map((n) => (
                  <div key={n.phoneNumber} onClick={() => setStep2Data({ selectedNumber: n.phoneNumber })}
                    className={"p-3 rounded-lg border cursor-pointer transition-colors " + (
                      step2Data.selectedNumber === n.phoneNumber
                        ? "border-purple-600 bg-purple-900/20"
                        : "border-gray-700 hover:border-gray-600 bg-gray-800"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-mono">{n.friendlyName || n.phoneNumber}</p>
                        <p className="text-gray-500 text-xs">{n.locality}, {n.region}</p>
                      </div>
                      {step2Data.selectedNumber === n.phoneNumber && (
                        <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm mb-2">Creez votre premier agent :</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Nom complet</label>
                  <input value={step3Data.name} onChange={(e) => setStep3Data({ ...step3Data, name: e.target.value })}
                    placeholder="Marie Dupont"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Email</label>
                  <input type="email" value={step3Data.email} onChange={(e) => setStep3Data({ ...step3Data, email: e.target.value })}
                    placeholder="agent@entreprise.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Mot de passe initial</label>
                <input value={step3Data.password} onChange={(e) => setStep3Data({ ...step3Data, password: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Message d accueil</label>
                <textarea value={step4Data.welcomeMessage}
                  onChange={(e) => setStep4Data({ ...step4Data, welcomeMessage: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-gray-400 text-xs">
                Options auto-creees : 1 = Support, 0 = Operateur
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-white font-semibold text-lg mb-2">Votre call center est pret !</h3>
              <p className="text-gray-400 text-sm">Cliquez pour finaliser et acceder au dashboard.</p>
            </div>
          )}

          <div className="flex justify-between mt-6">
            {currentStep > 1 ? (
              <button onClick={() => setCurrentStep(currentStep - 1)}
                className="border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
              >
                Retour
              </button>
            ) : <div />}
            <button onClick={handleNext} disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-6 py-2 rounded-lg text-sm font-medium"
            >
              {loading ? "En cours..." : currentStep === 5 ? "Lancer mon call center" : "Continuer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
