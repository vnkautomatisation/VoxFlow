"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { adminApi } from "@/lib/adminApi"

interface IVRConfig {
  id:              string
  name:            string
  welcome_message: string
  nodes:           any[]
  created_at:      string
}

interface Props {
  configs:   IVRConfig[]
  onRefresh: () => void
}

const DEFAULT_NODES = [
  { key: "1", label: "Support technique", action: "QUEUE", value: "" },
  { key: "2", label: "Facturation",       action: "QUEUE", value: "" },
  { key: "0", label: "Receptionniste",    action: "AGENT", value: "" },
]

export default function IVRBuilder({ configs, onRefresh }: Props) {
  const { accessToken } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<IVRConfig | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [nodes,    setNodes]    = useState(DEFAULT_NODES)
  const [form, setForm] = useState({
    name: "", welcomeMessage: "Bienvenue. Pour le support appuyez sur 1. Pour la facturation appuyez sur 2."
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await adminApi.createIVR(accessToken!, { ...form, nodes })
      setShowForm(false)
      onRefresh()
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const updateNode = (idx: number, field: string, value: string) => {
    const updated = [...nodes]
    updated[idx] = { ...updated[idx], [field]: value }
    setNodes(updated)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">
          Menus vocaux (IVR) <span className="text-gray-500 text-sm font-normal">({configs.length})</span>
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {showForm ? "Annuler" : "+ Nouveau menu IVR"}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h3 className="text-white font-medium mb-4">Constructeur IVR</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom du menu</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Menu principal"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Message d accueil</label>
              <textarea
                value={form.welcomeMessage}
                onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-2 block">Options du menu</label>
              <div className="space-y-2">
                {nodes.map((node, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                    <div className="w-8 h-8 bg-teal-900 rounded-full flex items-center justify-center text-teal-300 font-bold text-sm flex-shrink-0">
                      {node.key}
                    </div>
                    <input
                      value={node.label}
                      onChange={(e) => updateNode(idx, "label", e.target.value)}
                      placeholder="Label option"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none"
                    />
                    <select
                      value={node.action}
                      onChange={(e) => updateNode(idx, "action", e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none"
                    >
                      <option value="QUEUE">File d attente</option>
                      <option value="AGENT">Agent direct</option>
                      <option value="VOICEMAIL">Messagerie</option>
                      <option value="HANGUP">Raccrocher</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              {loading ? "Creation..." : "Sauvegarder le menu IVR"}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {configs.length === 0 ? (
          <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">Aucun menu IVR configure</p>
            <p className="text-gray-600 text-xs mt-1">Cree ton premier menu vocal ci-dessus</p>
          </div>
        ) : configs.map((config) => (
          <div key={config.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-2">{config.name}</h3>
            <p className="text-gray-400 text-xs mb-3 line-clamp-2">{config.welcome_message}</p>
            <div className="flex items-center gap-2">
              <span className="bg-blue-900 text-blue-300 text-xs px-2 py-1 rounded-full">
                {(config.nodes || []).length} options
              </span>
              <span className="text-gray-600 text-xs">
                {new Date(config.created_at).toLocaleDateString("fr-CA")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
