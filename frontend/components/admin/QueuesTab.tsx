"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { adminApi } from "@/lib/adminApi"
import { ConfirmModal } from "@/components/shared/VFModal"

interface Queue {
  id:          string
  name:        string
  description: string
  strategy:    string
  created_at:  string
}

interface Props {
  queues:    Queue[]
  onRefresh: () => void
}

const STRATEGY_LABELS: Record<string, string> = {
  ROUND_ROBIN:  "Tournant",
  LEAST_BUSY:   "Moins occupe",
  PRIORITY:     "Priorite",
  RANDOM:       "Aleatoire",
}

export default function QueuesTab({ queues, onRefresh }: Props) {
  const { accessToken } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [form, setForm] = useState({
    name: "", description: "", strategy: "ROUND_ROBIN", maxWaitTime: 300
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await adminApi.createQueue(accessToken!, form)
      setShowForm(false)
      setForm({ name: "", description: "", strategy: "ROUND_ROBIN", maxWaitTime: 300 })
      onRefresh()
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const [deleteQueueId, setDeleteQueueId] = useState<string | null>(null)

  const handleDelete = async (queueId: string) => {
    try {
      await adminApi.deleteQueue(accessToken!, queueId)
      onRefresh()
    } catch (err) { console.error(err) }
    setDeleteQueueId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-lg">
          Files d attente <span className="text-gray-500 text-sm font-normal">({queues.length})</span>
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {showForm ? "Annuler" : "+ Nouvelle file"}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-4">
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Nom de la file</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Support technique"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Strategie de distribution</label>
              <select
                value={form.strategy}
                onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="ROUND_ROBIN">Tournant (recommande)</option>
                <option value="LEAST_BUSY">Moins occupe</option>
                <option value="PRIORITY">Par priorite</option>
                <option value="RANDOM">Aleatoire</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Temps max attente (sec)</label>
              <input
                type="number"
                value={form.maxWaitTime}
                onChange={(e) => setForm({ ...form, maxWaitTime: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                {loading ? "Creation..." : "Creer la file"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {queues.length === 0 ? (
          <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">Aucune file d attente</p>
          </div>
        ) : queues.map((queue) => (
          <div key={queue.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-medium">{queue.name}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{queue.description}</p>
              </div>
              <button
                onClick={() => setDeleteQueueId(queue.id)}
                className="text-gray-600 hover:text-red-400 text-xs transition-colors"
              >
                Supprimer
              </button>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="bg-teal-900 text-teal-300 text-xs px-2 py-1 rounded-full">
                {STRATEGY_LABELS[queue.strategy] || queue.strategy}
              </span>
              <span className="text-gray-600 text-xs">
                {new Date(queue.created_at).toLocaleDateString("fr-CA")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {deleteQueueId && (
        <ConfirmModal title="Supprimer cette file d'attente ?" message="Les appels en attente seront perdus." confirmLabel="Supprimer" danger
          onConfirm={() => handleDelete(deleteQueueId)} onCancel={() => setDeleteQueueId(null)} />
      )}
    </div>
  )
}
