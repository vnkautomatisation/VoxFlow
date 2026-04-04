"use client"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { ownerApi } from "@/lib/ownerApi"

interface Org {
  id:         string
  name:       string
  slug:       string
  plan:       string
  status:     string
  created_at: string
}

interface Props {
  orgs:     Org[]
  onRefresh: () => void
}

const PLAN_COLORS: Record<string, string> = {
  STARTER:    "bg-gray-800 text-gray-300",
  PRO:        "bg-blue-900 text-blue-300",
  ENTERPRISE: "bg-purple-900 text-purple-300",
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-green-900 text-green-300",
  SUSPENDED: "bg-amber-900 text-amber-300",
  CANCELLED: "bg-red-900 text-red-300",
}

export default function OrgsTable({ orgs, onRefresh }: Props) {
  const { accessToken } = useAuthStore()
  const [loading, setLoading] = useState<string | null>(null)

  const handleStatus = async (orgId: string, newStatus: string) => {
    setLoading(orgId)
    try {
      await ownerApi.updateOrgStatus(accessToken!, orgId, newStatus)
      onRefresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  if (orgs.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">Aucun admin pour le moment</p>
        <p className="text-gray-600 text-xs mt-1">Cree le premier compte admin ci-dessus</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Organisation</th>
            <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Plan</th>
            <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Statut</th>
            <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Cree le</th>
            <th className="text-left text-gray-500 text-xs uppercase px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map((org) => (
            <tr key={org.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="px-4 py-3">
                <p className="text-white text-sm font-medium">{org.name}</p>
                <p className="text-gray-500 text-xs">{org.slug}</p>
              </td>
              <td className="px-4 py-3">
                <span className={"text-xs px-2 py-1 rounded-full " + (PLAN_COLORS[org.plan] || "bg-gray-800 text-gray-300")}>
                  {org.plan}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={"text-xs px-2 py-1 rounded-full " + (STATUS_COLORS[org.status] || "bg-gray-800 text-gray-300")}>
                  {org.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400 text-sm">
                {new Date(org.created_at).toLocaleDateString("fr-CA")}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {org.status === "ACTIVE" ? (
                    <button
                      onClick={() => handleStatus(org.id, "SUSPENDED")}
                      disabled={loading === org.id}
                      className="text-xs border border-amber-700 text-amber-400 px-2 py-1 rounded hover:bg-amber-900/30 transition-colors disabled:opacity-50"
                    >
                      Suspendre
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatus(org.id, "ACTIVE")}
                      disabled={loading === org.id}
                      className="text-xs border border-green-700 text-green-400 px-2 py-1 rounded hover:bg-green-900/30 transition-colors disabled:opacity-50"
                    >
                      Reactiver
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
