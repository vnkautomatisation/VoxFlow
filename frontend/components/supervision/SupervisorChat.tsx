'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface Message {
  id: string; from_user_id: string; to_user_id: string
  content: string; read_at: string | null; created_at: string
}

interface Props {
  agentId: string
  agentName: string
  currentUserId: string
  onClose: () => void
}

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''
const apiFetch = async (path: string, opts: RequestInit = {}) => {
  const r = await fetch(API() + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...(opts.headers || {}) },
    body: opts.body,
  })
  return r.json()
}

export default function SupervisorChat({ agentId, agentName, currentUserId, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const r = await apiFetch(`/api/v1/supervision/chat/${agentId}`)
    if (r.success && Array.isArray(r.data)) setMessages(r.data)
  }, [agentId])

  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id) }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    await apiFetch(`/api/v1/supervision/chat/${agentId}`, {
      method: 'POST', body: JSON.stringify({ content: input.trim() }),
    })
    setInput('')
    setSending(false)
    load()
  }

  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 20, width: 320, height: 420,
      background: '#18181f', border: '1px solid #2e2e44', borderRadius: 16,
      display: 'flex', flexDirection: 'column', zIndex: 100,
      boxShadow: '0 16px 48px rgba(0,0,0,.7)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid #2e2e44', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#eeeef8' }}>{agentName}</div>
          <div style={{ fontSize: 10, color: '#55557a' }}>Chat superviseur</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#55557a', cursor: 'pointer', fontSize: 18 }}>x</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#35355a', fontSize: 12, marginTop: 40 }}>
            Aucun message. Envoyez un message a l'agent.
          </div>
        )}
        {messages.map(m => {
          const isMe = m.from_user_id === currentUserId
          return (
            <div key={m.id} style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}>
              <div style={{
                background: isMe ? '#7b61ff' : '#1f1f2a',
                color: isMe ? '#fff' : '#eeeef8',
                padding: '7px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.4,
              }}>
                {m.content}
              </div>
              <div style={{ fontSize: 9, color: '#55557a', marginTop: 2, textAlign: isMe ? 'right' : 'left' }}>
                {fmtTime(m.created_at)}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 12px',
        borderTop: '1px solid #2e2e44', flexShrink: 0,
      }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Message..."
          style={{
            flex: 1, background: '#111118', border: '1px solid #2e2e44',
            borderRadius: 10, padding: '8px 12px', color: '#eeeef8',
            fontSize: 12, outline: 'none',
          }} />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{
            padding: '8px 14px', background: '#7b61ff', border: 'none',
            borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', opacity: sending || !input.trim() ? 0.5 : 1,
          }}>
          Envoyer
        </button>
      </div>
    </div>
  )
}
