'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

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

function fmtCents(c: number): string { return (c / 100).toFixed(2).replace('.', ',') }

const STATUS_BADGES: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20', label: 'Brouillon' },
  scheduled: { cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Planifie' },
  running: { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'En cours' },
  paused: { cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'En pause' },
  completed: { cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20', label: 'Termine' },
  canceled: { cls: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Annule' },
}

export default function RobotPage() {
  const api = useApi()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [drawer, setDrawer] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Drawer state
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', messageType: 'tts', messageContent: '', language: 'fr', afterAnswerAction: 'hangup', callerId: '', maxAttempts: 3, scheduledAt: '', gdprConsent: false })
  const [csvContacts, setCsvContacts] = useState<any[]>([])
  const [importResult, setImportResult] = useState<any>(null)
  const [creating, setCreating] = useState(false)

  const flash = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [sumRes, statsRes, campRes] = await Promise.all([
      api('/api/v1/billing/robot/summary'), api('/api/v1/robot/stats'), api('/api/v1/robot/campaigns'),
    ])
    if (sumRes.success) {
      setSummary(sumRes.data)
      setHasAccess(!!(sumRes.data.activePlan || sumRes.data.creditsBalance > 0))
    } else { setHasAccess(false) }
    if (statsRes.success) setStats(statsRes.data)
    if (campRes.success) setCampaigns(campRes.data?.campaigns || [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // Poll if any campaign is running
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === 'running')
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const res = await api('/api/v1/robot/campaigns')
        if (res.success) setCampaigns(res.data?.campaigns || [])
      }, 5000)
    } else if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [campaigns]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (id: string, action: string) => {
    const res = await api(`/api/v1/robot/campaigns/${id}/${action}`, { method: 'POST' })
    if (res.success) { flash(`Campagne ${action === 'start' ? 'lancee' : action === 'pause' ? 'en pause' : action === 'cancel' ? 'annulee' : 'reprise'}`); loadData() }
    else flash(res.error || 'Erreur', 'error')
  }

  const handleCreateCampaign = async (launch: boolean) => {
    setCreating(true)
    // Create campaign
    const campRes = await api('/api/v1/robot/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name, messageType: form.messageType, messageContent: form.messageContent,
        language: form.language, afterAnswerAction: form.afterAnswerAction, callerId: form.callerId || null,
        maxAttempts: form.maxAttempts, scheduledAt: form.scheduledAt || null,
        gdprConsentConfirmed: launch ? form.gdprConsent : false,
      }),
    })
    if (!campRes.success) { flash(campRes.error || 'Erreur creation', 'error'); setCreating(false); return }
    const campId = campRes.data?.id

    // Import contacts
    if (csvContacts.length > 0 && campId) {
      const importRes = await api(`/api/v1/robot/campaigns/${campId}/contacts`, {
        method: 'POST', body: JSON.stringify({ contacts: csvContacts }),
      })
      if (importRes.success) setImportResult(importRes.data)
    }

    // Launch if requested
    if (launch && campId) {
      const startRes = await api(`/api/v1/robot/campaigns/${campId}/start`, { method: 'POST' })
      if (startRes.success) flash('Campagne lancee')
      else flash(startRes.error || 'Erreur lancement', 'error')
    } else { flash('Campagne enregistree') }

    setDrawer(false); setStep(1); setForm({ name: '', messageType: 'tts', messageContent: '', language: 'fr', afterAnswerAction: 'hangup', callerId: '', maxAttempts: 3, scheduledAt: '', gdprConsent: false })
    setCsvContacts([]); setImportResult(null); setCreating(false); loadData()
  }

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-9 h-9 border-[3px] border-[#2e2e44] border-t-[#7b61ff] rounded-full animate-spin" /></div>

  // ── NO ACCESS ──
  if (!hasAccess) return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-[#7b61ff]/10 border border-[#7b61ff]/20 flex items-center justify-center mx-auto mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7b61ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
      </div>
      <h2 className="text-xl font-bold text-[#eeeef8] mb-3">Robot d&apos;appel masse</h2>
      <p className="text-[13px] text-[#55557a] mb-6">Envoyez des milliers d&apos;appels automatises. TTS, audio MP3, IVR, detection repondeur.</p>
      <div className="text-[13px] text-[#7b61ff] font-semibold mb-6">A partir de 49 CAD$/mois</div>
      <div className="flex gap-3 justify-center">
        <Link href="/client/plans" className="px-6 py-2.5 bg-[#7b61ff] text-white rounded-lg text-sm font-bold no-underline hover:bg-[#6145ff] transition-colors">Voir les plans</Link>
      </div>
    </div>
  )

  const mu = summary?.minutesUsage

  // ── ACTIVE ──
  return (
    <div className="w-full">
      {toast && <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg text-sm font-semibold shadow-lg ${toast.type === 'error' ? 'bg-red-950 border border-red-800 text-red-300' : 'bg-emerald-950 border border-emerald-800 text-emerald-300'}`}>{toast.msg}</div>}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Campagnes actives', value: stats.activeCampaigns, color: 'text-emerald-400' },
            { label: 'Contacts appeles', value: stats.totalContacts, color: 'text-[#eeeef8]' },
            { label: 'Taux reponse', value: stats.avgAnswerRate + '%', color: 'text-[#7b61ff]' },
            { label: 'Minutes restantes', value: mu ? mu.minutesRemaining.toFixed(0) : '-', color: 'text-[#ffb547]' },
          ].map((s, i) => (
            <div key={i} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
              <div className={`text-[22px] font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-[#55557a]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Minutes bar */}
      {mu && mu.minutesIncluded > 0 && (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4 mb-6">
          <div className="flex justify-between mb-1.5 text-[12px]">
            <span className="text-[#9898b8]">{mu.minutesUsed.toFixed(1)} / {mu.minutesIncluded} min</span>
            <span className="text-[#eeeef8] font-semibold">{mu.percentUsed}%</span>
          </div>
          <div className="h-2.5 bg-[#111118] rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${mu.percentUsed > 100 ? 'bg-red-500' : mu.percentUsed > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, mu.percentUsed)}%` }} />
          </div>
        </div>
      )}

      {/* Campaigns header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-[#9898b8]">Campagnes</h2>
        <div className="flex gap-2">
          <Link href="/client/robot/blacklist" className="px-4 py-2 bg-[#18181f] border border-[#2e2e44] text-[#9898b8] rounded-lg text-[12px] font-semibold no-underline hover:bg-[#1e1e2a]">Liste noire RGPD</Link>
          <button onClick={() => { setDrawer(true); setStep(1) }} className="px-4 py-2 bg-[#7b61ff] text-white rounded-lg text-[12px] font-bold cursor-pointer border-none hover:bg-[#6145ff]">Nouvelle campagne</button>
        </div>
      </div>

      {/* Campaigns table */}
      <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden mb-6">
        <div className="grid grid-cols-[1fr_100px_90px_120px_80px_80px_140px] px-5 py-2.5 bg-[#111118] border-b border-[#2e2e44] text-[10px] text-[#55557a] uppercase tracking-wider font-semibold">
          <div>Nom</div><div>Statut</div><div className="text-right">Contacts</div><div>Progression</div><div className="text-right">Repondus</div><div className="text-right">Minutes</div><div className="text-right">Actions</div>
        </div>
        {campaigns.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#55557a]">Aucune campagne. Creez votre premiere campagne.</div>
        ) : campaigns.map((c: any) => {
          const badge = STATUS_BADGES[c.status] || STATUS_BADGES.draft
          const pct = c.progressPercent || 0
          return (
            <div key={c.id} className="grid grid-cols-[1fr_100px_90px_120px_80px_80px_140px] px-5 py-3 border-b border-[#2e2e44]/60 items-center hover:bg-[#1e1e2a] transition-colors">
              <Link href={`/client/robot/${c.id}`} className="text-[13px] font-semibold text-[#eeeef8] no-underline hover:text-[#7b61ff]">{c.name}</Link>
              <div><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.cls} ${c.status === 'running' ? 'animate-pulse' : ''}`}>{badge.label}</span></div>
              <div className="text-right text-[13px] text-[#9898b8]">{c.total_contacts || 0}</div>
              <div>
                <div className="h-2 bg-[#111118] rounded-full overflow-hidden">
                  <div className="h-full bg-[#7b61ff] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-[#55557a] mt-0.5">{pct}%</div>
              </div>
              <div className="text-right text-[13px] text-[#9898b8]">{c.answered_human || 0}</div>
              <div className="text-right text-[13px] text-[#9898b8]">{parseFloat(c.minutes_used || 0).toFixed(1)}</div>
              <div className="flex gap-1 justify-end">
                {c.status === 'draft' && <button onClick={() => handleAction(c.id, 'start')} className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-[10px] font-semibold cursor-pointer border-none">Lancer</button>}
                {c.status === 'running' && <button onClick={() => handleAction(c.id, 'pause')} className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded text-[10px] font-semibold cursor-pointer border-none">Pause</button>}
                {c.status === 'paused' && <button onClick={() => handleAction(c.id, 'resume')} className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-[10px] font-semibold cursor-pointer border-none">Reprendre</button>}
                {['running', 'paused'].includes(c.status) && <button onClick={() => handleAction(c.id, 'cancel')} className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-[10px] font-semibold cursor-pointer border-none">Annuler</button>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── DRAWER ── */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setDrawer(false)}>
          <div onClick={e => e.stopPropagation()} className="w-[640px] max-w-full h-full bg-[#0c0c1a] border-l border-[#2e2e44] flex flex-col overflow-y-auto">
            <div className="px-6 py-5 border-b border-[#2e2e44] flex items-center justify-between">
              <div className="text-[17px] font-bold text-[#eeeef8]">Nouvelle campagne</div>
              <div className="flex gap-2 text-[12px] text-[#55557a]">
                {[1,2,3].map(s => <span key={s} className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${step >= s ? 'bg-[#7b61ff] text-white' : 'bg-[#1e1e2a] text-[#55557a]'}`}>{s}</span>)}
              </div>
            </div>

            <div className="flex-1 px-6 py-5">
              {/* Step 1: Message */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[12px] text-[#9898b8] mb-1 block">Nom de la campagne</label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" placeholder="Ma campagne" />
                  </div>
                  <div>
                    <label className="text-[12px] text-[#9898b8] mb-1 block">Type de message</label>
                    <div className="flex gap-2">
                      {['tts', 'audio'].map(t => (
                        <button key={t} onClick={() => setForm(p => ({ ...p, messageType: t }))} className={`px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer border ${form.messageType === t ? 'border-[#7b61ff] bg-[#7b61ff]/10 text-[#7b61ff]' : 'border-[#2e2e44] bg-[#111118] text-[#9898b8]'}`}>{t === 'tts' ? 'Texte (TTS)' : 'Audio MP3'}</button>
                      ))}
                    </div>
                  </div>
                  {form.messageType === 'tts' && (
                    <div>
                      <label className="text-[12px] text-[#9898b8] mb-1 block">Message TTS ({form.messageContent.length}/500)</label>
                      <textarea value={form.messageContent} onChange={e => setForm(p => ({ ...p, messageContent: e.target.value.slice(0, 500) }))} rows={4} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none resize-none" placeholder="Bonjour, ceci est un message automatise..." />
                    </div>
                  )}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[12px] text-[#9898b8] mb-1 block">Langue</label>
                      <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none">
                        <option value="fr">Francais canadien</option><option value="en">Anglais americain</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[12px] text-[#9898b8] mb-1 block">Apres reponse</label>
                      <select value={form.afterAnswerAction} onChange={e => setForm(p => ({ ...p, afterAnswerAction: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none">
                        <option value="hangup">Raccrocher</option><option value="ivr">IVR</option><option value="agent">Agent</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] text-[#9898b8] mb-1 block">Max tentatives (1-5)</label>
                    <input type="number" min={1} max={5} value={form.maxAttempts} onChange={e => setForm(p => ({ ...p, maxAttempts: Math.min(5, Math.max(1, parseInt(e.target.value) || 1)) }))} className="w-24 bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" />
                  </div>
                </div>
              )}

              {/* Step 2: Contacts */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[12px] text-[#9898b8] mb-2 block">Import CSV (phone, first_name, last_name)</label>
                    <input type="file" accept=".csv" onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const text = await file.text()
                      const Papa = (await import('papaparse')).default
                      const result = Papa.parse(text, { header: true, skipEmptyLines: true })
                      setCsvContacts(result.data as any[])
                    }} className="text-[12px] text-[#9898b8]" />
                  </div>
                  {csvContacts.length > 0 && (
                    <div>
                      <div className="text-[13px] text-[#eeeef8] font-semibold mb-2">{csvContacts.length} contacts charges</div>
                      <div className="bg-[#111118] rounded-lg p-3 max-h-[200px] overflow-y-auto">
                        {csvContacts.slice(0, 10).map((c: any, i: number) => (
                          <div key={i} className="text-[12px] text-[#9898b8] py-0.5">{c.phone} — {c.first_name || ''} {c.last_name || ''}</div>
                        ))}
                        {csvContacts.length > 10 && <div className="text-[11px] text-[#55557a] mt-1">... et {csvContacts.length - 10} de plus</div>}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-[12px] text-[#9898b8] mb-1 block">Date/heure de lancement (optionnel)</label>
                    <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2 text-[13px] text-[#eeeef8] outline-none" />
                  </div>
                </div>
              )}

              {/* Step 3: RGPD + launch */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="bg-[#111118] rounded-lg p-4 space-y-2 text-[13px]">
                    <div className="flex justify-between"><span className="text-[#9898b8]">Campagne</span><span className="text-[#eeeef8] font-semibold">{form.name}</span></div>
                    <div className="flex justify-between"><span className="text-[#9898b8]">Message</span><span className="text-[#eeeef8]">{form.messageType === 'tts' ? 'TTS' : 'Audio'} ({form.language})</span></div>
                    <div className="flex justify-between"><span className="text-[#9898b8]">Contacts</span><span className="text-[#eeeef8]">{csvContacts.length}</span></div>
                    <div className="flex justify-between"><span className="text-[#9898b8]">Minutes estimees</span><span className="text-[#eeeef8]">{(csvContacts.length * 0.5).toFixed(0)} min</span></div>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.gdprConsent} onChange={e => setForm(p => ({ ...p, gdprConsent: e.target.checked }))} className="w-4 h-4 accent-[#7b61ff] mt-0.5" />
                    <span className="text-[12px] text-[#9898b8] leading-relaxed">Je confirme avoir obtenu le consentement explicite de tous les contacts pour recevoir cet appel automatise, conformement a la loi canadienne anti-pourriel (LCAP).</span>
                  </label>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#2e2e44] flex justify-between">
              {step > 1 ? <button onClick={() => setStep(s => s - 1)} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Precedent</button> : <div />}
              <div className="flex gap-2">
                {step < 3 && <button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.name} className={`px-5 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer ${form.name ? 'bg-[#7b61ff] text-white' : 'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}>Suivant</button>}
                {step === 3 && (
                  <>
                    <button onClick={() => handleCreateCampaign(false)} disabled={creating} className="px-5 py-2 bg-[#18181f] border border-[#2e2e44] rounded-lg text-[#9898b8] text-[12px] font-semibold cursor-pointer">Enregistrer brouillon</button>
                    <button onClick={() => handleCreateCampaign(true)} disabled={creating || !form.gdprConsent} className={`px-5 py-2 rounded-lg text-[12px] font-bold border-none cursor-pointer ${form.gdprConsent && !creating ? 'bg-emerald-600 text-white' : 'bg-[#2e2e44] text-[#55557a] cursor-not-allowed'}`}>{creating ? '...' : 'Lancer maintenant'}</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
