"use client"

import { useState } from "react"
import { integrationsApi } from "@/lib/integrationsApi"

interface Props {
  token:          string
  catalog:        any[]
  integrations:   any[]
  connectedTypes: string[]
  onRefresh:      () => void
}

export default function CRMIntegrations({ token, catalog, integrations, connectedTypes, onRefresh }: Props) {
  const [connecting,  setConnecting]  = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({})
  const [syncing,     setSyncing]     = useState<string | null>(null)
  const [results,     setResults]     = useState<Record<string, any>>({})
  const [disConfirm,  setDisConfirm]  = useState<string | null>(null)

  const handleConnect = async (type: string, name: string) => {
    const apiKey = apiKeyInput[type]
    if (!apiKey?.trim()) return
    setConnecting(type)
    try {
      await integrationsApi.connectIntegration(token, {
        type, name,
        credentials: { apiKey },
        config:      {},
      })
      setApiKeyInput((prev) => ({ ...prev, [type]: "" }))
      onRefresh()
    } catch (err) { console.error(err) }
    finally { setConnecting(null) }
  }

  const handleDisconnect = async (type: string) => {
    const integration = integrations.find((i) => i.type === type)
    if (!integration) return
    await integrationsApi.disconnectIntegration(token, integration.id)
    setDisConfirm(null)
    onRefresh()
  }

  const handleSync = async (type: string) => {
    setSyncing(type)
    try {
      let res: any
      if (type === "HUBSPOT")    res = await integrationsApi.syncHubSpot(token)
      if (type === "SALESFORCE") res = await integrationsApi.syncSalesforce(token)
      if (res?.success) setResults((prev) => ({ ...prev, [type]: res.data }))
    } catch {}
    finally { setSyncing(null) }
  }

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#9898b8]">
          {catalog.length} intégration{catalog.length !== 1 ? "s" : ""} disponible{catalog.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Grille intégrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {catalog.map((item) => {
          const isConnected = connectedTypes.includes(item.type)
          const result      = results[item.type]
          const canSync     = ["HUBSPOT", "SALESFORCE"].includes(item.type)
          const isDisConfirm = disConfirm === item.type

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

              {/* Sync result banner */}
              {result && (
                <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 mb-3 text-[11px] text-[#9898b8] flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    <span className="text-emerald-400 font-bold">{result.synced}</span> contact{result.synced !== 1 ? "s" : ""} importé{result.synced !== 1 ? "s" : ""}
                    {result.failed > 0 && (
                      <span className="text-rose-400 ml-2">· {result.failed} erreur{result.failed !== 1 ? "s" : ""}</span>
                    )}
                  </span>
                </div>
              )}

              {/* Actions */}
              {isConnected ? (
                <div className="flex gap-2">
                  {canSync && (
                    <button onClick={() => handleSync(item.type)} disabled={syncing === item.type}
                      className="flex-1 bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      {syncing === item.type ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          Synchronisation...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                          Synchroniser
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
                <div className="flex gap-2">
                  <input
                    value={apiKeyInput[item.type] || ""}
                    onChange={(e) => setApiKeyInput((prev) => ({ ...prev, [item.type]: e.target.value }))}
                    placeholder={`Clé API ${item.name}...`}
                    type="password"
                    className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-1.5 text-[#eeeef8] text-xs placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
                  />
                  <button
                    onClick={() => handleConnect(item.type, item.name)}
                    disabled={connecting === item.type || !apiKeyInput[item.type]?.trim()}
                    className="bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    {connecting === item.type ? "..." : "Connecter"}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
