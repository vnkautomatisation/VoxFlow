'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { DIALER_CONFIG } from '@/lib/dialerConfig'
import { vfGlobals } from '@/lib/windowGlobals'
import { playAudioFile } from '@/lib/playAudio'

// ── Types ───────────────────────────────────────────────────────
export type ViewId = 'login' | 'incoming' | 'calling' | 'main' | 'wrapup'
export type TabId = 'dialer' | 'queue' | 'agents' | 'history' | 'voicemails' | 'search'
export type PanelId = 'xfer' | 'notes' | 'kpad' | null
export type XferType = 'blind' | 'attended' | 'conf'
export type HistFilter = 'all' | 'INBOUND' | 'OUTBOUND' | 'MISSED'

export interface Contact {
    id?: string; first_name: string; last_name: string
    company?: string; phone?: string; email?: string
    pipeline_stage?: string; total_calls?: number
    last_call?: string; tags?: string[]
}

export interface CallRecord {
    id: string; direction: 'INBOUND' | 'OUTBOUND'; status: string
    from_number: string; to_number: string; duration: number
    started_at: string; ended_at?: string; notes?: string
    contact?: Contact; twilio_sid?: string; recording_url?: string
}

export interface AgentInfo {
    id: string; name?: string; first_name?: string; last_name?: string
    extension?: string; ext?: string; status: string
    current_call?: boolean; current_call_number?: string; call_duration?: number
}

export interface QueueEntry {
    id: string; from_number: string; caller_name?: string
    status?: string; wait_seconds?: number; duration?: number
    agent_name?: string; agent_id?: string
}

export interface VoicemailRecord {
    id: string; from_number: string; recording_url?: string
    transcription?: string; duration?: number; status: string
    created_at: string; contact?: Contact
}

// ── Couleurs avatars ────────────────────────────────────────────
export const ACP: [string, string][] = [
    ['#2d1a80', '#3d1fa3'], ['#1a356b', '#1a4d8f'], ['#1a4d3a', '#1a6b54'],
    ['#4d1a5a', '#6b1a80'], ['#4d2a1a', '#6b3a1a'], ['#1a3a4d', '#1a5270'], ['#3a4d1a', '#506b1a']
]

// ── Utils ───────────────────────────────────────────────────────
export const fmtT = (s: number) =>
    String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')

export const fmtD = (dt?: string) => {
    if (!dt) return ''
    const d = new Date(dt), df = (Date.now() - d.getTime()) / 1000
    if (df < 60) return "À l'instant"
    if (df < 3600) return Math.floor(df / 60) + 'min'
    if (df < 86400) return Math.floor(df / 3600) + 'h'
    return d.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short' })
}

export const ini = (s: string) =>
    s.split(' ').map(w => w[0] || '').join('').substring(0, 2).toUpperCase()

export const avatarGrad = (name: string) => {
    const i = (name.charCodeAt(0) || 0) % ACP.length
    return `linear-gradient(135deg,${ACP[i][0]},${ACP[i][1]})`
}

// ── Système audio ───────────────────────────────────────────────
const DTMF_FREQS: Record<string, [number, number]> = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477], '+': [941, 1336]
}

let _audioCtx: AudioContext | null = null

function getAC(): AudioContext {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (_audioCtx.state === 'suspended') _audioCtx.resume()
    return _audioCtx
}

function pip(freqs: number[], dur: number, vol: number) {
    try {
        const a = getAC(), now = a.currentTime
        const g = a.createGain()
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(vol, now + 0.01)
        g.gain.setValueAtTime(vol, now + dur - 0.02)
        g.gain.linearRampToValueAtTime(0, now + dur)
        g.connect(a.destination)
        freqs.forEach(f => {
            const o = a.createOscillator()
            o.type = 'sine'; o.frequency.value = f
            o.connect(g); o.start(now); o.stop(now + dur)
        })
    } catch { }
}

export function playDTMF(k: string) { const f = DTMF_FREQS[k]; if (f) pip(f, 0.09, 0.12) }
export function playConnect() { pip([880, 1100], 0.15, 0.12) }
export function playHangup() {
    try {
        const a = getAC(), now = a.currentTime
        const g = a.createGain()
        g.gain.setValueAtTime(0.12, now)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
        g.connect(a.destination)
        const o = a.createOscillator(); o.type = 'sine'
        o.frequency.setValueAtTime(480, now)
        o.frequency.exponentialRampToValueAtTime(280, now + 0.3)
        o.connect(g); o.start(now); o.stop(now + 0.3)
    } catch { }
}

// Exposer globalement pour compatibilité
if (typeof window !== 'undefined') {
    (window as any).vfDTMF = playDTMF
        ; (window as any).vfConnect = playConnect
        ; (window as any).vfHangup = playHangup
}

// ── Waveform ────────────────────────────────────────────────────
let _stopLocalWF: (() => void) | null = null
let _stopRemoteWF: (() => void) | null = null

function drawWave(canvas: HTMLCanvasElement, analyser: AnalyserNode, color: string) {
    const W = canvas.width = canvas.offsetWidth * window.devicePixelRatio
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio
    const ctx = canvas.getContext('2d')!
    const buf = new Uint8Array(analyser.frequencyBinCount)
    let rafId: number

    function frame() {
        rafId = requestAnimationFrame(frame)
        analyser.getByteTimeDomainData(buf)
        ctx.clearRect(0, 0, W, H)
        ctx.fillStyle = 'rgba(27,27,40,0.6)'
        ctx.fillRect(0, 0, W, H)
        ctx.strokeStyle = color; ctx.lineWidth = 1.5 * devicePixelRatio
        ctx.lineJoin = 'round'; ctx.shadowColor = color; ctx.shadowBlur = 6
        ctx.beginPath()
        const sw = W / buf.length; let x = 0
        for (let i = 0; i < buf.length; i++) {
            const y = (buf[i] / 128.0 * H) / 2
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
            x += sw
        }
        ctx.lineTo(W, H / 2); ctx.stroke(); ctx.shadowBlur = 0
    }
    frame()
    return () => cancelAnimationFrame(rafId)
}

export function startWaveforms(call?: any) {
    const wrap = document.getElementById('wf-wrap')
    const cLocal = document.getElementById('wf-local') as HTMLCanvasElement
    const cRemote = document.getElementById('wf-remote') as HTMLCanvasElement
    if (!wrap || !cLocal || !cRemote) return
    wrap.classList.add('on')
    try {
        const ac = getAC()

        // ── Micro local ───────────────────────────────────────────
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
            const src = ac.createMediaStreamSource(stream)
            const an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.8
            src.connect(an)
            _stopLocalWF = drawWave(cLocal, an, '#00d4aa')
            vfGlobals.setWfLocalStream(stream)
        }).catch(() => { })

        // ── Audio remote — plusieurs chemins selon version SDK ────
        const tryRemote = (pc: RTCPeerConnection) => {
            const receivers = pc.getReceivers?.() || []
            const audio = receivers.find((r: any) => r.track?.kind === 'audio')
            if (!audio) return false
            const rs = new MediaStream([audio.track])
            const srcR = ac.createMediaStreamSource(rs)
            const anR = ac.createAnalyser(); anR.fftSize = 512; anR.smoothingTimeConstant = 0.8
            srcR.connect(anR)
            _stopRemoteWF = drawWave(cRemote, anR, '#7b61ff')
            return true
        }

        const getPc = (call: any): RTCPeerConnection | null => {
            // SDK 2.x
            if (call?._mediaHandler?.version?.pc) return call._mediaHandler.version.pc
            if (call?._mediaHandler?._peerConnection) return call._mediaHandler._peerConnection
            // SDK 1.x / autres
            if (call?.conn?._pc) return call.conn._pc
            if (call?._pc) return call._pc
            // Chercher récursivement dans les propriétés
            for (const key of Object.keys(call || {})) {
                const v = call[key]
                if (v && typeof v === 'object' && typeof v.getReceivers === 'function') return v
            }
            return null
        }

        const pc = getPc(call)
        if (pc) {
            if (!tryRemote(pc)) {
                // Réessayer après 1s (connexion pas encore établie)
                setTimeout(() => { const pc2 = getPc(call); if (pc2) tryRemote(pc2) }, 1000)
            }
        } else {
            // Dernier recours : attendre 1.5s et retenter
            setTimeout(() => {
                const c2 = vfGlobals.getCall()
                const pc2 = getPc(c2)
                if (pc2) tryRemote(pc2)
            }, 1500)
        }
    } catch { }
}

export function stopWaveforms() {
    document.getElementById('wf-wrap')?.classList.remove('on')
    _stopLocalWF?.(); _stopLocalWF = null
    _stopRemoteWF?.(); _stopRemoteWF = null
    const stream = vfGlobals.getWfLocalStream()
    if (stream) {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
        vfGlobals.setWfLocalStream(undefined)
    }
}

// ── Hook principal ──────────────────────────────────────────────
export function useDialer() {
    const { accessToken, isAuth, user } = useAuthStore()

    // ── Session ────────────────────────────────────────────────
    const S = useRef<any>({
        url: DIALER_CONFIG.API_URL, tok: null, role: 'AGENT',
        ext: null, status: 'ONLINE', name: '',
        callId: null, twSid: null, contact: null, dir: 'OUTBOUND',
        muted: false, hold: false, rec: false,
        tsec: 0, tint: null, panel: null, xt: 'blind',
        hf: 'all', poll: null, _inCo: null, _inNum: null,
    })

    // ── UI State ───────────────────────────────────────────────
    const [view, setView] = useState<ViewId>('login')
    const [tab, setTab] = useState<TabId>('dialer')
    const [panel, setPanel] = useState<PanelId>(null)
    const [agStatus, setAgStatus] = useState<'ONLINE' | 'BREAK' | 'OFFLINE'>('ONLINE')
    const [dialNum, setDialNum] = useState('')
    const [callTimer, setCallTimer] = useState(0)
    const [muted, setMuted] = useState(false)
    const [onHold, setOnHold] = useState(false)
    const [recording, setRecording] = useState(false)
    const [xferType, setXferType] = useState<XferType>('blind')
    const [xferNum, setXferNum] = useState('')
    const [notesVal, setNotesVal] = useState('')
    const [outcome, setOutcome] = useState('Résolu')
    const [stars, setStars] = useState(0)
    const [toast, setToast] = useState('')
    const [histFilter, setHistFilter] = useState<HistFilter>('all')

    // ── Data State ─────────────────────────────────────────────
    const [calls, setCalls] = useState<CallRecord[]>([])
    const [agents, setAgents] = useState<AgentInfo[]>([])
    const [queue, setQueue] = useState<QueueEntry[]>([])
    const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([])
    const [contact, setContact] = useState<Contact | null>(null)
    const [incoming, setIncoming] = useState<{ from: string; co?: Contact } | null>(null)
    const [wrapupDur, setWrapupDur] = useState(0)
    // Agents disponibles pour transfert = agents avec extension, pas en appel
    const qAgentsXfer = agents.filter(a => (a.extension || a.ext) && !a.current_call)
    const [searchRes, setSearchRes] = useState<Contact[]>([])
    const [loginErr, setLoginErr] = useState('')

    // ── Caller ID picker (multi-pays) ──────────────────────────
    // Liste des numéros actifs de l'org, groupés par pays, pour que
    // l'agent puisse choisir lequel utiliser comme "from" avant de
    // composer. Persisté dans localStorage.vf_from_num.
    const [myNumbers, setMyNumbers] = useState<Array<{
        number: string; flag: string; country_code: string; country_name: string; friendly_name: string;
    }>>([])
    const [fromNumber, setFromNumberState] = useState<string>('')
    const setFromNumber = useCallback((n: string) => {
        setFromNumberState(n)
        try { if (n) localStorage.setItem('vf_from_num', n); else localStorage.removeItem('vf_from_num') } catch {}
    }, [])

    // ── Refs ───────────────────────────────────────────────────
    const timerRef = useRef<any>(null)
    const pollRef = useRef<any>(null)
    const lpdoneRef = useRef(false)
    const lptRef = useRef<any>(null)

    // ── Features du forfait (lu depuis localStorage) ───────────
    // Source : vf_features (JSON) sync par le portail au login.
    // Fallback permissif si vide pour ne pas bloquer en dev.
    // Note: trialInfo est consommé par TrialBanner via useAuthStore,
    // pas ici — on n'expose rien sur trial depuis useDialer.
    const featuresRef = useRef<Record<string, boolean>>({})
    const [featuresVersion, setFeaturesVersion] = useState(0)
    const [planName, setPlanName] = useState<string>('')

    useEffect(() => {
        const loadFeatures = () => {
            try {
                const raw = localStorage.getItem('vf_features')
                featuresRef.current = raw ? JSON.parse(raw) : {}
            } catch { featuresRef.current = {} }
            setPlanName(localStorage.getItem('vf_plan_name') || localStorage.getItem('vf_plan_id') || '')
            setFeaturesVersion(v => v + 1)
        }
        loadFeatures()
        // Écouter les events storage (portail change les features)
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'vf_features' || e.key === 'vf_plan_id' || e.key === 'vf_trial') loadFeatures()
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    // Helper : le forfait a-t-il cette feature activée ?
    // Fallback permissif (true) si pas de features chargées
    const has = useCallback((f: string): boolean => {
        const feats = featuresRef.current
        if (!feats || Object.keys(feats).length === 0) return true
        return !!feats[f]
    }, [featuresVersion])

    // ── isAdmin helper ─────────────────────────────────────────
    const isAdmin = useCallback(() =>
        S.current.role === 'ADMIN' ||
        S.current.role === 'OWNER' ||
        S.current.role === 'OWNER_STAFF' ||
        S.current.role === 'SUPERVISOR', [])

    // ── Toast ──────────────────────────────────────────────────
    const showToast = useCallback((msg: string, dur = 2500) => {
        setToast(msg)
        setTimeout(() => setToast(''), dur)
    }, [])

    // ── API helper ─────────────────────────────────────────────
    const api = useCallback(async (path: string, opts: any = {}) => {
        const r = await fetch(S.current.url + path, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                ...(S.current.tok ? { Authorization: 'Bearer ' + S.current.tok } : {}),
                ...(opts.headers || {}),
            },
            body: opts.body ? JSON.stringify(opts.body) : undefined,
        })
        return r.json()
    }, [])

    // ── Auth — source de vérité = vf_tok dans localStorage ──────────
    // Ne pas se fier à useAuthStore (Zustand) en Electron — localStorage isolé
    useEffect(() => {
        const tok  = localStorage.getItem('vf_tok')
        const role = localStorage.getItem('vf_role') || 'AGENT'
        const url  = localStorage.getItem('vf_url')  || DIALER_CONFIG.API_URL
        const ext  = localStorage.getItem('vf_ext')  || ''
        const name = localStorage.getItem('vf_name') || ''

        if (tok) {
            S.current.tok  = tok
            S.current.role = role
            S.current.url  = url
            S.current.ext  = ext || null
            S.current.name = name
            setView('main')
            loadData()
            startPoll()
            // Re-check role + extension apres 2s (le portail parent peut les setter en retard)
            setTimeout(() => {
                const freshRole = localStorage.getItem('vf_role') || role
                const freshExt = localStorage.getItem('vf_ext') || ''
                S.current.role = freshRole
                S.current.ext = freshExt || null
                loadData()
            }, 2000)
        } else if (isAuth && accessToken && user) {
            // Portail connecté (même contexte) → sync complet depuis Zustand
            S.current.tok  = accessToken
            S.current.url  = url
            S.current.role = user.role
            S.current.ext  = user.extension || null
            S.current.name = user.name || ''
            localStorage.setItem('vf_tok',  accessToken)
            localStorage.setItem('vf_url',  url)
            localStorage.setItem('vf_role', user.role)
            if (user.extension) localStorage.setItem('vf_ext', user.extension)
            if (user.name)      localStorage.setItem('vf_name', user.name)
            setView('main')
            loadData()
            startPoll()
        } else {
            // En mode embedded (iframe), le parent peut ne pas avoir encore set le token
            // Re-checker toutes les secondes pendant 10s
            const isEmbedded = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('embedded') === 'true' || window.parent !== window)
            if (isEmbedded) {
                let retries = 0
                const check = setInterval(() => {
                    retries++
                    const t = localStorage.getItem('vf_tok')
                    if (t) {
                        clearInterval(check)
                        S.current.tok  = t
                        S.current.role = localStorage.getItem('vf_role') || 'AGENT'
                        S.current.url  = localStorage.getItem('vf_url') || DIALER_CONFIG.API_URL
                        S.current.ext  = localStorage.getItem('vf_ext') || null
                        S.current.name = localStorage.getItem('vf_name') || ''
                        setView('main')
                        loadData()
                        startPoll()
                    }
                    if (retries > 10) clearInterval(check)
                }, 1000)
            } else {
                S.current.tok = null
                stopPoll()
                setView('login')
            }
        }
    }, [isAuth, accessToken, user])


    // ── Données ────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        try {
            const [cr, vr] = await Promise.all([
                api('/api/v1/telephony/calls?limit=200'),
                api('/api/v1/telephony/voicemails'),
            ])
            if (cr.success) setCalls(cr.data || [])
            if (vr.success) setVoicemails(vr.data || [])
        } catch { }
        try {
            const [qr, ar] = await Promise.all([
                api('/api/v1/queues'),
                api('/api/v1/supervision/snapshot').catch(() => ({ success: false })),
            ])
            if (qr.success) setQueue(qr.data || [])
            // Agents : snapshot = source de verite pour les statuts temps reel
            const snapAgents = ar.success && ar.data ? (ar.data.agentStatuses || ar.data.agents || []) : []

            if (Array.isArray(snapAgents) && snapAgents.length > 0) {
                setAgents(snapAgents.map((a: any) => ({
                    id: a.agentId || a.id,
                    name: a.name || 'Agent',
                    first_name: a.name?.split(' ')[0] || '',
                    last_name: a.name?.split(' ').slice(1).join(' ') || '',
                    extension: a.extension || a.ext || '',
                    status: a.status || 'OFFLINE',
                    current_call: !!(a.callId),
                    current_call_number: a.callFrom || a.callTo || null,
                    call_duration: a.callDuration || 0,
                })))
            }
        } catch { }
        // Charger les numéros de l'org pour le Caller ID picker
        try {
            const nr = await api('/api/v1/telephony/my-numbers')
            if (nr?.success && Array.isArray(nr.data?.numbers)) {
                const nums = nr.data.numbers
                setMyNumbers(nums)
                // Sélectionner le numéro stocké ou le premier
                if (!fromNumber) {
                    const stored = localStorage.getItem('vf_from_num') || ''
                    const preferred = stored && nums.find((n: any) => n.number === stored)
                    setFromNumberState(preferred ? stored : (nums[0]?.number || ''))
                }
            }
        } catch { }
    }, [api, isAdmin, fromNumber])

    const startPoll = useCallback(() => {
        stopPoll()
        pollRef.current = setInterval(loadData, 10000)
    }, [loadData])

    const stopPoll = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current)
    }, [])

    // ── Login manuel ───────────────────────────────────────────
    const doLogin = useCallback(async (url: string, email: string, pass: string) => {
        S.current.url = url.replace(/\/$/, '')
        localStorage.setItem('vf_url', S.current.url)
        setLoginErr('')
        const r = await api('/api/v1/auth/login', { method: 'POST', body: { email, password: pass } })
        if (r.success && r.data?.accessToken) {
            const tok = r.data.accessToken
            const role = r.data.user?.role || 'AGENT'
            S.current.tok = tok
            S.current.role = role
            S.current.ext = r.data.user?.extension || null
            if (r.data.user?.extension) localStorage.setItem('vf_ext', r.data.user.extension)
            else localStorage.removeItem('vf_ext')
            // Écrire dans localStorage — source de vérité pour Electron
            localStorage.setItem('vf_tok', tok)
            localStorage.setItem('vf_role', role)
            // Écrire les cookies session pour le middleware Next.js
            try {
                await fetch(DIALER_CONFIG.PORTAL_URL + '/api/auth/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: tok, role }),
                })
            } catch { }
            setView('main')
            // Demander permission notification pour appels entrants
            try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission() } catch {}
            await loadData()
            startPoll()
        } else {
            setLoginErr(r.message || 'Identifiants incorrects')
        }
    }, [api, loadData, startPoll])

    const doLogout = useCallback(() => {
        localStorage.removeItem('vf_tok')
        localStorage.removeItem('vf_role')
        S.current.tok = null
        stopPoll()
        setView('login')
        setLoginErr('')
    }, [stopPoll])

    // ── Statut ─────────────────────────────────────────────────
    const doStatus = useCallback((s: 'ONLINE' | 'BREAK' | 'OFFLINE') => {
        setAgStatus(s)
        S.current.status = s
        api('/api/v1/telephony/status', { method: 'PATCH', body: { status: s } }).catch(() => { })
    }, [api])

    // ── Clavier ────────────────────────────────────────────────
    const startLong = useCallback((e?: TouchEvent) => {
        if (e) e.preventDefault()
        lpdoneRef.current = false
        lptRef.current = setTimeout(() => {
            lpdoneRef.current = true
            setDialNum(p => p.endsWith('0') ? p.slice(0, -1) + '+' : p + '+')
        }, 500)
    }, [])

    const endLong = useCallback(() => {
        if (lptRef.current) { clearTimeout(lptRef.current); lptRef.current = null }
    }, [])

    // ── Appel sortant ──────────────────────────────────────────
    const callNum = useCallback(async (n?: string) => {
        const to = n || dialNum
        if (!to) return

        // Vérif forfait côté client : STARTER/BASIC = INBOUND_ONLY
        // Le backend enforce aussi (défense en profondeur) mais on
        // donne un feedback immédiat sans round-trip.
        try {
            const currentPlan = String(localStorage.getItem('vf_plan') || '').toUpperCase()
            if (currentPlan === 'INBOUND_ONLY') {
                showToast('Appels sortants non inclus dans votre forfait — passez au Confort')
                return
            }
        } catch { }

        // Auto-match: si l'agent compose +33... et qu'on a un numéro FR,
        // utiliser automatiquement le numéro FR comme caller ID. Sinon,
        // utiliser le fromNumber sélectionné manuellement, ou défaut.
        let callerId = fromNumber
        try {
            if (myNumbers.length > 0) {
                const digits = to.replace(/\D/g, '')
                // Essayer de matcher le préfixe international (33, 32, 1, etc.)
                // avec un numéro de l'org du même pays
                const prefixes: Record<string, string> = {
                    '1': 'CA_US', '33': 'FR', '32': 'BE', '41': 'CH', '44': 'GB',
                    '49': 'DE', '34': 'ES', '39': 'IT', '31': 'NL', '351': 'PT',
                }
                let matched: any = null
                for (const [pfx, code] of Object.entries(prefixes)) {
                    if (digits.startsWith(pfx)) {
                        matched = myNumbers.find((m: any) => m.country_code === code)
                        if (matched) break
                    }
                }
                if (matched) callerId = matched.number
            }
        } catch { }

        S.current.contact = null; setContact(null)
        try {
            const r = await api('/api/v1/telephony/call/outbound', {
                method: 'POST',
                body: { to, fromNumber: callerId || undefined },
            })
            if (r.success) {
                S.current.callId = r.data.call?.id || null
                S.current.twSid = r.data.call?.twilio_sid || null
                S.current.contact = r.data.contact || null
                setContact(r.data.contact || null)
                S.current.dir = 'OUTBOUND'
                startCallUI(to)
            } else {
                // Backend retourne DIALER_INBOUND_ONLY pour les STARTER/BASIC
                if (r.code === 'DIALER_INBOUND_ONLY') {
                    showToast(r.error || 'Forfait entrant uniquement')
                    try { localStorage.setItem('vf_plan', 'INBOUND_ONLY') } catch { }
                    return
                }
                showToast(r.message || r.error || 'Erreur appel')
            }
        } catch { showToast('Erreur réseau') }

        // Twilio WebRTC si disponible
        const dev = vfGlobals.getDevice()
        if (dev && dev.state === 'registered') {
            try {
                const call = await dev.connect({ params: { To: to } })
                vfGlobals.setCall(call)
                call.on('accept', () => startCallUI(to))
                call.on('disconnect', endCallCleanup)
                call.on('error', (e: any) => showToast(e.message))
            } catch (e: any) { showToast('WebRTC: ' + e.message) }
        }

        if ((window as any).electronAPI?.callStarted) (window as any).electronAPI.callStarted()
    }, [dialNum, api, showToast, fromNumber, myNumbers])

    const startCallUI = useCallback((num: string) => {
        playConnect()
        S.current.tsec = 0
        setCallTimer(0)
        setMuted(false); setOnHold(false); setRecording(false); setPanel(null)
        setNotesVal(''); setView('calling')
        clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
            S.current.tsec++
            setCallTimer(S.current.tsec)
        }, 1000)
        setTimeout(() => startWaveforms(vfGlobals.getCall()), 500)
    }, [])

    // ── Appel entrant ──────────────────────────────────────────
    const handleIncoming = useCallback(async (call: any) => {
        const from = call.parameters?.From || 'Entrant'
        S.current._inNum = from
        vfGlobals.setCall(call)
        let co: Contact | undefined
        try {
            const r = await api('/api/v1/telephony/lookup/' + encodeURIComponent(from))
            if (r.success && r.data?.contact) co = r.data.contact
        } catch { }
        S.current._inCo = co || null
        setIncoming({ from, co })
        setView('incoming')

        // ── Notification browser (meme si onglet en arriere-plan) ──
        const callerName = co ? `${co.first_name} ${co.last_name}`.trim() : from
        try {
            if (Notification.permission === 'granted') {
                const n = new Notification('Appel entrant', {
                    body: callerName,
                    icon: '/icons/icon-192.png',
                    tag: 'vf-incoming',
                    requireInteraction: true,
                })
                n.onclick = () => { window.focus(); n.close() }
                call.on('cancel', () => n.close())
                call.on('disconnect', () => n.close())
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission()
            }
        } catch {}

        // ── Son de sonnerie ──
        try {
            const ring = new Audio('/sounds/ringtone.mp3')
            ring.loop = true
            ring.volume = 0.7
            ring.play().catch(() => {})
            call.on('cancel', () => { ring.pause(); ring.currentTime = 0 })
            call.on('disconnect', () => { ring.pause(); ring.currentTime = 0 })
            // Arreter a la reponse aussi
            const origAccept = call.accept?.bind(call)
            if (origAccept) {
                call.accept = (...args: any[]) => { ring.pause(); ring.currentTime = 0; return origAccept(...args) }
            }
        } catch {}

        // ── Titre onglet clignotant ──
        const origTitle = document.title
        let blink: ReturnType<typeof setInterval> | null = null
        let on = false
        blink = setInterval(() => {
            document.title = on ? `APPEL — ${callerName}` : origTitle
            on = !on
        }, 800)
        call.on('cancel', () => { if (blink) clearInterval(blink); document.title = origTitle })
        call.on('disconnect', () => { if (blink) clearInterval(blink); document.title = origTitle })

        call.on('cancel', () => { vfGlobals.clearCall(); setView('main') })
    }, [api])

    const doAnswer = useCallback(() => {
        const call = vfGlobals.getCall()
        if (call) {
            call.accept()
            call.on('disconnect', endCallCleanup)
        }
        // Arreter le titre clignotant
        document.title = 'VoxFlow Dialer'
        S.current.contact = incoming?.co || null
        setContact(incoming?.co || null)
        S.current.dir = 'INBOUND'
        startCallUI(incoming?.from || 'Entrant')
        setIncoming(null)
        if ((window as any).electronAPI?.callStarted) (window as any).electronAPI.callStarted()
    }, [incoming, startCallUI])

    const doRefuse = useCallback(() => {
        const call = vfGlobals.getCall()
        if (call) { call.reject(); vfGlobals.clearCall() }
        setIncoming(null); setView('main')
    }, [])

    // ── Raccrocher ─────────────────────────────────────────────
    const hangup = useCallback(async () => {
        playHangup()
        stopWaveforms()
        clearInterval(timerRef.current)
        const dur = S.current.tsec
        const call = vfGlobals.getCall()
        if (call) { try { call.disconnect() } catch { }; vfGlobals.clearCall() }
        if (S.current.callId) {
            await api('/api/v1/telephony/call/' + S.current.callId + '/end', {
                method: 'PATCH', body: { duration: dur, notes: notesVal, twilioSid: S.current.twSid || '' }
            }).catch(() => { })
        }
        if ((window as any).electronAPI?.callEnded) (window as any).electronAPI.callEnded()
        setWrapupDur(dur)
        setStars(0)
        setView('wrapup')
        setTimeout(async () => {
            S.current.callId = null; S.current.contact = null; S.current.twSid = null
            setDialNum(''); setContact(null); setNotesVal('')
            setView('main'); await loadData()
        }, 3200)
    }, [api, notesVal, loadData])

    const endCallCleanup = useCallback(() => {
        clearInterval(timerRef.current)
        setCallTimer(0); setView('main')
        if ((window as any).electronAPI?.callEnded) (window as any).electronAPI.callEnded()
    }, [])

    // ── Mute / Hold / Rec ──────────────────────────────────────
    const doMute = useCallback(() => {
        const next = !muted
        setMuted(next); S.current.muted = next
        const call = vfGlobals.getCall()
        if (call?.mute) call.mute(next)
        if (S.current.callId)
            api('/api/v1/telephony/call/' + S.current.callId + '/mute', { method: 'PATCH', body: { mute: next } }).catch(() => { })
        showToast(next ? 'Micro coupé' : 'Micro actif')
    }, [muted, api, showToast])

    const doHold = useCallback(() => {
        const next = !onHold
        setOnHold(next); S.current.hold = next
        if (S.current.callId)
            api('/api/v1/telephony/call/' + S.current.callId + '/hold', { method: 'PATCH', body: { hold: next } }).catch(() => { })
        showToast(next ? 'Appel en attente' : 'Appel repris')
    }, [onHold, api, showToast])

    const doRec = useCallback(() => {
        if (!isAdmin()) { showToast('Réservé aux administrateurs'); return }
        const next = !recording
        setRecording(next); S.current.rec = next
        showToast(next ? 'Enregistrement démarré' : 'Enregistrement arrêté')
    }, [recording, isAdmin, showToast])

    // ── Transfert ──────────────────────────────────────────────
    const execTransfer = useCallback(async () => {
        if (!xferNum || !S.current.callId) return
        await api('/api/v1/telephony/call/' + S.current.callId + '/transfer', {
            method: 'POST', body: { to: xferNum, type: xferType }
        }).catch(() => { })
        showToast('Transfert en cours…')
        if (xferType === 'blind') setTimeout(hangup, 900)
    }, [xferNum, xferType, api, showToast, hangup])

    const xferToAgent = useCallback((ext: string) => {
        setXferNum(ext)
        setTimeout(execTransfer, 100)
    }, [execTransfer])

    // ── Notes ──────────────────────────────────────────────────
    const saveNotes = useCallback(() => {
        if (notesVal && S.current.callId)
            api('/api/v1/telephony/call/' + S.current.callId + '/notes', {
                method: 'PATCH', body: { notes: notesVal }
            }).catch(() => { })
        showToast('Notes sauvegardées')
    }, [notesVal, api, showToast])

    // ── DTMF ───────────────────────────────────────────────────
    const dtmf = useCallback((k: string) => {
        playDTMF(k)
        const call = vfGlobals.getCall()
        if (call?.sendDigits) call.sendDigits(k)
    }, [])

    // ── Supervision ────────────────────────────────────────────
    const supListen = useCallback((id: string) => { showToast('Écoute activée'); api('/api/v1/supervision/listen/' + id, { method: 'POST' }).catch(() => { }) }, [api, showToast])
    const supWhisper = useCallback((id: string) => { showToast('Chuchotement actif'); api('/api/v1/supervision/whisper/' + id, { method: 'POST' }).catch(() => { }) }, [api, showToast])
    const supBarge = useCallback((id: string) => { showToast("Vous rejoignez l'appel"); api('/api/v1/supervision/barge/' + id, { method: 'POST' }).catch(() => { }) }, [api, showToast])

    // ── Voicemails ─────────────────────────────────────────────
    const markRead = useCallback((id: string) => {
        setVoicemails(v => v.map(x => x.id === id ? { ...x, status: 'LISTENED' } : x))
        api('/api/v1/telephony/voicemail/' + id + '/listen', { method: 'PATCH' }).catch(() => { })
    }, [api])

    const playVM = useCallback((id: string, url: string) => {
        markRead(id); playAudio(url)
    }, [markRead])

    // ── Search ─────────────────────────────────────────────────
    const doSearch = useCallback(async (q: string) => {
        try {
            if (!q || q.length < 2) {
                // Sans recherche : charger les derniers contacts
                const r = await api('/api/v1/crm/contacts?limit=10')
                if (r.success) setSearchRes(r.data || [])
                return
            }
            const r = await api('/api/v1/crm/contacts?search=' + encodeURIComponent(q) + '&limit=10')
            if (r.success) setSearchRes(r.data || [])
        } catch { }
    }, [api])

    // ── Queue ──────────────────────────────────────────────────
    const pickQ = useCallback((num: string) => {
        if (num) { S.current.dir = 'INBOUND'; callNum(num) }
    }, [callNum])

    // ── Audio playback ─────────────────────────────────────────
    const playAudio = useCallback((url: string) => {
        if (!url) { showToast('Aucun enregistrement'); return }
        playAudioFile({ url, apiUrl: S.current.url, token: S.current.tok || undefined })
    }, [showToast])

    // ── CRM ────────────────────────────────────────────────────
    const openCRM = useCallback(() => {
        window.open(S.current.url.replace(':4000', ':3001') + '/admin/crm', '_blank')
    }, [])

    // qAgentsXfer est maintenant un derive de agents (plus de useEffect/setState)

    // ── Sync logout/login temps réel avec le portail ────────────────
    useEffect(() => {
        // Snapshot du token au montage
        let lastTok = localStorage.getItem('vf_tok')

        const check = () => {
            const tok = localStorage.getItem('vf_tok')

            // Token supprimé → logout immédiat
            if (lastTok && !tok) {
                lastTok = null
                S.current.tok = null
                if (pollRef.current) clearInterval(pollRef.current)
                setView('login')
                return
            }

            // Nouveau token ou token changé → reconnexion
            if (tok && tok !== lastTok) {
                lastTok = tok
                S.current.tok = tok
                S.current.role = localStorage.getItem('vf_role') || 'AGENT'
                S.current.url = localStorage.getItem('vf_url') || S.current.url
                setView('main')
            }
        }

        // Vérification toutes les 1 seconde — léger et réactif
        const iv = setInterval(check, 1000)
        return () => clearInterval(iv)
    }, []) // [] = monté une fois, pas de dépendances


    // ── Débloquer AudioContext au premier clic ───────────────────
    useEffect(() => {
        const unlock = () => { try { getAC() } catch { } }
        document.addEventListener('click', unlock, { once: true })
        document.addEventListener('touchstart', unlock, { once: true })
        document.addEventListener('keydown', unlock, { once: true })
    }, [])

    // ── onDialNumber depuis Electron / CRM ─────────────────────
    useEffect(() => {
        const ea = (window as any).electronAPI
        if (!ea?.onDialNumber) return
        ea.removeDialListener?.()
        ea.onDialNumber((data: any) => {
            if (!data?.phone) return
            setDialNum(data.phone)
            setTimeout(() => callNum(data.phone), 300)
        })
    }, [callNum])

    return {
        // State
        view, tab, panel, agStatus, dialNum, callTimer,
        muted, onHold, recording, xferType, xferNum, notesVal, outcome,
        stars, toast, histFilter, calls, agents, queue, voicemails,
        contact, incoming, wrapupDur, qAgentsXfer, searchRes, loginErr,
        // Setters
        setView, setTab, setPanel, setDialNum, setXferType, setXferNum,
        setNotesVal, setOutcome, setStars, setHistFilter,
        // Actions
        doLogin, doLogout, doStatus, callNum, doAnswer, doRefuse, hangup, handleIncoming,
        doMute, doHold, doRec, execTransfer, xferToAgent, saveNotes,
        dtmf, supListen, supWhisper, supBarge, markRead, playVM,
        doSearch, pickQ, playAudio, openCRM, showToast,
        startLong, endLong, lpdoneRef,
        // Helpers
        isAdmin, S,
        // Features gating
        has, planName, featuresVersion,
        // Caller ID picker (multi-pays)
        myNumbers, fromNumber, setFromNumber,
        // Refresh externe (postMessage du portail)
        refreshData: loadData,
        setNum: setDialNum,
    }
}