// ============================================================
//  VoxFlow — frontend/hooks/useAgentDashboard.ts
//  Hook central du portail agent
//  - Charge calls, voicemails, contacts, scripts, stats, queue
//  - Polling toutes les 30s
//  - Écoute BroadcastChannel "voxflow_calls" depuis le dialer
// ============================================================
"use client"
import { useState, useEffect, useRef, useCallback } from "react"

// ── Types ─────────────────────────────────────────────────────
export type CallStatus = "COMPLETED" | "NO_ANSWER" | "MISSED" | "IN_PROGRESS" | "FAILED" | "CANCELLED"

export interface ApiCall {
    id: string
    from_number: string
    to_number: string
    direction: "INBOUND" | "OUTBOUND"
    status: CallStatus
    duration?: number
    started_at: string
    ended_at?: string
    notes?: string
    contact?: { id: string; first_name?: string; last_name?: string; company?: string } | null
}

export interface QueueEntry {
    id: string
    from_number: string
    caller_name?: string
    wait_seconds: number
    priority: number
    status: string
}

export interface Voicemail {
    id: string
    from_number: string
    duration: number
    status: "NEW" | "LISTENED" | "ARCHIVED"
    transcription?: string
    created_at: string
    contact?: { first_name?: string; last_name?: string } | null
}

export interface Script {
    id: string
    name: string
    content: string
    queue_id?: string | null
}

export interface Contact {
    id: string
    first_name?: string
    last_name?: string
    phone?: string
    email?: string
    company?: string
}

export interface AgentStats {
    calls_total: number
    calls_answered: number
    calls_missed: number
    talk_seconds: number
    avg_duration: number
}

export interface AgentGoals {
    daily_calls_target: number
    daily_answer_rate: number
    daily_talk_time: number
}

// ── Config ────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
const POLL_INTERVAL = 30_000

const DEFAULT_STATS: AgentStats = {
    calls_total: 0, calls_answered: 0, calls_missed: 0,
    talk_seconds: 0, avg_duration: 0,
}

const DEFAULT_GOALS: AgentGoals = {
    daily_calls_target: 50, daily_answer_rate: 80, daily_talk_time: 14400,
}

// ── Helper fetch ──────────────────────────────────────────────
async function apiFetch(path: string, token: string): Promise<any> {
    const r = await fetch(API_URL + path, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${path}`)
    return r.json()
}

// ── Hook principal ────────────────────────────────────────────
export function useAgentDashboard() {
    const [calls, setCalls] = useState<ApiCall[]>([])
    const [queue, setQueue] = useState<QueueEntry[]>([])
    const [voicemails, setVoicemails] = useState<Voicemail[]>([])
    const [scripts, setScripts] = useState<Script[]>([])
    const [contacts, setContacts] = useState<Contact[]>([])
    const [stats, setStats] = useState<AgentStats>(DEFAULT_STATS)
    const [goals, setGoals] = useState<AgentGoals>(DEFAULT_GOALS)
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const getToken = () =>
        typeof window !== "undefined" ? localStorage.getItem("vf_tok") || "" : ""

    // ── Fetch tout en parallèle ───────────────────────────────
    const fetchAll = useCallback(async () => {
        const token = getToken()
        if (!token) { setLoading(false); return }

        const [callsRes, vmRes, scriptsRes, queueRes, goalsRes, contactsRes] =
            await Promise.allSettled([
                apiFetch("/api/v1/telephony/calls?limit=50", token),
                apiFetch("/api/v1/telephony/voicemails", token),
                apiFetch("/api/v1/agent/scripts", token),
                apiFetch("/api/v1/queues/live", token),          // peut échouer si route absente
                apiFetch("/api/v1/agent/goals", token),          // idem
                apiFetch("/api/v1/crm/contacts?limit=100", token),
            ])

        // ── Calls + stats temps réel ──────────────────────────
        if (callsRes.status === "fulfilled" && callsRes.value?.success) {
            const raw: any[] = callsRes.value.data || []
            const mapped: ApiCall[] = raw.map(c => ({
                id: c.id,
                from_number: c.from_number,
                to_number: c.to_number,
                direction: c.direction,
                status: c.status,
                duration: c.duration,
                started_at: c.started_at,
                ended_at: c.ended_at,
                notes: c.notes,
                contact: c.contact || null,
            }))
            setCalls(mapped)

            // Calculer stats depuis les appels du jour courant
            const today = new Date().toDateString()
            const todayCalls = raw.filter(c => new Date(c.started_at).toDateString() === today)
            const answered = todayCalls.filter(c => c.status === "COMPLETED")
            const missed = todayCalls.filter(c => ["NO_ANSWER", "MISSED", "FAILED", "CANCELLED"].includes(c.status))
            const talkSec = answered.reduce((s: number, c: any) => s + (c.duration || 0), 0)
            const avgDur = answered.length ? Math.round(talkSec / answered.length) : 0
            setStats({ calls_total: todayCalls.length, calls_answered: answered.length, calls_missed: missed.length, talk_seconds: talkSec, avg_duration: avgDur })
        }

        // ── Voicemails ────────────────────────────────────────
        if (vmRes.status === "fulfilled" && vmRes.value?.success) {
            setVoicemails(vmRes.value.data || [])
        }

        // ── Scripts ───────────────────────────────────────────
        if (scriptsRes.status === "fulfilled" && scriptsRes.value?.success) {
            setScripts(scriptsRes.value.data || [])
        }

        // ── Queue live ────────────────────────────────────────
        if (queueRes.status === "fulfilled" && queueRes.value?.success) {
            setQueue(queueRes.value.data || [])
        }

        // ── Objectifs agent ───────────────────────────────────
        if (goalsRes.status === "fulfilled" && goalsRes.value?.success) {
            const g = goalsRes.value.data?.goals
            if (g) setGoals({
                daily_calls_target: g.daily_calls_target ?? 50,
                daily_answer_rate: g.daily_answer_rate ?? 80,
                daily_talk_time: g.daily_talk_time ?? 14400,
            })
        }

        // ── Contacts CRM ──────────────────────────────────────
        if (contactsRes.status === "fulfilled" && contactsRes.value?.success) {
            setContacts(contactsRes.value.data || [])
        }

        setLastRefresh(new Date())
        setLoading(false)
    }, [])

    // ── BroadcastChannel : écoute le dialer flottant ─────────
    useEffect(() => {
        if (typeof window === "undefined") return
        const bc = new BroadcastChannel("voxflow_calls")
        bc.onmessage = (e: MessageEvent) => {
            if (["CALL_ENDED", "CALL_STARTED", "CALL_MISSED", "STATUS_CHANGED"].includes(e.data?.type)) {
                // Refresh après 800ms pour laisser le backend écrire
                setTimeout(fetchAll, 800)
            }
        }
        return () => bc.close()
    }, [fetchAll])

    // ── Polling 30s ───────────────────────────────────────────
    useEffect(() => {
        fetchAll()
        pollRef.current = setInterval(fetchAll, POLL_INTERVAL)
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [fetchAll])

    // ── Actions ───────────────────────────────────────────────
    const markVoicemailListened = useCallback(async (id: string) => {
        const token = getToken()
        setVoicemails(prev => prev.map(v => v.id === id ? { ...v, status: "LISTENED" as const } : v))
        try {
            await fetch(`${API_URL}/api/v1/telephony/voicemail/${id}/listen`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            })
        } catch { }
    }, [])

    const saveContactToApi = useCallback(async (form: any): Promise<boolean> => {
        const token = getToken()
        try {
            const r = await fetch(`${API_URL}/api/v1/crm/contacts`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (r.ok) { setTimeout(fetchAll, 500); return true }
            return false
        } catch { return false }
    }, [fetchAll])

    const updateAgentStatus = useCallback(async (status: string) => {
        const token = getToken()
        try {
            await fetch(`${API_URL}/api/v1/telephony/status`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
        } catch { }
    }, [])

    return {
        calls, queue, voicemails, scripts, contacts,
        stats, goals, loading, lastRefresh,
        refresh: fetchAll,
        markVoicemailListened,
        saveContactToApi,
        updateAgentStatus,
    }
}