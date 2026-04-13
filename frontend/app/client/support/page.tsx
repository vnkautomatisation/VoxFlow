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

// ─── Relative time ──────────────────────────────────────────────────────────
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

// ─── Badge configs ──────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  'Facturation': '#38b6ff',
  'Technique': '#ff8c42',
  'Commercial': '#00d4aa',
}

const PRIORITY_COLORS: Record<string, string> = {
  'Normale': '#6a6a8a',
  'Haute': '#ff8c42',
  'Urgente': '#ff4d6d',
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  'open': { label: 'Ouvert', color: '#00d4aa' },
  'in_progress': { label: 'En cours', color: '#38b6ff' },
  'closed': { label: 'Ferme', color: '#6a6a8a' },
}

// ─── Shared styles ──────────────────────────────────────────────────────────
const INPUT_STYLE: React.CSSProperties = {
  width: '100%', background: '#080810', border: '1px solid #2a2a4a', borderRadius: 9,
  padding: '10px 13px', color: '#e8e8f8', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

const TABLE_HEADER: React.CSSProperties = {
  padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#5a5a7a',
  textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'left',
  borderBottom: '1px solid #1e1e3a',
}

const TABLE_CELL: React.CSSProperties = {
  padding: '14px 16px', fontSize: 13, color: '#c8c8e8', verticalAlign: 'middle',
}

// ─── Badge component ────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      background: color + '18', color, border: `1px solid ${color}33`,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}
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
      if (res.error) {
        setErr(res.error)
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
      style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c1a', border: '1px solid #2a2a4a', borderRadius: 16, padding: 28, width: 540, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#e8e8f8' }}>Nouveau ticket</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a5a7a', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Sujet */}
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Sujet</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Decrivez brievement votre demande" style={INPUT_STYLE} />
          </div>

          {/* Categorie + Priorite */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Categorie</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={INPUT_STYLE}>
                <option value="Facturation">Facturation</option>
                <option value="Technique">Technique</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Priorite</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={INPUT_STYLE}>
                <option value="Normale">Normale</option>
                <option value="Haute">Haute</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Description</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Decrivez votre probleme en detail..."
              style={{ ...INPUT_STYLE, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {/* File upload area (UI only) */}
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>Fichier joint (optionnel)</label>
            <div style={{
              border: '2px dashed #2a2a4a', borderRadius: 10, padding: '18px 16px',
              textAlign: 'center', color: '#4a4a6a', fontSize: 12, cursor: 'pointer',
              transition: 'border-color .15s',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4a6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 6px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Glissez un fichier ici ou cliquez pour parcourir
            </div>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, background: '#ff4d6d18', border: '1px solid #ff4d6d33', fontSize: 12, color: '#ff4d6d' }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 9, color: '#6a6a8a', fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              flex: 1, padding: 11, background: saving ? '#5a4abf' : '#7b61ff', border: 'none',
              borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
            }}
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
      if (res.error) {
        setError(res.error)
      } else {
        setTicket(res.data || res)
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

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #1e1e3a', borderTopColor: '#7b61ff',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ fontSize: 13, color: '#5a5a7a' }}>Chargement du ticket...</div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#7b61ff', fontSize: 13, cursor: 'pointer', marginBottom: 16, padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Retour aux tickets
        </button>
        <div style={{ padding: '16px 20px', background: '#ff4d6d12', border: '1px solid #ff4d6d44', borderRadius: 10, fontSize: 13, color: '#ff8888' }}>
          {error || 'Ticket introuvable'}
        </div>
      </div>
    )
  }

  const status = STATUS_MAP[ticket.status] || STATUS_MAP['open']
  const catColor = CATEGORY_COLORS[ticket.category] || '#6a6a8a'
  const prioColor = PRIORITY_COLORS[ticket.priority] || '#6a6a8a'

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#7b61ff', fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Retour aux tickets
      </button>

      {/* Ticket header card */}
      <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f8', marginBottom: 8 }}>{ticket.subject}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge label={ticket.category} color={catColor} />
              <Badge label={ticket.priority} color={prioColor} />
              <Badge label={status.label} color={status.color} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#5a5a7a', marginBottom: 4 }}>#{ticket.id.slice(0, 8)}</div>
            <div style={{ fontSize: 12, color: '#4a4a6a' }}>Cree le {fmtDate(ticket.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Conversation thread */}
      <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, marginBottom: 20 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#c8c8e8' }}>Conversation</div>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 500, overflowY: 'auto' }}>
          {(!ticket.messages || ticket.messages.length === 0) ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#3a3a5a', fontSize: 13 }}>
              Aucun message pour le moment.
            </div>
          ) : ticket.messages.map((msg) => {
            const isClient = msg.from_role === 'client'
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '70%' }}>
                  <div style={{
                    padding: '12px 16px',
                    background: isClient ? '#7b61ff22' : '#1a1a2e',
                    border: isClient ? '1px solid #7b61ff44' : '1px solid #2a2a4a',
                    borderRadius: isClient ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    fontSize: 13,
                    color: '#d0d0e8',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.message}
                  </div>
                  <div style={{ fontSize: 10, color: '#4a4a6a', marginTop: 4, textAlign: isClient ? 'right' : 'left' }}>
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
          <div style={{ padding: '16px 24px', borderTop: '1px solid #1e1e3a', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#5a5a7a' }}>Ce ticket est ferme.</div>
          </div>
        ) : (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #1e1e3a' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
                rows={2}
                placeholder="Votre reponse..."
                style={{ ...INPUT_STYLE, flex: 1, resize: 'none', lineHeight: 1.5 }}
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                style={{
                  padding: '0 18px', background: sending ? '#5a4abf' : '#7b61ff', border: 'none',
                  borderRadius: 9, color: '#fff', cursor: sending || !reply.trim() ? 'default' : 'pointer',
                  opacity: !reply.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'opacity .15s',
                }}
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
      if (res.error) {
        setError(res.error)
        setTickets([])
      } else {
        const data = Array.isArray(res) ? res : (Array.isArray(res.data) ? res.data : [])
        setTickets(data)
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les tickets')
      setTickets([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  // If a ticket is selected, show the detail view
  if (selectedId) {
    return <TicketDetailView ticketId={selectedId} onBack={() => { setSelectedId(null); loadTickets() }} />
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0, marginBottom: 6 }}>Support</h1>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Creez et suivez vos demandes de support.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
            background: '#7b61ff', border: 'none', borderRadius: 9, color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nouveau ticket
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 16, padding: '12px 18px', background: '#ff4d6d12', border: '1px solid #ff4d6d44', borderRadius: 10, fontSize: 13, color: '#ff8888' }}>
          {error}
        </div>
      )}

      {/* Ticket table */}
      <div style={{ background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 32, height: 32, border: '3px solid #1e1e3a', borderTopColor: '#7b61ff',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <div style={{ fontSize: 13, color: '#5a5a7a' }}>Chargement des tickets...</div>
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#3a3a5a' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2a2a4a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 10px' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div style={{ fontSize: 14, marginBottom: 4 }}>Aucun ticket</div>
            <div style={{ fontSize: 12, color: '#2a2a4a' }}>Creez votre premiere demande de support.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#0a0a18' }}>
                <th style={TABLE_HEADER}>#ID</th>
                <th style={TABLE_HEADER}>Sujet</th>
                <th style={TABLE_HEADER}>Categorie</th>
                <th style={TABLE_HEADER}>Priorite</th>
                <th style={TABLE_HEADER}>Statut</th>
                <th style={TABLE_HEADER}>Derniere mise a jour</th>
                <th style={{ ...TABLE_HEADER, textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, idx) => {
                const rowBg = idx % 2 === 0 ? '#0a0a18' : '#0f0f1e'
                const status = STATUS_MAP[t.status] || STATUS_MAP['open']
                const catColor = CATEGORY_COLORS[t.category] || '#6a6a8a'
                const prioColor = PRIORITY_COLORS[t.priority] || '#6a6a8a'
                return (
                  <tr
                    key={t.id}
                    style={{ background: rowBg, transition: 'background .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#14142a')}
                    onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                  >
                    <td style={{ ...TABLE_CELL, fontFamily: 'monospace', fontSize: 12, color: '#5a5a7a' }}>
                      {t.id.slice(0, 8)}
                    </td>
                    <td style={{ ...TABLE_CELL, fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject}
                    </td>
                    <td style={TABLE_CELL}>
                      <Badge label={t.category} color={catColor} />
                    </td>
                    <td style={TABLE_CELL}>
                      <Badge label={t.priority} color={prioColor} />
                    </td>
                    <td style={TABLE_CELL}>
                      <Badge label={status.label} color={status.color} />
                    </td>
                    <td style={{ ...TABLE_CELL, fontSize: 12, color: '#5a5a7a' }}>
                      {relativeTime(t.updated_at)}
                    </td>
                    <td style={{ ...TABLE_CELL, textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedId(t.id)}
                        style={{
                          padding: '6px 16px', background: 'transparent', border: '1px solid #2a2a4a',
                          borderRadius: 7, color: '#7b61ff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          transition: 'border-color .15s, background .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#7b61ff55'; e.currentTarget.style.background = '#7b61ff12' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a4a'; e.currentTarget.style.background = 'transparent' }}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* New ticket modal */}
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={loadTickets} />}
    </div>
  )
}
