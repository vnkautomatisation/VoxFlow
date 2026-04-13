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

/* ────────────────────────────── Status helpers ───────────────────── */

function statusBadgeClasses(s: Campaign['status']): { bg: string; text: string; border: string; label: string } {
  if (s === 'running')   return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'En cours' }
  if (s === 'paused')    return { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20',   label: 'En pause' }
  if (s === 'completed') return { bg: 'bg-sky-500/10',     text: 'text-sky-400',     border: 'border-sky-500/20',     label: 'Termine' }
  return { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20', label: 'Brouillon' }
}

function statusColor(s: Campaign['status']): string {
  if (s === 'running') return '#00d4aa'
  if (s === 'paused') return '#ffb547'
  if (s === 'completed') return '#38b6ff'
  return '#6a6a8a'
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
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center max-w-[480px]">
        <div className="mb-6">
          <RobotIcon size={96} />
        </div>
        <h1 className="text-[26px] font-bold text-[#eeeef8] mb-3">
          Robot d'appel masse
        </h1>
        <p className="text-sm text-[#6a6a8a] leading-relaxed mb-2">
          Automatisez vos campagnes d'appels avec notre robot intelligent.
        </p>
        <ul className="text-[13px] text-[#5a5a7a] leading-relaxed mb-6 space-y-1 text-left inline-block">
          <li>150k appels/h</li>
          <li>TTS dynamique</li>
          <li>Message vocal pre-enregistre</li>
          <li>IVR post-robot</li>
          <li>RGPD liste noire</li>
          <li>Export resultats</li>
        </ul>
        <div className="mb-6">
          <div className="inline-block px-5 py-2.5 bg-[#7b61ff]/5 border border-[#7b61ff]/20 rounded-xl">
            <span className="text-[28px] font-bold text-[#7b61ff]">135</span>
            <span className="text-sm text-[#7b61ff] ml-1">CAD$/mois</span>
          </div>
        </div>
        <div>
          <a
            href="/client/plans"
            className="inline-block px-8 py-3 bg-[#7b61ff] hover:bg-[#6145ff] rounded-lg text-white text-sm font-bold no-underline transition-colors"
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

  const inputCls = 'w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]'

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[300]" />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-[500px] max-w-[95vw] bg-[#18181f] border-l border-[#2e2e44] z-[301] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#2e2e44] flex justify-between items-center">
          <div className="text-[17px] font-bold text-[#eeeef8]">Nouvelle campagne robot</div>
          <button onClick={onClose} className="bg-transparent border-none text-[#5a5a7a] hover:text-[#8a8aa8] cursor-pointer p-1 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Campaign name */}
          <div>
            <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Nom de la campagne</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Rappel rendez-vous mai" className={inputCls} />
          </div>

          {/* CSV Upload */}
          <div>
            <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Upload CSV</label>
            {csvHeaders.length === 0 ? (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleCsvDrop}
                onClick={() => csvInputRef.current?.click()}
                className="border-2 border-dashed border-[#2e2e44] rounded-xl px-5 py-8 text-center cursor-pointer bg-[#1f1f2a] hover:border-[#7b61ff]/30 transition-colors"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4a6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div className="text-[13px] text-[#6a6a8a] mb-1">Deposez votre fichier CSV ici</div>
                <div className="text-[11px] text-[#4a4a6a]">ou cliquez pour parcourir</div>
              </div>
            ) : (
              <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-xl p-3.5">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-xs text-[#a0a0c0]">
                    {csvFileName} -- {csvTotalRows} contacts detectes
                  </div>
                  <button
                    onClick={() => { setCsvHeaders([]); setCsvRows([]); setCsvTotalRows(0); setCsvFileName(''); setPhoneCol(''); setPrenomCol('') }}
                    className="bg-transparent border-none text-red-400 text-[11px] cursor-pointer hover:text-red-300 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
                {/* Preview table */}
                <div className="overflow-x-auto mb-3.5">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr>
                        {csvHeaders.map(h => (
                          <th key={h} className="px-2.5 py-1.5 border-b border-[#2e2e44] text-[#7b61ff] font-semibold text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i}>
                          {csvHeaders.map(h => (
                            <td key={h} className="px-2.5 py-1.5 border-b border-[#1f1f2a] text-[#8a8aa8] whitespace-nowrap">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Column mapping */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-[#6a6a8a] uppercase tracking-wider mb-1 font-semibold">Colonne telephone (obligatoire)</label>
                    <select value={phoneCol} onChange={e => setPhoneCol(e.target.value)} className={inputCls}>
                      <option value="">-- Selectionner --</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#6a6a8a] uppercase tracking-wider mb-1 font-semibold">Colonne prenom (optionnel)</label>
                    <select value={prenomCol} onChange={e => setPrenomCol(e.target.value)} className={inputCls}>
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
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f) }}
            />
          </div>

          {/* Message type radio */}
          <div>
            <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Type de message</label>
            <div className="flex gap-2.5">
              {([['tts', 'TTS (Text-to-Speech)'], ['audio', 'Audio (MP3 pre-enregistre)']] as const).map(([val, lab]) => (
                <label key={val} className={`flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-lg cursor-pointer text-xs border transition-colors ${
                  messageType === val
                    ? 'bg-[#7b61ff]/5 border-[#7b61ff]/25 text-[#c0b0ff]'
                    : 'bg-[#1f1f2a] border-[#2e2e44] text-[#6a6a8a]'
                }`}>
                  <input
                    type="radio"
                    name="messageType"
                    checked={messageType === val}
                    onChange={() => setMessageType(val)}
                    className="accent-[#7b61ff]"
                  />
                  {lab}
                </label>
              ))}
            </div>
          </div>

          {/* TTS or Audio */}
          {messageType === 'tts' ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Message vocal TTS</label>
                <textarea
                  value={ttsText}
                  onChange={e => { if (e.target.value.length <= 500) setTtsText(e.target.value) }}
                  rows={4}
                  placeholder="Bonjour {prenom}, ceci est un rappel automatise..."
                  className={`${inputCls} resize-y leading-relaxed`}
                />
                <div className="text-[11px] text-[#4a4a6a] mt-1 text-right">{ttsText.length}/500</div>
              </div>
              <div>
                <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Langue</label>
                <select value={ttsLang} onChange={e => setTtsLang(e.target.value)} className={inputCls}>
                  <option value="FR">Francais</option>
                  <option value="EN">English</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Fichier audio MP3 (max 5 Mo)</label>
              {!audioFile ? (
                <div
                  onClick={() => audioInputRef.current?.click()}
                  className="border-2 border-dashed border-[#2e2e44] rounded-xl px-5 py-6 text-center cursor-pointer bg-[#1f1f2a] hover:border-[#7b61ff]/30 transition-colors"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4a6a" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-1.5">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                  <div className="text-xs text-[#6a6a8a]">Cliquez pour choisir un fichier MP3</div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg">
                  <span className="text-xs text-[#a0a0c0]">{audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} Mo)</span>
                  <button onClick={() => setAudioFile(null)} className="bg-transparent border-none text-red-400 text-[11px] cursor-pointer hover:text-red-300 transition-colors">Retirer</button>
                </div>
              )}
              <input
                ref={audioInputRef}
                type="file"
                accept=".mp3,audio/mpeg"
                className="hidden"
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
            <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Action apres reponse</label>
            <select value={afterAction} onChange={e => setAfterAction(e.target.value)} className={inputCls}>
              <option value="hangup">Raccrocher</option>
              <option value="ivr">Transfert IVR</option>
              <option value="agent">Transfert agent</option>
            </select>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Planification</label>
            <div className="grid grid-cols-2 gap-2.5">
              <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className={inputCls} />
              <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-[11px] text-[#6a6a8a] uppercase tracking-wider mb-1.5 font-semibold">Fuseau horaire</label>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls}>
              <option value="America/Toronto">America/Toronto</option>
              <option value="America/Montreal">America/Montreal</option>
              <option value="America/Vancouver">America/Vancouver</option>
              <option value="Europe/Paris">Europe/Paris</option>
            </select>
          </div>

          {/* Error */}
          {err && (
            <div className="px-3.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-2.5">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-3 bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg text-[13px] font-bold transition-colors disabled:opacity-60"
          >
            {saving ? 'Creation...' : 'Creer la campagne'}
          </button>
          <button onClick={onClose} className="px-5 py-3 bg-transparent border border-[#2e2e44] rounded-lg text-[#5a5a7a] text-[13px] hover:border-[#3e3e54] transition-colors">
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

  /* -- Loading -- */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-9 h-9 border-[3px] border-[#1e1e3a] border-t-[#7b61ff] rounded-full mx-auto mb-3.5 animate-spin" />
          <div className="text-[13px] text-[#4a4a6a]">Chargement...</div>
        </div>
      </div>
    )
  }

  /* -- No subscription -- */
  if (!hasRobot) {
    return <NoSubscriptionView />
  }

  /* -- Active subscription -- */
  return (
    <div>
      {/* Page header */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#eeeef8] mb-1.5">Robot d'appel</h1>
          <p className="text-[13px] text-[#6a6a8a]">Gerez vos campagnes d'appels automatises.</p>
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          className="flex items-center gap-2 bg-[#7b61ff] text-white hover:bg-[#6145ff] rounded-lg px-4 py-2 text-sm font-bold transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouvelle campagne
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-[13px] mb-4">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Campagnes totales', value: totalCampaigns, color: 'text-[#7b61ff]' },
          { label: 'Contacts ce mois', value: contactsThisMonth.toLocaleString('fr-CA'), color: 'text-sky-400' },
          { label: 'Taux reponse moyen', value: avgResponse + '%', color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
            <div className="text-[10px] text-[#4a4a6a] uppercase tracking-wider mb-1.5">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#1f1f2a]">
              {['Nom', 'Date', 'Contacts', 'Livres %', 'Repondus %', 'Statut', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] text-[#4a4a6a] uppercase tracking-wider font-semibold text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#4a4a6a] text-[13px]">
                  Aucune campagne. Cliquez sur "Nouvelle campagne" pour commencer.
                </td>
              </tr>
            )}
            {campaigns.map(c => {
              const date = c.created_at ? new Date(c.created_at).toLocaleDateString('fr-CA') : '--'
              // Simulated percentages
              const deliveredPct = c.status === 'completed' ? 98 : c.status === 'running' ? 62 : c.status === 'paused' ? 45 : 0
              const answeredPct = c.status === 'completed' ? 24 : c.status === 'running' ? 18 : c.status === 'paused' ? 12 : 0
              const badge = statusBadgeClasses(c.status)

              return (
                <tr key={c.id} className="border-b border-[#1f1f2a] hover:bg-[#1f1f2a] transition-colors">
                  <td className="px-4 py-3.5 text-[13px] text-[#c8c8e8] font-semibold">{c.name}</td>
                  <td className="px-4 py-3.5 text-xs text-[#6a6a8a]">{date}</td>
                  <td className="px-4 py-3.5 text-[13px] text-[#a0a0c0]">{(c.contacts_count || 0).toLocaleString('fr-CA')}</td>
                  <td className="px-4 py-3.5 text-[13px] text-[#a0a0c0]">{deliveredPct}%</td>
                  <td className="px-4 py-3.5 text-[13px] text-[#a0a0c0]">{answeredPct}%</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                      {c.status === 'running' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1.5 flex-wrap">
                      {/* Detail */}
                      <a
                        href={`/client/robot/${c.id}`}
                        className="px-2.5 py-1 text-[11px] rounded-md bg-[#7b61ff]/10 border border-[#7b61ff]/20 text-[#a695ff] no-underline font-semibold hover:bg-[#7b61ff]/20 transition-colors"
                      >
                        Detail
                      </a>
                      {/* Lancer */}
                      {(c.status === 'draft' || c.status === 'paused') && (
                        <button
                          onClick={() => patchCampaign(c.id, { status: 'running' })}
                          className="px-2.5 py-1 text-[11px] rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-colors"
                        >
                          Lancer
                        </button>
                      )}
                      {/* Arreter */}
                      {c.status === 'running' && (
                        <button
                          onClick={() => patchCampaign(c.id, { status: 'paused' })}
                          className="px-2.5 py-1 text-[11px] rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold hover:bg-amber-500/20 transition-colors"
                        >
                          Arreter
                        </button>
                      )}
                      {/* Dupliquer */}
                      <button
                        onClick={() => duplicateCampaign(c)}
                        className="px-2.5 py-1 text-[11px] rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 font-semibold hover:bg-sky-500/20 transition-colors"
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

      {/* Drawer */}
      {showDrawer && <CampaignDrawer onClose={() => setShowDrawer(false)} onCreate={createCampaign} />}
    </div>
  )
}
