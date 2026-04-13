'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

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

const fmtDate = (dt: string) => {
    if (!dt) return '--'
    return new Date(dt).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Types ──────────────────────────────────────────────────────

interface Campaign {
    id: string
    name: string
    status: string
    type: string
    total_contacts: number
    from_number: string | null
    max_attempts: number
    dial_ratio: number
    script_id: string | null
    created_by: string
    created_at: string
    updated_at: string
    script?: { id: string; name: string } | null
    creator?: { id: string; name: string } | null
    contacts?: Lead[]
}

interface Lead {
    id: string
    phone_number: string
    name: string | null
    status: string
    attempts: number
    last_attempt_at: string | null
    contact_id: string | null
}

interface CRMContact {
    id: string
    first_name: string
    last_name: string
    phone: string
    email: string
    company: string
}

// ── Status config ──────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    DRAFT:     { label: 'Brouillon',  bg: 'bg-zinc-400/10',    text: 'text-zinc-400',    dot: 'bg-zinc-400'    },
    ACTIVE:    { label: 'En cours',   bg: 'bg-emerald-400/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    PAUSED:    { label: 'En pause',   bg: 'bg-amber-400/10',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
    COMPLETED: { label: 'Terminee',   bg: 'bg-violet-400/10',  text: 'text-violet-400',  dot: 'bg-violet-400'  },
}

const LEAD_STATUS_CFG: Record<string, { label: string; text: string }> = {
    PENDING:   { label: 'En attente', text: 'text-zinc-400'    },
    ANSWERED:  { label: 'Repondu',    text: 'text-emerald-400' },
    NO_ANSWER: { label: 'Pas de rep', text: 'text-amber-400'   },
    BUSY:      { label: 'Occupe',     text: 'text-rose-400'    },
    FAILED:    { label: 'Echoue',     text: 'text-red-400'     },
    DNC:       { label: 'Ne pas app', text: 'text-zinc-500'    },
}

// ── Page ───────────────────────────────────────────────────────

export default function CampaignsPage() {
    const router = useRouter()
    const { isAuth, user } = useAuthStore()

    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Drawer
    const [selected, setSelected] = useState<Campaign | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [drawerLoading, setDrawerLoading] = useState(false)

    // New campaign modal
    const [showNewModal, setShowNewModal] = useState(false)
    const [newName, setNewName] = useState('')
    const [saving, setSaving] = useState(false)

    // CRM contacts for new campaign
    const [crmContacts, setCrmContacts] = useState<CRMContact[]>([])
    const [crmLoading, setCrmLoading] = useState(false)
    const [crmSearch, setCrmSearch] = useState('')
    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())

    // Delete confirmation
    const [delConfirm, setDelConfirm] = useState<string | null>(null)

    // Toast
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    // ── Load campaigns ─────────────────────────────────────────

    const load = useCallback(async () => {
        try {
            const r = await apiFetch('/api/v1/ai2/campaigns')
            if (r.success) {
                setCampaigns(r.data || [])
                setError('')
            } else {
                setError(r.message || 'Erreur de chargement')
            }
        } catch {
            setError('Erreur reseau')
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
        const poll = setInterval(load, 20000)
        return () => clearInterval(poll)
    }, [isAuth, load, router])

    // ── Open campaign drawer ───────────────────────────────────

    const openDrawer = async (c: Campaign) => {
        setSelected(c)
        setDrawerOpen(true)
        setDrawerLoading(true)
        try {
            const r = await apiFetch(`/api/v1/ai2/campaigns/${c.id}`)
            if (r.success) setSelected(r.data)
        } catch { /* keep original data */ }
        setDrawerLoading(false)
    }

    // ── Status change ──────────────────────────────────────────

    const changeStatus = async (id: string, status: string) => {
        try {
            const r = await apiFetch(`/api/v1/ai2/campaigns/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            })
            if (r.success) {
                showToast('Statut mis a jour')
                load()
                if (selected?.id === id) {
                    setSelected({ ...selected!, status })
                }
            } else {
                showToast(r.message || 'Erreur', 'err')
            }
        } catch {
            showToast('Erreur reseau', 'err')
        }
    }

    // ── Create campaign ────────────────────────────────────────

    const openNewModal = async () => {
        setShowNewModal(true)
        setNewName('')
        setSelectedContacts(new Set())
        setCrmSearch('')
        setCrmLoading(true)
        try {
            const r = await apiFetch('/api/v1/crm/contacts')
            if (r.success) setCrmContacts(r.data || [])
        } catch { /* ignore */ }
        setCrmLoading(false)
    }

    const toggleContact = (id: string) => {
        setSelectedContacts(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAll = () => {
        const filtered = filteredCrmContacts
        if (selectedContacts.size === filtered.length) {
            setSelectedContacts(new Set())
        } else {
            setSelectedContacts(new Set(filtered.map(c => c.id)))
        }
    }

    const createCampaign = async () => {
        if (!newName.trim()) { showToast('Nom requis', 'err'); return }
        setSaving(true)
        try {
            const r = await apiFetch('/api/v1/ai2/campaigns', {
                method: 'POST',
                body: JSON.stringify({ name: newName.trim() }),
            })
            if (r.success && r.data?.id) {
                // Add selected contacts
                if (selectedContacts.size > 0) {
                    const contacts = crmContacts
                        .filter(c => selectedContacts.has(c.id))
                        .map(c => ({
                            phoneNumber: c.phone,
                            name: [c.first_name, c.last_name].filter(Boolean).join(' '),
                            contactId: c.id,
                        }))
                    await apiFetch(`/api/v1/ai2/campaigns/${r.data.id}/contacts`, {
                        method: 'POST',
                        body: JSON.stringify({ contacts }),
                    })
                }
                showToast('Campagne creee')
                setShowNewModal(false)
                load()
            } else {
                showToast(r.message || 'Erreur', 'err')
            }
        } catch {
            showToast('Erreur reseau', 'err')
        }
        setSaving(false)
    }

    // ── Computed ────────────────────────────────────────────────

    const stats = {
        total: campaigns.length,
        active: campaigns.filter(c => c.status === 'ACTIVE').length,
        completed: campaigns.filter(c => c.status === 'COMPLETED').length,
        leads: campaigns.reduce((s, c) => s + (c.total_contacts || 0), 0),
    }

    const filteredCrmContacts = crmContacts.filter(c => {
        if (!crmSearch) return true
        const q = crmSearch.toLowerCase()
        return (c.first_name || '').toLowerCase().includes(q)
            || (c.last_name || '').toLowerCase().includes(q)
            || (c.phone || '').includes(q)
            || (c.company || '').toLowerCase().includes(q)
    })

    // ── Render ──────────────────────────────────────────────────

    if (!isAuth) return null

    return (
        <div className="min-h-screen bg-[#111118] text-[#eeeef8]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

                {/* ── Header ───────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold">Robot Dialer</h1>
                        <p className="text-xs text-[#55557a] mt-1">
                            {stats.total} campagne{stats.total !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={openNewModal}
                        className="flex items-center justify-center gap-2 bg-[#7b61ff] hover:bg-[#6a4fff] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
                    >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Nouvelle campagne
                    </button>
                </div>

                {/* ── KPI cards ─────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    {[
                        { label: 'Total campagnes', value: stats.total,     color: '#7b61ff' },
                        { label: 'En cours',        value: stats.active,    color: '#34d399' },
                        { label: 'Completees',      value: stats.completed, color: '#a78bfa' },
                        { label: 'Leads total',     value: stats.leads,     color: '#fbbf24' },
                    ].map(kpi => (
                        <div key={kpi.label} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-2">{kpi.label}</div>
                            <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                        </div>
                    ))}
                </div>

                {/* ── Loading / Error / Empty ────────────────── */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-[#7b61ff] border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {error && !loading && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                        <p className="text-sm text-red-400">{error}</p>
                        <button onClick={load} className="text-xs text-[#7b61ff] mt-2 underline">Reessayer</button>
                    </div>
                )}

                {!loading && !error && campaigns.length === 0 && (
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#7b61ff]/10 flex items-center justify-center">
                            <svg width="24" height="24" fill="none" stroke="#7b61ff" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-bold mb-1">Aucune campagne</h3>
                        <p className="text-xs text-[#55557a] mb-4">Creez votre premiere campagne de prospection automatisee.</p>
                        <button onClick={openNewModal} className="bg-[#7b61ff] hover:bg-[#6a4fff] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                            Creer une campagne
                        </button>
                    </div>
                )}

                {/* ── Campaign list ──────────────────────────── */}
                {!loading && !error && campaigns.length > 0 && (
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
                        {/* Desktop header */}
                        <div className="hidden sm:grid grid-cols-[1fr_120px_90px_100px_100px_140px] gap-3 px-4 py-3 border-b border-[#2e2e44] text-[10px] font-bold uppercase tracking-wider text-[#55557a]">
                            <div>Campagne</div>
                            <div>Statut</div>
                            <div className="text-right">Leads</div>
                            <div className="text-right">Progres</div>
                            <div>Cree le</div>
                            <div className="text-right">Actions</div>
                        </div>

                        {campaigns.map(c => {
                            const cfg = STATUS_CFG[c.status] || STATUS_CFG.DRAFT
                            const progress = c.total_contacts > 0
                                ? Math.round(((c.total_contacts - (c.total_contacts || 0)) / (c.total_contacts || 1)) * 100)
                                : 0
                            return (
                                <div key={c.id}
                                    className="grid grid-cols-1 sm:grid-cols-[1fr_120px_90px_100px_100px_140px] gap-2 sm:gap-3 px-4 py-3 border-b border-[#2e2e44]/50 hover:bg-[#1f1f2a] transition-colors cursor-pointer group"
                                    onClick={() => openDrawer(c)}
                                >
                                    {/* Name + type */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-[#7b61ff]/10 border border-[#7b61ff]/20 flex items-center justify-center flex-shrink-0">
                                            <svg width="14" height="14" fill="none" stroke="#7b61ff" strokeWidth="2" viewBox="0 0 24 24">
                                                <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold truncate group-hover:text-[#7b61ff] transition-colors">{c.name}</div>
                                            <div className="text-[10px] text-[#55557a]">{c.type || 'POWER'}{c.creator?.name ? ` - ${c.creator.name}` : ''}</div>
                                        </div>
                                    </div>

                                    {/* Status badge */}
                                    <div className="flex items-center sm:justify-start">
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                            {cfg.label}
                                        </span>
                                    </div>

                                    {/* Leads count */}
                                    <div className="text-sm font-semibold sm:text-right">{c.total_contacts || 0}</div>

                                    {/* Progress bar */}
                                    <div className="flex items-center gap-2 sm:justify-end">
                                        <div className="w-16 h-1.5 bg-[#2e2e44] rounded-full overflow-hidden">
                                            <div className="h-full bg-[#7b61ff] rounded-full transition-all"
                                                style={{ width: `${progress}%` }} />
                                        </div>
                                        <span className="text-[10px] text-[#55557a] tabular-nums">{progress}%</span>
                                    </div>

                                    {/* Created date */}
                                    <div className="text-xs text-[#9898b8]">{fmtDate(c.created_at)}</div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 sm:justify-end" onClick={e => e.stopPropagation()}>
                                        {c.status === 'DRAFT' && (
                                            <button onClick={() => changeStatus(c.id, 'ACTIVE')}
                                                className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-lg hover:bg-emerald-400/20 transition-colors"
                                                title="Demarrer">
                                                Demarrer
                                            </button>
                                        )}
                                        {c.status === 'ACTIVE' && (
                                            <button onClick={() => changeStatus(c.id, 'PAUSED')}
                                                className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg hover:bg-amber-400/20 transition-colors"
                                                title="Pause">
                                                Pause
                                            </button>
                                        )}
                                        {c.status === 'PAUSED' && (
                                            <button onClick={() => changeStatus(c.id, 'ACTIVE')}
                                                className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-lg hover:bg-emerald-400/20 transition-colors"
                                                title="Reprendre">
                                                Reprendre
                                            </button>
                                        )}
                                        {delConfirm === c.id ? (
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => { changeStatus(c.id, 'COMPLETED'); setDelConfirm(null) }}
                                                    className="text-[10px] font-bold text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-1 rounded-lg hover:bg-red-400/20">
                                                    Oui
                                                </button>
                                                <button onClick={() => setDelConfirm(null)}
                                                    className="text-[10px] font-bold text-[#9898b8] bg-[#2e2e44]/50 px-2 py-1 rounded-lg hover:bg-[#2e2e44]">
                                                    Non
                                                </button>
                                            </div>
                                        ) : (
                                            c.status !== 'COMPLETED' && (
                                                <button onClick={() => setDelConfirm(c.id)}
                                                    className="text-[10px] font-bold text-[#55557a] hover:text-red-400 px-1.5 py-1 rounded-lg transition-colors"
                                                    title="Terminer">
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Drawer: campaign details ──────────────────── */}
            {drawerOpen && selected && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setDrawerOpen(false)} />

                    {/* Panel */}
                    <div className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-[#18181f] border-l border-[#2e2e44] z-50 flex flex-col overflow-hidden"
                        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,.5)' }}>

                        {/* Drawer header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e44]">
                            <div className="min-w-0 flex-1">
                                <h2 className="text-base font-bold truncate">{selected.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    {(() => {
                                        const cfg = STATUS_CFG[selected.status] || STATUS_CFG.DRAFT
                                        return (
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        )
                                    })()}
                                    <span className="text-[10px] text-[#55557a]">{selected.type || 'POWER'}</span>
                                </div>
                            </div>
                            <button onClick={() => setDrawerOpen(false)}
                                className="text-[#55557a] hover:text-[#eeeef8] p-1 rounded-lg hover:bg-[#2e2e44] transition-colors">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Drawer actions */}
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2e2e44]">
                            {selected.status === 'DRAFT' && (
                                <button onClick={() => changeStatus(selected.id, 'ACTIVE')}
                                    className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 rounded-lg hover:bg-emerald-400/20 transition-colors">
                                    Demarrer
                                </button>
                            )}
                            {selected.status === 'ACTIVE' && (
                                <button onClick={() => changeStatus(selected.id, 'PAUSED')}
                                    className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg hover:bg-amber-400/20 transition-colors">
                                    Pause
                                </button>
                            )}
                            {selected.status === 'PAUSED' && (
                                <button onClick={() => changeStatus(selected.id, 'ACTIVE')}
                                    className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 rounded-lg hover:bg-emerald-400/20 transition-colors">
                                    Reprendre
                                </button>
                            )}
                            {selected.status !== 'COMPLETED' && (
                                <button onClick={() => changeStatus(selected.id, 'COMPLETED')}
                                    className="text-[10px] font-bold text-violet-400 bg-violet-400/10 border border-violet-400/20 px-3 py-1.5 rounded-lg hover:bg-violet-400/20 transition-colors">
                                    Terminer
                                </button>
                            )}
                        </div>

                        {/* Drawer info grid */}
                        <div className="grid grid-cols-2 gap-3 px-5 py-4 border-b border-[#2e2e44]">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Leads</div>
                                <div className="text-sm font-bold">{selected.total_contacts || 0}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Max tentatives</div>
                                <div className="text-sm font-bold">{selected.max_attempts || 3}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Ratio</div>
                                <div className="text-sm font-bold">{selected.dial_ratio || 1.0}x</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Cree le</div>
                                <div className="text-sm font-bold">{fmtDate(selected.created_at)}</div>
                            </div>
                            {selected.from_number && (
                                <div className="col-span-2">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Numero sortant</div>
                                    <div className="text-sm font-bold font-mono">{selected.from_number}</div>
                                </div>
                            )}
                        </div>

                        {/* Leads list */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-3">
                                Leads ({selected.contacts?.length || 0})
                            </div>

                            {drawerLoading && (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-5 h-5 border-2 border-[#7b61ff] border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}

                            {!drawerLoading && (!selected.contacts || selected.contacts.length === 0) && (
                                <div className="text-center py-8">
                                    <p className="text-xs text-[#55557a]">Aucun lead dans cette campagne</p>
                                </div>
                            )}

                            {!drawerLoading && selected.contacts && selected.contacts.length > 0 && (
                                <div className="space-y-1.5">
                                    {selected.contacts.map(lead => {
                                        const ls = LEAD_STATUS_CFG[lead.status] || LEAD_STATUS_CFG.PENDING
                                        return (
                                            <div key={lead.id}
                                                className="flex items-center gap-3 bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5">
                                                <div className="w-7 h-7 rounded-full bg-[#2e2e44] flex items-center justify-center flex-shrink-0">
                                                    <svg width="12" height="12" fill="none" stroke="#9898b8" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                        <circle cx="12" cy="7" r="4" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-semibold truncate">
                                                        {lead.name || 'Sans nom'}
                                                    </div>
                                                    <div className="text-[10px] text-[#55557a] font-mono">{lead.phone_number}</div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className={`text-[10px] font-bold ${ls.text}`}>{ls.label}</span>
                                                    {lead.attempts > 0 && (
                                                        <span className="text-[9px] text-[#55557a]">x{lead.attempts}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ── Modal: new campaign ──────────────────────── */}
            {showNewModal && (
                <>
                    <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowNewModal(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
                            style={{ boxShadow: '0 8px 48px rgba(0,0,0,.7), 0 0 0 1px rgba(123,97,255,.1)' }}>

                            {/* Modal header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e44]">
                                <h2 className="text-base font-bold">Nouvelle campagne</h2>
                                <button onClick={() => setShowNewModal(false)}
                                    className="text-[#55557a] hover:text-[#eeeef8] p-1 rounded-lg hover:bg-[#2e2e44] transition-colors">
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            {/* Modal body */}
                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#55557a] block mb-1.5">
                                        Nom de la campagne
                                    </label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="Ex: Prospection Q2 2026"
                                        className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
                                    />
                                </div>

                                {/* CRM Contacts */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#55557a]">
                                            Contacts CRM ({selectedContacts.size} selectionnes)
                                        </label>
                                        <button onClick={selectAll}
                                            className="text-[10px] font-bold text-[#7b61ff] hover:text-[#a78bfa] transition-colors">
                                            {selectedContacts.size === filteredCrmContacts.length && filteredCrmContacts.length > 0
                                                ? 'Tout deselectionner'
                                                : 'Tout selectionner'}
                                        </button>
                                    </div>

                                    {/* Search */}
                                    <div className="relative mb-2">
                                        <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="12" height="12" fill="none" stroke="#55557a" strokeWidth="2" viewBox="0 0 24 24">
                                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                        <input
                                            type="text"
                                            value={crmSearch}
                                            onChange={e => setCrmSearch(e.target.value)}
                                            placeholder="Rechercher un contact..."
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg pl-8 pr-3 py-2 text-xs text-[#eeeef8] placeholder-[#55557a] focus:outline-none focus:border-[#7b61ff] transition-colors"
                                        />
                                    </div>

                                    {/* Contact list */}
                                    <div className="max-h-56 overflow-y-auto border border-[#2e2e44] rounded-lg">
                                        {crmLoading && (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="w-5 h-5 border-2 border-[#7b61ff] border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}

                                        {!crmLoading && filteredCrmContacts.length === 0 && (
                                            <div className="text-center py-6">
                                                <p className="text-xs text-[#55557a]">Aucun contact trouve</p>
                                            </div>
                                        )}

                                        {!crmLoading && filteredCrmContacts.map(c => {
                                            const isSelected = selectedContacts.has(c.id)
                                            const displayName = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '--'
                                            return (
                                                <label key={c.id}
                                                    className={`flex items-center gap-3 px-3 py-2.5 border-b border-[#2e2e44]/50 last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-[#7b61ff]/10' : 'hover:bg-[#1f1f2a]'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleContact(c.id)}
                                                        className="w-3.5 h-3.5 rounded border-[#2e2e44] bg-[#1f1f2a] text-[#7b61ff] focus:ring-[#7b61ff] focus:ring-offset-0 accent-[#7b61ff]"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-semibold truncate">{displayName}</div>
                                                        <div className="text-[10px] text-[#55557a] font-mono">{c.phone || 'Pas de tel'}</div>
                                                    </div>
                                                    {c.company && (
                                                        <span className="text-[10px] text-[#55557a] flex-shrink-0 truncate max-w-[100px]">{c.company}</span>
                                                    )}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Modal footer */}
                            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2e2e44]">
                                <button onClick={() => setShowNewModal(false)}
                                    className="text-xs font-bold text-[#9898b8] bg-[#2e2e44]/50 px-4 py-2.5 rounded-lg hover:bg-[#2e2e44] transition-colors">
                                    Annuler
                                </button>
                                <button onClick={createCampaign} disabled={saving}
                                    className="text-xs font-bold text-white bg-[#7b61ff] hover:bg-[#6a4fff] px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {saving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                    Creer la campagne
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ── Toast ────────────────────────────────────── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl text-xs font-bold border
                    ${toast.type === 'ok'
                        ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'
                        : 'bg-red-400/10 text-red-400 border-red-400/30'
                    }`}
                    style={{ boxShadow: '0 4px 16px rgba(0,0,0,.5)' }}>
                    {toast.msg}
                </div>
            )}
        </div>
    )
}
