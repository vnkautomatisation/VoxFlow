"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import ChannelIcon from "./ChannelIcon"

const PRIORITY_CHIPS = [
  { value: "LOW",    label: "Basse",   tw: "border-zinc-400/30 text-zinc-400 bg-zinc-400/10" },
  { value: "NORMAL", label: "Normale", tw: "border-zinc-300/30 text-zinc-300 bg-zinc-300/10" },
  { value: "HIGH",   label: "Haute",   tw: "border-amber-400/30 text-amber-400 bg-amber-400/10" },
  { value: "URGENT", label: "Urgent",  tw: "border-rose-400/30 text-rose-400 bg-rose-400/10" },
]

const AGENT_GRADIENTS = [
  "linear-gradient(135deg, #7b61ff, #6145ff)",
  "linear-gradient(135deg, #a78bfa, #7b61ff)",
  "linear-gradient(135deg, #38b6ff, #7b61ff)",
  "linear-gradient(135deg, #00d4aa, #38b6ff)",
  "linear-gradient(135deg, #ffb547, #ff4d6d)",
]

const hashStr = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const fmtDT = (dt?: string) => {
  if (!dt) return "—"
  return new Date(dt).toLocaleString("fr-CA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const Divider = ({ title, danger }: { title: string; danger?: boolean }) => (
  <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${danger ? "text-rose-500/70" : "text-[#55557a]"}`}>
    <div className={`flex-1 h-px ${danger ? "bg-rose-500/20" : "bg-[#2e2e44]"}`} />
    {title}
    <div className={`flex-1 h-px ${danger ? "bg-rose-500/20" : "bg-[#2e2e44]"}`} />
  </div>
)

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) => (
  <div className="flex items-center gap-3 bg-[#1f1f2a] rounded-lg px-3 py-2">
    <div className="text-[#55557a] flex-shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="text-[9px] font-bold uppercase tracking-wider text-[#55557a]">{label}</div>
      <div className="text-xs text-[#eeeef8] truncate">{value || "—"}</div>
    </div>
  </div>
)

interface Props {
  conversation: any
  agents:       any[]
  agentsError?: boolean
  onClose:      () => void
  onUpdate:     (patch: any) => Promise<void>
}

export default function ConversationDetailDrawer({ conversation, agents, agentsError, onClose, onUpdate }: Props) {
  const router = useRouter()
  const [saving,     setSaving]     = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [newTag,     setNewTag]     = useState("")

  const contact = conversation.contact
  const name = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Contact"
    : conversation.metadata?.visitorName || conversation.metadata?.phone || "Visiteur anonyme"

  const subtitle = [conversation.channel, contact?.company, conversation.subject].filter(Boolean).join(" · ")

  const tags: string[] = conversation.tags ?? []

  const wrap = async (patch: any) => {
    if (saving) return
    setSaving(true)
    try { await onUpdate(patch) }
    finally { setSaving(false) }
  }

  const handleAddTag = async () => {
    const t = newTag.trim().slice(0, 40)
    if (!t) return
    if (tags.includes(t)) { setNewTag(""); return }
    await wrap({ tags: [...tags, t] })
    setNewTag("")
  }

  const handleRemoveTag = async (t: string) => {
    await wrap({ tags: tags.filter(x => x !== t) })
  }

  const handleClose = async () => {
    await wrap({ status: "CLOSED" })
    setDelConfirm(false)
    onClose()
  }

  const assignedAgent = conversation.agent
  const assignedGradient = assignedAgent?.id
    ? AGENT_GRADIENTS[hashStr(assignedAgent.id) % AGENT_GRADIENTS.length]
    : AGENT_GRADIENTS[0]
  const assignedInitials = assignedAgent?.name
    ? assignedAgent.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()
    : ""

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay click-to-close */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-[480px] bg-[#111118] border-l border-[#2e2e44] flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] bg-[#18181f]">
          <div className="flex items-center gap-3 min-w-0">
            <ChannelIcon channel={conversation.channel} size="md" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#eeeef8] truncate">{name}</div>
              <div className="text-[10px] text-[#55557a] truncate">{subtitle}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#55557a] hover:text-[#eeeef8] transition-colors p-1.5 rounded-lg hover:bg-[#1f1f2a]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18" />
              <line x1="6"  y1="6"  x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* A. Contact */}
          <section>
            <Divider title="Contact" />
            {contact ? (
              <div className="space-y-2">
                <InfoRow
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
                  label="Nom"
                  value={`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()}
                />
                <InfoRow
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>}
                  label="Email"
                  value={contact.email}
                />
                <InfoRow
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>}
                  label="Téléphone"
                  value={contact.phone}
                />
                <InfoRow
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1" /></svg>}
                  label="Entreprise"
                  value={contact.company}
                />

                {contact.id && (
                  <button
                    onClick={() => router.push(`/admin/crm?contactId=${contact.id}`)}
                    className="w-full mt-2 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-2 rounded-lg text-xs font-bold hover:text-[#7b61ff] hover:border-[#7b61ff]/30 transition-colors flex items-center justify-center gap-2"
                  >
                    Voir dans le CRM
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-[#1f1f2a] rounded-lg px-4 py-3">
                <div className="text-xs text-[#eeeef8] font-semibold">Visiteur anonyme</div>
                <div className="text-[11px] text-[#55557a] mt-0.5">
                  {conversation.metadata?.visitorName || conversation.metadata?.phone || "Aucune information"}
                </div>
              </div>
            )}
          </section>

          {/* B. Tags */}
          <section>
            <Divider title="Tags" />
            <div className="space-y-2">
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 bg-[#2e2e44] text-[#9898b8] text-[10px] font-bold px-2 py-1 rounded">
                      {t}
                      <button
                        onClick={() => handleRemoveTag(t)}
                        disabled={saving}
                        className="text-[#55557a] hover:text-rose-400 transition-colors disabled:opacity-50"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <line x1="18" y1="6"  x2="6"  y2="18" />
                          <line x1="6"  y1="6"  x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[#55557a] text-xs italic">Aucun tag</p>
              )}

              <div className="flex gap-2">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag() } }}
                  placeholder="Nouveau tag..."
                  maxLength={40}
                  className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-1.5 text-[#eeeef8] text-xs placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
                />
                <button
                  onClick={handleAddTag}
                  disabled={saving || !newTag.trim()}
                  className="bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-1.5 rounded-lg text-xs font-bold hover:text-[#7b61ff] disabled:opacity-50 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          {/* C. Priorité */}
          <section>
            <Divider title="Priorité" />
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_CHIPS.map((p) => {
                const sel = conversation.priority === p.value
                return (
                  <button
                    key={p.value}
                    onClick={() => wrap({ priority: p.value })}
                    disabled={saving}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      sel ? p.tw : "border-[#2e2e44] text-[#55557a] hover:text-[#9898b8] hover:border-[#3a3a55]"
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* D. Assignation */}
          <section>
            <Divider title="Assignation" />
            <select
              value={assignedAgent?.id || ""}
              onChange={(e) => wrap({ assignedTo: e.target.value || null })}
              disabled={saving}
              className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-[#eeeef8] text-sm focus:outline-none focus:border-[#7b61ff] transition-colors disabled:opacity-50"
            >
              <option value="">— Non assigné —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {agentsError && (
              <p className="text-rose-400/70 text-[10px] mt-1.5">Impossible de charger les agents</p>
            )}

            {assignedAgent && (
              <div className="mt-3 flex items-center gap-3 bg-[#1f1f2a] rounded-lg px-3 py-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: assignedGradient }}
                >
                  {assignedInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[#eeeef8] font-semibold truncate">{assignedAgent.name}</div>
                  <div className="text-[10px] text-[#55557a] truncate">{assignedAgent.email}</div>
                </div>
              </div>
            )}
          </section>

          {/* E. Métadonnées */}
          <section>
            <Divider title="Métadonnées" />
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center gap-3 px-1">
                <span className="text-[#55557a] font-medium">Créé le</span>
                <span className="text-[#9898b8] font-mono">{fmtDT(conversation.created_at)}</span>
              </div>
              <div className="flex justify-between items-center gap-3 px-1">
                <span className="text-[#55557a] font-medium">Dernier message</span>
                <span className="text-[#9898b8] font-mono">{fmtDT(conversation.last_message_at)}</span>
              </div>
              {conversation.resolved_at && (
                <div className="flex justify-between items-center gap-3 px-1">
                  <span className="text-[#55557a] font-medium">Résolu le</span>
                  <span className="text-sky-400 font-mono">{fmtDT(conversation.resolved_at)}</span>
                </div>
              )}
              {conversation.closed_at && (
                <div className="flex justify-between items-center gap-3 px-1">
                  <span className="text-[#55557a] font-medium">Fermé le</span>
                  <span className="text-zinc-400 font-mono">{fmtDT(conversation.closed_at)}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3 px-1 pt-1">
                <span className="text-[#55557a] font-medium">ID</span>
                <span className="text-[#55557a] font-mono text-[10px] truncate">{conversation.id}</span>
              </div>
            </div>
          </section>

          {/* F. Zone dangereuse */}
          {conversation.status !== "CLOSED" && (
            <section>
              <Divider title="Zone dangereuse" danger />
              {!delConfirm ? (
                <button
                  onClick={() => setDelConfirm(true)}
                  disabled={saving}
                  className="w-full text-rose-400 border border-rose-400/30 bg-rose-400/10 hover:bg-rose-400/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Fermer définitivement
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-rose-400/80">Êtes-vous sûr ? La conversation sera marquée comme fermée.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDelConfirm(false)}
                      disabled={saving}
                      className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-2 rounded-lg text-xs font-bold hover:text-[#eeeef8] transition-colors disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleClose}
                      disabled={saving}
                      className="flex-1 bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      Confirmer la fermeture
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2e2e44] bg-[#18181f] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2 rounded-lg text-sm font-bold hover:text-[#eeeef8] transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
