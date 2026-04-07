'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore, getDashboardRoute } from '@/store/authStore'
import { authApi } from '@/lib/authApi'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { setAuth, isAuth, user } = useAuthStore()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [remember, setRemember] = useState(false)
    const [loading, setLoading] = useState(false)
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
            router.replace(redirect || getDashboardRoute(user.role))
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
                router.replace(redirect || getDashboardRoute(res.data.user.role))
            } else {
                setError(res.message || 'Identifiants incorrects')
            }
        } catch {
            setError('Erreur de connexion au serveur')
        } finally {
            setLoading(false)
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
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-[#eeeef8] text-sm outline-none focus:border-[#7b61ff] transition-colors placeholder:text-[#35355a]"
                            />
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
                            disabled={loading}
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

                    {/* Séparateur + info rôles */}
                    <div className="mt-6 pt-5 border-t border-[#2e2e44]">
                        <p className="text-[10px] text-[#35355a] text-center">
                            L'accès est limité selon votre rôle (Owner · Admin · Agent)
                        </p>
                    </div>
                </div>

            </div>
        </div>
    )
}