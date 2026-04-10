'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore, getDashboardRoute } from '@/store/authStore'
import { authApi } from '@/lib/authApi'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { setAuth, isAuth, user } = useAuthStore()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [remember, setRemember] = useState(false)
    const [loading, setLoading] = useState(false)
    const [ssoLoading, setSsoLoading] = useState<'google' | 'azure' | null>(null)
    const [error, setError] = useState('')

    // Charger les credentials sauvegardés
    useEffect(() => {
        try {
            const saved = localStorage.getItem('vf_remember')
            if (saved) {
                const { email: e, password: p } = JSON.parse(saved)
                setEmail(e || '')
                setPassword(p || '')
                setRemember(true)
            }
        } catch { }
    }, [])

    // Si déjà connecté → rediriger
    useEffect(() => {
        if (isAuth && user) {
            const redirect = searchParams.get('redirect')
            const target = redirect || getDashboardRoute(user.role)
            window.location.href = target
        }
    }, [isAuth, user])

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        setLoading(true)
        setError('')
        try {
            const res = await authApi.login(email, password)
            if (res.success && res.data?.accessToken) {
                // Sauvegarder ou effacer les credentials
                if (remember) {
                    localStorage.setItem('vf_remember', JSON.stringify({ email, password }))
                } else {
                    localStorage.removeItem('vf_remember')
                }
                setAuth(res.data.user, res.data.accessToken)
                const redirect = searchParams.get('redirect')
                const target = redirect || getDashboardRoute(res.data.user.role)
                // Attendre que la cookie HTTP-only soit écrite avant la nav
                // (sinon race condition : middleware voit pas encore le token
                // et bounce vers /login). Un micro-délai suffit.
                await new Promise(r => setTimeout(r, 150))
                // Hard navigation pour garantir un fresh middleware check
                window.location.href = target
            } else {
                setError(res.message || 'Identifiants incorrects')
            }
        } catch {
            setError('Erreur de connexion au serveur')
        } finally {
            setLoading(false)
        }
    }

    // ── SSO OAuth handler (Google / Microsoft) ────────────────
    //
    // Supabase JS `signInWithOAuth` construit une URL vers
    // /auth/v1/authorize?provider=X mais NE VÉRIFIE PAS si le provider
    // est activé côté Supabase. Si désactivé, le browser navigue vers
    // cette URL qui retourne du JSON `{error_code:"validation_failed"}`
    // et l'utilisateur voit la réponse brute, pas notre message d'erreur.
    //
    // Solution: preflight GET sur l'URL Supabase avec `redirect: manual`,
    // détecter le 400 et afficher un message clair AVANT de rediriger.
    const handleSSO = async (provider: 'google' | 'azure') => {
        setError('')
        setSsoLoading(provider)

        const providerLabel = provider === 'google' ? 'Google' : 'Microsoft'

        try {
            const supabase = createClient()

            // Préserver le ?redirect= à travers le round-trip OAuth.
            // Ex: /login?redirect=/admin/crm → Google → /callback?redirect=/admin/crm
            //     → /admin/crm après sync du JWT.
            const redirectParam = searchParams.get('redirect')
            const callbackBase = `${window.location.origin}/callback`
            const redirectTo = redirectParam
                ? `${callbackBase}?redirect=${encodeURIComponent(redirectParam)}`
                : callbackBase

            // 1. Construire l'URL OAuth via Supabase SDK (skipBrowserRedirect)
            const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo,
                    skipBrowserRedirect: true, // ← on contrôle la nav nous-mêmes
                    queryParams: provider === 'google'
                        ? { access_type: 'offline', prompt: 'consent' }
                        : undefined,
                },
            })

            if (oauthError || !data?.url) {
                const msg = (oauthError?.message || '').toLowerCase()
                if (msg.includes('not enabled') || msg.includes('unsupported provider')) {
                    setError(`${providerLabel} SSO n'est pas activé dans Supabase. Dashboard → Authentication → Providers → activer ${providerLabel}.`)
                } else {
                    setError(`Erreur SSO ${providerLabel}: ${oauthError?.message || 'URL OAuth indisponible'}`)
                }
                setSsoLoading(null)
                return
            }

            // 2. Preflight: fetch l'URL Supabase pour détecter le 400 "not enabled"
            //    Si activé → Supabase retourne 302 (opaqueredirect via CORS)
            //    Si désactivé → Supabase retourne 400 avec JSON lisible
            try {
                const preflight = await fetch(data.url, { method: 'GET', redirect: 'manual' })
                if (preflight.status === 400) {
                    const body = await preflight.json().catch(() => null)
                    const errMsg = body?.msg || body?.error_description || body?.error || 'Provider non configuré'
                    if (errMsg.toLowerCase().includes('not enabled') ||
                        errMsg.toLowerCase().includes('unsupported provider')) {
                        setError(`${providerLabel} SSO n'est pas activé dans Supabase. Dashboard → Authentication → Providers → activer ${providerLabel} (il faut aussi renseigner le Client ID + Secret).`)
                    } else {
                        setError(`Erreur SSO ${providerLabel}: ${errMsg}`)
                    }
                    setSsoLoading(null)
                    return
                }
                // status 0/opaqueredirect/302 → OK, provider activé, on navigue
            } catch {
                // Si preflight échoue (CORS, réseau), on tente la redirection
                // quand même — l'utilisateur verra l'erreur Supabase sinon.
            }

            // 3. Navigation manuelle vers l'URL OAuth
            window.location.href = data.url
        } catch (err: any) {
            setError(err?.message || 'Erreur de connexion SSO')
            setSsoLoading(null)
        }
    }

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

                {/* Card */}
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl p-8 shadow-2xl">
                    <h1 className="text-xl font-bold text-[#eeeef8] mb-6">Connexion</h1>

                    {error && (
                        <div className="bg-[rgba(255,77,109,.12)] border border-[rgba(255,77,109,.3)] rounded-lg px-4 py-3 mb-5 text-[#ff4d6d] text-sm font-semibold">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Email */}
                        <div>
                            <label className="block text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="agent@company.com"
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
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
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

                        {/* Se souvenir + Mot de passe oublié */}
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div
                                    onClick={() => setRemember(!remember)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${remember
                                            ? 'bg-[#7b61ff] border-[#7b61ff]'
                                            : 'bg-[#1f1f2a] border-[#2e2e44] group-hover:border-[#7b61ff]'
                                        }`}
                                >
                                    {remember && (
                                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-xs text-[#9898b8] group-hover:text-[#eeeef8] transition-colors">
                                    Se souvenir de moi
                                </span>
                            </label>
                            <a href="/forgot-password" className="text-xs text-[#7b61ff] hover:text-[#6145ff] transition-colors">
                                Mot de passe oublié ?
                            </a>
                        </div>

                        {/* Bouton connexion */}
                        <button
                            type="submit"
                            disabled={loading || ssoLoading !== null}
                            className="w-full bg-[#7b61ff] hover:bg-[#6145ff] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Connexion...
                                </span>
                            ) : 'Se connecter'}
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
                            onClick={() => handleSSO('google')}
                            disabled={loading || ssoLoading !== null}
                            className="w-full flex items-center justify-center gap-3 bg-[#1f1f2a] border border-[#2e2e44] text-[#eeeef8] font-medium py-2.5 rounded-lg text-sm hover:bg-[#2e2e44] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {ssoLoading === 'google' ? (
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
                            <span>{ssoLoading === 'google' ? 'Redirection...' : 'Continuer avec Google'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSSO('azure')}
                            disabled={loading || ssoLoading !== null}
                            className="w-full flex items-center justify-center gap-3 bg-[#1f1f2a] border border-[#2e2e44] text-[#eeeef8] font-medium py-2.5 rounded-lg text-sm hover:bg-[#2e2e44] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {ssoLoading === 'azure' ? (
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
                            <span>{ssoLoading === 'azure' ? 'Redirection...' : 'Continuer avec Microsoft'}</span>
                        </button>
                    </div>

                    {/* CTA Register trial */}
                    <div className="mt-6 pt-5 border-t border-[#2e2e44] text-center">
                        <p className="text-xs text-[#9898b8]">
                            Nouveau sur VoxFlow ?{' '}
                            <a href="/register" className="text-[#7b61ff] hover:text-[#6145ff] font-bold transition-colors">
                                Essai gratuit 14 jours
                            </a>
                        </p>
                        <p className="text-[10px] text-[#35355a] mt-2">
                            Sans carte de crédit · Annulation à tout moment
                        </p>
                    </div>
                </div>

            </div>
        </div>
    )
}