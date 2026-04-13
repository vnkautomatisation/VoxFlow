"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { adminApi } from "@/lib/adminApi"

interface Agent {
  id:         string
  name:       string
  email:      string
  role:       string
  status:     string
  created_at: string
}

const ROLE_COLORS: Record<string, string> = {
  AGENT:      "bg-blue-900 text-blue-300",
  SUPERVISOR: "bg-purple-900 text-purple-300",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   "bg-green-900 text-green-300",
  INACTIVE: "bg-gray-800 text-gray-400",
}

interface Props {
  agents:    Agent[]
  onRefresh: () => void
}

export default function AgentsTab({ agents, onRefresh }: Props) {
  const { accessToken } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "AGENT"
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await adminApi.createAgent(accessToken!, form)
      setShowForm(false)
      setForm({ name: "", email: "", password: "", role: "AGENT" })
      onRefresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async (agentId: string) => {
    try {
      await adminApi.deleteAgent(accessToken!, agentId)
      onRefresh()
    } catch (err) { console.error(err) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">
          Agents <span className="text-gray-500 text-sm font-normal">({agents.length})</span>
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {showForm ? "Annuler" : "+ Nouvel agent"}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <h3 className="text-white font-medium mb-4">Creer un agent</h3>
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-3 py-2 mb-3 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom complet</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Mot de passe initial</label>
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="AGENT">Agent</option>
                <option value="SUPERVISOR">Superviseur</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-800 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                {loading ? "Creation..." : "Creer l agent"}
              </button>
            </div>
          </form>
        </div>
      )}

      {agents.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">Aucun agent pour le moment</p>
          <p className="text-gray-600 text-xs mt-1">Cree ton premier agent ci-dessus</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Agent</th>
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Role</th>
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Statut</th>
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Membre depuis</th>
                <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-900 rounded-full flex items-center justify-center text-teal-300 text-xs font-bold">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{agent.name}</p>
                        <p className="text-gray-500 text-xs">{agent.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={"text-xs px-2 py-1 rounded-full " + (ROLE_COLORS[agent.role] || "bg-gray-800 text-gray-400")}>
                      {agent.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={"text-xs px-2 py-1 rounded-full " + (STATUS_COLORS[agent.status] || "bg-gray-800 text-gray-400")}>
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {new Date(agent.created_at).toLocaleDateString("fr-CA")}
                  </td>
                  <td className="px-4 py-3">
                    {agent.status === "ACTIVE" && (
                      <button
                        onClick={() => handleDeactivate(agent.id)}
                        className="text-xs border border-red-800 text-red-400 px-2 py-1 rounded hover:bg-red-900/30 transition-colors"
                      >
                        Desactiver
                      </button>
                    )}
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
