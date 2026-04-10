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
    // Problème: Supabase `signInWithOAuth` NE VÉRIFIE PAS si le provider
    // est activé. Si désactivé, le browser navigue vers une URL qui
    // retourne du JSON brut `{error_code:"validation_failed"}` au lieu
    // d'une redirect vers Google/MS.
    //
    // Solution: GET `/auth/v1/settings` (endpoint public avec CORS OK)
    // qui retourne `{external:{google:bool, azure:bool, ...}}`. On vérifie
    // AVANT de faire quoi que ce soit que le provider est activé.
    const handleSSO = async (provider: 'google' | 'azure') => {
        setError('')
        setSsoLoading(provider)

        const providerLabel = provider === 'google' ? 'Google' : 'Microsoft'
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            setError('Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL manquant)')
            setSsoLoading(null)
            return
        }

        try {
            // 1. Pré-vérification: le provider est-il activé dans Supabase ?
            //    L'endpoint /auth/v1/settings est public et retourne
            //    { external: { google: bool, azure: bool, ... } }
            let settingsChecked = false
            try {
                const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
                    method: 'GET',
                    headers: { 'apikey': supabaseKey },
                })
                if (settingsRes.ok) {
                    settingsChecked = true
                    const settings = await settingsRes.json()
                    const enabled = settings?.external?.[provider]
                    if (!enabled) {
                        setError(`${providerLabel} SSO n'est pas activé dans Supabase. Dashboard → Authentication → Providers → activer ${providerLabel} (il faut renseigner le Client ID + Client Secret).`)
                        setSsoLoading(null)
                        return
                    }
                } else if (settingsRes.status === 401) {
                    // Clé anon invalide / tronquée
                    setError('Clé Supabase anon invalide — vérifie NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local (peut-être tronquée).')
                    setSsoLoading(null)
                    return
                }
            } catch {
                // Erreur réseau sur settings → on tente quand même l'OAuth
            }

            // Si on n'a pas pu vérifier, on avertit dans le log console
            if (!settingsChecked) {
                console.warn('[SSO] Impossible de vérifier /auth/v1/settings — tentative OAuth directe')
            }

            // 2. Le provider est activé → on lance l'OAuth
            const supabase = createClient()

            // Préserver le ?redirect= à travers le round-trip OAuth.
            // Ex: /login?redirect=/admin/crm → Google → /callback?redirect=/admin/crm
            //     → /admin/crm après sync du JWT.
            const redirectParam = searchParams.get('redirect')
            const callbackBase = `${window.location.origin}/callback`
            const redirectTo = redirectParam
                ? `${callbackBase}?redirect=${encodeURIComponent(redirectParam)}`
                : callbackBase

            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo,
                    queryParams: provider === 'google'
                        ? { access_type: 'offline', prompt: 'consent' }
                        : undefined,
                },
            })

            if (oauthError) {
                setError(`Erreur SSO ${providerLabel}: ${oauthError.message}`)
                setSsoLoading(null)
            }
            // Si pas d'erreur → Supabase auto-redirect vers le provider
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