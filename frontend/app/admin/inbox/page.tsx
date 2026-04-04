"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { omniApi } from "@/lib/omniApi"
import ConversationList from "@/components/inbox/ConversationList"
import ConversationView from "@/components/inbox/ConversationView"
import InboxStats from "@/components/inbox/InboxStats"
import NewConversationModal from "@/components/inbox/NewConversationModal"

const CHANNELS = [
  { id: "",          label: "Tout",      icon: "📬" },
  { id: "CHAT",      label: "Chat",      icon: "💬" },
  { id: "EMAIL",     label: "Email",     icon: "✉️" },
  { id: "WHATSAPP",  label: "WhatsApp",  icon: "📱" },
  { id: "SMS",       label: "SMS",       icon: "💌" },
]

const STATUSES = [
  { id: "OPEN",     label: "Ouverts" },
  { id: "PENDING",  label: "En attente" },
  { id: "RESOLVED", label: "Resolus" },
]

export default function InboxPage() {
  const router = useRouter()
  const [token,    setToken]    = useState<string | null>(null)
  const [mounted,  setMounted]  = useState(false)
  const [convs,    setConvs]    = useState<any[]>([])
  const [stats,    setStats]    = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [channel,  setChannel]  = useState("")
  const [status,   setStatus]   = useState("OPEN")
  const [showNew,  setShowNew]  = useState(false)
  const [total,    setTotal]    = useState(0)

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
      const params: any = { status }
      if (channel) params.channel = channel
      const [convRes, statsRes] = await Promise.all([
        omniApi.getConversations(token, params),
        omniApi.getStats(token),
      ])
      if (convRes.success)  { setConvs(convRes.data.conversations || []); setTotal(convRes.data.total || 0) }
      if (statsRes.success) setStats(statsRes.data)
    } catch {}
    finally { setLoading(false) }
  }, [token, channel, status])

  useEffect(() => { if (token) load() }, [token, channel, status])

  const handleSelect = async (conv: any) => {
    if (!token) return
    const res = await omniApi.getConversation(token, conv.id)
    if (res.success) setSelected(res.data)
  }

  const handleSendMessage = async (content: string) => {
    if (!token || !selected) return
    await omniApi.sendMessage(token, selected.id, content)
    const res = await omniApi.getConversation(token, selected.id)
    if (res.success) setSelected(res.data)
    load()
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!token || !selected) return
    await omniApi.updateConversation(token, selected.id, { status: newStatus })
    setSelected({ ...selected, status: newStatus })
    load()
  }

  const handleAssign = async (agentId: string) => {
    if (!token || !selected) return
    await omniApi.updateConversation(token, selected.id, { assignedTo: agentId })
    load()
  }

  if (!mounted || !token) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 animate-pulse text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin/dashboard")} className="text-gray-400 hover:text-white text-sm">Dashboard</button>
            <h1 className="text-xl font-bold text-white">
              VoxFlow <span className="text-gray-500 text-sm font-normal">Boite unifiee</span>
            </h1>
          </div>
          <button onClick={() => setShowNew(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >+ Nouvelle conversation</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-4 w-full flex-1 flex flex-col gap-4">

        {/* Stats */}
        {stats && <InboxStats stats={stats} />}

        {/* Filtres canaux */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {CHANNELS.map((ch) => (
              <button key={ch.id} onClick={() => setChannel(ch.id)}
                className={"px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 " + (channel === ch.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
              >
                <span className="text-base">{ch.icon}</span>
                {ch.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {STATUSES.map((s) => (
              <button key={s.id} onClick={() => setStatus(s.id)}
                className={"px-3 py-1.5 rounded-lg text-sm transition-colors " + (status === s.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
              >{s.label}</button>
            ))}
          </div>
          <span className="text-gray-600 text-xs">{total} conversation{total !== 1 ? "s" : ""}</span>
        </div>

        {/* Layout 2 colonnes */}
        <div className="flex gap-4 flex-1 min-h-0" style={{ height: "calc(100vh - 280px)" }}>

          {/* Liste conversations */}
          <div className="w-80 flex-shrink-0 overflow-y-auto">
            <ConversationList
              conversations={convs}
              loading={loading}
              selectedId={selected?.id}
              onSelect={handleSelect}
            />
          </div>

          {/* Vue conversation */}
          <div className="flex-1 overflow-hidden">
            {selected ? (
              <ConversationView
                conversation={selected}
                token={token}
                onSendMessage={handleSendMessage}
                onUpdateStatus={handleUpdateStatus}
                onRefresh={() => {
                  omniApi.getConversation(token, selected.id).then((r) => {
                    if (r.success) setSelected(r.data)
                  })
                }}
              />
            ) : (
              <div className="h-full bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-3">📬</div>
                  <p className="text-gray-400 text-sm">Selectionnez une conversation</p>
                  <p className="text-gray-600 text-xs mt-1">ou creez-en une nouvelle</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNew && (
        <NewConversationModal
          token={token}
          onClose={() => setShowNew(false)}
          onCreated={() => { load(); setShowNew(false) }}
        />
      )}
    </div>
  )
}
