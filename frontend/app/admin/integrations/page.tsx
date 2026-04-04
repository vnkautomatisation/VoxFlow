"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { integrationsApi } from "@/lib/integrationsApi"
import APIKeysPanel from "@/components/integrations/APIKeysPanel"
import WebhooksPanel from "@/components/integrations/WebhooksPanel"
import CRMIntegrations from "@/components/integrations/CRMIntegrations"

type Tab = "crm" | "webhooks" | "apikeys" | "docs"

const INTEGRATIONS_CATALOG = [
  { type: "HUBSPOT",        name: "HubSpot",         icon: "🟠", desc: "Synchroniser contacts et deals",      color: "border-orange-700" },
  { type: "SALESFORCE",     name: "Salesforce",       icon: "🔵", desc: "CRM enterprise Salesforce",          color: "border-blue-700" },
  { type: "ZAPIER",         name: "Zapier",            icon: "⚡", desc: "Automatiser avec 5000+ apps",        color: "border-amber-700" },
  { type: "ZENDESK",        name: "Zendesk",           icon: "🎫", desc: "Tickets support Zendesk",            color: "border-green-700" },
  { type: "GOOGLE_CALENDAR",name: "Google Calendar",  icon: "📅", desc: "Synchroniser les rendez-vous",       color: "border-blue-600" },
  { type: "SLACK",          name: "Slack",             icon: "💬", desc: "Notifications dans Slack",           color: "border-purple-700" },
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
