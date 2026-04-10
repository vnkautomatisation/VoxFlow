"use client"

import { useState } from "react"
import { integrationsApi } from "@/lib/integrationsApi"

// ── Spec des credentials par intégration ──────────────────────
interface CredField {
  key:         string
  label:       string
  type?:       "text" | "password" | "email"
  placeholder?: string
  help?:       string
}

interface CredSpec {
  fields:      CredField[]
  actionLabel: string   // "Synchroniser" pour les CRM, "Tester" pour Slack
  actionCall:  "sync" | "test"
  docUrl?:     string   // Lien vers doc d'obtention des credentials
}

const CREDENTIALS_SPEC: Record<string, CredSpec> = {
  HUBSPOT: {
    fields: [
      { key: "apiKey", label: "Clé API (Private App Token)", type: "password", placeholder: "pat-na1-...", help: "Settings → Integrations → Private Apps" },
    ],
    actionLabel: "Synchroniser",
    actionCall:  "sync",
    docUrl:      "https://developers.hubspot.com/docs/api/private-apps",
  },
  SALESFORCE: {
    fields: [
      { key: "instanceUrl", label: "Instance URL", type: "text", placeholder: "https://myorg.my.salesforce.com", help: "URL de votre organisation Salesforce" },
      { key: "accessToken", label: "Access Token (OAuth Bearer)", type: "password", placeholder: "00D...", help: "Setup → Manage Connected Apps → OAuth" },
    ],
    actionLabel: "Synchroniser",
    actionCall:  "sync",
    docUrl:      "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/quickstart_oauth.htm",
  },
  ZENDESK: {
    fields: [
      { key: "subdomain", label: "Sous-domaine", type: "text", placeholder: "mycompany", help: "<subdomain>.zendesk.com" },
      { key: "email",     label: "Email admin",  type: "email", placeholder: "admin@mycompany.com" },
      { key: "apiToken",  label: "API Token",    type: "password", placeholder: "...", help: "Admin Center → Apps & intégrations → API Zendesk" },
    ],
    actionLabel: "Synchroniser",
    actionCall:  "sync",
    docUrl:      "https://support.zendesk.com/hc/en-us/articles/4408889192858",
  },
  SLACK: {
    fields: [
      { key: "botToken",  label: "Bot Token", type: "password", placeholder: "xoxb-...", help: "Slack App → OAuth & Permissions → Bot User Token" },
      { key: "channelId", label: "Channel ID", type: "text", placeholder: "C01ABC2DEF3", help: "Clic droit sur le canal → Copier l'ID" },
    ],
    actionLabel: "Tester",
    actionCall:  "test",
    docUrl:      "https://api.slack.com/authentication/token-types#bot",
  },
  GOOGLE_CALENDAR: {
    fields: [
      { key: "accessToken", label: "Access Token OAuth", type: "password", placeholder: "ya29...", help: "OAuth 2.0 Playground ou Google Cloud Console" },
      { key: "calendarId",  label: "Calendar ID",        type: "text",     placeholder: "primary", help: "Laissez 'primary' pour l'agenda principal" },
    ],
    actionLabel: "Synchroniser",
    actionCall:  "sync",
    docUrl:      "https://developers.google.com/calendar/api/quickstart/js",
  },
  ZAPIER: {
    fields: [
      { key: "webhookUrl", label: "URL Zapier Hook", type: "text", placeholder: "https://hooks.zapier.com/hooks/catch/...", help: "Plus rapide: utilisez l'onglet « Webhooks » pour configurer un webhook sortant" },
    ],
    actionLabel: "Synchroniser",
    actionCall:  "sync",
    docUrl:      "https://zapier.com/apps/webhook/help",
  },
}

interface Props {
  token:          string
  catalog:        any[]
  integrations:   any[]
  connectedTypes: string[]
  onRefresh:      () => void
}

export default function CRMIntegrations({ token, catalog, integrations, connectedTypes, onRefresh }: Props) {
  const [connecting,   setConnecting]   = useState<string | null>(null)
  const [credsInput,   setCredsInput]   = useState<Record<string, Record<string, string>>>({})
  const [syncing,      setSyncing]      = useState<string | null>(null)
  const [results,      setResults]      = useState<Record<string, any>>({})
  const [disConfirm,   setDisConfirm]   = useState<string | null>(null)
  const [expandedForm, setExpandedForm] = useState<string | null>(null)
  const [err,          setErr]          = useState<Record<string, string>>({})

  const updateField = (type: string, field: string, value: string) => {
    setCredsInput((prev) => ({
      ...prev,
      [type]: { ...(prev[type] || {}), [field]: value },
    }))
  }

  const handleConnect = async (type: string, name: string) => {
    const spec  = CREDENTIALS_SPEC[type]
    const creds = credsInput[type] || {}

    // Validation: tous les champs requis
    const missing = spec.fields.filter((f) => !creds[f.key]?.trim())
    if (missing.length > 0) {
      setErr((prev) => ({ ...prev, [type]: `Champs requis: ${missing.map((m) => m.label).join(", ")}` }))
      return
    }

    setErr((prev) => ({ ...prev, [type]: "" }))
    setConnecting(type)
    try {
      await integrationsApi.connectIntegration(token, {
        type, name,
        credentials: creds,
        config:      {},
      })
      setCredsInput((prev) => ({ ...prev, [type]: {} }))
      setExpandedForm(null)
      onRefresh()
    } catch (e: any) {
      setErr((prev) => ({ ...prev, [type]: e?.message || "Erreur de connexion" }))
    } finally { setConnecting(null) }
  }

  const handleDisconnect = async (type: string) => {
    const integration = integrations.find((i) => i.type === type)
    if (!integration) return
    await integrationsApi.disconnectIntegration(token, integration.id)
    setDisConfirm(null)
    onRefresh()
  }

  const handleAction = async (type: string) => {
    const spec = CREDENTIALS_SPEC[type]
    setSyncing(type)
    setErr((prev) => ({ ...prev, [type]: "" }))
    try {
      let res: any
      if (type === "HUBSPOT")         res = await integrationsApi.syncHubSpot(token)
      if (type === "SALESFORCE")      res = await integrationsApi.syncSalesforce(token)
      if (type === "ZENDESK")         res = await integrationsApi.syncZendesk(token)
      if (type === "SLACK")           res = await integrationsApi.testSlack(token)
      if (type === "GOOGLE_CALENDAR") res = await integrationsApi.syncGoogleCalendar(token)
      if (res?.success) {
        setResults((prev) => ({ ...prev, [type]: res.data }))
      } else if (res?.error) {
        setErr((prev) => ({ ...prev, [type]: res.error }))
      }
    } catch (e: any) {
      setErr((prev) => ({ ...prev, [type]: e?.message || `Erreur ${spec.actionLabel.toLowerCase()}` }))
    } finally { setSyncing(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#9898b8]">
          {catalog.length} intégration{catalog.length !== 1 ? "s" : ""} disponible{catalog.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {catalog.map((item) => {
          const isConnected = connectedTypes.includes(item.type)
          const result      = results[item.type]
          const error       = err[item.type]
          const spec        = CREDENTIALS_SPEC[item.type]
          const isDisConfirm = disConfirm === item.type
          const isExpanded   = expandedForm === item.type
          const currentCreds = credsInput[item.type] || {}

          return (
            <div key={item.type}
              className={`bg-[#18181f] border rounded-xl p-4 transition-colors ${
                isConnected ? "border-[#7b61ff]/30" : "border-[#2e2e44]"
              }`}
            >
              {/* Header: icon + name + status */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#1f1f2a] border border-[#2e2e44] flex items-center justify-center flex-shrink-0">
                    {item.svgIcon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[#eeeef8] font-semibold text-sm truncate">{item.name}</p>
                      {item.category && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2e2e44] text-[#9898b8]">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[#55557a] text-[11px] truncate mt-0.5">{item.desc}</p>
                  </div>
                </div>

                {isConnected && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 flex-shrink-0">
                    Connecté
                  </span>
                )}
              </div>

              {/* Error banner */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg px-3 py-2 mb-3 text-[11px]">
                  {error}
                </div>
              )}

              {/* Result banner */}
              {result && (
                <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 mb-3 text-[11px] text-[#9898b8] flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    {result.sent ? (
                      <>Test envoyé avec succès <span className="text-emerald-400">· channel {result.channel}</span></>
                    ) : (
                      <>
                        <span className="text-emerald-400 font-bold">{result.synced ?? 0}</span> enregistrement{(result.synced ?? 0) !== 1 ? "s" : ""} synchronisé{(result.synced ?? 0) !== 1 ? "s" : ""}
                        {result.failed > 0 && (
                          <span className="text-rose-400 ml-2">· {result.failed} erreur{result.failed !== 1 ? "s" : ""}</span>
                        )}
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Actions */}
              {isConnected ? (
                <div className="flex gap-2">
                  {spec && (
                    <button onClick={() => handleAction(item.type)} disabled={syncing === item.type}
                      className="flex-1 bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      {syncing === item.type ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          {spec.actionLabel}...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                          {spec.actionLabel}
                        </>
                      )}
                    </button>
                  )}
                  {!isDisConfirm ? (
                    <button onClick={() => setDisConfirm(item.type)}
                      className="text-rose-400 border border-rose-400/30 bg-rose-400/10 hover:bg-rose-400/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    >
                      Déconnecter
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setDisConfirm(null)}
                        className="bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-1.5 rounded-lg text-xs font-bold hover:text-[#eeeef8] transition-colors"
                      >
                        Annuler
                      </button>
                      <button onClick={() => handleDisconnect(item.type)}
                        className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        Confirmer
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {!isExpanded ? (
                    <button
                      onClick={() => { setExpandedForm(item.type); setErr((prev) => ({ ...prev, [item.type]: "" })) }}
                      className="w-full bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] hover:text-[#7b61ff] hover:border-[#7b61ff]/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5"  y1="12" x2="19" y2="12" />
                      </svg>
                      Connecter {item.name}
                    </button>
                  ) : (
                    <div className="space-y-2 pt-2 border-t border-[#2e2e44]">
                      {spec?.fields.map((f) => (
                        <div key={f.key}>
                          <label className="block text-[9px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{f.label}</label>
                          <input
                            type={f.type || "text"}
                            value={currentCreds[f.key] || ""}
                            onChange={(e) => updateField(item.type, f.key, e.target.value)}
                            placeholder={f.placeholder}
                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-2 py-1.5 text-[#eeeef8] text-[11px] placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
                          />
                          {f.help && <p className="text-[9px] text-[#55557a] mt-0.5">{f.help}</p>}
                        </div>
                      ))}

                      {spec?.docUrl && (
                        <a href={spec.docUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-[#7b61ff] hover:underline"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          Comment obtenir les credentials
                        </a>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setExpandedForm(null); setErr((prev) => ({ ...prev, [item.type]: "" })) }}
                          className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-1.5 rounded-lg text-xs font-bold hover:text-[#eeeef8] transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => handleConnect(item.type, item.name)}
                          disabled={connecting === item.type}
                          className="flex-1 bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        >
                          {connecting === item.type ? "..." : "Connecter"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
