"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/authApi"
import { createClient } from "@/lib/supabase/client"

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<"form" | "success">("form")
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState<"google" | "azure" | null>(null)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    name: "", email: "", password: "", orgName: "", plan: "STARTER",
  })

  // ── SSO OAuth handler (Google / Microsoft) ────────────────
  // Note: l'utilisateur SSO sera automatiquement créé avec un essai
  // 14 jours dans le backend via /sso-exchange (voir auth.service.ts).
  const handleSSO = async (provider: "google" | "azure") => {
    setError("")
    setSsoLoading(provider)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/callback`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === "google"
            ? { access_type: "offline", prompt: "consent" }
            : undefined,
        },
      })
      if (oauthError) {
        const providerLabel = provider === "google" ? "Google" : "Microsoft"
        if (oauthError.message?.toLowerCase().includes("not enabled") ||
            oauthError.message?.toLowerCase().includes("provider")) {
          setError(`${providerLabel} SSO n'est pas configuré. Activez-le dans Supabase → Authentication → Providers.`)
        } else {
          setError(`Erreur SSO ${providerLabel}: ${oauthError.message}`)
        }
        setSsoLoading(null)
      }
    } catch (err: any) {
      setError(err?.message || "Erreur de connexion SSO")
      setSsoLoading(null)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      // Note: role is forced to ADMIN server-side, no need to send it
      const res = await authApi.register({
        name:     form.name,
        email:    form.email,
        password: form.password,
        orgName:  form.orgName,
        plan:     form.plan,
      })
      if (res.success) {
        setStep("success")
      } else {
        setError(res.message || res.error || "Erreur lors de la création du compte")
      }
    } catch (err: any) {
      setError(err?.message || "Erreur de connexion au serveur")
    } finally {
      setLoading(false)
    }
  }

  // ── Écran de succès ────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111118] px-4">
        <div className="w-full max-w-md">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-[#7b61ff] shadow-[0_0_12px_#7b61ff]" />
              <span className="text-3xl font-bold">
                <span className="text-[#7b61ff]">Vox</span>
                <span className="text-[#00d4aa]">Flow</span>
              </span>
            </div>
            <p className="text-[#55557a] text-sm">Plateforme Call Center Pro</p>
          </div>

          {/* Card succès */}
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/30 flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-[#00d4aa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-xl font-bold text-[#eeeef8] mb-2">Compte créé !</h1>
            <p className="text-[#9898b8] text-sm mb-5">
              Votre essai gratuit de <span className="text-[#7b61ff] font-bold">14 jours</span> commence maintenant.
            </p>

            <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-4 py-3 mb-6 text-left">
              <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-1">
                Email de connexion
              </div>
              <div className="text-[#eeeef8] text-sm font-medium truncate">{form.email}</div>
            </div>

            <button
              onClick={() => router.push("/login")}
              className="w-full bg-[#7b61ff] hover:bg-[#6145ff] text-white font-bold py-3 rounded-xl text-sm transition-all"
            >
              Aller à la connexion
            </button>

            <p className="text-[10px] text-[#35355a] mt-4">
              Vous avez 14 jours pour explorer VoxFlow · Sans carte de crédit
            </p>
          </div>

        </div>
      </div>
    )
  }

  // ── Écran formulaire ───────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111118] px-4 py-8">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#7b61ff] shadow-[0_0_12px_#7b61ff]" />
            <span className="text-3xl font-bold">
              <span className="text-[#7b61ff]">Vox</span>
              <span className="text-[#00d4aa]">Flow</span>
            </span>
          </div>
          <p className="text-[#55557a] text-sm">Plateforme Call Center Pro</p>
        </div>

        {/* Badge trial */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="inline-flex items-center gap-2 bg-[#7b61ff]/10 border border-[#7b61ff]/30 rounded-full px-3 py-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#7b61ff]">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-[11px] font-bold text-[#7b61ff] uppercase tracking-wider">
              Essai gratuit 14 jours
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-[#eeeef8] mb-1">Créer un compte</h1>
          <p className="text-[#55557a] text-xs mb-6">
            Démarrez votre call center en moins de 2 minutes
          </p>

          {error && (
            <div className="bg-[rgba(255,77,109,.12)] border border-[rgba(255,77,109,.3)] rounded-lg px-4 py-3 mb-5 text-[#ff4d6d] text-sm font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">

            {/* Nom + Organisation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-1.5">
                  Votre nom
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jean Tremblay"
                  required
                  minLength={2}
                  className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-[#eeeef8] text-sm outline-none focus:border-[#7b61ff] transition-colors placeholder:text-[#35355a]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-1.5">
                  Entreprise
                </label>
                <input
                  value={form.orgName}
                  onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                  placeholder="Acme Inc."
                  required
                  minLength={2}
                  className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-[#eeeef8] text-sm outline-none focus:border-[#7b61ff] transition-colors placeholder:text-[#35355a]"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-1.5">
                Email professionnel
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vous@entreprise.com"
                required
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-[#eeeef8] text-sm outline-none focus:border-[#7b61ff] transition-colors placeholder:text-[#35355a]"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 caractères"
                  required
                  minLength={8}
                  className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 pr-10 text-[#eeeef8] text-sm outline-none focus:border-[#7b61ff] transition-colors placeholder:text-[#35355a]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#55557a] hover:text-[#9898b8] transition-colors"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Plan */}
            <div>
              <label className="block text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-1.5">
                Plan d'essai
              </label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-[#eeeef8] text-sm outline-none focus:border-[#7b61ff] transition-colors cursor-pointer"
              >
                <option value="STARTER">Starter — 99 $/mois · 5 agents</option>
                <option value="CONFORT">Confort — 199 $/mois · 15 agents</option>
                <option value="PRO">Pro — 299 $/mois · 25 agents</option>
                <option value="ENTERPRISE">Enterprise — 799 $/mois · 100 agents</option>
              </select>
              <p className="text-[10px] text-[#55557a] mt-1.5">
                Essai gratuit 14 jours · Changez ou annulez quand vous voulez
              </p>
            </div>

            {/* Conditions */}
            <p className="text-[10px] text-[#55557a] leading-relaxed">
              En créant un compte, vous acceptez nos{" "}
              <a href="/terms" className="text-[#7b61ff] hover:text-[#6145ff]">conditions d'utilisation</a>
              {" "}et notre{" "}
              <a href="/privacy" className="text-[#7b61ff] hover:text-[#6145ff]">politique de confidentialité</a>.
            </p>

            {/* Bouton créer */}
            <button
              type="submit"
              disabled={loading || ssoLoading !== null}
              className="w-full bg-[#7b61ff] hover:bg-[#6145ff] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Création en cours...
                </span>
              ) : "Démarrer mon essai gratuit"}
            </button>

          </form>

          {/* Séparateur SSO */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#2e2e44]" />
            <span className="text-[10px] text-[#55557a] font-bold uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-[#2e2e44]" />
          </div>

          {/* Boutons SSO */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleSSO("google")}
              disabled={loading || ssoLoading !== null}
              className="w-full flex items-center justify-center gap-3 bg-[#1f1f2a] border border-[#2e2e44] text-[#eeeef8] font-medium py-2.5 rounded-lg text-sm hover:bg-[#2e2e44] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {ssoLoading === "google" ? (
                <svg className="animate-spin w-4 h-4 text-[#7b61ff]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                </svg>
              )}
              <span>{ssoLoading === "google" ? "Redirection..." : "S'inscrire avec Google"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSSO("azure")}
              disabled={loading || ssoLoading !== null}
              className="w-full flex items-center justify-center gap-3 bg-[#1f1f2a] border border-[#2e2e44] text-[#eeeef8] font-medium py-2.5 rounded-lg text-sm hover:bg-[#2e2e44] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {ssoLoading === "azure" ? (
                <svg className="animate-spin w-4 h-4 text-[#7b61ff]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 23 23">
                  <path fill="#F35325" d="M1 1h10v10H1z" />
                  <path fill="#81BC06" d="M12 1h10v10H12z" />
                  <path fill="#05A6F0" d="M1 12h10v10H1z" />
                  <path fill="#FFBA08" d="M12 12h10v10H12z" />
                </svg>
              )}
              <span>{ssoLoading === "azure" ? "Redirection..." : "S'inscrire avec Microsoft"}</span>
            </button>
          </div>

          {/* Déjà un compte */}
          <div className="mt-6 pt-5 border-t border-[#2e2e44] text-center">
            <p className="text-xs text-[#9898b8]">
              Déjà un compte ?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-[#7b61ff] hover:text-[#6145ff] font-bold transition-colors"
              >
                Se connecter
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[#35355a] text-[10px] mt-4">
          © 2026 VNK Automatisation Inc. — Sans carte de crédit pour commencer
        </p>

      </div>
    </div>
  )
}
