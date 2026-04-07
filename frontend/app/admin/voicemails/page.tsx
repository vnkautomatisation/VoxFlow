'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

const API = () => typeof window !== 'undefined' ? localStorage.getItem('vf_url') || 'http://localhost:4000' : 'http://localhost:4000'
const TOK = () => typeof window !== 'undefined' ? localStorage.getItem('vf_tok') || '' : ''
const apiFetch = async (path: string, opts: RequestInit = {}) => {
    const r = await fetch(API() + path, {
        ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOK(), ...(opts.headers || {}) }, body: opts.body,
    }); return r.json()
}

const fmtD = (dt: string) => {
    if (!dt) return '—'
    const d = new Date(dt), df = (Date.now() - d.getTime()) / 1000
    if (df < 60) return "A l'instant"
    if (df < 3600) return `${Math.floor(df / 60)}min`
    if (df < 86400) return `${Math.floor(df / 3600)}h`
    return d.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })
}
const fmtT = (s: number) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '0:00'
const fmtPh = (p: string) => p?.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4') || p || '—'
const ini = (n: string) => (n || '?').split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase()
const ACP = ['#2d1a80', '#1a356b', '#1a4d3a', '#4d1a5a', '#4d2a1a']

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

    if (err) return <div className="text-[10px] text-rose-400 mt-1">{err}</div>
    return (
        <div className="flex items-center gap-2 mt-2">
            <button onClick={toggle} disabled={loading}
                className="w-7 h-7 rounded-full bg-[#7b61ff]/20 border border-[#7b61ff]/30 flex items-center justify-center hover:bg-[#7b61ff]/30 transition-colors flex-shrink-0">
                {loading
                    ? <div className="w-3 h-3 border border-[#7b61ff]/50 border-t-[#7b61ff] rounded-full animate-spin" />
                    : playing
                        ? <svg width="10" height="10" fill="currentColor" className="text-[#7b61ff]" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        : <svg width="10" height="10" fill="currentColor" className="text-[#7b61ff] ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                }
            </button>
            <div className="flex-1">
                <div className="bg-[#1f1f2a] rounded-full h-1.5 cursor-pointer" onClick={seek}>
                    <div className="bg-[#7b61ff] h-full rounded-full transition-all" style={{ width: `${prog}%` }} />
                </div>
                {dur > 0 && (
                    <div className="text-[9px] text-[#55557a] mt-0.5">
                        {fmtT(Math.floor(ref.current?.currentTime || 0))} / {fmtT(Math.floor(dur))}
                    </div>
                )}
            </div>
        </div>
    )
}

interface Voicemail { id: string; from_number: string; to_number: string; recording_url: string; duration: number; transcription: string; status: 'NEW' | 'LISTENED'; created_at: string; contact?: { id: string; first_name: string; last_name: string; company?: string } }
interface VmConfig { enabled: boolean; destination: 'queue' | 'ivr' | 'direct'; queueId: string; ivrId: string; greeting_audio_id: string; max_duration: number; transcribe: boolean; notify_email: string }
interface Queue { id: string; name: string }
interface IVR { id: string; name: string }
interface AudioFile { id: string; name: string; file_url: string; type: string }

const DEFAULT_CFG: VmConfig = { enabled: true, destination: 'queue', queueId: '', ivrId: '', greeting_audio_id: '', max_duration: 120, transcribe: true, notify_email: '' }

export default function VoicemailsPage() {
    const router = useRouter()
    const { isAuth } = useAuthStore()
    const [vms, setVms] = useState<Voicemail[]>([])
    const [queues, setQueues] = useState<Queue[]>([])
    const [ivrs, setIvrs] = useState<IVR[]>([])
    const [audios, setAudios] = useState<AudioFile[]>([])
    const [config, setConfig] = useState<VmConfig>(DEFAULT_CFG)
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'messages' | 'config'>('messages')
    const [filter, setFilter] = useState<'all' | 'NEW' | 'LISTENED'>('all')
    const [search, setSearch] = useState('')
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
    }

    const load = useCallback(async () => {
        try {
            const [vr, qr, ir, ar] = await Promise.all([
                apiFetch('/api/v1/telephony/voicemails'),
                apiFetch('/api/v1/admin/queues'),
                apiFetch('/api/v1/admin/ivr'),
                apiFetch('/api/v1/admin/audio'),
            ])
            if (vr.success) setVms(vr.data || [])
            if (qr.success) setQueues(qr.data || [])
            if (ir.success) setIvrs(ir.data || [])
            if (ar.success) setAudios(ar.data || [])
            try {
                const saved = localStorage.getItem('vf_vm_config')
                if (saved) setConfig(JSON.parse(saved))
            } catch { }
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isAuth) { router.push('/login'); return }
        load()
    }, [isAuth, load])

    const markRead = async (id: string) => {
        await apiFetch(`/api/v1/telephony/voicemail/${id}/listen`, { method: 'PATCH' })
        setVms(p => p.map(v => v.id === id ? { ...v, status: 'LISTENED' } : v))
    }

    const saveConfig = async () => {
        setSaving(true)
        localStorage.setItem('vf_vm_config', JSON.stringify(config))
        if (config.destination === 'queue' && config.queueId) {
            try {
                await apiFetch(`/api/v1/admin/queues/${config.queueId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        voicemail_enabled: config.enabled,
                        voicemail_greeting_id: config.greeting_audio_id || null,
                        voicemail_max_duration: config.max_duration,
                        voicemail_transcribe: config.transcribe,
                    })
                })
            } catch { }
        }
        setSaving(false)
        showToast('Configuration sauvegardee')
    }

    const filtered = vms
        .filter(v => filter === 'all' || v.status === filter)
        .filter(v => {
            if (!search) return true
            const s = search.toLowerCase()
            const name = v.contact ? `${v.contact.first_name} ${v.contact.last_name}` : ''
            return name.toLowerCase().includes(s) || v.from_number.includes(s) || (v.transcription || '').toLowerCase().includes(s)
        })

    const newCount = vms.filter(v => v.status === 'NEW').length

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-[#55557a] text-sm animate-pulse">Chargement...</div>
        </div>
    )

    return (
        <div className="p-6 max-w-5xl mx-auto">

            {toast && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full text-sm font-bold shadow-xl ${toast.type === 'ok' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-[#eeeef8] flex items-center gap-2">
                        Messagerie vocale
                        {newCount > 0 && <span className="text-xs font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full">{newCount}</span>}
                    </h1>
                    <div className="text-xs text-[#55557a] mt-0.5">{vms.length} message{vms.length > 1 ? 's' : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-[#18181f] border border-[#2e2e44] rounded-lg p-1">
                        {([['messages', 'Messages'], ['config', 'Configuration']] as const).map(([val, label]) => (
                            <button key={val} onClick={() => setTab(val)}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${tab === val ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <button onClick={load}
                        className="flex items-center gap-2 text-[10px] font-bold text-[#9898b8] border border-[#2e2e44] bg-[#18181f] px-3 py-2 rounded-lg hover:text-[#eeeef8] transition-colors">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
                        Rafraichir
                    </button>
                </div>
            </div>

            {/* ── MESSAGES ──────────────────────────────────────── */}
            {tab === 'messages' && (
                <>
                    <div className="flex items-center gap-3 mb-5">
                        <div className="flex gap-1 bg-[#18181f] border border-[#2e2e44] rounded-lg p-1">
                            {([['all', 'Tous'], ['NEW', 'Non lus'], ['LISTENED', 'Lus']] as const).map(([val, label]) => (
                                <button key={val} onClick={() => setFilter(val)}
                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${filter === val ? 'bg-[#7b61ff] text-white' : 'text-[#55557a] hover:text-[#9898b8]'}`}>
                                    {label}
                                    {val === 'NEW' && newCount > 0 && <span className="ml-1.5 bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{newCount}</span>}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1 max-w-sm">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55557a]" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
                                className="w-full bg-[#18181f] border border-[#2e2e44] rounded-lg pl-9 pr-4 py-2 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                        </div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-12 text-center">
                            <svg className="mx-auto mb-3 text-[#2e2e44]" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                            </svg>
                            <p className="text-sm font-medium text-[#55557a]">
                                {search ? 'Aucun résultat' : filter === 'NEW' ? 'Aucun message non lu' : 'Aucun message vocal'}
                            </p>
                            {!search && filter === 'all' && (
                                <button onClick={() => setTab('config')} className="text-xs text-[#7b61ff] hover:underline mt-2">
                                    Configurer la messagerie
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map((vm, i) => {
                                const name = vm.contact ? `${vm.contact.first_name} ${vm.contact.last_name}` : fmtPh(vm.from_number)
                                const isNew = vm.status === 'NEW'
                                const initials = vm.contact ? ini(`${vm.contact.first_name} ${vm.contact.last_name}`) : (vm.from_number[0] || '?').toUpperCase()
                                return (
                                    <div key={vm.id} className={`bg-[#18181f] border rounded-xl overflow-hidden transition-all ${isNew ? 'border-violet-400/30' : 'border-[#2e2e44]'}`}>
                                        <div className="flex items-start gap-4 px-5 py-4">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                                                style={{ background: `linear-gradient(135deg,${ACP[i % ACP.length]},${ACP[i % ACP.length]}dd)` }}>
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`font-semibold text-sm ${isNew ? 'text-[#eeeef8]' : 'text-[#9898b8]'}`}>{name}</span>
                                                    {isNew && <span className="text-[9px] font-bold bg-violet-400/15 text-violet-400 border border-violet-400/30 px-1.5 py-0.5 rounded-full">Nouveau</span>}
                                                    {vm.contact?.company && <span className="text-[10px] text-[#55557a]">{vm.contact.company}</span>}
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-[10px] font-mono text-[#55557a]">{fmtPh(vm.from_number)}</span>
                                                    <span className="text-[10px] text-[#3a3a55]">{fmtD(vm.created_at)}</span>
                                                    {vm.duration > 0 && <span className="text-[10px] text-[#3a3a55]">{fmtT(vm.duration)}</span>}
                                                </div>
                                                {vm.transcription && (
                                                    <div className="mt-2 border-l-2 border-[#7b61ff]/40 pl-3">
                                                        <p className="text-xs text-[#9898b8] italic leading-relaxed line-clamp-3">{vm.transcription}</p>
                                                    </div>
                                                )}
                                                {vm.recording_url && <AudioPlayer url={vm.recording_url} />}
                                            </div>
                                            <div className="flex flex-col gap-1.5 flex-shrink-0">
                                                <button onClick={() => window.open(`${window.location.origin}//dialer`, '_blank')}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5 rounded-lg hover:bg-emerald-400/20 transition-colors">
                                                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.19a16 16 0 006.36 6.36l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                                                    Rappeler
                                                </button>
                                                {isNew && (
                                                    <button onClick={() => markRead(vm.id)}
                                                        className="flex items-center gap-1.5 text-[10px] font-bold text-[#9898b8] border border-[#2e2e44] bg-[#1f1f2a] px-2.5 py-1.5 rounded-lg hover:text-[#eeeef8] transition-colors">
                                                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                                                        Marquer lu
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ── CONFIGURATION ─────────────────────────────────── */}
            {tab === 'config' && (
                <div className="space-y-5 max-w-2xl">

                    {/* Activation */}
                    <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-semibold text-[#eeeef8]">Messagerie vocale active</div>
                                <div className="text-xs text-[#55557a] mt-0.5">Les appelants peuvent laisser un message quand aucun agent n&apos;est disponible</div>
                            </div>
                            <div className={`w-12 h-6 rounded-full cursor-pointer relative transition-all ${config.enabled ? 'bg-[#7b61ff]' : 'bg-[#2e2e44]'}`}
                                onClick={() => setConfig(p => ({ ...p, enabled: !p.enabled }))}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.enabled ? 'left-7' : 'left-1'}`} />
                            </div>
                        </div>
                    </div>

                    {config.enabled && <>

                        {/* Destination */}
                        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 space-y-4">
                            <div className="text-xs font-bold uppercase tracking-widest text-[#55557a]">Destination</div>
                            <div className="text-xs text-[#9898b8]">Apres le message, comment router la notification ?</div>
                            <div className="space-y-2">
                                {([
                                    { val: 'queue', label: 'File d\'attente', desc: 'Notifier les agents d\'une file specifique' },
                                    { val: 'ivr', label: 'Menu IVR', desc: 'Renvoyer vers un menu IVR apres le message' },
                                    { val: 'direct', label: 'Direct', desc: 'Notification email uniquement' },
                                ] as const).map(opt => (
                                    <label key={opt.val}
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${config.destination === opt.val ? 'border-[#7b61ff]/40 bg-[#7b61ff]/10' : 'border-[#2e2e44] bg-[#1f1f2a] hover:border-[#3a3a55]'}`}>
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${config.destination === opt.val ? 'border-[#7b61ff] bg-[#7b61ff]' : 'border-[#3a3a55]'}`}>
                                            {config.destination === opt.val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                        <input type="radio" className="hidden" checked={config.destination === opt.val} onChange={() => setConfig(p => ({ ...p, destination: opt.val }))} />
                                        <div>
                                            <div className="text-sm font-semibold text-[#eeeef8]">{opt.label}</div>
                                            <div className="text-[10px] text-[#55557a]">{opt.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {config.destination === 'queue' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">File d&apos;attente</label>
                                    <select value={config.queueId} onChange={e => setConfig(p => ({ ...p, queueId: e.target.value }))}
                                        className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                        <option value="">— Choisir une file —</option>
                                        {queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                    </select>
                                </div>
                            )}
                            {config.destination === 'ivr' && (
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Menu IVR</label>
                                    <select value={config.ivrId} onChange={e => setConfig(p => ({ ...p, ivrId: e.target.value }))}
                                        className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                        <option value="">— Choisir un IVR —</option>
                                        {ivrs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Message d'accueil */}
                        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 space-y-4">
                            <div className="text-xs font-bold uppercase tracking-widest text-[#55557a]">Message d&apos;accueil</div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Fichier audio (depuis Medias)</label>
                                <select value={config.greeting_audio_id} onChange={e => setConfig(p => ({ ...p, greeting_audio_id: e.target.value }))}
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] outline-none focus:border-[#7b61ff]">
                                    <option value="">— Message par defaut (TTS) —</option>
                                    {audios.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                {audios.length === 0 && (
                                    <div className="text-[10px] text-[#55557a] mt-1">
                                        Aucun fichier —{' '}
                                        <a href="/admin/media" className="text-[#7b61ff] hover:underline">ajouter dans Medias</a>
                                    </div>
                                )}
                            </div>
                            {config.greeting_audio_id ? (
                                <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-4 py-3">
                                    <div className="text-xs font-medium text-[#eeeef8]">
                                        {audios.find(a => a.id === config.greeting_audio_id)?.name}
                                    </div>
                                    {(() => { const af = audios.find(a => a.id === config.greeting_audio_id); return af?.file_url ? <AudioPlayer url={af.file_url} /> : null })()}
                                </div>
                            ) : (
                                <div className="bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-4 py-3">
                                    <div className="text-[10px] text-[#55557a] mb-1">Message TTS par defaut :</div>
                                    <div className="text-xs text-[#9898b8] italic">
                                        "Nous sommes absents. Veuillez laisser votre message apres le bip."
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Options */}
                        <div className="bg-[#18181f] border border-[#2e2e44] rounded-xl p-5 space-y-5">
                            <div className="text-xs font-bold uppercase tracking-widest text-[#55557a]">Options</div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-2">
                                    Duree maximale : {config.max_duration}s
                                </label>
                                <input type="range" min="30" max="300" step="30"
                                    value={config.max_duration}
                                    onChange={e => setConfig(p => ({ ...p, max_duration: parseInt(e.target.value) }))}
                                    className="w-full accent-[#7b61ff]" />
                                <div className="flex justify-between text-[9px] text-[#55557a] mt-1">
                                    <span>30s</span><span>1min</span><span>2min</span><span>3min</span><span>4min</span><span>5min</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-[#eeeef8]">Transcription automatique</div>
                                    <div className="text-[10px] text-[#55557a]">Convertir le message en texte via IA</div>
                                </div>
                                <div className={`w-10 h-5 rounded-full cursor-pointer relative transition-all ${config.transcribe ? 'bg-[#7b61ff]' : 'bg-[#2e2e44]'}`}
                                    onClick={() => setConfig(p => ({ ...p, transcribe: !p.transcribe }))}>
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${config.transcribe ? 'left-5' : 'left-0.5'}`} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55557a] mb-1">Email de notification</label>
                                <input type="email" value={config.notify_email}
                                    onChange={e => setConfig(p => ({ ...p, notify_email: e.target.value }))}
                                    placeholder="admin@entreprise.com"
                                    className="w-full bg-[#1f1f2a] border border-[#2e2e44] rounded-lg px-3 py-2.5 text-sm text-[#eeeef8] placeholder-[#55557a] outline-none focus:border-[#7b61ff]" />
                            </div>
                        </div>

                    </>}

                    <button onClick={saveConfig} disabled={saving}
                        className="w-full bg-[#7b61ff] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#6145ff] disabled:opacity-50 transition-colors">
                        {saving ? 'Sauvegarde...' : 'Sauvegarder la configuration'}
                    </button>
                </div>
            )}
        </div>
    )
}