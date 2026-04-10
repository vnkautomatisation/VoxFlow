"use client"

import { useEffect, useState, useCallback } from "react"
import { omniApi } from "@/lib/omniApi"
import { adminApi } from "@/lib/adminApi"
import ConversationList from "@/components/inbox/ConversationList"
import ConversationView from "@/components/inbox/ConversationView"
import InboxStats from "@/components/inbox/InboxStats"
import NewConversationModal from "@/components/inbox/NewConversationModal"
import ConversationDetailDrawer from "@/components/inbox/ConversationDetailDrawer"
import ChannelIcon, { CHANNELS, CHANNEL_META } from "@/components/inbox/ChannelIcon"

const STATUSES = [
  { id: "OPEN",     label: "Ouverts" },
  { id: "PENDING",  label: "En attente" },
  { id: "RESOLVED", label: "Résolus" },
]

export default function InboxPage() {
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

  // Drawer détail
  const [showDetail,   setShowDetail]   = useState(false)
  const [agents,       setAgents]       = useState<any[]>([])
  const [agentsError,  setAgentsError]  = useState(false)
  const [agentsLoaded, setAgentsLoaded] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem("voxflow-auth")
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

  // Fetch agents lazily quand le drawer s'ouvre la première fois
  useEffect(() => {
    if (!showDetail || agentsLoaded || !token) return
    adminApi.getAgents(token)
      .then((r) => {
        if (r.success) {
          setAgents(Array.isArray(r.data) ? r.data : [])
          setAgentsError(false)
        } else {
          setAgentsError(true)
        }
      })
      .catch(() => setAgentsError(true))
      .finally(() => setAgentsLoaded(true))
  }, [showDetail, agentsLoaded, token])

  // Auto-close drawer si la conversation sélectionnée devient null
  useEffect(() => {
    if (!selected) setShowDetail(false)
  }, [selected])

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
    const res = await omniApi.getConversation(token, selected.id)
    if (res.success) setSelected(res.data)
    load()
  }

  // Handler consolidé pour les PATCH depuis le drawer
  const handleUpdateConversation = async (patch: any) => {
    if (!token || !selected) return
    await omniApi.updateConversation(token, selected.id, patch)
    // Re-fetch pour récupérer les joins (agent) que la réponse PATCH ne renvoie pas
    const res = await omniApi.getConversation(token, selected.id)
    if (res.success) setSelected(res.data)
    load()
  }

  const handleRefresh = () => {
    if (!token || !selected) return
    omniApi.getConversation(token, selected.id).then((r) => {
      if (r.success) setSelected(r.data)
    })
  }

  if (!mounted || !token) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-[#55557a] animate-pulse text-sm">Chargement...</p>
    </div>
  )

  return (
    <div className="h-[calc(100vh-48px)] overflow-hidden">
      <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#eeeef8]">Boîte unifiée</h1>
          <div className="text-xs text-[#55557a] mt-0.5">
            {total} conversation{total !== 1 ? "s" : ""} · {stats?.open ?? 0} ouverte{(stats?.open ?? 0) !== 1 ? "s" : ""}
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="bg-[#7b61ff] hover:bg-[#6145ff] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5"  y1="12" x2="19" y2="12" />
          </svg>
          Nouvelle conversation
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-3 flex-shrink-0">
          <InboxStats stats={stats} />
        </div>
      )}

      {/* Toolbar filtres */}
      <div className="flex items-center gap-2 flex-wrap mb-3 flex-shrink-0">
        {/* Canaux */}
        <div className="flex gap-1 bg-[#18181f] border border-[#2e2e44] rounded-xl p-1">
          <button
            onClick={() => setChannel("")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
              channel === "" ? "bg-[#2e2e44] text-[#eeeef8]" : "text-[#55557a] hover:text-[#9898b8]"
            }`}
          >
            Tout
          </button>
          {CHANNELS.map((ch) => (
            <button key={ch}
              onClick={() => setChannel(ch)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                channel === ch
                  ? "bg-[#7b61ff]/15 text-[#eeeef8] border border-[#7b61ff]/30"
                  : "border border-transparent text-[#55557a] hover:text-[#9898b8]"
              }`}
            >
              <ChannelIcon channel={ch} size="sm" />
              <span className="hidden md:inline">{CHANNEL_META[ch].labelFR}</span>
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex gap-1 bg-[#18181f] border border-[#2e2e44] rounded-xl p-1">
          {STATUSES.map((s) => (
            <button key={s.id}
              onClick={() => setStatus(s.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                status === s.id
                  ? "bg-[#7b61ff]/15 text-[#eeeef8] border border-[#7b61ff]/30"
                  : "border border-transparent text-[#55557a] hover:text-[#9898b8]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="text-[#55557a] text-xs ml-auto">
          {total} conversation{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Layout 2 colonnes — prend le reste de la hauteur via flex-1 */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Liste conversations */}
        <div className="w-80 flex-shrink-0 overflow-y-auto pr-1">
          <ConversationList
            conversations={convs}
            loading={loading}
            selectedId={selected?.id}
            onSelect={handleSelect}
          />
        </div>

        {/* Vue conversation */}
        <div className="flex-1 overflow-hidden min-w-0">
          {selected ? (
            <ConversationView
              conversation={selected}
              token={token}
              onSendMessage={handleSendMessage}
              onUpdateStatus={handleUpdateStatus}
              onRefresh={handleRefresh}
              onOpenDetail={() => setShowDetail(true)}
            />
          ) : (
            <div className="h-full bg-[#18181f] border border-[#2e2e44] rounded-xl flex items-center justify-center">
              <div className="text-center">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-[#2e2e44] mx-auto mb-3">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
                <p className="text-[#9898b8] text-sm font-medium">Sélectionnez une conversation</p>
                <p className="text-[#55557a] text-xs mt-1">ou créez-en une nouvelle</p>
              </div>
            </div>
          )}
        </div>
      </div>

      </div>

      {/* Modal nouvelle conversation */}
      {showNew && (
        <NewConversationModal
          token={token}
          onClose={() => setShowNew(false)}
          onCreated={() => { load(); setShowNew(false) }}
        />
      )}

      {/* Drawer détail */}
      {showDetail && selected && (
        <ConversationDetailDrawer
          conversation={selected}
          agents={agents}
          agentsError={agentsError}
          onClose={() => setShowDetail(false)}
          onUpdate={handleUpdateConversation}
        />
      )}
    </div>
  )
}
