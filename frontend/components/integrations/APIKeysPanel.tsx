"use client"

import { useState } from "react"
import { integrationsApi } from "@/lib/integrationsApi"

const PERMISSIONS = [
  { value: "calls:read",          label: "Lire les appels" },
  { value: "calls:write",         label: "Créer des appels" },
  { value: "contacts:read",       label: "Lire les contacts" },
  { value: "contacts:write",      label: "Modifier les contacts" },
  { value: "analytics:read",      label: "Lire les analytics" },
  { value: "conversations:read", label: "Lire les conversations" },
]

interface Props {
  token:     string
  apiKeys:   any[]
  onRefresh: () => void
}

export default function APIKeysPanel({ token, apiKeys, onRefresh }: Props) {
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState({ name: "", permissions: ["calls:read", "contacts:read"], expiresInDays: "" })
  const [saving,     setSaving]     = useState(false)
  const [newKey,     setNewKey]     = useState<string | null>(null)
  const [copied,     setCopied]     = useState(false)
  const [revConfirm, setRevConfirm] = useState<string | null>(null)

  const togglePerm = (perm: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm]
    }))
  }

  const handleCreate = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const res = await integrationsApi.createKey(
        token, form.name, form.permissions,
        form.expiresInDays ? parseInt(form.expiresInDays) : undefined
      )
      if (res.success) {
        setNewKey(res.data.rawKey)
        setShowForm(false)
        setForm({ name: "", permissions: ["calls:read", "contacts:read"], expiresInDays: "" })
        onRefresh()
      }
    } catch {}
    finally { setSaving(false) }
  }

  const handleCopy = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRevoke = async (id: string) => {
    await integrationsApi.revokeKey(token, id)
    setRevConfirm(null)
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#9898b8]">{apiKeys.length} clé{apiKeys.length !== 1 ? "s" : ""} API</div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-[#7b61ff] hover:bg-[#6145ff] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5"  y1="12" x2="19" y2="12" />
          </svg>
          Nouvelle clé API
        </button>
      </div>

      {/* Nouveau key banner — visible uniquement après création */}
      {newKey && (
        <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400 flex-shrink-0 mt-0.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-emerald-400 font-bold text-sm">Clé API créée</p>
              <p className="text-[#9898b8] text-[11px] mt-0.5">
                Copiez-la maintenant — elle ne sera plus affichée pour des raisons de sécurité.
              </p>
            </div>
            <button onClick={() => setNewKey(null)} className="text-[#55557a] hover:text-[#eeeef8] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6"  x2="6"  y2="18" />
                <line x1="6"  y1="6"  x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            <code className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-emerald-300 text-[11px] font-mono break-all">
              {newKey}
            </code>
            <button onClick={handleCopy}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copié
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copier
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Formulaire création */}
      {showForm && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
          <h3 className="text-[#eeeef8] font-bold text-sm mb-4">Nouvelle clé API</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Nom de la clé</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Intégration Zapier"
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Expiration (jours, optionnel)</label>
              <input type="number" value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
                placeholder="Aucune expiration"
                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-2">Permissions</label>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSIONS.map((p) => {
                const checked = form.permissions.includes(p.value)
                return (
                  <button key={p.value} type="button" onClick={() => togglePerm(p.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                      checked
                        ? "border-[#7b61ff]/40 bg-[#7b61ff]/10"
                        : "border-[#2e2e44] bg-[#1f1f2a] hover:border-[#3a3a55]"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      checked ? "bg-[#7b61ff] border-[#7b61ff]" : "border-[#3a3a55]"
                    }`}>
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-xs ${checked ? "text-[#eeeef8]" : "text-[#9898b8]"}`}>{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)}
              className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2 rounded-lg text-sm font-bold hover:text-[#eeeef8] transition-colors"
            >
              Annuler
            </button>
            <button onClick={handleCreate} disabled={saving || !form.name}
              className="flex-1 bg-[#7b61ff] hover:bg-[#6145ff] disabled:bg-[#2e2e44] disabled:text-[#55557a] text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            >
              {saving ? "Création..." : "Générer la clé"}
            </button>
          </div>
        </div>
      )}

      {/* Liste des clés */}
      {apiKeys.length === 0 ? (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#2e2e44] mx-auto mb-3">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          <p className="text-[#9898b8] text-sm font-medium">Aucune clé API</p>
          <p className="text-[#55557a] text-xs mt-1">Créez une clé pour accéder à l'API publique VoxFlow</p>
        </div>
      ) : (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#55557a] border-b border-[#2e2e44] bg-[#1f1f2a]">
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Nom</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Préfixe</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Permissions</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Dernière util.</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Expire</th>
                  <th className="text-left px-4 py-3 font-bold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-[#1f1f2a] last:border-0 hover:bg-[#1f1f2a] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${key.is_active ? "bg-emerald-400" : "bg-[#55557a]"}`}
                          style={{ boxShadow: key.is_active ? "0 0 8px #34d399" : undefined }}
                        />
                        <p className="text-[#eeeef8] text-xs font-semibold">{key.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#9898b8]">{key.key_prefix}…</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(key.permissions || []).slice(0, 2).map((p: string) => (
                          <span key={p} className="text-[9px] font-mono bg-[#2e2e44] text-[#9898b8] px-1.5 py-0.5 rounded">
                            {p}
                          </span>
                        ))}
                        {(key.permissions || []).length > 2 && (
                          <span className="text-[9px] font-bold text-[#55557a]">+{key.permissions.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#55557a] font-mono">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString("fr-CA") : "Jamais"}
                    </td>
                    <td className="px-4 py-3 text-[#55557a] font-mono">
                      {key.expires_at ? new Date(key.expires_at).toLocaleDateString("fr-CA") : "Aucune"}
                    </td>
                    <td className="px-4 py-3">
                      {revConfirm === key.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => setRevConfirm(null)}
                            className="text-[10px] font-bold bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-2 py-1 rounded hover:text-[#eeeef8]"
                          >
                            Annuler
                          </button>
                          <button onClick={() => handleRevoke(key.id)}
                            className="text-[10px] font-bold bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded"
                          >
                            Confirmer
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setRevConfirm(key.id)}
                          className="text-[10px] font-bold text-rose-400 border border-rose-400/30 bg-rose-400/10 px-2 py-1 rounded hover:bg-rose-400/20 transition-colors"
                        >
                          Révoquer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
