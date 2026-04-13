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

const fmtT = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const fmtD = (dt: string) => {
    if (!dt) return '—'
    const d = new Date(dt), df = (Date.now() - d.getTime()) / 1000
    if (df < 60) return 'À l\'instant'
    if (df < 3600) return `${Math.floor(df / 60)}min`
    if (df < 86400) return `${Math.floor(df / 3600)}h`
    return d.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' })
}

const ACP = ['#2d1a80', '#1a356b', '#1a4d3a', '#4d1a5a', '#4d2a1a', '#1a3a4d', '#3a4d1a']
const ini = (name: string) => (name || 'A').split(' ').map((n: string) => n[0] || '').join('').substring(0, 2).toUpperCase()

// Statuts temps reel (presence) — PAS le statut du compte
// ONLINE = connecte et pret a recevoir des appels
// BUSY = en appel actif
// BREAK = en pause volontaire
// OFFLINE = deconnecte ou pas encore connecte
// ACTIVE/INACTIVE = statut du COMPTE (affiche separement)
const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
    ONLINE: { label: 'Disponible', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    BUSY: { label: 'En appel', dot: 'bg-rose-400', text: 'text-rose-400', bg: 'bg-rose-400/10' },
    BREAK: { label: 'En pause', dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-400/10' },
    OFFLINE: { label: 'Hors ligne', dot: 'bg-zinc-500', text: 'text-zinc-500', bg: 'bg-zinc-500/10' },
    INACTIVE: { label: 'Desactive', dot: 'bg-zinc-700', text: 'text-zinc-600', bg: 'bg-zinc-700/10' },
}

interface Agent {
    id: string; name: string; email: string; role: string
    status: string; extension?: string; created_at: string
    agentStatus?: string; current_call?: boolean; call_duration?: number
    queues?: string[]; skills?: string[]; goals?: { calls: number; duration: number }
}

interface Queue { id: string; name: string; strategy: string }

interface PlanLimits { agents: number; did: number; ai: boolean; robot: boolean }
interface Subscription { plan: string; plan_name: string; limits: PlanLimits; seats: number }

const EMPTY_AGENT = { name: '', email: '', password: '', role: 'AGENT', extension: '', queues: [] as string[], skills: '' }

// Logique forfaits — plages d'extensions et capacités
const PLAN_CONFIG: Record<string, {
    extStart: number; extLabel: string
    callType: string; callBadge: string; callColor: string; callBg: string; callBorder: string
}> = {
    basic: { extStart: 100, extLabel: '1XX', callType: 'Entrant seulement', callBadge: '↓', callColor: 'text-sky-400', callBg: 'bg-sky-400/10', callBorder: 'border-sky-400/30' },
    confort: { extStart: 200, extLabel: '2XX', callType: 'Entrant + Sortant', callBadge: '↕', callColor: 'text-violet-400', callBg: 'bg-violet-400/10', callBorder: 'border-violet-400/30' },
    premium: { extStart: 300, extLabel: '3XX', callType: 'Toutes fonctions', callBadge: '★', callColor: 'text-amber-400', callBg: 'bg-amber-400/10', callBorder: 'border-amber-400/30' },
}
const DEFAULT_PLAN = PLAN_CONFIG.confort

export default function AgentsPage() {
    const router = useRouter()
    const { isAuth, user } = useAuthStore()
    const [agents, setAgents] = useState<Agent[]>([])
    const [queues, setQueues] = useState<Queue[]>([])
    const [subscription, setSubscription] = useState<Subscription | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [showDrawer, setShowDrawer] = useState(false)
    const [showNewModal, setShowNewModal] = useState(false)
    const [newAgent, setNewAgent] = useState(EMPTY_AGENT)
    const [editAgent, setEditAgent] = useState<Partial<Agent & { password?: string }>>({})
    const [saving, setSaving] = useState(false)
    const [delConfirm, setDelConfirm] = useState<string | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [agentCalls, setAgentCalls] = useState<any[]>([])

    const translateError = (msg: string) => {
        if (msg.includes('idx_users_extension_org')) return 'Cette extension est deja assignee a un autre agent'
        if (msg.includes('duplicate key')) return 'Doublon detecte — cette valeur existe deja'
        if (msg.includes('Email deja utilise')) return msg
        if (msg.includes('violates foreign key')) return 'Reference invalide'
        if (msg.includes('not-null constraint')) return 'Un champ obligatoire est vide'
        return msg
    }
    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg: type === 'err' ? translateError(msg) : msg, type })
        setTimeout(() => setToast(null), 4000)
    }

    const load = useCallback(async () => {
        try {
            const [ar, qr, sr] = await Promise.all([
                apiFetch('/api/v1/admin/agents'),
                apiFetch('/api/v1/admin/queues'),
                apiFetch('/api/v1/billing/subscription'),
            ])
            if (ar.success) setAgents(ar.data || [])
            if (qr.success) setQueues(qr.data || [])
            if (sr.success) setSubscription(sr.data)
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
        const poll = setInterval(load, 15000)
        return () => clearInterval(poll)
    }, [isAuth, load])

    const openDrawer = async (agent: Agent) => {
        setSelectedAgent(agent)
        setEditAgent({
            name: agent.name, email: agent.email, role: agent.role,
            extension: agent.extension || '',
            queues: agent.queues || [],
            goals: agent.goals || { calls: 30, duration: 300 },
        })
        setShowDrawer(true)
        // Charger les appels de cet agent
        try {
            const r = await apiFetch(`/api/v1/telephony/calls?limit=10`)
            if (r.success) setAgentCalls((r.data || []).filter((c: any) => c.agent_id === agent.id).slice(0, 5))
            else setAgentCalls([])
        } catch { setAgentCalls([]) }
    }

    const saveAgent = async () => {
        if (!selectedAgent) return
        setSaving(true)
        try {
            const payload: any = { ...editAgent }
            if (!payload.password) delete payload.password
            const r = await apiFetch(`/api/v1/admin/agents/${selectedAgent.id}`, {
                method: 'PATCH', body: JSON.stringify(payload),
            })
            if (r.success) { showToast('Agent mis a jour'); setShowDrawer(false); load() }
            else showToast(r.error || r.message || 'Erreur sauvegarde', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const createAgent = async () => {
        if (!newAgent.name || !newAgent.email || !newAgent.password) {
            showToast('Nom, email et mot de passe requis', 'err'); return
        }
        setSaving(true)
        try {
            const r = await apiFetch('/api/v1/admin/agents', {
                method: 'POST',
                body: JSON.stringify({
                    name: newAgent.name, email: newAgent.email,
                    password: newAgent.password, role: newAgent.role,
                    extension: newAgent.extension,
                }),
            })
            if (r.success) {
                showToast('Agent créé ✓')
                setShowNewModal(false)
                setNewAgent(EMPTY_AGENT)
                load()
            } else showToast(r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
        setSaving(false)
    }

    const deleteAgent = async (id: string) => {
        try {
            const r = await apiFetch(`/api/v1/admin/agents/${id}`, { method: 'DELETE' })
            if (r.success) { showToast('Agent supprimé'); setShowDrawer(false); setDelConfirm(null); load() }
            else showToast(r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
    }

    const toggleStatus = async (agent: Agent) => {
        const newStatus = agent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
        try {
            const r = await apiFetch(`/api/v1/admin/agents/${agent.id}`, {
                method: 'PATCH', body: JSON.stringify({ status: newStatus }),
            })
            if (r.success) { showToast(`Agent ${newStatus === 'ACTIVE' ? 'activé' : 'désactivé'}`); load() }
            else showToast(r.message || 'Erreur', 'err')
        } catch { showToast('Erreur réseau', 'err') }
    }

    // Filtres
    const filtered = agents.filter(a => {
        const q = search.toLowerCase()
        const matchSearch = !q || a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.extension?.includes(q)
        // Statut presence : agentStatus vient du snapshot supervision
        // Si pas de snapshot, l'agent est OFFLINE (pas "Actif")
        // status = compte (ACTIVE/INACTIVE), agentStatus = presence (ONLINE/OFFLINE/BUSY/BREAK)
        const st = a.status === 'INACTIVE' ? 'INACTIVE' : a.current_call ? 'BUSY' : (a.agentStatus || 'OFFLINE')
        const matchStatus = filterStatus === 'all' || st === filterStatus
        return matchSearch && matchStatus
    })

    // Stats rapides — base sur presence (agentStatus), pas le compte (status)
    const online = agents.filter(a => a.agentStatus === 'ONLINE' && !a.current_call).length
    const busy = agents.filter(a => a.current_call).length
    const onBreak = agents.filter(a => a.agentStatus === 'BREAK').length
    const offline = agents.filter(a => !['ONLINE', 'BUSY'].includes(a.agentStatus || a.status) && !a.current_call).length

    // Logique forfait courant
    const planKey = subscription?.plan || 'confort'
    const planCfg = PLAN_CONFIG[planKey] || DEFAULT_PLAN
    const seats = subscription?.seats ?? 5
    const maxAgents = subscription?.limits?.agents ?? 25
    const agentLimitReached = maxAgents !== -1 && agents.length >= maxAgents

    // Toutes les extensions selon seats achetés
    const allExtensions = Array.from({ length: seats }, (_, i) => String(planCfg.extStart + i))
    const usedExtensions = agents.map(a => a.extension).filter(Boolean) as string[]
    const freeExtensions = allExtensions.filter(e => !usedExtensions.includes(e))

    // nextExt — retourne la première extension libre
     const nextExt = () => freeExtensions[0] || String(planCfg.extStart)

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement des agents...</div>
        </div>
    )

    return (
        <div className="p-6 max-w-7xl mx-auto">

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl border max-w-sm
          ${toast.type === 'ok' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Agents</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{agents.length} agent{agents.length > 1 ? 's' : ''} · Mise à jour toutes les 15s</div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Badge forfait */}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${planCfg.callBg} ${planCfg.callBorder} ${planCfg.callColor}`}>
                        {planCfg.callBadge} {planCfg.callType}
                    </span>
                    <span className="text-[10px] text-[#55557a]">
                        {agents.length}/{maxAgents === -1 ? '∞' : maxAgents} agents · EXT {planCfg.extLabel}
                    </span>
                    <button
                        onClick={() => { if (!agentLimitReached) { setNewAgent({ ...EMPTY_AGENT, extension: nextExt() }); setShowNewModal(true) } }}
                        disabled={agentLimitReached}
                        title={agentLimitReached ? `Limite atteinte (${maxAgents} agents max sur le forfait ${subscription?.plan_name})` : ''}
                        className="bg-[#7b61ff] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6145ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ml-auto sm:ml-0">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        <span className="hidden sm:inline">{agentLimitReached ? 'Limite atteinte' : 'Nouvel agent'}</span>
                        <span className="sm:hidden">{agentLimitReached ? 'Limite' : 'Nouveau'}</span>
                    </button>
                </div>
            </div>

            {/* KPIs statuts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Disponibles', val: online, color: 'text-emerald-400', bg: 'border-emerald-400/20', dot: 'bg-emerald-400' },
                    { label: 'En appel', val: busy, color: 'text-rose-400', bg: 'border-rose-400/20', dot: 'bg-rose-400' },
                    { label: 'En pause', val: onBreak, color: 'text-amber-400', bg: 'border-amber-400/20', dot: 'bg-amber-400' },
                    { label: 'Hors ligne', val: offline, color: 'text-zinc-500', bg: 'border-zinc-500/20', dot: 'bg-zinc-500' },
                ].map(k => (
                    <div key={k.label} className={`bg-[#18181f] border ${k.bg} rounded-xl p-4 flex items-center gap-3`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${k.dot} flex-shrink-0`} style={{ boxShadow: `0 0 8px currentColor` }} />
                        <div>
                            <div className={`text-2xl font-bold font-mono ${k.color}`}>{k.val}</div>
                            <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider">{k.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filtres */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <div className="relative w-full sm:flex-1 sm:max-w-sm">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55557a]" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, email, extension..."
                        className="w-full bg-[#18181f] border border-[#2e2e44] rounded-lg pl-9 pr-4 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff] transition-colors" />
                </div>
                <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
                    {[
                        { val: 'all', label: 'Tous' },
                        { val: 'ONLINE', label: 'Disponibles' },
                        { val: 'BUSY', label: 'En appel' },
                        { val: 'BREAK', label: 'En pause' },
                        { val: 'OFFLINE', label: 'Hors ligne' },
                    ].map(f => (
                        <button key={f.val} onClick={() => setFilterStatus(f.val)}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0
                ${filterStatus === f.val ? 'bg-[#7b61ff]/20 text-violet-300 border border-[#7b61ff]/40' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="text-xs text-[#55557a] sm:ml-auto whitespace-nowrap">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</div>
            </div>

            {/* Table agents */}
            <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                    <thead>
                        <tr className="bg-[#1f1f2a] border-b border-[#2e2e44]">
                            {['Agent', 'Extension', 'Rôle', 'Statut', 'Files assignées', 'Appels auj.', 'Dernière activité', 'Actions'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#55557a] whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((a, i) => {
                            const st = a.status === 'INACTIVE' ? 'INACTIVE' : a.current_call ? 'BUSY' : (a.agentStatus || 'OFFLINE')
                            const sc = STATUS_CONFIG[st] || STATUS_CONFIG.OFFLINE
                            const color = ACP[i % ACP.length]
                            return (
                                <tr key={a.id} className="border-b border-[#1f1f2a] last:border-0 hover:bg-[#1f1f2a]/50 transition-colors cursor-pointer"
                                    onClick={() => openDrawer(a)}>
                                    {/* Agent */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 relative"
                                                style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
                                                {ini(a.name)}
                                                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#18181f] ${sc.dot}`} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-[#eeeef8]">{a.name}</div>
                                                <div className="text-[11px] text-[#55557a]">{a.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    {/* Extension */}
                                    <td className="px-4 py-3">
                                        {a.extension ? (
                                            <span className="font-mono text-xs font-bold text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded">
                                                EXT {a.extension}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-[#55557a] italic">Non assignée</span>
                                        )}
                                    </td>
                                    {/* Rôle */}
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                      ${a.role === 'ADMIN' ? 'bg-violet-400/15 text-violet-400 border border-violet-400/30' :
                                                a.role === 'OWNER' ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30' :
                                                    'bg-sky-400/15 text-sky-400 border border-sky-400/30'}`}>
                                            {a.role}
                                        </span>
                                    </td>
                                    {/* Statut presence */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} style={st === 'ONLINE' ? { boxShadow: '0 0 6px #34d399' } : undefined} />
                                            <span className={`text-xs font-semibold ${sc.text}`}>{sc.label}</span>
                                            {a.current_call && a.call_duration && (
                                                <span className="text-[10px] font-mono text-[#55557a]">{fmtT(a.call_duration)}</span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Files */}
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1 flex-wrap">
                                            {(a.queues || []).slice(0, 2).map((q: any) => (
                                                <span key={q} className="text-[9px] font-bold bg-[#2e2e44] text-[#9898b8] px-1.5 py-0.5 rounded">{q}</span>
                                            ))}
                                            {!a.queues?.length && <span className="text-[11px] text-[#55557a]">—</span>}
                                        </div>
                                    </td>
                                    {/* Appels */}
                                    <td className="px-4 py-3 font-mono text-sm text-[#9898b8]">—</td>
                                    {/* Dernière activité */}
                                    <td className="px-4 py-3 text-xs text-[#55557a]">{fmtD(a.created_at)}</td>
                                    {/* Actions */}
                                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openDrawer(a)}
                                                className="text-[10px] font-bold text-violet-400 border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 rounded-lg hover:bg-violet-400/20 transition-colors">
                                                Modifier
                                            </button>
                                            <button onClick={() => toggleStatus(a)}
                                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors
                          ${a.status === 'ACTIVE' || a.status === 'ONLINE'
                                                        ? 'text-amber-400 border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20'
                                                        : 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/20'}`}>
                                                {a.status === 'ACTIVE' || a.status === 'ONLINE' ? 'Désactiver' : 'Activer'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
              </div>
                {!filtered.length && (
                    <div className="text-center text-[#55557a] py-12">
                        <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                        <p className="text-sm font-medium">Aucun agent trouvé</p>
                        <p className="text-xs mt-1">Modifiez vos filtres ou créez un nouvel agent</p>
                    </div>
                )}
            </div>

            {/* ── DRAWER MODIFIER AGENT ── */}
            {showDrawer && selectedAgent && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
                    <div className="w-full sm:w-[480px] max-w-full bg-[#111118] border-l border-[#2e2e44] flex flex-col h-full overflow-hidden">

                        {/* Header drawer */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44] bg-[#18181f]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                                    style={{ background: `linear-gradient(135deg, ${ACP[0]}, ${ACP[1]})` }}>
                                    {ini(selectedAgent.name)}
                                </div>
                                <div>
                                    <div className="font-bold text-[#eeeef8]">{selectedAgent.name}</div>
                                    <div className="text-xs text-[#55557a]">{selectedAgent.email}</div>
                                </div>
                            </div>
                            <button onClick={() => setShowDrawer(false)} className="text-[#55557a] hover:text-[#eeeef8] transition-colors">
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>

                        {/* Contenu drawer */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Infos de base */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Informations de base<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { key: 'name', label: 'Nom complet', type: 'text', placeholder: 'Jean Tremblay' },
                                        { key: 'email', label: 'Adresse email', type: 'email', placeholder: 'jean@company.com' },
                                        { key: 'password', label: 'Nouveau mot de passe', type: 'password', placeholder: 'Laisser vide pour ne pas changer' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{f.label}</label>
                                            <input type={f.type} placeholder={f.placeholder}
                                                value={(editAgent as any)[f.key] || ''}
                                                onChange={e => setEditAgent(p => ({ ...p, [f.key]: e.target.value }))}
                                                className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff] transition-colors" />
                                        </div>
                                    ))}
                                    {/* Rôle */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Rôle</label>
                                        <select value={editAgent.role || 'AGENT'}
                                            onChange={e => setEditAgent(p => ({ ...p, role: e.target.value }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] transition-colors">
                                            <option value="AGENT">Agent</option>
                                            <option value="ADMIN">Administrateur</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Extension téléphonique — auto selon forfait */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Extension téléphonique<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="space-y-3">
                                    {/* Dropdown extensions disponibles */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">
                                            Assigner une extension
                                        </label>
                                        <select
                                            value={editAgent.extension || ''}
                                            onChange={e => setEditAgent(p => ({ ...p, extension: e.target.value }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] font-mono">
                                            <option value="">— Aucune extension —</option>
                                            {/* Extension actuelle de l'agent */}
                                            {editAgent.extension && (
                                                <option value={editAgent.extension}>
                                                    EXT {editAgent.extension} — Actuelle
                                                </option>
                                            )}
                                            {/* Extensions libres */}
                                            {freeExtensions
                                                .filter(e => e !== editAgent.extension)
                                                .map(e => (
                                                    <option key={e} value={e}>EXT {e} — Libre</option>
                                                ))
                                            }
                                            {/* Extensions occupées par d'autres */}
                                            {allExtensions
                                                .filter(e => usedExtensions.includes(e) && e !== editAgent.extension)
                                                .map(e => {
                                                    const owner = agents.find(a => a.extension === e)
                                                    return <option key={e} value={e} disabled>EXT {e} — {owner?.name || 'Occupée'}</option>
                                                })
                                            }
                                        </select>
                                    </div>
                                    {/* Résumé forfait */}
                                    <div className="text-[10px] text-[#55557a] bg-[#1f1f2a] rounded-lg px-3 py-2 flex items-center justify-between">
                                        <span>
                                            <span className="text-[#7b61ff] font-bold">{subscription?.plan_name || 'Confort'}</span>
                                            {' '}· {planCfg.callType} · {seats} seats
                                        </span>
                                        <span className={`font-bold px-2 py-0.5 rounded text-[9px] border ${planCfg.callBg} ${planCfg.callBorder} ${planCfg.callColor}`}>
                                            {freeExtensions.length} libre{freeExtensions.length > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            {/* Files d'attente */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Files d'attente assignées<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                {queues.length === 0 ? (
                                    <div className="text-xs text-[#55557a] bg-[#1f1f2a] rounded-lg p-3">Aucune file d'attente configurée</div>
                                ) : (
                                    <div className="space-y-2">
                                        {queues.map(q => {
                                            const checked = (editAgent.queues || []).includes(q.id)
                                            return (
                                                <label key={q.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                          ${checked ? 'border-violet-400/40 bg-violet-400/8' : 'border-[#2e2e44] bg-[#1f1f2a] hover:border-[#3a3a55]'}`}>
                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                            ${checked ? 'bg-[#7b61ff] border-[#7b61ff]' : 'border-[#3a3a55]'}`}>
                                                        {checked && <svg width="10" height="10" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                                                    </div>
                                                    <input type="checkbox" className="hidden" checked={checked}
                                                        onChange={e => {
                                                            const current = editAgent.queues || []
                                                            setEditAgent(p => ({
                                                                ...p,
                                                                queues: e.target.checked ? [...current, q.id] : current.filter((x: string) => x !== q.id)
                                                            }))
                                                        }} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-[#eeeef8]">{q.name}</div>
                                                        <div className="text-[10px] text-[#55557a]">{q.strategy}</div>
                                                    </div>
                                                </label>
                                            )
                                        })}
                                    </div>
                                )}
                            </section>

                            {/* Objectifs journaliers */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Objectifs journaliers<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Appels cibles / jour</label>
                                        <input type="number" min="0" max="999"
                                            value={(editAgent.goals as any)?.calls || 30}
                                            onChange={e => setEditAgent(p => ({ ...p, goals: { ...(p.goals as any || {}), calls: parseInt(e.target.value) } }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Durée moy. cible (s)</label>
                                        <input type="number" min="0" max="9999"
                                            value={(editAgent.goals as any)?.duration || 300}
                                            onChange={e => setEditAgent(p => ({ ...p, goals: { ...(p.goals as any || {}), duration: parseInt(e.target.value) } }))}
                                            className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]" />
                                    </div>
                                </div>
                            </section>

                            {/* Derniers appels */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Derniers appels<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                {agentCalls.length === 0 ? (
                                    <div className="text-xs text-[#55557a] bg-[#1f1f2a] rounded-lg p-3 text-center">Aucun appel récent</div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {agentCalls.map(c => (
                                            <div key={c.id} className="flex items-center gap-3 bg-[#1f1f2a] rounded-lg px-3 py-2">
                                                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c.direction === 'INBOUND' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-sky-400/15 text-sky-400'}`}>
                                                    {c.direction === 'INBOUND' ? '↓' : '↑'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-mono text-[#eeeef8] truncate">{c.from_number || c.to_number}</div>
                                                    <div className="text-[10px] text-[#55557a]">{fmtD(c.started_at)}</div>
                                                </div>
                                                <div className="text-[10px] font-mono text-[#9898b8]">{c.duration ? fmtT(c.duration) : '—'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* Lien supervision */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-[#2e2e44]" />Supervision<div className="flex-1 h-px bg-[#2e2e44]" />
                                </div>
                                <button onClick={() => router.push('/admin/supervision')}
                                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-sky-400 border border-sky-400/30 bg-sky-400/5 px-4 py-2.5 rounded-lg hover:bg-sky-400/15 transition-colors">
                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
                                    Voir en supervision live
                                </button>
                            </section>

                            {/* Zone danger */}
                            <section>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500/60 mb-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-rose-500/20" />Zone dangereuse<div className="flex-1 h-px bg-rose-500/20" />
                                </div>
                                {delConfirm === selectedAgent.id ? (
                                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                                        <p className="text-sm text-rose-400 font-medium mb-3">Confirmer la suppression de {selectedAgent.name} ?</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => setDelConfirm(null)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-3 py-2 rounded-lg text-xs font-bold">Annuler</button>
                                            <button onClick={() => deleteAgent(selectedAgent.id)} className="flex-1 bg-rose-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors">Supprimer définitivement</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => setDelConfirm(selectedAgent.id)}
                                        className="w-full text-rose-400 border border-rose-400/30 bg-rose-400/5 px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-rose-400/15 transition-colors">
                                        Supprimer cet agent
                                    </button>
                                )}
                            </section>
                        </div>

                        {/* Footer drawer */}
                        <div className="px-6 py-4 border-t border-[#2e2e44] bg-[#18181f] flex gap-3">
                            <button onClick={() => setShowDrawer(false)} className="flex-1 bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold hover:text-[#eeeef8] transition-colors">
                                Annuler
                            </button>
                            <button onClick={saveAgent} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL NOUVEL AGENT ── */}
            {showNewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44]">
                            <h3 className="font-bold text-[#eeeef8]">Nouvel agent</h3>
                            <button onClick={() => setShowNewModal(false)} className="text-[#55557a] hover:text-[#eeeef8] transition-colors">
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {[
                                { key: 'name', label: 'Nom complet *', type: 'text', placeholder: 'Jean Tremblay' },
                                { key: 'email', label: 'Email *', type: 'email', placeholder: 'jean@company.com' },
                                { key: 'password', label: 'Mot de passe *', type: 'password', placeholder: 'Minimum 8 caractères' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">{f.label}</label>
                                    <input type={f.type} placeholder={f.placeholder}
                                        value={(newAgent as any)[f.key]}
                                        onChange={e => setNewAgent(p => ({ ...p, [f.key]: e.target.value }))}
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff] transition-colors" />
                                </div>
                            ))}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Extension</label>
                                    <select
                                        value={newAgent.extension}
                                        onChange={e => setNewAgent(p => ({ ...p, extension: e.target.value }))}
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff] font-mono">
                                        <option value="">— Choisir une extension —</option>
                                        {freeExtensions.map(e => (
                                            <option key={e} value={e}>EXT {e} — Libre</option>
                                        ))}
                                        {freeExtensions.length === 0 && (
                                            <option value="" disabled>Aucune extension disponible</option>
                                        )}
                                    </select>
                                    <div className="text-[10px] text-[#55557a] mt-1">
                                        {freeExtensions.length} extension{freeExtensions.length > 1 ? 's' : ''} libre{freeExtensions.length > 1 ? 's' : ''} sur {seats} seats · Forfait {subscription?.plan_name}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Rôle</label>
                                    <select value={newAgent.role} onChange={e => setNewAgent(p => ({ ...p, role: e.target.value }))}
                                        className="w-full bg-[#111118] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                        <option value="AGENT">Agent</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                            </div>
                            {/* Files */}
                            {queues.length > 0 && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-2">Files d'attente</label>
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                        {queues.map(q => (
                                            <label key={q.id} className="flex items-center gap-2.5 cursor-pointer group">
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                          ${newAgent.queues.includes(q.id) ? 'bg-[#7b61ff] border-[#7b61ff]' : 'border-[#3a3a55] group-hover:border-[#7b61ff]'}`}>
                                                    {newAgent.queues.includes(q.id) && <svg width="10" height="10" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                                                </div>
                                                <input type="checkbox" className="hidden" checked={newAgent.queues.includes(q.id)}
                                                    onChange={e => setNewAgent(p => ({
                                                        ...p, queues: e.target.checked ? [...p.queues, q.id] : p.queues.filter(x => x !== q.id)
                                                    }))} />
                                                <span className="text-sm text-[#9898b8]">{q.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-[#2e2e44] flex gap-3">
                            <button onClick={() => setShowNewModal(false)} className="flex-1 bg-[#111118] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                            <button onClick={createAgent} disabled={saving}
                                className="flex-1 bg-[#7b61ff] text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                                {saving ? 'Création...' : 'Créer l\'agent'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
