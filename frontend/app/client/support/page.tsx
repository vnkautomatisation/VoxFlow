'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── API helper ─────────────────────────────────────────────────────────────
function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) },
    })
    return r.json()
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface Ticket {
  id: string
  subject: string
  category: string
  priority: string
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  message: string
  from_role: 'client' | 'support'
  created_at: string
  user_id: string
}

interface TicketDetail extends Ticket {
  messages: Message[]
}

// ─── Formatters ─────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  if (!iso) return '--'
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = now - then
  if (diff < 0) return 'a l\'instant'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'a l\'instant'
  if (mins < 60) return `il y a ${mins} minute${mins > 1 ? 's' : ''}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`
  const days = Math.floor(hours / 24)
  if (days < 30) return `il y a ${days} jour${days > 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  return `il y a ${months} mois`
}

function fmtDate(iso: string): string {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

function fmtTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso.slice(0, 16).replace('T', ' ')
  }
}

// ─── Badge components ───────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    Facturation: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
    Technique: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
    Commercial: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  }
  const cls = map[category] || 'bg-[#55557a]/10 text-[#9898b8] border-[#55557a]/20'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {category}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    Normale: 'bg-[#55557a]/10 text-[#9898b8] border-[#55557a]/20',
    Haute: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
    Urgente: 'bg-red-400/10 text-red-400 border-red-400/20',
  }
  const cls = map[priority] || 'bg-[#55557a]/10 text-[#9898b8] border-[#55557a]/20'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {priority}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Ouvert', cls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
    in_progress: { label: 'En cours', cls: 'bg-sky-400/10 text-sky-400 border-sky-400/20' },
    closed: { label: 'Ferme', cls: 'bg-[#55557a]/10 text-[#9898b8] border-[#55557a]/20' },
  }
  const s = map[status] || map.open
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ─── New Ticket Modal ───────────────────────────────────────────────────────
function NewTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const api = useApi()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Facturation')
  const [priority, setPriority] = useState('Normale')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!message.trim()) { setErr('Description requise'); return }
    setSaving(true)
    setErr(null)
    try {
      const res = await api('/api/v1/client/portal/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject: subject.trim() || 'Sans sujet', category, priority, message: message.trim() }),
      })
      const d = res.data || res
      if (d.error) {
        setErr(d.error)
        setSaving(false)
        return
      }
      onCreated()
      onClose()
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la creation')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-7 w-[540px] max-w-[95vw]">
        {/* Modal header */}
        <div className="flex justify-between items-center mb-5">
          <div className="text-lg font-bold text-[#eeeef8]">Nouveau ticket</div>
          <button onClick={onClose} className="text-[#55557a] hover:text-[#9898b8] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Sujet */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#55557a] font-semibold mb-1.5">Sujet</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Decrivez brievement votre demande"
              className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]/50 transition-colors"
            />
          </div>

          {/* Categorie + Priorite */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#55557a] font-semibold mb-1.5">Categorie</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]/50 transition-colors"
              >
                <option value="Facturation">Facturation</option>
                <option value="Technique">Technique</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#55557a] font-semibold mb-1.5">Priorite</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]/50 transition-colors"
              >
                <option value="Normale">Normale</option>
                <option value="Haute">Haute</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#55557a] font-semibold mb-1.5">Description</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Decrivez votre probleme en detail..."
              className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]/50 transition-colors resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Error */}
        {err && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {err}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-transparent border border-[#2e2e44] rounded-lg text-sm text-[#9898b8] hover:border-[#55557a] transition-colors cursor-pointer">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-default transition-colors"
          >
            {saving ? 'Creation...' : 'Creer le ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Ticket Detail View ─────────────────────────────────────────────────────
function TicketDetailView({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const api = useApi()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadTicket = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api(`/api/v1/client/portal/support/tickets/${ticketId}`)
      const d = res.data || res
      if (d.error) {
        setError(d.error)
      } else {
        setTicket(d)
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger le ticket')
    }
    setLoading(false)
  }, [ticketId])

  useEffect(() => { loadTicket() }, [loadTicket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages])

  const sendReply = async () => {
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      await api(`/api/v1/client/portal/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: reply.trim() }),
      })
      setReply('')
      await loadTicket()
    } catch (e: any) {
      console.error('[sendReply]', e)
    }
    setSending(false)
  }

  // Loading
  if (loading) {
    return (
      <div className="py-10 text-center">
        <div className="w-8 h-8 border-[3px] border-[#2e2e44] border-t-[#7b61ff] rounded-full animate-spin mx-auto mb-3.5" />
        <div className="text-sm text-[#55557a]">Chargement du ticket...</div>
      </div>
    )
  }

  // Error / not found
  if (error || !ticket) {
    return (
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[#7b61ff] text-sm hover:underline mb-4 bg-transparent border-none cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Retour aux tickets
        </button>
        <div className="px-5 py-4 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error || 'Ticket introuvable'}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[#7b61ff] text-sm hover:underline mb-5 bg-transparent border-none cursor-pointer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Retour aux tickets
      </button>

      {/* Ticket header card */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 mb-5">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="text-lg font-bold text-[#eeeef8] mb-2">{ticket.subject}</div>
            <div className="flex gap-2 items-center flex-wrap">
              <CategoryBadge category={ticket.category} />
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono text-[#55557a] mb-1">#{ticket.id.slice(0, 8)}</div>
            <div className="text-xs text-[#55557a]">Cree le {fmtDate(ticket.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Conversation thread */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl mb-5">
        <div className="px-5 py-4 border-b border-[#2e2e44]">
          <div className="text-sm font-semibold text-[#eeeef8]">Conversation</div>
        </div>
        <div className="px-5 py-5 flex flex-col gap-4 max-h-[500px] overflow-y-auto">
          {(!ticket.messages || ticket.messages.length === 0) ? (
            <div className="py-5 text-center text-sm text-[#55557a]">
              Aucun message pour le moment.
            </div>
          ) : ticket.messages.map((msg) => {
            const isClient = msg.from_role === 'client'
            return (
              <div key={msg.id} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[70%]">
                  <div className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isClient
                      ? 'bg-[#7b61ff]/15 border border-[#7b61ff]/25 rounded-[14px] rounded-br-[4px] text-[#eeeef8]'
                      : 'bg-[#1f1f2a] border border-[#2e2e44] rounded-[14px] rounded-bl-[4px] text-[#9898b8]'
                  }`}>
                    {msg.message}
                  </div>
                  <div className={`text-[10px] text-[#55557a] mt-1 ${isClient ? 'text-right' : 'text-left'}`}>
                    {isClient ? 'Vous' : 'Support'} -- {fmtTime(msg.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply form or closed message */}
        {ticket.status === 'closed' ? (
          <div className="px-5 py-4 border-t border-[#2e2e44] text-center">
            <div className="text-sm text-[#55557a]">Ce ticket est ferme.</div>
          </div>
        ) : (
          <div className="px-5 py-4 border-t border-[#2e2e44]">
            <div className="flex gap-2.5">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                rows={2}
                placeholder="Votre reponse..."
                className="flex-1 bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]/50 transition-colors resize-none leading-relaxed"
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="px-4 bg-[#7b61ff] hover:bg-[#6145ff] rounded-lg text-white flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-default transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function SupportPage() {
  const api = useApi()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api('/api/v1/client/portal/support/tickets')
      const d = res.data || res
      if (d.error) {
        setError(d.error)
        setTickets([])
      } else {
        const data = Array.isArray(d) ? d : []
        setTickets(data)
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les tickets')
      setTickets([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  // Detail view
  if (selectedId) {
    return <TicketDetailView ticketId={selectedId} onBack={() => { setSelectedId(null); loadTickets() }} />
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#eeeef8] mb-1">Support</h1>
          <p className="text-sm text-[#9898b8]">Creez et suivez vos demandes de support.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau ticket
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Ticket table */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center">
            <div className="w-8 h-8 border-[3px] border-[#2e2e44] border-t-[#7b61ff] rounded-full animate-spin mx-auto mb-3.5" />
            <div className="text-sm text-[#55557a]">Chargement des tickets...</div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2e2e44" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className="text-sm text-[#55557a] mb-1">Aucun ticket</div>
            <div className="text-xs text-[#55557a]/60">Creez votre premiere demande de support.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#111118]">
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">#ID</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Sujet</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Categorie</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Priorite</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]">Derniere MAJ</th>
                  <th className="px-4 py-3 text-center text-[10px] uppercase tracking-wider font-semibold text-[#55557a] border-b border-[#1f1f2a]"></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[#1f1f2a] hover:bg-[#1f1f2a] transition-colors"
                  >
                    <td className="px-4 py-3.5 text-xs font-mono text-[#55557a]">
                      {t.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#eeeef8] font-semibold max-w-[260px] truncate">
                      {t.subject}
                    </td>
                    <td className="px-4 py-3.5">
                      <CategoryBadge category={t.category} />
                    </td>
                    <td className="px-4 py-3.5">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#55557a]">
                      {relativeTime(t.updated_at)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => setSelectedId(t.id)}
                        className="px-3 py-1 bg-transparent border border-[#2e2e44] rounded-lg text-xs font-semibold text-[#7b61ff] hover:border-[#7b61ff]/30 hover:bg-[#7b61ff]/5 transition-colors cursor-pointer"
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New ticket modal */}
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={loadTickets} />}
    </div>
  )
}
