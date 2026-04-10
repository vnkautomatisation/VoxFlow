"use client"

import { useEffect, useState, useCallback } from "react"
import { integrationsApi } from "@/lib/integrationsApi"
import APIKeysPanel from "@/components/integrations/APIKeysPanel"
import WebhooksPanel from "@/components/integrations/WebhooksPanel"
import CRMIntegrations from "@/components/integrations/CRMIntegrations"

type Tab = "crm" | "webhooks" | "apikeys" | "docs"

// ── SVG Icons officiels des intégrations ──────────────────────
const INTEGRATION_ICONS: Record<string, React.ReactNode> = {
  HUBSPOT: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.164 7.33V5.02a1.56 1.56 0 00.895-1.405V3.58a1.56 1.56 0 00-1.557-1.557h-.036A1.56 1.56 0 0015.91 3.58v.036a1.56 1.56 0 00.895 1.404V7.33a4.43 4.43 0 00-2.104 1.224L7.13 3.27a1.73 1.73 0 00.044-.373 1.738 1.738 0 10-1.738 1.738c.208 0 .406-.038.59-.104l7.434 5.187a4.43 4.43 0 00-.582 2.185 4.43 4.43 0 00.673 2.346l-2.26 2.26a1.43 1.43 0 00-.41-.063 1.44 1.44 0 101.44 1.44 1.43 1.43 0 00-.063-.41l2.23-2.23a4.45 4.45 0 002.72.924 4.46 4.46 0 000-8.914zm0 6.57a2.115 2.115 0 110-4.23 2.115 2.115 0 010 4.23z" fill="#FF7A59"/>
    </svg>
  ),
  SALESFORCE: (
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.05 4.8a3.9 3.9 0 012.9-1.3 3.94 3.94 0 013.55 2.26 2.9 2.9 0 011.1-.22 2.95 2.95 0 012.95 2.95 2.95 2.95 0 01-.2 1.07 2.63 2.63 0 01.55 1.62 2.65 2.65 0 01-2.65 2.65 2.6 2.6 0 01-.43-.04 2.35 2.35 0 01-2.1 1.32 2.3 2.3 0 01-.97-.21 3.14 3.14 0 01-2.97 2.12 3.16 3.16 0 01-3-2.2 2.66 2.66 0 01-.52.05 2.7 2.7 0 01-2.7-2.7 2.7 2.7 0 01.75-1.87 2.2 2.2 0 01-.22-1A2.25 2.25 0 018.3 8.97a2.22 2.22 0 01.5.06 3.9 3.9 0 011.25-4.23z" fill="#00A1E0"/>
    </svg>
  ),
  ZAPIER: (
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.983 14.923l-4.26 4.26a1.4 1.4 0 01-1.98-1.98l4.26-4.26H4.22a1.4 1.4 0 010-2.8h5.783l-4.26-4.26a1.4 1.4 0 011.98-1.98l4.26 4.26V2.4a1.4 1.4 0 012.8 0v5.763l4.26-4.26a1.4 1.4 0 011.98 1.98l-4.26 4.26H22a1.4 1.4 0 010 2.8h-5.237l4.26 4.26a1.4 1.4 0 01-1.98 1.98l-4.26-4.26v5.42a1.4 1.4 0 01-2.8 0v-5.42z" fill="#FF4A00"/>
    </svg>
  ),
  ZENDESK: (
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.5 2C6.26 2 2 6.26 2 11.5S6.26 21 11.5 21 21 16.74 21 11.5 16.74 2 11.5 2zm-1.2 14.5L6 10.5h8.6l-4.3 6zm2.4-8.5l4.3-6h-8.6l4.3 6z" fill="#03363D"/>
    </svg>
  ),
  GOOGLE_CALENDAR: (
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H5V9h12v12zM5 7V5h14v2H5z" fill="#4285F4"/>
      <path d="M7 11h4v4H7z" fill="#34A853"/>
      <path d="M13 11h4v2h-4z" fill="#FBBC04"/>
      <path d="M13 15h4v2h-4z" fill="#EA4335"/>
    </svg>
  ),
  SLACK: (
    <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#E01E5A"/>
    </svg>
  ),
}

const INTEGRATIONS_CATALOG = [
  { type: "HUBSPOT",         get svgIcon() { return INTEGRATION_ICONS.HUBSPOT         }, name: "HubSpot",         desc: "Synchroniser contacts et deals",   category: "CRM" },
  { type: "SALESFORCE",      get svgIcon() { return INTEGRATION_ICONS.SALESFORCE      }, name: "Salesforce",      desc: "CRM enterprise Salesforce",        category: "CRM" },
  { type: "ZENDESK",         get svgIcon() { return INTEGRATION_ICONS.ZENDESK         }, name: "Zendesk",         desc: "Tickets support Zendesk",          category: "Support" },
  { type: "ZAPIER",          get svgIcon() { return INTEGRATION_ICONS.ZAPIER          }, name: "Zapier",          desc: "Automatiser avec 5000+ apps",      category: "Automation" },
  { type: "GOOGLE_CALENDAR", get svgIcon() { return INTEGRATION_ICONS.GOOGLE_CALENDAR }, name: "Google Calendar", desc: "Synchroniser les rendez-vous",     category: "Productivité" },
  { type: "SLACK",           get svgIcon() { return INTEGRATION_ICONS.SLACK           }, name: "Slack",           desc: "Notifications dans Slack",         category: "Communication" },
]

export default function IntegrationsPage() {
  const [token,        setToken]        = useState<string | null>(null)
  const [mounted,      setMounted]      = useState(false)
  const [activeTab,    setActiveTab]    = useState<Tab>("crm")
  const [integrations, setIntegrations] = useState<any[]>([])
  const [apiKeys,      setApiKeys]      = useState<any[]>([])
  const [webhooks,     setWebhooks]     = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem("voxflow-auth")
      if (!raw) { window.location.href = "/login"; return }
      const parsed = JSON.parse(raw)
      const state  = parsed.state || parsed
      if (!state.accessToken) { window.location.href = "/login"; return }
      setToken(state.accessToken)
    } catch { window.location.href = "/login" }
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [intRes, keysRes, whRes] = await Promise.all([
        integrationsApi.getIntegrations(token),
        integrationsApi.getKeys(token),
        integrationsApi.getWebhooks(token),
      ])
      if (intRes.success)  setIntegrations(Array.isArray(intRes.data)  ? intRes.data  : [])
      if (keysRes.success) setApiKeys(Array.isArray(keysRes.data)      ? keysRes.data : [])
      if (whRes.success)   setWebhooks(Array.isArray(whRes.data)       ? whRes.data   : [])
    } catch {}
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [token])

  if (!mounted || !token) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-[#55557a] animate-pulse text-sm">Chargement...</p>
    </div>
  )

  const connectedTypes = integrations.filter((i) => i.status === "ACTIVE").map((i) => i.type)
  const activeCount    = connectedTypes.length
  const activeWebhooks = webhooks.filter((w) => w.is_active).length

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "crm",      label: "Intégrations", count: activeCount },
    { id: "webhooks", label: "Webhooks",     count: webhooks.length },
    { id: "apikeys",  label: "Clés API",     count: apiKeys.length },
    { id: "docs",     label: "Documentation" },
  ]

  return (
    <div className="h-[calc(100vh-49px)] overflow-hidden flex flex-col">
      <div className="max-w-7xl w-full mx-auto px-6 pt-6 flex-shrink-0">

        {/* Header fixe */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#eeeef8]">Intégrations & API</h1>
            <div className="text-xs text-[#55557a] mt-0.5">
              {activeCount} intégration{activeCount !== 1 ? "s" : ""} active{activeCount !== 1 ? "s" : ""}
              {" · "}
              {activeWebhooks}/{webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""} actif{activeWebhooks !== 1 ? "s" : ""}
              {" · "}
              {apiKeys.length} clé{apiKeys.length !== 1 ? "s" : ""} API
            </div>
          </div>
        </div>

        {/* Tabs fixes */}
        <div className="flex gap-1 border-b border-[#2e2e44]">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${
                activeTab === t.id
                  ? "text-[#eeeef8] border-[#7b61ff]"
                  : "text-[#55557a] border-transparent hover:text-[#9898b8]"
              }`}
            >
              {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Zone contenu scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-[#55557a] text-sm animate-pulse">Chargement...</p>
            </div>
          ) : (
            <>
              {activeTab === "crm" && (
                <CRMIntegrations
                  token={token}
                  catalog={INTEGRATIONS_CATALOG}
                  integrations={integrations}
                  connectedTypes={connectedTypes}
                  onRefresh={load}
                />
              )}
              {activeTab === "webhooks" && (
                <WebhooksPanel token={token} webhooks={webhooks} onRefresh={load} />
              )}
              {activeTab === "apikeys" && (
                <APIKeysPanel token={token} apiKeys={apiKeys} onRefresh={load} />
              )}
              {activeTab === "docs" && (
                <APIDocs />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Documentation API ─────────────────────────────────────────
// IMPORTANT: seuls les endpoints CLIENT-FACING sont listés ici.
// Les webhooks internes (Twilio, SendGrid, Mailgun, TwiML handlers)
// sont configurés par VoxFlow côté infrastructure et ne sont PAS
// appelables par les clients. Les exposer dans cette doc révélerait
// notre architecture et augmenterait la surface d'attaque.
function APIDocs() {
  // API publique — protégée par clé API (vf_...)
  const publicApi = [
    { method: "GET",  path: "/api/v1/integrations/v2/calls",     desc: "Liste de vos appels (filtrés par votre organisation)",   auth: "API Key" },
    { method: "GET",  path: "/api/v1/integrations/v2/contacts",  desc: "Liste de vos contacts CRM",                                auth: "API Key" },
  ]

  // Widget chat public — pour embed dans un site web (sans auth)
  const widgetApi = [
    { method: "POST", path: "/api/v1/omni/chat/start",          desc: "Démarrer une session chat widget (retourne conversationId + visitorId)", auth: "Aucune" },
    { method: "POST", path: "/api/v1/omni/chat/:id/message",    desc: "Envoyer un message depuis le widget chat",                                auth: "Aucune" },
  ]

  const methodStyle = (m: string) =>
    m === "GET"    ? "bg-sky-400/10 text-sky-400 border-sky-400/30" :
    m === "POST"   ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
    m === "PATCH"  ? "bg-amber-400/10 text-amber-400 border-amber-400/30" :
    m === "DELETE" ? "bg-rose-400/10 text-rose-400 border-rose-400/30" :
    "bg-zinc-400/10 text-zinc-400 border-zinc-400/30"

  const EndpointsTable = ({ rows }: { rows: typeof publicApi }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[#55557a] border-b border-[#2e2e44] bg-[#1f1f2a]">
            <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Méthode</th>
            <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Endpoint</th>
            <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Description</th>
            <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Auth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ep, i) => (
            <tr key={i} className="border-b border-[#1f1f2a] last:border-0 hover:bg-[#1f1f2a] transition-colors">
              <td className="px-4 py-2.5">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${methodStyle(ep.method)}`}>
                  {ep.method}
                </span>
              </td>
              <td className="px-4 py-2.5 font-mono text-[#eeeef8]">{ep.path}</td>
              <td className="px-4 py-2.5 text-[#9898b8]">{ep.desc}</td>
              <td className="px-4 py-2.5 text-[#55557a]">{ep.auth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Authentication */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
        <h2 className="text-[#eeeef8] font-semibold mb-1">Authentification API</h2>
        <p className="text-[#55557a] text-xs mb-4">Générez une clé API dans l'onglet « Clés API ». Chaque clé est liée à votre organisation et ne donne accès qu'à vos propres données.</p>

        <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg p-4 font-mono text-xs text-[#9898b8]">
          <p className="text-[#55557a] mb-2"># Via header HTTP (recommandé)</p>
          <p className="text-[#eeeef8]">X-API-Key: vf_votre_cle_api</p>
          <p className="text-[#55557a] mt-3 mb-2"># Ou via paramètre URL</p>
          <p className="text-[#eeeef8]">GET /api/v1/integrations/v2/calls?api_key=vf_votre_cle</p>
        </div>
      </div>

      {/* API publique */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2e2e44]">
          <h2 className="text-[#eeeef8] font-semibold text-sm">API publique</h2>
          <p className="text-[10px] text-[#55557a] mt-0.5">Endpoints REST avec authentification par clé API — pour vos intégrations Zapier, Make, n8n ou serveur custom</p>
        </div>
        <EndpointsTable rows={publicApi} />
      </div>

      {/* Widget public */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2e2e44]">
          <h2 className="text-[#eeeef8] font-semibold text-sm">Widget chat (embed)</h2>
          <p className="text-[10px] text-[#55557a] mt-0.5">Endpoints sans authentification, conçus pour être appelés depuis le widget JavaScript embarqué sur votre site web</p>
        </div>
        <EndpointsTable rows={widgetApi} />
      </div>

      {/* Webhooks sortants info */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-400 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <h2 className="text-[#eeeef8] font-semibold text-sm mb-1">Recevoir les événements VoxFlow</h2>
            <p className="text-[#55557a] text-xs">
              Pour recevoir des notifications d'événements (appel terminé, nouveau contact, conversation résolue, etc.),
              configurez un <span className="text-[#9898b8] font-medium">webhook sortant</span> dans l'onglet « Webhooks ».
              VoxFlow POSTera vers votre URL à chaque événement avec une signature HMAC SHA256 pour vérifier l'origine.
            </p>
          </div>
        </div>
      </div>

      {/* Example Zapier / Make */}
      <div className="bg-[#18181f] border border-[#7b61ff]/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#7b61ff]" style={{ boxShadow: "0 0 8px #7b61ff" }} />
          <h2 className="text-[#eeeef8] font-semibold text-sm">Exemple Zapier / Make</h2>
        </div>
        <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg p-4 font-mono text-[11px] text-[#9898b8]">
          <p className="text-[#55557a]"># Trigger: Nouvel appel complété</p>
          <p className="text-[#eeeef8] mt-1">POST https://hooks.zapier.com/hooks/...</p>
          <p className="text-[#55557a] mt-3"># Payload reçu</p>
          <pre className="text-emerald-400 mt-1">{JSON.stringify({
            event:       "call.completed",
            call_id:     "uuid...",
            from:        "+15141234567",
            duration:    120,
            ai_summary:  "Problème résolu...",
            agent:       "Marie Dupont",
          }, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
