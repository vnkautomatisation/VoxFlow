'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''
const apiFetch = async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(API() + path, {
        ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...(opts.headers || {}) }, body: opts.body,
    }); return r.json()
}

const fmtT = (s: number) => {
    if (!s) return '0:00'
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
}
const fmtPhone = (p: string) => p?.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4') || '—'

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
    ONLINE: { label: 'Disponible', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
    BUSY: { label: 'En appel', dot: 'bg-rose-400', text: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/30' },
    BREAK: { label: 'En pause', dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
    OFFLINE: { label: 'Hors ligne', dot: 'bg-zinc-500', text: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
}
const ACP = ['#2d1a80', '#1a356b', '#1a4d3a', '#4d1a5a', '#4d2a1a']
const ini = (n: string) => (n || '?').split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase()

// ─── Modal Supervision WebRTC ───────────────────────────────────────────────
interface SupervisionModalProps {
    callId: string
    agentName: string
    callNum: string
    onClose: () => void
}

function SupervisionModal({ callId, agentName, callNum, onClose }: SupervisionModalProps) {
    const [mode, setMode] = useState<'listen' | 'whisper' | 'barge'>('listen')
    const [connected, setConnected] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [error, setError] = useState('')
    const [duration, setDuration] = useState(0)
    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
    const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
    const [selInput, setSelInput] = useState('')
    const [selOutput, setSelOutput] = useState('')
    const [speaking, setSpeaking] = useState(false)
    const deviceRef = useRef<any>(null)
    const callRef = useRef<any>(null)
    const timerRef = useRef<any>(null)
    const analyserRef = useRef<any>(null)
    const animRef = useRef<any>(null)

    // Charger les périphériques audio
    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            navigator.mediaDevices.enumerateDevices().then(devices => {
                setAudioInputs(devices.filter(d => d.kind === 'audioinput'))
                setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'))
            })
        }).catch(() => { })
    }, [])

    const startTimer = () => {
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    }

    const stopAll = () => {
        clearInterval(timerRef.current)
        cancelAnimationFrame(animRef.current)
        if (callRef.current) { try { callRef.current.disconnect() } catch { } callRef.current = null }
        if (deviceRef.current) { try { deviceRef.current.destroy() } catch { } deviceRef.current = null }
    }

    const connect = async () => {
        setConnecting(true)
        setError('')
        try {
            // 1. Appeler le backend pour rejoindre la conference
            const r = await apiFetch(`/api/v1/supervision/call/${callId}/join`, {
                method: 'POST', body: JSON.stringify({ mode })
            })
            if (!r.success) throw new Error(r.error || 'Erreur serveur')

            // 2. Obtenir un token WebRTC superviseur
            const tr = await apiFetch('/api/v1/telephony/token')
            if (!tr.success || !tr.data?.token) throw new Error('Token WebRTC indisponible')

            // 3. Charger le SDK Twilio si pas encore présent
            if (!(window as any).Twilio) {
                await new Promise<void>((res, rej) => {
                    if ((window as any).Twilio) { res(); return }
                    const s = document.createElement('script')
                    s.src = '/twilio.min.js'
                    s.onload = () => res()
                    s.onerror = () => rej(new Error('Impossible de charger twilio.min.js'))
                    document.head.appendChild(s)
                    setTimeout(() => rej(new Error('Timeout chargement SDK Twilio')), 8000)
                })
            }
            const T = (window as any).Twilio
            if (!T) throw new Error('SDK Twilio indisponible')

            const device = new T.Device(tr.data.token, {
                logLevel: 1,
                codecPreferences: ['opus', 'pcmu'],
                enableRingingState: true,
            })

            await new Promise<void>((res, rej) => {
                device.on('registered', () => res())
                device.on('error', (e: any) => rej(new Error(e.message)))
                device.register()
                setTimeout(() => rej(new Error('Timeout enregistrement Twilio')), 10000)
            })

            // 4. Rejoindre la conference
            const conf = r.data?.conferenceName || `supervision-${callId}`
            const call = await device.connect({
                params: {
                    To: conf,
                    supervisorMode: mode,
                    callId,
                }
            })

            callRef.current = call
            deviceRef.current = device

            // 5. Appliquer le périphérique audio sélectionné
            if (selInput) {
                try { await call.setInputDevice(selInput) } catch { }
            }
            if (selOutput && device.audio) {
                try { await device.audio.speakerDevices.set([selOutput]) } catch { }
            }

            // 6. Visualiseur vocal — détecter si l'admin parle
            call.on('volume', (_inputVol: number, outputVol: number) => {
                setSpeaking(outputVol > 0.01)
            })

            call.on('accept', () => { setConnected(true); setConnecting(false); startTimer() })
            call.on('disconnect', () => { setConnected(false); stopAll() })
            call.on('error', (e: any) => { setError(e.message); setConnecting(false) })

        } catch (e: any) {
            setError(e.message)
            setConnecting(false)
        }
    }

    const changeMode = async (newMode: 'listen' | 'whisper' | 'barge') => {
        setMode(newMode)
        // Notifier le backend du changement de mode
        try {
            await apiFetch(`/api/v1/supervision/call/${callId}/join`, {
                method: 'POST', body: JSON.stringify({ mode: newMode })
            })
        } catch { }
    }

    const disconnect = () => { stopAll(); onClose() }

    useEffect(() => () => stopAll(), [])

    const MODE_CFG = {
        listen: { label: 'Ecouter', desc: 'Vous ecoutez — personne ne vous entend', color: 'bg-sky-500/20 border-sky-500/40 text-sky-400', icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" /></svg> },
        whisper: { label: 'Chuchoter', desc: "Vous parlez a l'agent uniquement", color: 'bg-amber-500/20 border-amber-500/40 text-amber-400', icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> },
        barge: { label: 'Intervenir', desc: 'Tout le monde vous entend', color: 'bg-rose-500/20 border-rose-500/40 text-rose-400', icon: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg> },
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-md shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e44]">
                    <div>
                        <div className="font-bold text-[#eeeef8]">Supervision en direct</div>
                        <div className="text-xs text-[#55557a] mt-0.5">{agentName} — {fmtPhone(callNum)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        {connected && (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-rose-400">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                                {fmtT(duration)}
                            </div>
                        )}
                        <button onClick={disconnect} className="text-[#55557a] hover:text-[#eeeef8]">
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5">

                    {/* Sélecteur de mode */}
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3">Mode de supervision</div>
                        <div className="space-y-2">
                            {(Object.entries(MODE_CFG) as [string, any][]).map(([key, cfg]) => (
                                <button key={key}
                                    onClick={() => connected ? changeMode(key as any) : setMode(key as any)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                                        ${mode === key ? cfg.color : 'border-[#2e2e44] bg-[#1f1f2a] hover:border-[#3a3a55]'}`}>
                                    <span className="flex-shrink-0">{cfg.icon}</span>
                                    <div className="flex-1">
                                        <div className={`text-sm font-bold ${mode === key ? '' : 'text-[#9898b8]'}`}>{cfg.label}</div>
                                        <div className="text-[10px] text-[#55557a]">{cfg.desc}</div>
                                    </div>
                                    {mode === key && (
                                        <div className="w-2 h-2 rounded-full bg-current" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Périphériques audio */}
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#55557a] mb-3">Peripheriques audio</div>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-[10px] text-[#55557a] mb-1">Microphone</label>
                                <select value={selInput} onChange={e => setSelInput(e.target.value)}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-xs text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    <option value="">Peripherique par defaut</option>
                                    {audioInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone ' + d.deviceId.substring(0, 8)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] text-[#55557a] mb-1">Haut-parleur / Casque</label>
                                <select value={selOutput} onChange={e => setSelOutput(e.target.value)}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2 text-xs text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    <option value="">Peripherique par defaut</option>
                                    {audioOutputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Haut-parleur ' + d.deviceId.substring(0, 8)}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Indicateur vocal */}
                    {connected && (
                        <div className="bg-[#1f1f2a] rounded-xl p-3 flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full transition-all ${speaking ? 'bg-emerald-400 shadow-[0_0_8px_rgba(0,212,170,.6)]' : 'bg-[#3a3a55]'}`} />
                            <div className="text-xs text-[#9898b8]">
                                {mode === 'listen' ? 'Ecoute en cours' : speaking ? 'Vous parlez...' : 'Microphone actif'}
                            </div>
                            <div className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full border
                                ${MODE_CFG[mode].color}`}>
                                {MODE_CFG[mode].label}
                            </div>
                        </div>
                    )}

                    {/* Erreur */}
                    {error && (
                        <div className="bg-rose-400/10 border border-rose-400/30 rounded-lg p-3 text-xs text-rose-400">
                            {error}
                        </div>
                    )}

                    {/* Bouton principal */}
                    {!connected ? (
                        <button onClick={connect} disabled={connecting}
                            className="w-full bg-[#7b61ff] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                            {connecting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Connexion...
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                    Rejoindre en mode {MODE_CFG[mode].label}
                                </>
                            )}
                        </button>
                    ) : (
                        <button onClick={disconnect}
                            className="w-full bg-rose-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-rose-600 transition-colors flex items-center justify-center gap-2">
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 012 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.19" /><line x1="23" y1="1" x2="1" y2="23" /></svg>
                            Raccrocher
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Page principale ────────────────────────────────────────────────────────
export default function LivePage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [snapshot, setSnapshot] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [supModal, setSupModal] = useState<{ callId: string; agentName: string; callNum: string } | null>(null)
    const [forceModal, setForceModal] = useState<{ agentId: string; agentName: string } | null>(null)
    const [actionMsg, setActionMsg] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const [now, setNow] = useState(new Date())
    const [tick, setTick] = useState(0)
    const pollRef = useRef<any>(null)
    const tickRef = useRef<any>(null)

    const showMsg = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setActionMsg({ msg, type }); setTimeout(() => setActionMsg(null), 3000)
    }

    const load = useCallback(async () => {
        try {
            const r = await apiFetch('/api/v1/supervision/snapshot')
            if (r.success) setSnapshot(r.data)
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
        pollRef.current = setInterval(load, 5000)
        tickRef.current = setInterval(() => { setTick(t => t + 1); setNow(new Date()) }, 1000)
        return () => { clearInterval(pollRef.current); clearInterval(tickRef.current) }
    }, [isAuth, load])

    const forceStatus = async (agentId: string, status: string) => {
        try {
            const r = await apiFetch(`/api/v1/supervision/agent/${agentId}/status`, {
                method: 'POST', body: JSON.stringify({ status })
            })
            if (r.success) { showMsg('Statut mis a jour'); load() }
            else showMsg(r.error || 'Erreur', 'err')
        } catch { showMsg('Erreur reseau', 'err') }
        setForceModal(null)
    }

    const kpis = snapshot?.kpis || {}
    const agents = snapshot?.agents || []
    const calls = snapshot?.activeCalls || []
    const queues = snapshot?.queues || []

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement supervision...</div>
        </div>
    )

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">

            {actionMsg && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full text-sm font-bold shadow-xl
                    ${actionMsg.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {actionMsg.msg}
                </div>
            )}

            {/* Modal supervision */}
            {supModal && (
                <SupervisionModal
                    callId={supModal.callId}
                    agentName={supModal.agentName}
                    callNum={supModal.callNum}
                    onClose={() => setSupModal(null)}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8]">Supervision Live</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                            style={{ boxShadow: '0 0 6px rgba(0,212,170,.8)' }} />
                        <span className="text-xs text-[#55557a]">
                            Temps reel — {now.toLocaleTimeString('fr-CA')}
                        </span>
                    </div>
                </div>
                <button onClick={load}
                    className="flex items-center gap-2 text-[10px] font-bold text-[#9898b8] border border-[#2e2e44] bg-[#18181f] px-3 py-2 rounded-lg hover:text-[#eeeef8] transition-colors">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                    </svg>
                    Rafraichir
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-7 gap-3">
                {[
                    { label: 'Appels actifs', val: kpis.activeCalls || 0, color: kpis.activeCalls > 0 ? 'text-rose-400' : 'text-[#eeeef8]', glow: kpis.activeCalls > 0 },
                    { label: 'Agents en ligne', val: `${kpis.onlineAgents || 0}/${kpis.totalAgents || 0}`, color: 'text-emerald-400' },
                    { label: 'En appel', val: kpis.busyAgents || 0, color: 'text-rose-400' },
                    { label: 'Completes auj.', val: kpis.completedToday || 0, color: 'text-violet-400' },
                    { label: 'Manques auj.', val: kpis.missedToday || 0, color: kpis.missedToday > 0 ? 'text-amber-400' : 'text-[#9898b8]' },
                    { label: 'Duree moy.', val: fmtT(kpis.avgDuration || 0), color: 'text-sky-400' },
                    { label: 'SLA', val: `${kpis.slaRate || 100}%`, color: (kpis.slaRate || 100) >= 80 ? 'text-emerald-400' : 'text-rose-400' },
                ].map((k, i) => (
                    <div key={i} className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-3 text-center">
                        <div className={`text-xl font-bold font-mono ${k.color} ${(k as any).glow ? 'animate-pulse' : ''}`}>{k.val}</div>
                        <div className="text-[9px] text-[#55557a] font-bold uppercase tracking-wider mt-1">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Agents */}
            <div>
                <div className="text-xs font-bold text-[#eeeef8] mb-3">
                    Agents ({kpis.onlineAgents || 0}/{kpis.totalAgents || 0} en ligne)
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {agents.map((a: any, i: number) => {
                        const isOnCall = !!a.callId
                        const st = isOnCall ? 'BUSY' : (a.status || 'OFFLINE')
                        const cfg = STATUS_CFG[st] || STATUS_CFG.OFFLINE
                        const dur = a.callStarted
                            ? Math.floor((Date.now() - new Date(a.callStarted).getTime()) / 1000) + tick * 0
                            : (a.callDuration || 0)
                        return (
                            <div key={a.agentId} className={`bg-[#18181f] border rounded-xl overflow-hidden transition-all ${isOnCall ? 'border-rose-400/40' : cfg.border}`}>
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 relative"
                                        style={{ background: `linear-gradient(135deg, ${ACP[i % ACP.length]}, ${ACP[i % ACP.length]}dd)` }}>
                                        {ini(a.name)}
                                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#18181f] ${cfg.dot}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-[#eeeef8] truncate">{a.name}</div>
                                        <div className="text-[10px] text-[#55557a] truncate">{a.email}</div>
                                    </div>
                                    <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                                        {cfg.label}
                                    </div>
                                    <button onClick={() => setForceModal({ agentId: a.agentId, agentName: a.name })}
                                        className="text-[#55557a] hover:text-[#9898b8] transition-colors ml-1">
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
                                        </svg>
                                    </button>
                                </div>

                                {isOnCall && (
                                    <div className="border-t border-[#2e2e44] px-4 py-3 bg-rose-400/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${a.callDirection === 'INBOUND' ? 'bg-sky-400/20 text-sky-400' : 'bg-violet-400/20 text-violet-400'}`}>
                                                    {a.callDirection === 'INBOUND' ? 'Entrant' : 'Sortant'}
                                                </span>
                                                <span className="text-xs font-mono text-[#9898b8]">
                                                    {fmtPhone(a.callDirection === 'INBOUND' ? a.callFrom : a.callTo)}
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold font-mono text-rose-400 animate-pulse">{fmtT(dur)}</span>
                                        </div>
                                        {/* Bouton unique supervision — ouvre la modal */}
                                        <button
                                            onClick={() => setSupModal({
                                                callId: a.callId,
                                                agentName: a.name,
                                                callNum: a.callDirection === 'INBOUND' ? a.callFrom : a.callTo,
                                            })}
                                            className="w-full text-[10px] font-bold py-2 rounded-lg border transition-colors bg-violet-500/20 text-violet-400 border-violet-500/40 hover:bg-violet-500/30">
                                            Superviser cet appel
                                        </button>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Tableau appels actifs */}
            {calls.length > 0 && (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl overflow-hidden">
                    <div className="flex items-center px-5 py-4 border-b border-[#2e2e44]">
                        <div className="text-xs font-bold text-[#eeeef8] flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                            Appels actifs ({calls.length})
                        </div>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="bg-[#1f1f2a] border-b border-[#2e2e44]">
                                {['Direction', 'Numero', 'Contact', 'Agent', 'Duree', 'Statut', 'Actions'].map(h => (
                                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#55557a]">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {calls.map((c: any) => {
                                const agent = agents.find((a: any) => a.agentId === c.agent_id)
                                const dur = c.started_at ? Math.floor((Date.now() - new Date(c.started_at).getTime()) / 1000) : 0
                                return (
                                    <tr key={c.id} className="border-b border-[#1f1f2a] last:border-0 hover:bg-[#1f1f2a]/50">
                                        <td className="px-4 py-3">
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${c.direction === 'INBOUND' ? 'bg-sky-400/10 text-sky-400 border-sky-400/30' : 'bg-violet-400/10 text-violet-400 border-violet-400/30'}`}>
                                                {c.direction === 'INBOUND' ? 'Entrant' : 'Sortant'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-[#9898b8]">{fmtPhone(c.direction === 'INBOUND' ? c.from_number : c.to_number)}</td>
                                        <td className="px-4 py-3 text-xs text-[#55557a]">{c.contacts?.name || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-[#9898b8]">{agent?.name || '—'}</td>
                                        <td className="px-4 py-3 font-mono text-sm font-bold text-rose-400">{fmtT(dur)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${c.status === 'IN_PROGRESS' ? 'bg-rose-400/10 text-rose-400 border-rose-400/30' : 'bg-amber-400/10 text-amber-400 border-amber-400/30'}`}>
                                                {c.status === 'IN_PROGRESS' ? 'En cours' : c.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setSupModal({
                                                    callId: c.id,
                                                    agentName: agent?.name || 'Agent',
                                                    callNum: c.direction === 'INBOUND' ? c.from_number : c.to_number,
                                                })}
                                                className="text-[9px] font-bold px-3 py-1.5 rounded-lg border bg-violet-400/10 text-violet-400 border-violet-400/30 hover:bg-violet-400/20 transition-colors">
                                                Superviser
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Files d'attente */}
            {queues.length > 0 && (
                <div>
                    <div className="text-xs font-bold text-[#eeeef8] mb-3">Files d&apos;attente</div>
                    <div className="grid grid-cols-4 gap-3">
                        {queues.map((q: any) => (
                            <div key={q.id} className={`bg-[#18181f] border rounded-xl p-4 ${q.is_vip ? 'border-violet-400/40' : 'border-[#2e2e44]'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <div className="font-semibold text-sm text-[#eeeef8] truncate">{q.name}</div>
                                    {q.is_vip && <span className="text-[9px] font-bold bg-violet-400/15 text-violet-400 border border-violet-400/30 px-1.5 py-0.5 rounded-full">VIP</span>}
                                </div>
                                <div className="text-[10px] text-[#55557a]">{q.strategy?.replace('_', ' ')}</div>
                                <div className="text-[10px] text-[#3a3a55] mt-1">SLA : {q.sla_threshold || 20}s</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Etat vide */}
            {calls.length === 0 && agents.every((a: any) => !a.callId) && (
                <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-3">
                        <svg width="20" height="20" fill="none" stroke="#00d4aa" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <p className="text-sm font-medium text-[#9898b8]">Aucun appel actif</p>
                    <p className="text-xs text-[#55557a] mt-1">Tous les agents sont disponibles</p>
                </div>
            )}

            {/* Modal forcer statut */}
            {forceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="px-6 py-4 border-b border-[#2e2e44]">
                            <div className="font-bold text-[#eeeef8]">Forcer le statut</div>
                            <div className="text-xs text-[#55557a]">{forceModal.agentName}</div>
                        </div>
                        <div className="p-4 space-y-2">
                            {([
                                { status: 'ONLINE' as const, label: 'Disponible', cfg: STATUS_CFG.ONLINE },
                                { status: 'BREAK' as const, label: 'En pause', cfg: STATUS_CFG.BREAK },
                                { status: 'OFFLINE' as const, label: 'Hors ligne', cfg: STATUS_CFG.OFFLINE },
                            ]).map(s => (
                                <button key={s.status}
                                    onClick={() => forceStatus(forceModal.agentId, s.status)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${s.cfg.bg} ${s.cfg.border} hover:opacity-90`}>
                                    <div className={`w-2.5 h-2.5 rounded-full ${s.cfg.dot}`} />
                                    <span className={`text-sm font-semibold ${s.cfg.text}`}>{s.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="px-4 pb-4">
                            <button onClick={() => setForceModal(null)} className="w-full bg-[#1f1f2a] border border-[#2e2e44] text-[#9898b8] px-4 py-2.5 rounded-lg text-sm font-bold">Annuler</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}