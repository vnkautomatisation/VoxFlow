'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''

const apiFetch = async (path: string) => {
    const r = await fetch(API() + path, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK() } })
    return r.json()
}

const fmtT = (s: number) => { if (!s) return '0:00'; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const fmtD = (dt: string) => { if (!dt) return '—'; return new Date(dt).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' }) }
const fmtH = (dt: string) => { if (!dt) return '—'; return new Date(dt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) }

const PERIODS = [
    { value: '7d', label: '7 jours' },
    { value: '30d', label: '30 jours' },
    { value: '90d', label: '90 jours' },
]

const COLORS = { violet: '#7b61ff', mint: '#00d4aa', rose: '#ff4d6d', sky: '#38b6ff', amber: '#ffb547', grid: '#2e2e44', text: '#55557a' }
const AGENT_COLORS = ['#7b61ff', '#00d4aa', '#38b6ff', '#ffb547', '#ff4d6d', '#a78bfa', '#34d399', '#60a5fa']

const buildDailyData = (calls: any[], days: number) => {
    const map: Record<string, any> = {}
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        map[key] = { date: fmtD(d.toISOString()), total: 0, completed: 0, outbound: 0, inbound: 0, duration: 0 }
    }
    calls.forEach((c: any) => {
        const key = c.started_at?.split('T')[0]
        if (map[key]) {
            map[key].total++
            if (c.status === 'COMPLETED') map[key].completed++
            if (c.direction === 'OUTBOUND') map[key].outbound++
            else map[key].inbound++
            map[key].duration += c.duration || 0
        }
    })
    return Object.values(map)
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl px-4 py-3 shadow-2xl">
            <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider mb-2">{label}</div>
            {payload.map((p: any) => (
                <div key={p.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-[#9898b8]">{p.name}</span>
                    <span className="font-bold text-[#eeeef8] ml-auto pl-4">{p.value}</span>
                </div>
            ))}
        </div>
    )
}

export default function ReportsPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [period, setPeriod] = useState('30d')
    const [agentFilter, setAgentFilter] = useState('all')
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const r = await apiFetch(`/api/v1/admin/reports?period=${period}`)
            if (r.success) setData(r.data)
        } catch { }
        setLoading(false)
    }, [period])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const exportCSV = () => {
        if (!filteredCalls.length) return
        setExporting(true)
        const headers = ['ID', 'Direction', 'Statut', 'Durée (s)', 'Agent', 'Date', 'Heure']
        const rows = filteredCalls.map((c: any) => [
            c.id, c.direction, c.status, c.duration || 0,
            data?.byAgent?.find((a: any) => a.agent_id === c.agent_id)?.name || c.agent_id || '—',
            fmtD(c.started_at), fmtH(c.started_at)
        ])
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `rapport-voxflow-${period}-${new Date().toISOString().split('T')[0]}.csv`
        a.click(); URL.revokeObjectURL(url)
        setExporting(false)
    }

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const allCalls = data?.recentCalls || []

    // Filtre par agent
    const filteredCalls = agentFilter === 'all'
        ? allCalls
        : allCalls.filter((c: any) => c.agent_id === agentFilter)

    const daily = buildDailyData(filteredCalls, Math.min(days, 30))
    const byAgent = data?.byAgent || []

    const pieData = [
        { name: 'Complétés', value: filteredCalls.filter((c: any) => c.status === 'COMPLETED').length, color: COLORS.mint },
        { name: 'Non complétés', value: filteredCalls.filter((c: any) => c.status !== 'COMPLETED').length, color: COLORS.rose },
    ].filter(d => d.value > 0)

    const totalFiltered = filteredCalls.length
    const completedFiltered = filteredCalls.filter((c: any) => c.status === 'COMPLETED').length
    const resRate = totalFiltered > 0 ? Math.round((completedFiltered / totalFiltered) * 100) : 0
    const avgDur = completedFiltered > 0
        ? Math.round(filteredCalls.filter((c: any) => c.status === 'COMPLETED').reduce((s: number, c: any) => s + (c.duration || 0), 0) / completedFiltered)
        : 0

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement des rapports...</div>
        </div>
    )

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Rapports</h1>
                    <div className="text-xs text-[#55557a] mt-0.5">
                        {PERIODS.find(p => p.value === period)?.label}
                        {agentFilter !== 'all' && ` · ${byAgent.find((a: any) => a.agent_id === agentFilter)?.name || agentFilter}`}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">

                    {/* Filtre agent */}
                    <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                        className="bg-[#18181f] border border-[#2e2e44] text-[10px] font-bold text-[#9898b8] px-3 py-2 rounded-lg outline-none focus:border-[#7b61ff] transition-colors">
                        <option value="all">Tous les agents</option>
                        {byAgent.map((a: any) => (
                            <option key={a.agent_id} value={a.agent_id}>{a.name} ({a.calls} appels)</option>
                        ))}
                    </select>

                    {/* Sélecteur période */}
                    <div className="flex bg-[#18181f] border border-[#2e2e44] rounded-lg p-0.5">
                        {PERIODS.map(p => (
                            <button key={p.value} onClick={() => setPeriod(p.value)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all
                  ${period === p.value ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Export CSV */}
                    <button onClick={exportCSV} disabled={exporting || !filteredCalls.length}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-[#9898b8] border border-[#2e2e44] bg-[#18181f] px-3 py-2 rounded-lg hover:text-[#eeeef8] hover:border-[#3a3a55] disabled:opacity-40 transition-colors">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {exporting ? 'Export...' : 'Exporter CSV'}
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                    { label: 'Total appels', val: totalFiltered, color: 'text-[#eeeef8]', sub: PERIODS.find(p => p.value === period)?.label },
                    { label: 'Complétés', val: completedFiltered, color: 'text-emerald-400', sub: `${resRate}% taux` },
                    { label: 'Sortants', val: filteredCalls.filter((c: any) => c.direction === 'OUTBOUND').length, color: 'text-violet-400', sub: 'émis' },
                    { label: 'Entrants', val: filteredCalls.filter((c: any) => c.direction === 'INBOUND').length, color: 'text-sky-400', sub: 'reçus' },
                    { label: 'Durée moyenne', val: fmtT(avgDur), color: 'text-amber-400', sub: 'par appel' },
                ].map(k => (
                    <div key={k.label} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-4">
                        <div className={`text-2xl font-bold font-mono ${k.color}`}>{k.val}</div>
                        <div className="text-[10px] text-[#55557a] font-bold uppercase tracking-wider mt-1">{k.label}</div>
                        <div className="text-[10px] text-[#3a3a55] mt-0.5">{k.sub}</div>
                    </div>
                ))}
            </div>

            {/* Graphique volume par jour */}
            <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
                <div className="text-xs font-bold text-[#eeeef8] mb-4">Volume d'appels par jour</div>
                {daily.some((d: any) => d.total > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.violet} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={COLORS.violet} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.mint} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={COLORS.mint} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '10px', color: COLORS.text }} />
                            <Area type="monotone" dataKey="total" name="Total" stroke={COLORS.violet} fill="url(#gT)" strokeWidth={2} dot={false} />
                            <Area type="monotone" dataKey="completed" name="Complétés" stroke={COLORS.mint} fill="url(#gC)" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-[220px] flex items-center justify-center text-[#55557a] text-sm">Aucune donnée pour cette période</div>
                )}
            </div>

            {/* Graphiques 3 colonnes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Entrants vs Sortants */}
                <div className="col-span-2 bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
                    <div className="text-xs font-bold text-[#eeeef8] mb-4">Entrants vs Sortants par jour</div>
                    {daily.some((d: any) => d.inbound > 0 || d.outbound > 0) ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                <XAxis dataKey="date" tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '10px', color: COLORS.text }} />
                                <Bar dataKey="inbound" name="Entrants" fill={COLORS.sky} radius={[3, 3, 0, 0]} />
                                <Bar dataKey="outbound" name="Sortants" fill={COLORS.violet} radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-[#55557a] text-sm">Aucune donnée</div>
                    )}
                </div>

                {/* Pie résolution */}
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
                    <div className="text-xs font-bold text-[#eeeef8] mb-4">Taux de résolution</div>
                    {pieData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={130}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60}
                                        dataKey="value" paddingAngle={3} strokeWidth={0}>
                                        {pieData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="text-center mt-1">
                                <div className="text-2xl font-bold font-mono text-emerald-400">{resRate}%</div>
                                <div className="text-[10px] text-[#55557a]">taux de complétion</div>
                            </div>
                            <div className="space-y-1.5 mt-3">
                                {pieData.map((d: any) => (
                                    <div key={d.name} className="flex items-center justify-between text-[10px]">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                                            <span className="text-[#9898b8]">{d.name}</span>
                                        </div>
                                        <span className="font-bold text-[#eeeef8]">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-[130px] flex items-center justify-center text-[#55557a] text-sm">Aucune donnée</div>
                    )}
                </div>
            </div>

            {/* Graphique par agent */}
            {byAgent.length > 0 && agentFilter === 'all' && (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
                    <div className="text-xs font-bold text-[#eeeef8] mb-4">Performance par agent</div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={byAgent} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '10px', color: COLORS.text }} />
                            <Bar dataKey="calls" name="Total appels" fill={COLORS.violet} radius={[3, 3, 0, 0]} />
                            <Bar dataKey="completed" name="Complétés" fill={COLORS.mint} radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Tableau stats agents */}
                    <div className="mt-4 space-y-2">
                        {byAgent.map((a: any, i: number) => (
                            <div key={a.agent_id}
                                className="flex items-center gap-3 bg-[#1f1f2a] rounded-lg px-4 py-2.5 cursor-pointer hover:bg-[#2e2e44]/50 transition-colors"
                                onClick={() => setAgentFilter(a.agent_id)}>
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: AGENT_COLORS[i % AGENT_COLORS.length] }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-[#eeeef8] truncate">{a.name}</div>
                                </div>
                                <div className="flex items-center gap-4 text-[10px]">
                                    <div className="text-center">
                                        <div className="font-bold text-[#eeeef8]">{a.calls}</div>
                                        <div className="text-[#55557a]">appels</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-emerald-400">{a.resolution}%</div>
                                        <div className="text-[#55557a]">résolution</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-amber-400">{fmtT(a.avgDuration)}</div>
                                        <div className="text-[#55557a]">durée moy.</div>
                                    </div>
                                </div>
                                <svg width="12" height="12" fill="none" stroke="#55557a" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tableau appels récents */}
            <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e44]">
                    <div className="text-xs font-bold text-[#eeeef8]">Appels récents</div>
                    <div className="flex items-center gap-2">
                        {agentFilter !== 'all' && (
                            <button onClick={() => setAgentFilter('all')}
                                className="text-[10px] text-[#7b61ff] hover:underline">
                                ← Tous les agents
                            </button>
                        )}
                        <div className="text-[10px] text-[#55557a]">{filteredCalls.length} appel{filteredCalls.length > 1 ? 's' : ''}</div>
                    </div>
                </div>
                {filteredCalls.length === 0 ? (
                    <div className="py-10 text-center text-[#55557a] text-sm">Aucun appel sur cette période</div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#1f1f2a] border-b border-[#2e2e44]">
                                {['Direction', 'Statut', 'Durée', 'Agent', 'Date', 'Heure'].map(h => (
                                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#55557a]">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCalls.map((c: any) => {
                                const agentName = byAgent.find((a: any) => a.agent_id === c.agent_id)?.name || c.agent_id?.substring(0, 12) || '—'
                                return (
                                    <tr key={c.id} className="border-b border-[#1f1f2a] last:border-0 hover:bg-[#1f1f2a]/50">
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                        ${c.direction === 'INBOUND'
                                                    ? 'bg-sky-400/15 text-sky-400 border border-sky-400/30'
                                                    : 'bg-violet-400/15 text-violet-400 border border-violet-400/30'}`}>
                                                {c.direction === 'INBOUND' ? '↓ Entrant' : '↑ Sortant'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                        ${c.status === 'COMPLETED'
                                                    ? 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/30'
                                                    : 'bg-rose-400/15 text-rose-400 border border-rose-400/30'}`}>
                                                {c.status === 'COMPLETED' ? 'Complété' : c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm text-[#9898b8]">{fmtT(c.duration || 0)}</td>
                                        <td className="px-4 py-3 text-xs text-[#9898b8] truncate max-w-[140px]">
                                            <button onClick={() => setAgentFilter(c.agent_id)} className="hover:text-[#7b61ff] transition-colors text-left">
                                                {agentName}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-[#55557a]">{fmtD(c.started_at)}</td>
                                        <td className="px-4 py-3 text-xs text-[#55557a]">{fmtH(c.started_at)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

        </div>
    )
}