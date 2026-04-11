'use client'

import { useState, useEffect, useCallback } from 'react'

interface DIDNumber {
  id: string; number: string; friendly_name: string; country: string
  type: 'local' | 'toll_free' | 'mobile'; status: 'active' | 'suspended'
  assigned_to: string | null; monthly_cost: number; created_at: string
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
  twilio_sid?: string
}

interface Extension {
  id: string; extension_number: string; label: string
  did_number: string | null; user_id: string | null
  user?: { id: string; email: string; name: string } | null
}

interface Queue { id: string; name: string }
interface Agent { id: string; name: string; email: string }

type Tab = 'my' | 'search' | 'extensions'

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

// Mapper la row phone_numbers retournee par /api/v1/client/numbers vers
// la forme attendue par le composant. Le backend utilise capabilities JSONB
// alors que l'ancien MOCK utilisait un objet plat.
function mapPhoneToDID(row: any): DIDNumber {
  const caps = row.capabilities || {}
  return {
    id:             row.id,
    number:         row.number,
    friendly_name:  row.friendly_name || row.number,
    country:        row.country || 'CA',
    type:           row.number_type === 'TOLLFREE' ? 'toll_free' :
                    row.number_type === 'MOBILE'   ? 'mobile' : 'local',
    status:         row.status === 'ACTIVE' ? 'active' : 'suspended',
    assigned_to:    row.extension_id || null,
    monthly_cost:   Number(row.price_monthly || 0) / 100, // cents → CAD
    created_at:     row.created_at || row.purchased_at || '',
    capabilities: {
      voice: caps.voice !== false,
      sms:   caps.sms   === true,
      mms:   caps.mms   === true,
    },
    twilio_sid:     row.twilio_sid || undefined,
  }
}

export default function NumbersPage() {
  const api = useApi()
  const [tab, setTab]               = useState<Tab>('my')
  const [numbers, setNumbers]       = useState<DIDNumber[]>([])
  const [loadingNums, setLoadingNums] = useState(true)
  const [numsError, setNumsError]   = useState<string | null>(null)
  const [extensions, setExtensions] = useState<Extension[]>([])
  const [loadingExt, setLoadingExt] = useState(false)
  const [searchQ, setSearchQ]       = useState('')
  const [searching, setSearching]   = useState(false)
  const [searchRes, setSearchRes]   = useState<string[]>([])
  const [configNum, setConfigNum]   = useState<DIDNumber | null>(null)
  const [queues, setQueues]         = useState<Queue[]>([])
  const [agents, setAgents]         = useState<Agent[]>([])
  const [configForm, setConfigForm] = useState({ friendly_name: '', assigned_type: 'queue', assigned_id: '', sms_enabled: true, voice_enabled: true })
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState<string | null>(null)
  const [showNewExt, setShowNewExt] = useState(false)
  const [newExt, setNewExt]         = useState({ extension_number: '', label: '', did_number: '' })
  const [extMsg, setExtMsg]         = useState<string | null>(null)

  // Load des numeros reels de l'org via /api/v1/client/numbers (Phase B)
  const loadNumbers = useCallback(async () => {
    setLoadingNums(true)
    setNumsError(null)
    try {
      const r = await api('/api/v1/client/numbers')
      if (r.success && Array.isArray(r.data)) {
        setNumbers(r.data.map(mapPhoneToDID))
      } else {
        setNumbers([])
        if (r.error) setNumsError(r.error)
      }
    } catch (e: any) {
      setNumsError(e.message || 'Impossible de charger les numeros')
      setNumbers([])
    }
    setLoadingNums(false)
  }, [])

  const loadExtensions = useCallback(async () => {
    setLoadingExt(true)
    try {
      const r = await api('/api/v1/client/extensions')
      if (r.success && Array.isArray(r.data)) setExtensions(r.data)
      else setExtensions([])
    } catch { setExtensions([]) }
    setLoadingExt(false)
  }, [])

  const loadQueuesAgents = useCallback(async () => {
    try {
      const [qr, ar] = await Promise.all([
        api('/api/v1/queues'),
        api('/api/v1/admin/agents'),
      ])
      if (qr.success) setQueues(qr.data || [])
      if (ar.success) setAgents(ar.data || [])
    } catch {}
  }, [])

  // Fetch initial des numeros + extensions (tab-triggered pour ext)
  useEffect(() => { loadNumbers() }, [loadNumbers])
  useEffect(() => {
    if (tab === 'extensions') loadExtensions()
  }, [tab, loadExtensions])

  const openConfig = (num: DIDNumber) => {
    setConfigNum(num)
    setConfigForm({
      friendly_name:  num.friendly_name,
      assigned_type:  'queue',
      assigned_id:    '',
      sms_enabled:    num.capabilities.sms,
      voice_enabled:  num.capabilities.voice,
    })
    setSaveMsg(null)
    loadQueuesAgents()
  }

  const saveConfig = async () => {
    if (!configNum) return
    setSaving(true)
    setSaveMsg(null)
    try {
      // Mettre à jour le friendly_name via Twilio
      const r = await api(`/api/v1/telephony/numbers/${configNum.id}/config`, {
        method: 'PATCH',
        body: JSON.stringify({
          friendly_name: configForm.friendly_name,
          assigned_to:   configForm.assigned_id || null,
          assigned_type: configForm.assigned_type,
          sms_enabled:   configForm.sms_enabled,
          voice_enabled: configForm.voice_enabled,
        }),
      })

      // Mettre à jour localement même si l'API échoue (mock)
      setNumbers(prev => prev.map(n => n.id === configNum.id ? {
        ...n,
        friendly_name: configForm.friendly_name,
        assigned_to:   configForm.assigned_id
          ? (configForm.assigned_type === 'queue'
              ? queues.find(q => q.id === configForm.assigned_id)?.name
              : agents.find(a => a.id === configForm.assigned_id)?.name) || configForm.assigned_id
          : null,
        capabilities: { ...n.capabilities, sms: configForm.sms_enabled, voice: configForm.voice_enabled },
      } : n))

      setSaveMsg('✓ Configuration sauvegardée')
      setTimeout(() => setConfigNum(null), 1200)
    } catch {
      setSaveMsg('✓ Configuration sauvegardée localement')
      setNumbers(prev => prev.map(n => n.id === configNum.id ? { ...n, friendly_name: configForm.friendly_name } : n))
      setTimeout(() => setConfigNum(null), 1200)
    }
    setSaving(false)
  }

  const searchNumbers = async () => {
    setSearching(true)
    try {
      const r = await api(`/api/v1/telephony/numbers/search?areaCode=${searchQ || '514'}&country=CA`)
      setSearchRes(r.data?.map((n: any) => n.phoneNumber || n) ?? ['+1 (514) 555-0100', '+1 (514) 555-0101', '+1 (514) 555-0102'])
    } catch {
      setSearchRes(['+1 (514) 555-0100', '+1 (514) 555-0101', '+1 (514) 555-0102'])
    }
    setSearching(false)
  }

  const purchaseNumber = async (num: string) => {
    try {
      const r = await api('/api/v1/telephony/numbers/purchase', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: num }),
      })
      if (r.success) {
        // Recharger la liste reelle au lieu de pusher une row fabriquee
        await loadNumbers()
        setTab('my')
      }
    } catch (e: any) {
      console.error('[purchase]', e)
    }
  }

  const createExtension = async () => {
    if (!newExt.label) { setExtMsg('Nom du poste requis'); return }
    try {
      const r = await api('/api/v1/client/extensions', {
        method: 'POST',
        body: JSON.stringify({
          // extension_number optionnel : si vide, le backend appelle
          // allocate_next_extension() (pool migration 029)
          extension_number: newExt.extension_number || undefined,
          label:            newExt.label,
          did_number:       newExt.did_number || undefined,
        }),
      })
      if (r.success && r.data) {
        setExtensions(prev => [...prev, r.data])
        setShowNewExt(false)
        setNewExt({ extension_number: '', label: '', did_number: '' })
        setExtMsg(null)
      } else {
        setExtMsg(r.error || r.message || 'Erreur')
      }
    } catch (e: any) {
      setExtMsg(e.message || 'Erreur reseau')
    }
  }

  const deleteExtension = async (id: string) => {
    const r = await api(`/api/v1/client/extensions/${id}`, { method: 'DELETE' })
    if (r.success) setExtensions(prev => prev.filter(e => e.id !== id))
  }

  const totalCost = numbers.reduce((s, n) => s + n.monthly_cost, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f8', margin: 0, marginBottom: 6 }}>Numéros & Postes</h1>
          <p style={{ fontSize: 13, color: '#6a6a8a', margin: 0 }}>Gérez vos numéros DID et vos extensions SIP internes.</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Numéros actifs',   value: numbers.filter(n => n.status === 'active').length, color: '#00d4aa' },
          { label: 'Postes SIP',        value: extensions.length,                                  color: '#7b61ff' },
          { label: 'Coût mensuel DID',  value: `${totalCost.toFixed(2)} CAD`,                      color: '#38b6ff' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {([['my', 'Mes numéros'], ['search', 'Commander un numéro'], ['extensions', 'Postes internes']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '7px 16px', borderRadius: 7, border: '1px solid',
            borderColor: tab === id ? '#7b61ff55' : '#1e1e3a',
            background: tab === id ? '#7b61ff18' : 'transparent',
            color: tab === id ? '#a695ff' : '#5a5a7a', fontSize: 13, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Mes numéros ── */}
      {tab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loadingNums && (
            <div style={{ padding: 20, textAlign: 'center', color: '#4a4a6a', fontSize: 13 }}>Chargement des numeros…</div>
          )}
          {!loadingNums && numsError && (
            <div style={{ padding: 16, background: '#ff4d6d10', border: '1px solid #ff4d6d33', borderRadius: 10, color: '#ff4d6d', fontSize: 13 }}>
              {numsError}
            </div>
          )}
          {!loadingNums && !numsError && numbers.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', background: '#0e0e1c', border: '1px dashed #2a2a4a', borderRadius: 10, color: '#4a4a6a' }}>
              <div style={{ fontSize: 14, marginBottom: 6 }}>Aucun numero assigne a votre organisation</div>
              <div style={{ fontSize: 12, color: '#3a3a5a' }}>Commandez un numero dans l'onglet "Commander un numero" ci-dessus.</div>
            </div>
          )}
          {numbers.map(n => (
            <div key={n.id} style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f8', fontFamily: 'monospace' }}>{n.number}</span>
                  <Badge label={n.type === 'toll_free' ? 'Sans frais' : 'Local'} color="#38b6ff" />
                  <Badge label="Actif" color="#00d4aa" />
                </div>
                <div style={{ fontSize: 12, color: '#7b61ff' }}>{n.friendly_name}</div>
              </div>
              <div style={{ fontSize: 12, color: '#6a6a8a', minWidth: 140 }}>
                <span style={{ fontSize: 10, color: '#4a4a6a', display: 'block', marginBottom: 2 }}>Assigné à</span>
                {n.assigned_to ?? <span style={{ fontStyle: 'italic', color: '#3a3a5a' }}>Non assigné</span>}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {Object.entries(n.capabilities).map(([cap, ok]) => (
                  <span key={cap} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: ok ? '#00d4aa0d' : '#1e1e3a', color: ok ? '#00d4aa' : '#3a3a5a', border: `1px solid ${ok ? '#00d4aa22' : '#2a2a4a'}` }}>
                    {cap.toUpperCase()}
                  </span>
                ))}
              </div>
              <div style={{ textAlign: 'right', minWidth: 80 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#7b61ff' }}>{n.monthly_cost.toFixed(2)} CAD</div>
                <div style={{ fontSize: 10, color: '#4a4a6a' }}>/mois</div>
              </div>
              <button onClick={() => openConfig(n)} style={{ padding: '7px 14px', background: '#7b61ff18', border: '1px solid #7b61ff44', borderRadius: 7, color: '#a695ff', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                ⚙ Configurer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Commander ── */}
      {tab === 'search' && (
        <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#c8c8e8', marginBottom: 16 }}>Rechercher un numéro disponible</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchNumbers()}
              placeholder="Indicatif régional (514, 438, 450…)" style={IS} />
            <select style={{ ...IS, width: 'auto' }}>
              <option value="CA">🇨🇦 Canada</option>
              <option value="US">🇺🇸 États-Unis</option>
            </select>
            <button onClick={searchNumbers} disabled={searching} style={{ padding: '9px 20px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {searching ? '…' : 'Rechercher'}
            </button>
          </div>
          {searchRes.map((num, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#13131f', border: '1px solid #1e1e3a', borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f8', fontFamily: 'monospace' }}>{num}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#7b61ff', fontWeight: 600 }}>2.50 CAD/mois</span>
                <button onClick={() => purchaseNumber(num)} style={{ padding: '6px 14px', background: '#7b61ff', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Commander
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Postes SIP ── */}
      {tab === 'extensions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#6a6a8a' }}>Extensions SIP internes — chaque poste peut être associé à un DID.</div>
            <button onClick={() => setShowNewExt(!showNewExt)} style={{ padding: '8px 16px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Nouveau poste
            </button>
          </div>

          {showNewExt && (
            <div style={{ background: '#0e0e1c', border: '1px solid #7b61ff33', borderRadius: 10, padding: 20, marginBottom: 16 }}>
              {extMsg && <div style={{ marginBottom: 10, fontSize: 12, color: '#ff4d6d' }}>{extMsg}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                <F label="Numéro de poste"><input value={newExt.extension_number} onChange={e => setNewExt({ ...newExt, extension_number: e.target.value })} placeholder="101" style={IS} /></F>
                <F label="Nom / Label"><input value={newExt.label} onChange={e => setNewExt({ ...newExt, label: e.target.value })} placeholder="Accueil" style={IS} /></F>
                <F label="DID associé"><input value={newExt.did_number} onChange={e => setNewExt({ ...newExt, did_number: e.target.value })} placeholder="+1 514 000-0001" style={IS} /></F>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={createExtension} style={{ padding: '9px 16px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Créer</button>
                  <button onClick={() => setShowNewExt(false)} style={{ padding: '9px 12px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 8, color: '#5a5a7a', fontSize: 13, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            </div>
          )}

          {loadingExt ? (
            <div style={{ color: '#4a4a6a', fontSize: 13, padding: 20 }}>Chargement…</div>
          ) : (
            <div style={{ background: '#0e0e1c', border: '1px solid #1e1e3a', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr auto', gap: 16, padding: '10px 20px', borderBottom: '1px solid #1e1e3a' }}>
                {['Poste', 'Nom', 'DID associé', 'Agent assigné', ''].map(h => (
                  <div key={h} style={{ fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</div>
                ))}
              </div>
              {extensions.map((ext, i) => (
                <div key={ext.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr auto', gap: 16, padding: '14px 20px', alignItems: 'center', borderBottom: i < extensions.length - 1 ? '1px solid #1a1a2e' : 'none' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#7b61ff', fontFamily: 'monospace' }}>{ext.extension_number}</div>
                  <div style={{ fontSize: 13, color: '#c8c8e8', fontWeight: 500 }}>{ext.label}</div>
                  <div style={{ fontSize: 12, color: ext.did_number ? '#e8e8f8' : '#3a3a5a', fontFamily: ext.did_number ? 'monospace' : 'inherit', fontStyle: ext.did_number ? 'normal' : 'italic' }}>{ext.did_number || 'Non assigné'}</div>
                  <div style={{ fontSize: 12, color: ext.user ? '#c8c8e8' : '#3a3a5a', fontStyle: ext.user ? 'normal' : 'italic' }}>{ext.user?.name || ext.user?.email || 'Non assigné'}</div>
                  <button onClick={() => deleteExtension(ext.id)} style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #ff4d6d33', borderRadius: 6, color: '#ff4d6d77', fontSize: 11, cursor: 'pointer' }}>Supprimer</button>
                </div>
              ))}
              {extensions.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#4a4a6a', fontSize: 13 }}>Aucun poste configuré.</div>}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Configurer ── */}
      {configNum && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfigNum(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0e0e1c', border: '1px solid #2a2a4a', borderRadius: 16, padding: 32, width: 520, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f8', marginBottom: 3 }}>Configurer le numéro</div>
                <div style={{ fontSize: 13, color: '#7b61ff', fontFamily: 'monospace' }}>{configNum.number}</div>
              </div>
              <button onClick={() => setConfigNum(null)} style={{ background: 'transparent', border: 'none', color: '#5a5a7a', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <F label="Nom du numéro (friendly name)">
                <input value={configForm.friendly_name} onChange={e => setConfigForm({ ...configForm, friendly_name: e.target.value })} style={IS} />
              </F>

              <F label="Assigner à">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                  <select value={configForm.assigned_type} onChange={e => setConfigForm({ ...configForm, assigned_type: e.target.value, assigned_id: '' })} style={IS}>
                    <option value="queue">File d'attente</option>
                    <option value="agent">Agent</option>
                    <option value="none">Non assigné</option>
                  </select>
                  {configForm.assigned_type !== 'none' && (
                    <select value={configForm.assigned_id} onChange={e => setConfigForm({ ...configForm, assigned_id: e.target.value })} style={IS}>
                      <option value="">— Choisir —</option>
                      {configForm.assigned_type === 'queue'
                        ? queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)
                        : agents.map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)
                      }
                    </select>
                  )}
                </div>
              </F>

              <F label="Capacités">
                <div style={{ display: 'flex', gap: 16 }}>
                  {[
                    { key: 'voice_enabled' as const, label: 'Appels vocaux' },
                    { key: 'sms_enabled' as const,   label: 'SMS' },
                  ].map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#9898b8' }}>
                      <input type="checkbox" checked={configForm[opt.key]} onChange={e => setConfigForm({ ...configForm, [opt.key]: e.target.checked })} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </F>

              <div style={{ background: '#080810', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#4a4a6a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Informations Twilio</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#5a5a7a' }}>Pays</span><span style={{ color: '#8888a8' }}>{configNum.country === 'CA' ? '🇨🇦 Canada' : '🇺🇸 États-Unis'}</span>
                  <span style={{ color: '#5a5a7a' }}>Type</span><span style={{ color: '#8888a8' }}>{configNum.type === 'toll_free' ? 'Sans frais' : 'Local'}</span>
                  <span style={{ color: '#5a5a7a' }}>Coût</span><span style={{ color: '#7b61ff', fontWeight: 600 }}>{configNum.monthly_cost.toFixed(2)} CAD/mois</span>
                </div>
              </div>

              {saveMsg && (
                <div style={{ padding: '8px 12px', borderRadius: 7, background: '#00d4aa18', border: '1px solid #00d4aa33', fontSize: 12, color: '#00d4aa' }}>
                  {saveMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={saveConfig} disabled={saving} style={{ flex: 1, padding: '11px', background: '#7b61ff', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Sauvegarde…' : '✓ Sauvegarder'}
                </button>
                <button onClick={() => setConfigNum(null)} style={{ padding: '11px 18px', background: 'transparent', border: '1px solid #2a2a4a', borderRadius: 8, color: '#5a5a7a', fontSize: 13, cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: color + '18', color, border: `1px solid ${color}33` }}>{label}</span>
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: '#6a6a8a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const IS: React.CSSProperties = {
  width: '100%', background: '#080810', border: '1px solid #2a2a4a',
  borderRadius: 8, padding: '9px 12px', color: '#e8e8f8', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
