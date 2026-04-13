'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { VoxFlowLogo } from '@/components/shared/VoxFlowLogo'

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''
const apiFetch = async (path: string) => {
    const r = await fetch(API() + path, {
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK() },
    }); return r.json()
}

const fmtTime = (s: number) => {
    if (!s) return '0:00'
    const m = Math.floor(s / 60), sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
}

interface Agent {
    agentId: string
    name: string
    status: string
    callId: string | null
}
interface KPIs {
    activeCalls: number
    onlineAgents: number
    totalToday: number
    completedToday: number
    missedToday: number
    avgDuration: number
    slaRate: number
    busyAgents: number
    totalAgents: number
}
interface Snapshot {
    agents: Agent[]
    activeCalls: any[]
    kpis: KPIs
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
function KPICard({ label, value, color, glow }: { label: string; value: string | number; color: string; glow: string }) {
    return (
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-sm p-6 flex flex-col items-center justify-center gap-2 min-h-[140px]">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-medium">{label}</span>
            <span className={`text-5xl font-bold tabular-nums ${color}`} style={{ textShadow: `0 0 30px ${glow}, 0 0 60px ${glow}` }}>
                {value}
            </span>
        </div>
    )
}

// ─── Agent Dot ─────────────────────────────────────────────────────────────
function AgentDot({ agent }: { agent: Agent }) {
    const st = agent.status?.toUpperCase() || 'OFFLINE'
    const cfg: Record<string, { bg: string; ring: string; label: string }> = {
        ONLINE: { bg: 'bg-emerald-400', ring: 'ring-emerald-400/40', label: 'Disponible' },
        ACTIVE: { bg: 'bg-emerald-400', ring: 'ring-emerald-400/40', label: 'Disponible' },
        BUSY: { bg: 'bg-rose-400', ring: 'ring-rose-400/40', label: 'En appel' },
        BREAK: { bg: 'bg-amber-400', ring: 'ring-amber-400/40', label: 'Pause' },
        OFFLINE: { bg: 'bg-zinc-600', ring: 'ring-zinc-600/40', label: 'Hors ligne' },
    }
    const c = cfg[st] || cfg.OFFLINE
    const ini = (agent.name || '?').split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase()

    return (
        <div className="flex flex-col items-center gap-1 group relative" title={`${agent.name} - ${c.label}`}>
            <div className={`w-10 h-10 rounded-full ${c.bg} ${c.ring} ring-2 flex items-center justify-center text-xs font-bold text-white/90 shadow-lg`}>
                {ini}
            </div>
            <span className="text-[10px] text-zinc-500 truncate max-w-[60px] text-center">{agent.name?.split(' ')[0]}</span>
        </div>
    )
}

// ─── Wallboard Page ────────────────────────────────────────────────────────
export default function WallboardPage() {
    const router = useRouter()
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
    const [clock, setClock] = useState('')
    const [date, setDate] = useState('')
    const [pulse, setPulse] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            const res = await apiFetch('/api/v1/supervision/snapshot')
            if (res?.data) setSnapshot(res.data)
            else if (res?.agents) setSnapshot(res)
            setPulse(true)
            setTimeout(() => setPulse(false), 300)
        } catch { /* silent */ }
    }, [])

    // Clock tick
    useEffect(() => {
        const tick = () => {
            const n = new Date()
            setClock(n.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
            setDate(n.toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
        }
        tick()
        const iv = setInterval(tick, 1000)
        return () => clearInterval(iv)
    }, [])

    // Data refresh every 5s
    useEffect(() => {
        fetchData()
        const iv = setInterval(fetchData, 5000)
        return () => clearInterval(iv)
    }, [fetchData])

    // Escape to go back
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') router.push('/admin/dashboard')
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [router])

    const k = snapshot?.kpis
    const agents = snapshot?.agents || []
    const waiting = (snapshot?.activeCalls || []).filter((c: any) => c.status === 'RINGING' || c.status === 'ON_HOLD').length

    const kpis = [
        {
            label: 'Appels actifs',
            value: k?.activeCalls ?? 0,
            color: (k?.activeCalls ?? 0) > 0 ? 'text-rose-400' : 'text-white',
            glow: (k?.activeCalls ?? 0) > 0 ? 'rgba(251,113,133,0.4)' : 'rgba(255,255,255,0.1)',
        },
        {
            label: 'Agents en ligne',
            value: k?.onlineAgents ?? 0,
            color: 'text-emerald-400',
            glow: 'rgba(52,211,153,0.4)',
        },
        {
            label: 'En attente',
            value: waiting,
            color: waiting > 0 ? 'text-amber-400' : 'text-white',
            glow: waiting > 0 ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)',
        },
        {
            label: "Appels aujourd'hui",
            value: k?.totalToday ?? 0,
            color: 'text-white',
            glow: 'rgba(255,255,255,0.1)',
        },
        {
            label: 'Duree moyenne',
            value: fmtTime(k?.avgDuration ?? 0),
            color: 'text-sky-400',
            glow: 'rgba(56,189,248,0.3)',
        },
        {
            label: 'Taux resolution',
            value: k?.completedToday && k?.totalToday ? Math.round((k.completedToday / k.totalToday) * 100) + '%' : '100%',
            color: 'text-violet-400',
            glow: 'rgba(167,139,250,0.3)',
        },
        {
            label: 'SLA',
            value: (k?.slaRate ?? 100) + '%',
            color: (k?.slaRate ?? 100) >= 80 ? 'text-emerald-400' : 'text-rose-400',
            glow: (k?.slaRate ?? 100) >= 80 ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)',
        },
        {
            label: 'Appels manques',
            value: k?.missedToday ?? 0,
            color: (k?.missedToday ?? 0) > 0 ? 'text-rose-400' : 'text-white',
            glow: (k?.missedToday ?? 0) > 0 ? 'rgba(251,113,133,0.4)' : 'rgba(255,255,255,0.1)',
        },
    ]

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden" style={{ background: '#0a0a12' }}>

            {/* ── Header: logo + clock ── */}
            <div className="flex items-center justify-between px-8 py-4 shrink-0">
                <div className="opacity-60">
                    <VoxFlowLogo size="sm" variant="dark" />
                </div>
                <div className="text-right">
                    <div className="text-3xl font-mono font-bold text-white/90 tabular-nums tracking-wide"
                        style={{ textShadow: '0 0 20px rgba(167,139,250,0.3)' }}>
                        {clock}
                    </div>
                    <div className="text-xs text-zinc-500 capitalize">{date}</div>
                </div>
            </div>

            {/* ── Live indicator ── */}
            <div className="flex items-center justify-center gap-2 pb-3 shrink-0">
                <span className={`inline-block w-2 h-2 rounded-full bg-emerald-400 ${pulse ? 'opacity-100' : 'opacity-40'} transition-opacity duration-300`} />
                <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-medium">Temps reel</span>
            </div>

            {/* ── KPI Grid ── */}
            <div className="flex-1 px-8 flex items-center justify-center">
                <div className="grid grid-cols-4 gap-5 w-full max-w-[1400px]">
                    {kpis.map(kpi => (
                        <KPICard key={kpi.label} label={kpi.label} value={kpi.value} color={kpi.color} glow={kpi.glow} />
                    ))}
                </div>
            </div>

            {/* ── Agent status bar ── */}
            <div className="shrink-0 px-8 pb-6 pt-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] px-6 py-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-medium">Agents</span>
                        <span className="text-[10px] text-zinc-700">
                            {agents.filter(a => ['ONLINE','ACTIVE','BUSY'].includes(a.status?.toUpperCase())).length}/{agents.length}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {agents.length === 0 && <span className="text-xs text-zinc-700">Aucun agent</span>}
                        {agents.map(a => <AgentDot key={a.agentId} agent={a} />)}
                    </div>
                </div>
            </div>

            {/* ── Escape hint ── */}
            <div className="absolute bottom-2 right-4">
                <span className="text-[10px] text-zinc-700">Echap pour quitter</span>
            </div>
        </div>
    )
}
