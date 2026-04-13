'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''
const apiFetch = async (path: string) => {
    const r = await fetch(API() + path, { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK() } })
    return r.json()
}

const fmtDate = (dt: string) => {
    if (!dt) return '--'
    return new Date(dt).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })
}
const fmtTime = (dt: string) => {
    if (!dt) return '--'
    return new Date(dt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
}
const fmtDur = (s: number) => {
    if (!s) return '0:00'
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
const fmtPh = (p: string) => p?.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4') || p || '--'

type TimeFilter = 'all' | 'today' | 'week' | 'month'
type DirFilter = 'all' | 'INBOUND' | 'OUTBOUND'

interface Call {
    id: string
    from_number: string
    to_number: string
    direction: 'INBOUND' | 'OUTBOUND'
    duration: number
    recording_url: string
    recording_duration?: number
    transcription?: string
    ai_summary?: string
    started_at: string
    agent?: { id: string; name: string }
    agent_name?: string
}

/* ── Inline Audio Player ────────────────────────── */
function AudioPlayer({ url }: { url: string }) {
    const [loading, setLoading] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [prog, setProg] = useState(0)
    const [dur, setDur] = useState(0)
    const [err, setErr] = useState('')
    const ref = useRef<HTMLAudioElement | null>(null)

    const toggle = async () => {
        if (ref.current) {
            if (ref.current.paused) { ref.current.play(); setPlaying(true) }
            else { ref.current.pause(); setPlaying(false) }
            return
        }
        setLoading(true); setErr('')
        try {
            const tok = TOK(), base = API()
            const src = url.includes('twilio.com') && tok
                ? `${base}/api/v1/telephony/recording-proxy?url=${encodeURIComponent(url)}`
                : url
            const res = await fetch(src, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} })
            if (!res.ok) throw new Error('HTTP ' + res.status)
            const blob = URL.createObjectURL(await res.blob())
            const a = new Audio(blob)
            ref.current = a
            a.onloadedmetadata = () => setDur(a.duration)
            a.ontimeupdate = () => setProg(a.currentTime / (a.duration || 1) * 100)
            a.onended = () => { setPlaying(false); setProg(0) }
            await a.play(); setPlaying(true)
        } catch (e: any) { setErr(e.message) }
        setLoading(false)
    }

    const seek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return
        const r = e.currentTarget.getBoundingClientRect()
        ref.current.currentTime = ((e.clientX - r.left) / r.width) * ref.current.duration
    }

    useEffect(() => () => { ref.current?.pause() }, [])

    if (err) return <div className="text-[10px] text-rose-400">{err}</div>
    return (
        <div className="flex items-center gap-2">
            <button onClick={toggle} disabled={loading}
                className="w-7 h-7 rounded-full bg-[#7b61ff]/20 border border-[#7b61ff]/30 flex items-center justify-center hover:bg-[#7b61ff]/30 transition-colors flex-shrink-0">
                {loading
                    ? <div className="w-3 h-3 border border-[#7b61ff]/50 border-t-[#7b61ff] rounded-full animate-spin" />
                    : playing
                        ? <svg width="10" height="10" fill="currentColor" className="text-[#7b61ff]" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        : <svg width="10" height="10" fill="currentColor" className="text-[#7b61ff] ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                }
            </button>
            <div className="flex-1 min-w-[80px]">
                <div className="bg-[#1f1f2a] rounded-full h-1.5 cursor-pointer" onClick={seek}>
                    <div className="bg-[#7b61ff] h-full rounded-full transition-all" style={{ width: `${prog}%` }} />
                </div>
                {dur > 0 && (
                    <div className="text-[9px] text-[#55557a] mt-0.5">
                        {fmtDur(Math.floor(ref.current?.currentTime || 0))} / {fmtDur(Math.floor(dur))}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ── Recordings Page ────────────────────────────── */
export default function RecordingsPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [calls, setCalls] = useState<Call[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
    const [dirFilter, setDirFilter] = useState<DirFilter>('all')
    const [expandedTx, setExpandedTx] = useState<Set<string>>(new Set())

    const load = useCallback(async () => {
        try {
            const res = await apiFetch('/api/v1/telephony/calls?limit=200')
            if (res.success) {
                const withRec = (res.data || []).filter((c: Call) => c.recording_url)
                setCalls(withRec)
            }
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const toggleTx = (id: string) => {
        setExpandedTx(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const downloadRec = (url: string, callId: string) => {
        const tok = TOK(), base = API()
        const src = url.includes('twilio.com') && tok
            ? `${base}/api/v1/telephony/recording-proxy?url=${encodeURIComponent(url)}`
            : url
        const a = document.createElement('a')
        a.href = src
        a.download = `recording-${callId}.wav`
        a.target = '_blank'
        a.click()
    }

    /* ── Filters ───────────────────────────────────── */
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const filtered = calls.filter(c => {
        if (dirFilter !== 'all' && c.direction !== dirFilter) return false
        if (timeFilter !== 'all') {
            const dt = new Date(c.started_at)
            if (timeFilter === 'today' && dt < startOfDay) return false
            if (timeFilter === 'week' && dt < startOfWeek) return false
            if (timeFilter === 'month' && dt < startOfMonth) return false
        }
        if (search) {
            const s = search.toLowerCase()
            const agentName = (c.agent?.name || c.agent_name || '').toLowerCase()
            return agentName.includes(s)
                || (c.from_number || '').includes(s)
                || (c.to_number || '').includes(s)
                || fmtDate(c.started_at).toLowerCase().includes(s)
        }
        return true
    })

    /* ── Stats ─────────────────────────────────────── */
    const totalDuration = filtered.reduce((a, c) => a + (c.recording_duration || c.duration || 0), 0)
    const avgDuration = filtered.length ? Math.round(totalDuration / filtered.length) : 0

    /* ── Loading state ─────────────────────────────── */
    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement...</div>
        </div>
    )

    const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
        { value: 'all', label: 'Tous' },
        { value: 'today', label: "Aujourd'hui" },
        { value: 'week', label: 'Cette semaine' },
        { value: 'month', label: 'Ce mois' },
    ]

    const DIR_FILTERS: { value: DirFilter; label: string }[] = [
        { value: 'all', label: 'Tous' },
        { value: 'INBOUND', label: 'Entrants' },
        { value: 'OUTBOUND', label: 'Sortants' },
    ]

    return (
        <div className="p-6 max-w-6xl mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8] flex items-center gap-2">
                        Enregistrements
                        <span className="text-xs font-bold bg-[#7b61ff]/15 text-[#7b61ff] border border-[#7b61ff]/30 px-2 py-0.5 rounded-full">{filtered.length}</span>
                    </h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{calls.length} enregistrement{calls.length !== 1 ? 's' : ''} au total</div>
                </div>
                <button onClick={() => { setLoading(true); load() }}
                    className="flex items-center gap-2 text-[10px] font-bold text-[#9898b8] border border-[#2e2e44] bg-[#18181f] px-3 py-2 rounded-lg hover:text-[#eeeef8] transition-colors self-start">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
                    Rafraichir
                </button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {[
                    { label: 'Total enregistrements', value: String(filtered.length), color: '#7b61ff' },
                    { label: 'Duree totale', value: fmtDur(totalDuration), color: '#00d4aa' },
                    { label: 'Duree moyenne', value: fmtDur(avgDuration), color: '#38b6ff' },
                ].map(s => (
                    <div key={s.label} className="bg-[#18181f] border border-[#2e2e44] rounded-xl px-5 py-4">
                        <div className="text-[10px] font-bold text-[#55557a] uppercase tracking-wider">{s.label}</div>
                        <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                {/* Search */}
                <div className="relative w-full sm:flex-1 sm:max-w-sm">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55557a]" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par tel, agent, date..."
                        className="w-full bg-[#18181f] border border-[#2e2e44] rounded-lg pl-9 pr-4 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                </div>

                {/* Time filters */}
                <div className="flex gap-1 bg-[#18181f] border border-[#2e2e44] rounded-lg p-1 self-start sm:self-auto">
                    {TIME_FILTERS.map(f => (
                        <button key={f.value} onClick={() => setTimeFilter(f.value)}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${timeFilter === f.value ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Direction filters */}
                <div className="flex gap-1 bg-[#18181f] border border-[#2e2e44] rounded-lg p-1 self-start sm:self-auto">
                    {DIR_FILTERS.map(f => (
                        <button key={f.value} onClick={() => setDirFilter(f.value)}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${dirFilter === f.value ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 ? (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                    <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9 9l6 6M15 9l-6 6" />
                    </svg>
                    <p className="text-sm font-medium text-[#55557a]">
                        {search || timeFilter !== 'all' || dirFilter !== 'all' ? 'Aucun enregistrement correspondant' : 'Aucun enregistrement disponible'}
                    </p>
                    <p className="text-xs text-[#3a3a55] mt-1">Les appels enregistres apparaitront ici</p>
                </div>
            ) : (
                /* ── Table ──────────────────────────────────── */
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[#2e2e44]">
                                    {['Date', 'Agent', 'De', 'Vers', 'Duree', 'Direction', 'Lecture', 'Actions'].map(h => (
                                        <th key={h} className="text-[10px] font-bold text-[#55557a] uppercase tracking-wider px-4 py-3">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => {
                                    const agentName = c.agent?.name || c.agent_name || '--'
                                    const hasTx = !!(c.transcription || c.ai_summary)
                                    const txOpen = expandedTx.has(c.id)
                                    return (
                                        <tr key={c.id} className="border-b border-[#2e2e44]/50 hover:bg-[#1a1a28] transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="text-xs text-[#eeeef8] font-medium">{fmtDate(c.started_at)}</div>
                                                <div className="text-[10px] text-[#55557a]">{fmtTime(c.started_at)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs text-[#9898b8] font-medium">{agentName}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs text-[#9898b8] font-mono">{fmtPh(c.from_number)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs text-[#9898b8] font-mono">{fmtPh(c.to_number)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs text-[#eeeef8] font-mono">{fmtDur(c.recording_duration || c.duration || 0)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.direction === 'INBOUND'
                                                    ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                                                    : 'bg-sky-400/10 text-sky-400 border border-sky-400/20'
                                                    }`}>
                                                    {c.direction === 'INBOUND' ? 'Entrant' : 'Sortant'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="w-40">
                                                    <AudioPlayer url={c.recording_url} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    {/* Download */}
                                                    <button onClick={() => downloadRec(c.recording_url, c.id)}
                                                        title="Telecharger"
                                                        className="w-7 h-7 rounded-lg bg-[#12121a] border border-[#2e2e44] flex items-center justify-center hover:border-[#7b61ff]/40 transition-colors">
                                                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-[#9898b8]">
                                                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                                        </svg>
                                                    </button>
                                                    {/* Transcription toggle */}
                                                    {hasTx && (
                                                        <button onClick={() => toggleTx(c.id)}
                                                            title="Transcription"
                                                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${txOpen
                                                                ? 'bg-[#7b61ff]/15 border-[#7b61ff]/40 text-[#7b61ff]'
                                                                : 'bg-[#12121a] border-[#2e2e44] text-[#9898b8] hover:border-[#7b61ff]/40'
                                                                }`}>
                                                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Transcription expanded row-inline */}
                                                {txOpen && (
                                                    <div className="mt-2 bg-[#12121a] border border-[#2e2e44] rounded-lg p-3 max-w-xs">
                                                        {c.ai_summary && (
                                                            <div className="mb-2">
                                                                <div className="text-[9px] font-bold text-[#7b61ff] uppercase tracking-wider mb-1">Resume IA</div>
                                                                <div className="text-[11px] text-[#9898b8] leading-relaxed">{c.ai_summary}</div>
                                                            </div>
                                                        )}
                                                        {c.transcription && (
                                                            <div>
                                                                <div className="text-[9px] font-bold text-[#55557a] uppercase tracking-wider mb-1">Transcription</div>
                                                                <div className="text-[11px] text-[#9898b8] leading-relaxed max-h-32 overflow-y-auto">{c.transcription}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
