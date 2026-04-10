'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { authApi } from '@/lib/authApi'
import { useAuthStore, getDashboardRoute } from '@/store/authStore'

/**
 * /auth/callback — OAuth callback handler.
 *
 * Flow :
 *  1. Supabase redirects here after a successful Google/Microsoft OAuth.
 *     The URL contains `?code=...` (PKCE flow) or `#access_token=...` (implicit).
 *  2. We let the Supabase client exchange the code for a session (cookie-based).
 *  3. We read the session, extract the Supabase access_token and the provider.
 *  4. We call our backend /api/v1/auth/sso-exchange which:
 *     - Validates the Supabase token server-side
 *     - Creates or logs in our own user
 *     - Returns our JWT
 *  5. We store our JWT in authStore and redirect to the role-based dashboard.
 */
export default function OAuthCallbackPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { setAuth }  = useAuthStore()

  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [error,  setError]  = useState<string>('')

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient()

        // 1. Vérifier les erreurs OAuth retournées par le provider
        const errorParam       = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')
        if (errorParam) {
          throw new Error(errorDescription || errorParam)
        }

        // 2. Si on a un `code` dans l'URL → échanger pour une session (PKCE)
        const code = searchParams.get('code')
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw new Error('Erreur échange code: ' + exchangeError.message)
        }

        // 3. Récupérer la session active
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw new Error('Erreur session: ' + sessionError.message)

        const session = sessionData?.session
        if (!session?.access_token) {
          throw new Error('Aucune session active après OAuth')
        }

        // 4. Déterminer le provider depuis les app_metadata
        const rawProvider = (session.user?.app_metadata?.provider || '').toLowerCase()
        const provider: 'google' | 'azure' =
          rawProvider === 'google' ? 'google' :
          rawProvider === 'azure'  ? 'azure' :
          rawProvider === 'microsoft' ? 'azure' :
          'google' // Fallback

        // 5. Appeler notre backend pour l'exchange
        const res = await authApi.ssoExchange(session.access_token, provider)
        if (!res?.success || !res.data?.accessToken) {
          throw new Error(res?.message || res?.error || 'Échec de la connexion SSO')
        }

        // 6. Stocker notre JWT dans authStore + redirect
        setAuth(res.data.user, res.data.accessToken)

        // Nettoyer la session Supabase (on utilise notre propre JWT)
        await supabase.auth.signOut().catch(() => {})

        const redirect = searchParams.get('redirect')
        router.replace(redirect || getDashboardRoute(res.data.user.role))
      } catch (err: any) {
        console.error('[OAuth callback]', err)
        setError(err?.message || 'Erreur de connexion SSO')
        setStatus('error')
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── États UI ──────────────────────────────────────────────
  if (status === 'error') {
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

          {/* Card erreur */}
          <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-[rgba(255,77,109,.12)] border border-[rgba(255,77,109,.3)] flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-[#ff4d6d]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
              </svg>
            </div>

            <h1 className="text-xl font-bold text-[#eeeef8] mb-2">Connexion SSO échouée</h1>
            <p className="text-[#9898b8] text-sm mb-5">{error}</p>

            <button
              onClick={() => router.replace('/login')}
              className="w-full bg-[#7b61ff] hover:bg-[#6145ff] text-white font-bold py-3 rounded-xl text-sm transition-all"
            >
              Retour à la connexion
            </button>
          </div>

        </div>
      </div>
    )
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111118] px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#7b61ff] shadow-[0_0_12px_#7b61ff] animate-pulse" />
            <span className="text-3xl font-bold">
              <span className="text-[#7b61ff]">Vox</span>
              <span className="text-[#00d4aa]">Flow</span>
            </span>
          </div>
          <p className="text-[#55557a] text-sm">Plateforme Call Center Pro</p>
        </div>

        {/* Card loading */}
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl p-8 shadow-2xl text-center">
          <div className="flex items-center justify-center mb-5">
            <svg className="animate-spin w-10 h-10 text-[#7b61ff]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-[#eeeef8] mb-2">Connexion en cours...</h1>
          <p className="text-[#9898b8] text-sm">Authentification via votre fournisseur SSO</p>
        </div>

      </div>
    </div>
  )
}
