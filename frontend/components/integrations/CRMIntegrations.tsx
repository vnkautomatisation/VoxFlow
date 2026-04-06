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
  const [connecting, setConnecting] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({})
  const [syncing,    setSyncing]    = useState<string | null>(null)
  const [results,    setResults]    = useState<Record<string, any>>({})

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
    if (!integration || !confirm("Deconnecter " + type + " ?")) return
    await integrationsApi.disconnectIntegration(token, integration.id)
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
    <div>
      <h2 className="text-white font-semibold mb-4">Integrations CRM & Outils</h2>
      <div className="grid grid-cols-2 gap-4">
        {catalog.map((item) => {
          const isConnected = connectedTypes.includes(item.type)
          const result      = results[item.type]
          const canSync     = ["HUBSPOT", "SALESFORCE"].includes(item.type)

          return (
            <div key={item.type} className={"bg-gray-900 border rounded-xl p-5 " + (isConnected ? item.color : "border-gray-800")}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8">{item.svgIcon ?? item.icon}</span>
                  <div>
                    <p className="text-white font-semibold">{item.name}</p>
                    <p className="text-gray-500 text-xs">{item.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected && (
                    <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">Connecte</span>
                  )}
                  {isConnected && canSync && (
                    <button onClick={() => handleSync(item.type)} disabled={syncing === item.type}
                      className="text-xs bg-teal-900 text-teal-300 hover:bg-teal-800 px-2 py-0.5 rounded-full"
                    >{syncing === item.type ? "Sync..." : "Sync"}</button>
                  )}
                </div>
              </div>

              {result && (
                <div className="bg-gray-800 rounded-lg p-2 mb-3 text-xs text-gray-300">
                  Sync: {result.synced} contacts importes, {result.failed} erreurs
                </div>
              )}

              {isConnected ? (
                <button onClick={() => handleDisconnect(item.type)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >Deconnecter</button>
              ) : (
                <div className="flex gap-2 mt-2">
                  <input
                    value={apiKeyInput[item.type] || ""}
                    onChange={(e) => setApiKeyInput((prev) => ({ ...prev, [item.type]: e.target.value }))}
                    placeholder={"Cle API " + item.name + "..."}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
                  />
                  <button
                    onClick={() => handleConnect(item.type, item.name)}
                    disabled={connecting === item.type || !apiKeyInput[item.type]?.trim()}
                    className="bg-teal-700 hover:bg-teal-600 disabled:bg-gray-700 text-white px-3 py-1.5 rounded-lg text-xs"
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

