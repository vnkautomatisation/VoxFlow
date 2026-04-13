"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { securityApi } from "@/lib/securityApi"
import { ConfirmModal } from "@/components/shared/VFModal"
import {
  Shield, Smartphone, Key, Activity,
  CheckCircle, XCircle, Clock, Globe,
  Trash2, RefreshCw, ChevronRight, Lock
} from "lucide-react"

type Tab = "2fa" | "sessions" | "audit"

export default function SecurityPage() {
  const router = useRouter()
  const [token,      setToken]      = useState<string | null>(null)
  const [mounted,    setMounted]    = useState(false)
  const [activeTab,  setActiveTab]  = useState<Tab>("2fa")
  const [twoFA,      setTwoFA]      = useState<any>(null)
  const [sessions,   setSessions]   = useState<any[]>([])
  const [auditLogs,  setAuditLogs]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [setupData,  setSetupData]  = useState<any>(null)
  const [otpCode,    setOtpCode]    = useState("")
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState("")

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
      const [twoRes, sessRes, auditRes] = await Promise.all([
        securityApi.get2FAStatus(token),
        securityApi.getSessions(token),
        securityApi.getAuditLogs(token, 30),
      ])
      if (twoRes.success)   setTwoFA(twoRes.data)
      if (sessRes.success)  setSessions(sessRes.data   || [])
      if (auditRes.success) setAuditLogs(auditRes.data || [])
    } catch {}
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load() }, [token])

  const handleSetup2FA = async () => {
    if (!token) return
    const res = await securityApi.setup2FA(token)
    if (res.success) setSetupData(res.data)
  }

  const handleEnable2FA = async () => {
    if (!token || !otpCode) return
    setSaving(true)
    try {
      const res = await securityApi.enable2FA(token, otpCode)
      if (res.success) {
        setMsg("2FA active avec succes !")
        setSetupData(null)
        setOtpCode("")
        load()
      } else {
        setMsg("Code invalide. Reessayez.")
      }
    } catch {}
    finally { setSaving(false); setTimeout(() => setMsg(""), 3000) }
  }

  const [showDisable2FA, setShowDisable2FA] = useState(false)

  const handleDisable2FA = async () => {
    if (!token) return
    const res = await securityApi.disable2FA(token)
    if (res.success) { load() }
    setShowDisable2FA(false)
  }

  const handleRevokeSession = async (id: string) => {
    if (!token) return
    await securityApi.revokeSession(token, id)
    load()
  }

  if (!mounted || !token) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 animate-pulse text-sm">Chargement...</p>
    </div>
  )

  const TABS = [
    { id: "2fa",      label: "Authentification 2FA", icon: Shield },
    { id: "sessions", label: "Sessions actives",      icon: Globe },
    { id: "audit",    label: "Journal d activite",    icon: Activity },
  ]

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push("/profile")} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Profil
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-purple-400" />
            Securite du compte
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
                className={"flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors " + (activeTab === tab.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <p className="text-gray-500 animate-pulse text-center py-12">Chargement...</p>
        ) : (
          <>
            {/* ── 2FA ── */}
            {activeTab === "2fa" && twoFA && (
              <div className="space-y-4">
                <div className={"bg-gray-900 border rounded-xl p-5 " + (twoFA.enabled ? "border-green-800" : "border-gray-800")}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={"w-10 h-10 rounded-full flex items-center justify-center " + (twoFA.enabled ? "bg-green-900" : "bg-gray-800")}>
                        <Shield className={"w-5 h-5 " + (twoFA.enabled ? "text-green-400" : "text-gray-500")} />
                      </div>
                      <div>
                        <p className="text-white font-medium">Authentification a deux facteurs</p>
                        <p className={"text-sm " + (twoFA.enabled ? "text-green-400" : "text-gray-500")}>
                          {twoFA.enabled ? "Active" : "Non active"}
                        </p>
                      </div>
                    </div>
                    {twoFA.enabled ? (
                      <button onClick={() => setShowDisable2FA(true)}
                        className="border border-red-800 text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-sm"
                      >Desactiver</button>
                    ) : (
                      <button onClick={handleSetup2FA}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                      >Activer 2FA</button>
                    )}
                  </div>

                  {twoFA.enabled && (
                    <div className="flex items-center gap-4 text-sm text-gray-400 pt-2 border-t border-gray-800">
                      <div className="flex items-center gap-1.5">
                        <Key className="w-4 h-4" />
                        <span>{twoFA.backupCodesLeft} codes de secours restants</span>
                      </div>
                      {twoFA.enabledAt && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>Active le {new Date(twoFA.enabledAt).toLocaleDateString("fr-CA")}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Setup 2FA */}
                {setupData && (
                  <div className="bg-gray-900 border border-purple-800 rounded-xl p-5">
                    <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-purple-400" />
                      Configurer l application d authentification
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-gray-400 text-sm mb-3">1. Scannez ce QR code avec Google Authenticator ou Authy</p>
                        <div className="bg-white p-3 rounded-lg inline-block mb-3">
                          <img
                            src={"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + encodeURIComponent(setupData.qrUrl)}
                            alt="QR Code 2FA"
                            className="w-32 h-32"
                          />
                        </div>
                        <p className="text-gray-500 text-xs">Ou entrez manuellement: <code className="text-purple-300">{setupData.secret}</code></p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-3">2. Entrez le code a 6 chiffres genere par l application</p>
                        <input
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-2xl text-center font-mono tracking-widest focus:outline-none focus:border-purple-500 mb-3"
                        />
                        {msg && <p className={"text-sm mb-2 " + (msg.includes("succes") ? "text-green-400" : "text-red-400")}>{msg}</p>}
                        <button
                          onClick={handleEnable2FA}
                          disabled={otpCode.length !== 6 || saving}
                          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white py-2 rounded-lg text-sm font-medium"
                        >{saving ? "Verification..." : "Activer 2FA"}</button>

                        <div className="mt-4">
                          <p className="text-gray-500 text-xs font-medium mb-2">Codes de secours (sauvegardez-les !):</p>
                          <div className="grid grid-cols-2 gap-1">
                            {setupData.backupCodes.map((code: string) => (
                              <code key={code} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">{code}</code>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SESSIONS ── */}
            {activeTab === "sessions" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-teal-400" />
                    Sessions actives ({sessions.length})
                  </h2>
                  {sessions.length > 1 && (
                    <button
                      onClick={async () => { if (!token) return; await securityApi.revokeAll(token); load() }}
                      className="flex items-center gap-1.5 border border-red-800 text-red-400 px-3 py-1.5 rounded-lg text-sm hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Tout revoquer
                    </button>
                  )}
                </div>

                {sessions.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                    <Globe className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Aucune session active</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div key={session.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center">
                            <Globe className="w-4 h-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{session.ip_address || "IP inconnue"}</p>
                            <p className="text-gray-500 text-xs">
                              {session.user_agent?.substring(0, 50) || "Navigateur inconnu"}
                            </p>
                            <p className="text-gray-600 text-xs">
                              Derniere activite: {new Date(session.last_active_at).toLocaleString("fr-CA")}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => handleRevokeSession(session.id)}
                          className="text-red-500 hover:text-red-400 p-1.5 rounded hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── AUDIT LOGS ── */}
            {activeTab === "audit" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Journal d activite
                  </h2>
                  <button onClick={load} className="text-gray-500 hover:text-white">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                    <Activity className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Aucune activite enregistree</p>
                  </div>
                ) : (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    {auditLogs.map((log, i) => (
                      <div key={log.id} className={"flex items-start gap-4 px-5 py-3 " + (i > 0 ? "border-t border-gray-800" : "")}>
                        <div className={"w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 " + (
                          log.action.includes("ERROR") || log.action.includes("FAIL") ? "bg-red-900" :
                          log.action.includes("ENABLED") || log.action.includes("CREATE") ? "bg-green-900" :
                          "bg-gray-800"
                        )}>
                          {log.action.includes("ERROR") || log.action.includes("FAIL")
                            ? <XCircle className="w-4 h-4 text-red-400" />
                            : log.action.includes("ENABLED") || log.action.includes("CREATE")
                            ? <CheckCircle className="w-4 h-4 text-green-400" />
                            : <Activity className="w-4 h-4 text-gray-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium">{log.action}</p>
                          {log.user && <p className="text-gray-500 text-xs">{log.user.name} ({log.user.email})</p>}
                          {log.resource && <p className="text-gray-600 text-xs">{log.resource} {log.resource_id ? "· " + log.resource_id.slice(0, 8) : ""}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-gray-600 text-xs">{new Date(log.created_at).toLocaleString("fr-CA")}</p>
                          {log.ip_address && <p className="text-gray-700 text-xs">{log.ip_address}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {showDisable2FA && (
          <ConfirmModal title="Desactiver le 2FA ?" message="Votre compte sera moins protege." confirmLabel="Desactiver" danger
            onConfirm={handleDisable2FA} onCancel={() => setShowDisable2FA(false)} />
        )}
      </div>
    </div>
  )
}
