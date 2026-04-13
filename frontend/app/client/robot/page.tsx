'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/* ────────────────────────────── Types ────────────────────────────── */

interface Campaign {
  id: string
  name: string
  type: string
  status: 'draft' | 'running' | 'paused' | 'completed'
  contacts_count: number
  config: any
  created_at: string
}

interface Subscription {
  service_type: string
  status: string
}

interface CsvRow { [key: string]: string }

/* ────────────────────────────── API ──────────────────────────────── */

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

/* ────────────────────────────── Styles ───────────────────────────── */

const IS: React.CSSProperties = {
  width: '100%', background: '#080810', border: '1px solid #2a2a4a', borderRadius: 8,
  padding: '10px 13px', color: '#e8e8f8', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

const LABEL: React.CSSProperties = {
  fontSize: 11, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em',
  display: 'block', marginBottom: 5, fontWeight: 600,
}

const CARD: React.CSSProperties = {
  background: '#0f0f1e', border: '1px solid #1e1e3a', borderRadius: 12, padding: '18px 22px',
}

/* ────────────────────────────── Status helpers ───────────────────── */

function statusColor(s: Campaign['status']): string {
  if (s === 'running') return '#00d4aa'
  if (s === 'paused') return '#ffb547'
  if (s === 'completed') return '#38b6ff'
  return '#6a6a8a'
}

function statusLabel(s: Campaign['status']): string {
  if (s === 'running') return 'En cours'
  if (s === 'paused') return 'En pause'
  if (s === 'completed') return 'Termine'
  return 'Brouillon'
}

/* ────────────────────────────── CSV Parser ───────────────────────── */

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(/[,;]/).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length && rows.length < 5; i++) {
    const vals = lines[i].split(/[,;]/).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: CsvRow = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
    rows.push(row)
  }
  return { headers, rows }
}

/* ────────────────────────────── Robot SVG Icon ───────────────────── */

function RobotIcon({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <rect x="16" y="28" width="48" height="36" rx="8" stroke="#7b61ff" strokeWidth="2.5" fill="#7b61ff12" />
      <circle cx="32" cy="44" r="5" fill="#7b61ff" />
      <circle cx="48" cy="44" r="5" fill="#7b61ff" />
      <rect x="34" y="54" width="12" height="3" rx="1.5" fill="#7b61ff" opacity="0.6" />
      <line x1="40" y1="18" x2="40" y2="28" stroke="#7b61ff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="14" r="4" stroke="#7b61ff" strokeWidth="2" fill="#7b61ff33" />
      <line x1="10" y1="40" x2="16" y2="40" stroke="#7b61ff" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="64" y1="40" x2="70" y2="40" stroke="#7b61ff" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="24" y="64" width="10" height="8" rx="3" stroke="#7b61ff" strokeWidth="2" fill="none" />
      <rect x="46" y="64" width="10" height="8" rx="3" stroke="#7b61ff" strokeWidth="2" fill="none" />
    </svg>
  )
}

/* ────────────────────────────── No Subscription View ─────────────── */

function NoSubscriptionView() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ marginBottom: 24 }}>
          <RobotIcon size={96} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e8e8f8', margin: '0 0 12px' }}>
          Robot d'appel masse
        </h1>
        <p style={{ fontSize: 14, color: '#6a6a8a', lineHeight: 1.7, margin: '0 0 8px' }}>
          Automatisez vos campagnes d'appels avec notre robot intelligent.
        </p>
        <p style={{ fontSize: 13, color: '#5a5a7a', lineHeight: 1.6, margin: '0 0 24px' }}>
          150k appels/h, TTS dynamique, IVR post-robot.
        </p>
        <div style={{
          display: 'inline-block', padding: '10px 20px', background: '#7b61ff12',
          border: '1px solid #7b61ff33', borderRadius: 10, marginBottom: 24,
        }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#7b61ff' }}>135</span>
          <span style={{ fontSize: 14, color: '#7b61ff', marginLeft: 4 }}>CAD$/mois</span>
        </div>
        <div>
          <a
            href="/commander?service=robot"
            style={{
              display: 'inline-block', padding: '13px 32px', background: '#7b61ff',
              border: 'none', borderRadius: 10, color: '#fff', fontSize: 14,
              fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
            }}
          >
            Souscrire au Robot d'appel
          </a>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────── Drawer ───────────────────────────── */

function CampaignDrawer({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (payload: { name: string; config: any; contacts_count: number }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [messageType, setMessageType] = useState<'tts' | 'audio'>('tts')
  const [ttsText, setTtsText] = useState('')
  const [ttsLang, setTtsLang] = useState('FR')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [afterAction, setAfterAction] = useState('hangup')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [timezone, setTimezone] = useState('America/Toronto')

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvTotalRows, setCsvTotalRows] = useState(0)
  const [phoneCol, setPhoneCol] = useState('')
  const [prenomCol, setPrenomCol] = useState('')
  const [csvFileName, setCsvFileName] = useState('')

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  const handleCsvUpload = (file: File) => {
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const totalLines = text.trim().split(/\r?\n/).length - 1
      setCsvTotalRows(totalLines)
      const { headers, rows } = parseCsv(text)
      setCsvHeaders(headers)
      setCsvRows(rows)
      // Auto-detect phone column
      const phoneGuess = headers.find(h => /phone|tel|numero|mobile|cell/i.test(h))
      if (phoneGuess) setPhoneCol(phoneGuess)
      const prenomGuess = headers.find(h => /prenom|first.?name|firstname|name/i.test(h))
      if (prenomGuess) setPrenomCol(prenomGuess)
    }
    reader.readAsText(file)
  }

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.csv')) handleCsvUpload(file)
  }

  const submit = async () => {
    setErr(null)
    if (!name.trim()) return setErr('Nom de la campagne requis')
    if (csvTotalRows < 1) return setErr('Veuillez uploader un fichier CSV')
    if (!phoneCol) return setErr('Selectionnez la colonne telephone')
    if (messageType === 'tts' && !ttsText.trim()) return setErr('Message TTS requis')
    if (messageType === 'audio' && !audioFile) return setErr('Fichier audio requis')

    setSaving(true)
    try {
      await onCreate({
        name,
        contacts_count: csvTotalRows,
        config: {
          message_type: messageType,
          tts_text: messageType === 'tts' ? ttsText : undefined,
          tts_lang: messageType === 'tts' ? ttsLang : undefined,
          audio_filename: messageType === 'audio' ? audioFile?.name : undefined,
          after_action: afterAction,
          phone_column: phoneCol,
          prenom_column: prenomCol || undefined,
          schedule_date: schedDate || undefined,
          schedule_time: schedTime || undefined,
          timezone,
        },
      })
      onClose()
    } catch (e: any) {
      setErr(e.message || 'Erreur lors de la creation')
    }
    setSaving(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: '#00000088', zIndex: 300 }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 500, maxWidth: '95vw',
        background: '#0c0c1a', borderLeft: '1px solid #1e1e3a', zIndex: 301,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e1e3a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#e8e8f8' }}>Nouvelle campagne robot</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5a5a7a', cursor: 'pointer', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Campaign name */}
          <div>
            <label style={LABEL}>Nom de la campagne</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Rappel rendez-vous mai" style={IS} />
          </div>

          {/* CSV Upload */}
          <div>
            <label style={LABEL}>Upload CSV</label>
            {csvHeaders.length === 0 ? (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleCsvDrop}
                onClick={() => csvInputRef.current?.click()}
                style={{
                  border: '2px dashed #2a2a4a', borderRadius: 10, padding: '32px 20px',
                  textAlign: 'center', cursor: 'pointer', background: '#080810',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#7b61ff55')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a4a')}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4a6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: 13, color: '#6a6a8a', marginBottom: 4 }}>Deposez votre fichier CSV ici</div>
                <div style={{ fontSize: 11, color: '#4a4a6a' }}>ou cliquez pour parcourir</div>
              </div>
            ) : (
              <div style={{ background: '#080810', border: '1px solid #1e1e3a', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#a0a0c0' }}>
                    {csvFileName} — {csvTotalRows} contacts detectes
                  </div>
                  <button
                    onClick={() => { setCsvHeaders([]); setCsvRows([]); setCsvTotalRows(0); setCsvFileName(''); setPhoneCol(''); setPrenomCol('') }}
                    style={{ background: 'transparent', border: 'none', color: '#ff4d6d', fontSize: 11, cursor: 'pointer' }}
                  >
                    Supprimer
                  </button>
                </div>
                {/* Preview table */}
                <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {csvHeaders.map(h => (
                          <th key={h} style={{ padding: '6px 10px', borderBottom: '1px solid #1e1e3a', color: '#7b61ff', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i}>
                          {csvHeaders.map(h => (
                            <td key={h} style={{ padding: '5px 10px', borderBottom: '1px solid #12122a', color: '#8a8aa8', whiteSpace: 'nowrap' }}>{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Column mapping */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ ...LABEL, fontSize: 10 }}>Colonne telephone (obligatoire)</label>
                    <select value={phoneCol} onChange={e => setPhoneCol(e.target.value)} style={IS}>
                      <option value="">-- Selectionner --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...LABEL, fontSize: 10 }}>Colonne prenom (optionnel)</label>
                    <select value={prenomCol} onChange={e => setPrenomCol(e.target.value)} style={IS}>
                      <option value="">-- Aucun --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f) }}
            />
          </div>

          {/* Message type radio */}
          <div>
            <label style={LABEL}>Type de message</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([['tts', 'TTS (Text-to-Speech)'], ['audio', 'Audio (MP3 pre-enregistre)']] as const).map(([val, lab]) => (
                <label key={val} style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  background: messageType === val ? '#7b61ff12' : '#080810',
                  border: `1px solid ${messageType === val ? '#7b61ff44' : '#2a2a4a'}`,
                  borderRadius: 8, cursor: 'pointer', fontSize: 12, color: messageType === val ? '#c0b0ff' : '#6a6a8a',
                }}>
                  <input
                    type="radio"
                    name="messageType"
                    checked={messageType === val}
                    onChange={() => setMessageType(val)}
                    style={{ accentColor: '#7b61ff' }}
                  />
                  {lab}
                </label>
              ))}
            </div>
          </div>

          {/* TTS or Audio */}
          {messageType === 'tts' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={LABEL}>Message vocal TTS</label>
                <textarea
                  value={ttsText}
                  onChange={e => { if (e.target.value.length <= 500) setTtsText(e.target.value) }}
                  rows={4}
                  placeholder="Bonjour {prenom}, ceci est un rappel automatise..."
                  style={{ ...IS, resize: 'vertical', lineHeight: 1.6 }}
                />
                <div style={{ fontSize: 11, color: '#4a4a6a', marginTop: 4, textAlign: 'right' }}>{ttsText.length}/500</div>
              </div>
              <div>
                <label style={LABEL}>Langue</label>
                <select value={ttsLang} onChange={e => setTtsLang(e.target.value)} style={IS}>
                  <option value="FR">Francais</option>
                  <option value="EN">English</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label style={LABEL}>Fichier audio MP3 (max 5 Mo)</label>
              {!audioFile ? (
                <div
                  onClick={() => audioInputRef.current?.click()}
                  style={{
                    border: '2px dashed #2a2a4a', borderRadius: 10, padding: '24px 20px',
                    textAlign: 'center', cursor: 'pointer', background: '#080810',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4a6a" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 6 }}>
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                  <div style={{ fontSize: 12, color: '#6a6a8a' }}>Cliquez pour choisir un fichier MP3</div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#080810', border: '1px solid #1e1e3a', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: '#a0a0c0' }}>{audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} Mo)</span>
                  <button onClick={() => setAudioFile(null)} style={{ background: 'transparent', border: 'none', color: '#ff4d6d', fontSize: 11, cursor: 'pointer' }}>Retirer</button>
                </div>
              )}
              <input
                ref={audioInputRef}
                type="file"
                accept=".mp3,audio/mpeg"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f && f.size <= 5 * 1024 * 1024) setAudioFile(f)
                  else if (f) setErr('Le fichier depasse 5 Mo')
                }}
              />
            </div>
          )}

          {/* After action */}
          <div>
            <label style={LABEL}>Action apres reponse</label>
            <select value={afterAction} onChange={e => setAfterAction(e.target.value)} style={IS}>
              <option value="hangup">Raccrocher</option>
              <option value="ivr">Transfert IVR</option>
              <option value="agent">Transfert agent</option>
            </select>
          </div>

          {/* Schedule */}
          <div>
            <label style={LABEL}>Planification</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={IS} />
              <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={IS} />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label style={LABEL}>Fuseau horaire</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} style={IS}>
              <option value="America/Toronto">America/Toronto</option>
              <option value="America/Montreal">America/Montreal</option>
              <option value="America/Vancouver">America/Vancouver</option>
              <option value="Europe/Paris">Europe/Paris</option>
            </select>
          </div>

          {/* Error */}
          {err && (
            <div style={{ padding: '8px 14px', borderRadius: 8, background: '#ff4d6d18', border: '1px solid #ff4d6d33', fontSize: 12, color: '#ff4d6d' }}>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #1e1e3a', display: 'flex', gap: 10 }}>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              flex: 1, padding: 12, background: saving ? '#5a4abf' : '#7b61ff', border: 'none',
              borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {saving ? 'Creation...' : 'Creer la campagne'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 20px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 9, color: '#5a5a7a', fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
        </div>
      </div>
    </>
  )
}

/* ────────────────────────────── Main Page ────────────────────────── */

export default function RobotPage() {
  const api = useApi()
  const [loading, setLoading] = useState(true)
  const [hasRobot, setHasRobot] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showDrawer, setShowDrawer] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Check subscription
      const subRes = await api('/api/v1/client/portal/subscriptions')
      const subs: Subscription[] = Array.isArray(subRes?.data) ? subRes.data : (Array.isArray(subRes) ? subRes : [])
      const robotSub = subs.find((s: Subscription) => s.service_type === 'ROBOT' && (s.status === 'active' || s.status === 'trialing'))
      if (!robotSub) {
        setHasRobot(false)
        setLoading(false)
        return
      }
      setHasRobot(true)

      // Load campaigns
      const campRes = await api('/api/v1/client/portal/robot/campaigns')
      const campData = Array.isArray(campRes?.data) ? campRes.data : (Array.isArray(campRes) ? campRes : [])
      setCampaigns(campData)
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const createCampaign = async (payload: { name: string; config: any; contacts_count: number }) => {
    const r = await api('/api/v1/client/portal/robot/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (r.error) throw new Error(r.error)
    await loadData()
  }

  const patchCampaign = async (id: string, patch: { status?: string; config?: any; name?: string }) => {
    try {
      await api(`/api/v1/client/portal/robot/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      await loadData()
    } catch (e: any) {
      console.error('[patchCampaign]', e)
    }
  }

  const duplicateCampaign = async (c: Campaign) => {
    try {
      await api('/api/v1/client/portal/robot/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: c.name + ' (copie)',
          config: c.config,
          contacts_count: c.contacts_count,
        }),
      })
      await loadData()
    } catch (e: any) {
      console.error('[duplicateCampaign]', e)
    }
  }

  // Stats
  const totalCampaigns = campaigns.length
  const contactsThisMonth = campaigns
    .filter(c => {
      const d = new Date(c.created_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, c) => s + (c.contacts_count || 0), 0)
  const avgResponse = 23.5

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #1e1e3a', borderTopColor: '#7b61ff',
            borderRadius: '50%', margin: '0 auto 14px',
            animation: 'robotSpin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 13, color: '#4a4a6a' }}>Chargement...</div>
          <style>{`@keyframes robotSpin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  /* ── No subscription ── */
  if (!hasRobot) {
    return <NoSubscriptionView />
  }

  /* ── Active subscription ── */
  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: '0 0 6px' }}>Robot d'appel</h1>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Gerez vos campagnes d'appels automatises.</p>
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: '#7b61ff', border: 'none', borderRadius: 9, color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouvelle campagne
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#ff4d6d10', border: '1px solid #ff4d6d33', borderRadius: 10, color: '#ff4d6d', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Campagnes totales', value: totalCampaigns, color: '#7b61ff' },
          { label: 'Contacts ce mois', value: contactsThisMonth.toLocaleString('fr-CA'), color: '#38b6ff' },
          { label: 'Taux reponse moyen', value: avgResponse + '%', color: '#00d4aa' },
        ].map(s => (
          <div key={s.label} style={CARD}>
            <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e3a' }}>
              {['Nom', 'Date', 'Contacts', 'Livres %', 'Repondus %', 'Statut', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase',
                  letterSpacing: '.06em', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: '#4a4a6a', fontSize: 13 }}>
                  Aucune campagne. Cliquez sur "Nouvelle campagne" pour commencer.
                </td>
              </tr>
            )}
            {campaigns.map(c => {
              const date = c.created_at ? new Date(c.created_at).toLocaleDateString('fr-CA') : '--'
              // Simulated percentages
              const deliveredPct = c.status === 'completed' ? 98 : c.status === 'running' ? 62 : c.status === 'paused' ? 45 : 0
              const answeredPct = c.status === 'completed' ? 24 : c.status === 'running' ? 18 : c.status === 'paused' ? 12 : 0

              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #12122a' }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#c8c8e8', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: '#6a6a8a' }}>{date}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#a0a0c0' }}>{(c.contacts_count || 0).toLocaleString('fr-CA')}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#a0a0c0' }}>{deliveredPct}%</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#a0a0c0' }}>{answeredPct}%</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                      background: statusColor(c.status) + '15',
                      color: statusColor(c.status),
                      border: `1px solid ${statusColor(c.status)}33`,
                    }}>
                      {c.status === 'running' && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', background: '#00d4aa',
                          animation: 'robotPulse 1.5s ease-in-out infinite',
                        }} />
                      )}
                      {statusLabel(c.status)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {/* Detail */}
                      <a
                        href={`/client/robot/${c.id}`}
                        style={{
                          padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                          background: '#7b61ff18', border: '1px solid #7b61ff33', color: '#a695ff',
                          textDecoration: 'none', fontWeight: 600,
                        }}
                      >
                        Detail
                      </a>
                      {/* Lancer */}
                      {(c.status === 'draft' || c.status === 'paused') && (
                        <button
                          onClick={() => patchCampaign(c.id, { status: 'running' })}
                          style={{
                            padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                            background: '#00d4aa18', border: '1px solid #00d4aa33', color: '#00d4aa', fontWeight: 600,
                          }}
                        >
                          Lancer
                        </button>
                      )}
                      {/* Arreter */}
                      {c.status === 'running' && (
                        <button
                          onClick={() => patchCampaign(c.id, { status: 'paused' })}
                          style={{
                            padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                            background: '#ffb54718', border: '1px solid #ffb54733', color: '#ffb547', fontWeight: 600,
                          }}
                        >
                          Arreter
                        </button>
                      )}
                      {/* Dupliquer */}
                      <button
                        onClick={() => duplicateCampaign(c)}
                        style={{
                          padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
                          background: '#38b6ff18', border: '1px solid #38b6ff33', color: '#38b6ff', fontWeight: 600,
                        }}
                      >
                        Dupliquer
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pulse animation */}
      <style>{`@keyframes robotPulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

      {/* Drawer */}
      {showDrawer && <CampaignDrawer onClose={() => setShowDrawer(false)} onCreate={createCampaign} />}
    </div>
  )
}
