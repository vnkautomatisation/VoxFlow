'use client'
import { useState, useEffect, useCallback } from 'react'

// API helper — lit token + url depuis localStorage
function useApi() {
  const getUrl = () => typeof window !== 'undefined' ? (localStorage.getItem('vf_url') || 'http://localhost:4000') : 'http://localhost:4000'
  const getTok = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') : null
  return async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(getUrl() + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(getTok() ? { Authorization: 'Bearer ' + getTok() } : {}), ...(opts.headers || {}) },
      body: opts.body,
    })
    return r.json()
  }
}

type Priority = 'low' | 'normal' | 'high' | 'urgent'
type Status = 'open' | 'pending' | 'resolved'

interface Msg { from: 'client' | 'support'; text: string; date: string }
interface Ticket {
  id: string; number: string; subject: string; category: string
  priority: Priority; status: Status; created: string; updated: string
  messages: Msg[]
}

const CATS = ['Technique', 'Facturation', 'Compte', 'Numéros DID', 'Autre']
const PRIOS: { id: Priority; label: string; color: string }[] = [
  { id: 'low',    label: 'Basse',   color: '#5a5a7a' },
  { id: 'normal', label: 'Normale', color: '#38b6ff' },
  { id: 'high',   label: 'Haute',   color: '#ffb547' },
  { id: 'urgent', label: 'Urgente', color: '#ff4d6d' },
]
// Mapper row support_tickets + support_messages du backend → forme UI
function mapTicket(row: any): Ticket {
  return {
    id:       row.id,
    number:   row.number || '',
    subject:  row.subject || '',
    category: row.category || 'Autre',
    priority: (row.priority || 'normal').toLowerCase() as Priority,
    status:   (row.status   || 'open').toLowerCase()   as Status,
    created:  row.created_at ? String(row.created_at).slice(0, 10) : '',
    updated:  row.updated_at ? String(row.updated_at).slice(0, 10) : '',
    messages: Array.isArray(row.messages) ? row.messages.map((m: any) => ({
      from: m.sender_type === 'AGENT' || m.from === 'support' ? 'support' : 'client',
      text: String(m.content || m.text || ''),
      date: m.created_at ? String(m.created_at).slice(0, 16).replace('T', ' ') : (m.date || ''),
    })) : [],
  }
}

const IS: React.CSSProperties = {
  width: '100%', background: '#080810', border: '1px solid #2a2a4a', borderRadius: 9,
  padding: '10px 13px', color: '#e8e8f8', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

function NewTicketModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Ticket) => void }) {
  const [subject,  setSubject]  = useState('')
  const [cat,      setCat]      = useState('Technique')
  const [priority, setPriority] = useState<Priority>('normal')
  const [msg,      setMsg]      = useState('')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)

  const submit = async () => {
    if (!subject.trim()) return setErr('Sujet requis')
    if (!msg.trim())     return setErr('Description requise')
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    onCreate({
      id: Date.now().toString(),
      number: 'TK-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900) + 100),
      subject, category: cat, priority, status: 'open',
      created: new Date().toISOString().slice(0, 10),
      updated: new Date().toISOString().slice(0, 10),
      messages: [{ from: 'client', text: msg, date: new Date().toLocaleString('fr-CA').slice(0, 16) }],
    })
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c1a', border: '1px solid #2a2a4a', borderRadius: 16, padding: 28, width: 520, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f8' }}>Nouveau ticket</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a5a7a', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Sujet</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Décrivez brièvement votre problème" style={IS} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Catégorie</label>
              <select value={cat} onChange={e => setCat(e.target.value)} style={IS}>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Priorité</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} style={IS}>
                {PRIOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={5}
              placeholder="Décrivez votre problème en détail — étapes, messages d'erreur, captures d'écran..."
              style={{ ...IS, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
        </div>
        {err && <div style={{ marginTop: 10, padding: '7px 12px', borderRadius: 7, background: '#ff4d6d18', border: '1px solid #ff4d6d33', fontSize: 12, color: '#ff4d6d' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: 11, background: saving ? '#5a4abf' : '#7b61ff', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            {saving ? 'Envoi…' : 'Créer le ticket'}
          </button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 9, color: '#5a5a7a', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

function TicketModal({ ticket, onClose, onReply }: { ticket: Ticket; onClose: () => void; onReply: (id: string, text: string) => void }) {
  const [reply, setReply] = useState('')
  const pr = PRIOS.find(p => p.id === ticket.priority)!
  const sc = ticket.status === 'open' ? '#ff8888' : ticket.status === 'pending' ? '#ffb547' : '#00d4aa'
  const sl = ticket.status === 'open' ? 'Ouvert' : ticket.status === 'pending' ? 'En attente' : 'Résolu'

  const send = () => {
    if (!reply.trim()) return
    onReply(ticket.id, reply)
    setReply('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c1a', border: '1px solid #2a2a4a', borderRadius: 16, width: 640, maxWidth: '98vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1e1e3a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#7b61ff' }}>{ticket.number}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: sc + '18', color: sc, border: `1px solid ${sc}33`, fontWeight: 600 }}>{sl}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: pr.color + '18', color: pr.color, border: `1px solid ${pr.color}33` }}>{pr.label}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f8' }}>{ticket.subject}</div>
              <div style={{ fontSize: 11, color: '#5a5a7a', marginTop: 3 }}>{ticket.category} · Créé le {ticket.created}</div>
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a5a7a', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ticket.messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: m.from === 'client' ? 'row-reverse' : 'row', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.from === 'client' ? '#7b61ff33' : '#00d4aa22', border: `1px solid ${m.from === 'client' ? '#7b61ff55' : '#00d4aa44'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: m.from === 'client' ? '#a695ff' : '#00d4aa', flexShrink: 0 }}>
                {m.from === 'client' ? 'C' : 'S'}
              </div>
              <div style={{ maxWidth: '75%' }}>
                <div style={{ padding: '10px 14px', background: m.from === 'client' ? '#7b61ff18' : '#1a1a2e', border: `1px solid ${m.from === 'client' ? '#7b61ff33' : '#2a2a4a'}`, borderRadius: 10, fontSize: 13, color: '#c8c8e8', lineHeight: 1.55 }}>{m.text}</div>
                <div style={{ fontSize: 10, color: '#4a4a6a', marginTop: 3, textAlign: m.from === 'client' ? 'right' : 'left' }}>{m.date}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Répondre */}
        {ticket.status !== 'resolved' && (
          <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #1e1e3a' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }} rows={2}
                placeholder="Votre message… (Ctrl+Entrée pour envoyer)"
                style={{ ...IS, flex: 1, resize: 'none', lineHeight: 1.5 }} />
              <button onClick={send} style={{ padding: '0 16px', background: '#7b61ff', border: 'none', borderRadius: 9, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SupportPage() {
  const api = useApi()
  const [tickets,    setTickets]    = useState<Ticket[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [showNew,    setShowNew]    = useState(false)
  const [selected,   setSelected]   = useState<Ticket | null>(null)
  const [filter,     setFilter]     = useState<Status | 'all'>('all')

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await api('/api/v1/billing/tickets')
      if (r.success && Array.isArray(r.data)) {
        setTickets(r.data.map(mapTicket))
      } else {
        setTickets([])
        if (r.error || r.message) setError(r.error || r.message)
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les tickets')
      setTickets([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  const open    = tickets.filter(t => t.status === 'open').length
  const pending = tickets.filter(t => t.status === 'pending').length
  const resolved= tickets.filter(t => t.status === 'resolved').length
  const filtered= filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  const createTicket = async (t: Ticket) => {
    try {
      const r = await api('/api/v1/billing/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject:  t.subject,
          category: t.category,
          priority: t.priority,
          message:  t.messages[0]?.text || '',
        }),
      })
      if (r.success) await loadTickets()
    } catch (e: any) {
      console.error('[createTicket]', e)
    }
  }

  const addReply = async (id: string, text: string) => {
    try {
      const r = await api(`/api/v1/billing/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text, sender_type: 'CLIENT' }),
      })
      if (r.success) await loadTickets()
    } catch (e: any) {
      console.error('[addReply]', e)
    }
    // Optimistic update pour l'UX
    setTickets(prev => prev.map(t => t.id !== id ? t : {
      ...t,
      messages: [...t.messages, { from: 'client', text, date: new Date().toLocaleString('fr-CA').slice(0, 16) }],
      updated: new Date().toISOString().slice(0, 10),
    }))
    setSelected(prev => prev?.id !== id ? prev : {
      ...prev!,
      messages: [...prev!.messages, { from: 'client', text, date: new Date().toLocaleString('fr-CA').slice(0, 16) }],
    })
  }

  const sc = (s: Status) => s === 'open' ? '#ff8888' : s === 'pending' ? '#ffb547' : '#00d4aa'
  const sl = (s: Status) => s === 'open' ? 'Ouvert'  : s === 'pending' ? 'En attente' : 'Résolu'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0, marginBottom: 6 }}>Support</h1>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Créez et suivez vos demandes de support.</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#7b61ff', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouveau ticket
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[['Ouverts', open, '#ff8888'], ['En attente', pending, '#ffb547'], ['Résolus', resolved, '#00d4aa']].map(([l,v,c]) => (
          <div key={l as string} style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filtre */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {([['all','Tous'], ['open','Ouverts'], ['pending','En attente'], ['resolved','Résolus']] as [string,string][]).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id as Status | 'all')} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid', borderColor: filter === id ? '#7b61ff55' : '#1e1e3a', background: filter === id ? '#7b61ff18' : 'transparent', color: filter === id ? '#a695ff' : '#5a5a7a', fontSize: 12, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#4a4a6a', fontSize: 13 }}>Chargement des tickets…</div>
        ) : error ? (
          <div style={{ padding: 16, background: '#ff4d6d10', border: '1px solid #ff4d6d33', color: '#ff4d6d', fontSize: 13 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#3a3a5a', fontSize: 13 }}>
            {filter === 'all' ? 'Aucun ticket — creez votre premiere demande.' : 'Aucun ticket dans cette categorie.'}
          </div>
        ) : filtered.map((t, i) => {
          const pr = PRIOS.find(p => p.id === t.priority)!
          return (
            <div key={t.id} onClick={() => setSelected(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #1a1a2e' : 'none', cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#13131f')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, background: sc(t.status) + '18', border: `1px solid ${sc(t.status)}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={sc(t.status)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#c8c8e8', marginBottom: 2 }}>{t.subject}</div>
                <div style={{ fontSize: 11, color: '#5a5a7a' }}>{t.number} · {t.category} · {t.messages.length} message{t.messages.length > 1 ? 's' : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: pr.color + '18', color: pr.color, border: `1px solid ${pr.color}33` }}>{pr.label}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: sc(t.status) + '18', color: sc(t.status), border: `1px solid ${sc(t.status)}33`, fontWeight: 600 }}>{sl(t.status)}</span>
              </div>
              <div style={{ fontSize: 11, color: '#4a4a6a', minWidth: 80, textAlign: 'right' }}>{t.updated}</div>
            </div>
          )
        })}
      </div>

      {showNew  && <NewTicketModal onClose={() => setShowNew(false)} onCreate={async t => { await createTicket(t); setShowNew(false) }} />}
      {selected && <TicketModal ticket={selected} onClose={() => setSelected(null)} onReply={addReply} />}
    </div>
  )
}
