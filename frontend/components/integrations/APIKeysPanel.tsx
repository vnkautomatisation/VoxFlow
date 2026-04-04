"use client"

import { useState } from "react"
import { integrationsApi } from "@/lib/integrationsApi"

const PERMISSIONS = [
  { value: "calls:read",        label: "Lire les appels" },
  { value: "calls:write",       label: "Creer des appels" },
  { value: "contacts:read",     label: "Lire les contacts" },
  { value: "contacts:write",    label: "Modifier les contacts" },
  { value: "analytics:read",    label: "Lire les analytics" },
  { value: "conversations:read",label: "Lire les conversations" },
]

interface Props {
  token:   string
  apiKeys: any[]
  onRefresh: () => void
}

export default function APIKeysPanel({ token, apiKeys, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", permissions: ["calls:read", "contacts:read"], expiresInDays: "" })
  const [saving,   setSaving]   = useState(false)
  const [newKey,   setNewKey]   = useState<string | null>(null)
  const [copied,   setCopied]   = useState(false)

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Cles API</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
        >+ Nouvelle cle API</button>
      </div>

      {/* Afficher la cle juste apres creation */}
      {newKey && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-4">
          <p className="text-green-400 font-medium text-sm mb-2">Cle API creee — copiez-la maintenant, elle ne sera plus affichee !</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-green-300 text-xs font-mono break-all">{newKey}</code>
            <button onClick={handleCopy}
              className="bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-xs"
            >{copied ? "Copie !" : "Copier"}</button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-gray-500 text-xs mt-2 hover:text-gray-400">Fermer</button>
        </div>
      )}

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom de la cle</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Integration Zapier"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Expiration (jours, optionnel)</label>
              <input type="number" value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
                placeholder="Aucune expiration"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500" />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-gray-400 text-xs mb-2 block">Permissions</label>
            <div className="grid grid-cols-2 gap-2">
              {PERMISSIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={form.permissions.includes(p.value)}
                    onChange={() => togglePerm(p.value)}
                    className="rounded text-teal-500"
                  />
                  <span className="text-gray-300 text-sm">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving || !form.name}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >{saving ? "Creation..." : "Generer la cle"}</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-700 text-gray-400 px-4 py-2 rounded-lg text-sm">Annuler</button>
          </div>
        </div>
      )}

      {apiKeys.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🔑</div>
          <p className="text-gray-400 text-sm">Aucune cle API</p>
          <p className="text-gray-500 text-xs mt-1">Creez une cle pour acceder a l API publique VoxFlow</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {["Nom", "Prefixe", "Permissions", "Derniere utilisation", "Expire", "Actions"].map((h) => (
                  <th key={h} className="text-left text-gray-500 text-xs uppercase px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b border-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={"w-2 h-2 rounded-full " + (key.is_active ? "bg-green-500" : "bg-gray-500")}></div>
                      <p className="text-white text-sm">{key.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-400 text-xs">{key.key_prefix}...</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(key.permissions || []).slice(0, 2).map((p: string) => (
                        <span key={p} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{p}</span>
                      ))}
                      {(key.permissions || []).length > 2 && (
                        <span className="text-xs text-gray-500">+{key.permissions.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString("fr-CA") : "Jamais"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {key.expires_at ? new Date(key.expires_at).toLocaleDateString("fr-CA") : "Aucune"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={async () => { await integrationsApi.revokeKey(token, key.id); onRefresh() }}
                      className="text-red-500 hover:text-red-400 text-xs"
                    >Revoquer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
