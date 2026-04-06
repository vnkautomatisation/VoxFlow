"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { integrationsApi } from "@/lib/integrationsApi"
import APIKeysPanel from "@/components/integrations/APIKeysPanel"
import WebhooksPanel from "@/components/integrations/WebhooksPanel"
import CRMIntegrations from "@/components/integrations/CRMIntegrations"

type Tab = "crm" | "webhooks" | "apikeys" | "docs"

const INTEGRATION_ICONS: Record<string, React.ReactNode> = {
  HUBSPOT: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.164 7.33V5.02a1.56 1.56 0 00.895-1.405V3.58a1.56 1.56 0 00-1.557-1.557h-.036A1.56 1.56 0 0015.91 3.58v.036a1.56 1.56 0 00.895 1.404V7.33a4.43 4.43 0 00-2.104 1.224L7.13 3.27a1.73 1.73 0 00.044-.373 1.738 1.738 0 10-1.738 1.738c.208 0 .406-.038.59-.104l7.434 5.187a4.43 4.43 0 00-.582 2.185 4.43 4.43 0 00.673 2.346l-2.26 2.26a1.43 1.43 0 00-.41-.063 1.44 1.44 0 101.44 1.44 1.43 1.43 0 00-.063-.41l2.23-2.23a4.45 4.45 0 002.72.924 4.46 4.46 0 000-8.914zm0 6.57a2.115 2.115 0 110-4.23 2.115 2.115 0 010 4.23z" fill="#FF7A59"/>
    </svg>
  ),
  SALESFORCE: (
    <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.05 4.8a3.9 3.9 0 012.9-1.3 3.94 3.94 0 013.55 2.26 2.9 2.9 0 011.1-.22 2.95 2.95 0 012.95 2.95 2.95 2.95 0 01-.2 1.07 2.63 2.63 0 01.55 1.62 2.65 2.65 0 01-2.65 2.65 2.6 2.6 0 01-.43-.04 2.35 2.35 0 01-2.1 1.32 2.3 2.3 0 01-.97-.21 3.14 3.14 0 01-2.97 2.12 3.16 3.16 0 01-3-2.2 2.66 2.66 0 01-.52.05 2.7 2.7 0 01-2.7-2.7 2.7 2.7 0 01.75-1.87 2.2 2.2 0 01-.22-1A2.25 2.25 0 018.3 8.97a2.22 2.22 0 01.5.06 3.9 3.9 0 011.25-4.23z" fill="#00A1E0"/>
    </svg>
  ),
  ZAPIER: (
    <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.983 14.923l-4.26 4.26a1.4 1.4 0 01-1.98-1.98l4.26-4.26H4.22a1.4 1.4 0 010-2.8h5.783l-4.26-4.26a1.4 1.4 0 011.98-1.98l4.26 4.26V2.4a1.4 1.4 0 012.8 0v5.763l4.26-4.26a1.4 1.4 0 011.98 1.98l-4.26 4.26H22a1.4 1.4 0 010 2.8h-5.237l4.26 4.26a1.4 1.4 0 01-1.98 1.98l-4.26-4.26v5.42a1.4 1.4 0 01-2.8 0v-5.42z" fill="#FF4A00"/>
    </svg>
  ),
  ZENDESK: (
    <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.5 2C6.26 2 2 6.26 2 11.5S6.26 21 11.5 21 21 16.74 21 11.5 16.74 2 11.5 2zm-1.2 14.5L6 10.5h8.6l-4.3 6zm2.4-8.5l4.3-6h-8.6l4.3 6z" fill="#03363D"/>
    </svg>
  ),
  GOOGLE_CALENDAR: (
    <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H5V9h12v12zM5 7V5h14v2H5z" fill="#4285F4"/>
      <path d="M7 11h4v4H7z" fill="#34A853"/>
      <path d="M13 11h4v2h-4z" fill="#FBBC04"/>
      <path d="M13 15h4v2h-4z" fill="#EA4335"/>
    </svg>
  ),
  SLACK: (
    <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#E01E5A"/>
    </svg>
  ),
}

const INTEGRATIONS_CATALOG = [
  { type: "HUBSPOT", get svgIcon() { return INTEGRATION_ICONS["HUBSPOT"] },         name: "HubSpot",         desc: "Synchroniser contacts et deals",   color: "border-orange-700/40" },
  { type: "SALESFORCE", get svgIcon() { return INTEGRATION_ICONS["SALESFORCE"] },      name: "Salesforce",       desc: "CRM enterprise Salesforce",        color: "border-blue-700/40" },
  { type: "ZAPIER", get svgIcon() { return INTEGRATION_ICONS["ZAPIER"] },          name: "Zapier",           desc: "Automatiser avec 5000+ apps",      color: "border-amber-700/40" },
  { type: "ZENDESK", get svgIcon() { return INTEGRATION_ICONS["ZENDESK"] },         name: "Zendesk",          desc: "Tickets support Zendesk",          color: "border-teal-700/40" },
  { type: "GOOGLE_CALENDAR", get svgIcon() { return INTEGRATION_ICONS["GOOGLE_CALENDAR"] }, name: "Google Calendar",  desc: "Synchroniser les rendez-vous",     color: "border-blue-600/40" },
  { type: "SLACK", get svgIcon() { return INTEGRATION_ICONS["SLACK"] },           name: "Slack",            desc: "Notifications dans Slack",         color: "border-pink-700/40" },
]

export default function IntegrationsPage() {
  const router = useRouter()
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
      const raw    = localStorage.getItem("voxflow-auth")
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
      if (intRes.success)  setIntegrations(intRes.data  || [])
      if (keysRes.success) setApiKeys(keysRes.data      || [])
      if (whRes.success)   setWebhooks(whRes.data       || [])
    } catch {}
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [token])

  if (!mounted || !token) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 animate-pulse text-sm">Chargement...</p>
    </div>
  )

  const connectedTypes = integrations.filter((i) => i.status === "ACTIVE").map((i) => i.type)

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push("/admin/dashboard")} className="text-gray-400 hover:text-white text-sm">Dashboard</button>
            <h1 className="text-xl font-bold text-white">
              VoxFlow <span className="text-gray-500 text-sm font-normal">Integrations & API</span>
            </h1>
            <div className="flex gap-1">
              {[
                { id: "crm",      label: "Integrations CRM" },
                { id: "webhooks", label: "Webhooks (" + webhooks.length + ")" },
                { id: "apikeys",  label: "Cles API (" + apiKeys.length + ")" },
                { id: "docs",     label: "Documentation" },
              ].map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
                  className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (activeTab === t.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >{t.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <p className="text-gray-500 animate-pulse text-center py-12">Chargement...</p>
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
  )
}

function APIDocs() {
  const endpoints = [
    { method: "GET",  path: "/api/v1/integrations/v2/calls",    desc: "Liste des appels",   auth: "API Key" },
    { method: "GET",  path: "/api/v1/integrations/v2/contacts", desc: "Liste des contacts", auth: "API Key" },
    { method: "POST", path: "/api/v1/omni/chat/start",           desc: "Demarrer chat widget", auth: "Aucune" },
    { method: "POST", path: "/api/v1/omni/chat/:id/message",     desc: "Envoyer message chat", auth: "Aucune" },
    { method: "POST", path: "/api/v1/telephony/webhook/voice",   desc: "Webhook voix Twilio", auth: "Twilio" },
  ]

  return (
    <div>
      <h2 className="text-white font-semibold mb-4">Documentation API publique</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <h3 className="text-white font-medium mb-3">Authentification</h3>
        <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm text-gray-300 mb-3">
          <p className="text-gray-500 text-xs mb-2"># Header HTTP</p>
          <p>X-API-Key: vf_votre_cle_api</p>
          <p className="text-gray-500 mt-2 text-xs"># ou parametre URL</p>
          <p>GET /api/v1/integrations/v2/calls?api_key=vf_votre_cle</p>
        </div>
        <p className="text-gray-400 text-sm">Generez une cle API dans l onglet "Cles API". Chaque cle est liee a votre organisation.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-white font-medium text-sm">Endpoints disponibles</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {["Methode", "Endpoint", "Description", "Auth"].map((h) => (
                <th key={h} className="text-left text-gray-500 text-xs uppercase px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                <td className="px-4 py-3">
                  <span className={"text-xs font-bold px-2 py-1 rounded " + (
                    ep.method === "GET"  ? "bg-blue-900 text-blue-300" :
                    ep.method === "POST" ? "bg-green-900 text-green-300" :
                    "bg-amber-900 text-amber-300"
                  )}>{ep.method}</span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-300 text-xs">{ep.path}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">{ep.desc}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{ep.auth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-gray-900 border border-teal-800 rounded-xl p-5">
        <h3 className="text-teal-400 font-medium mb-3">Exemple Zapier / Make</h3>
        <div className="bg-gray-800 rounded-lg p-4 font-mono text-xs text-gray-300">
          <p className="text-gray-500"># Trigger: Nouvel appel complete</p>
          <p>POST votre-url-zapier.com/hooks/...</p>
          <p className="text-gray-500 mt-2"># Payload recu:</p>
          <pre className="text-green-400">{JSON.stringify({
            event:       "call.completed",
            call_id:     "uuid...",
            from:        "+15141234567",
            duration:    120,
            ai_summary:  "Probleme resolu...",
            agent:       "Marie Dupont",
          }, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}



