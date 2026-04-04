import { create } from "zustand"

export type CallState = "idle" | "ringing" | "in_call" | "on_hold" | "wrap_up"
export type AgentStatus = "ONLINE" | "OFFLINE" | "BREAK" | "BUSY" | "ON_CALL"

export interface ActiveCall {
  id:          string
  from:        string
  to:          string
  direction:   "INBOUND" | "OUTBOUND"
  startedAt:   Date
  duration:    number
}

interface CallStore {
  callState:   CallState
  agentStatus: AgentStatus
  activeCall:  ActiveCall | null
  isMuted:     boolean
  isOnHold:    boolean
  notes:       string
  duration:    number

  setCallState:   (s: CallState) => void
  setAgentStatus: (s: AgentStatus) => void
  setActiveCall:  (c: ActiveCall | null) => void
  setMuted:       (v: boolean) => void
  setOnHold:      (v: boolean) => void
  setNotes:       (n: string) => void
  incrementDuration: () => void
  reset:          () => void
}

export const useCallStore = create<CallStore>((set) => ({
  callState:   "idle",
  agentStatus: "OFFLINE",
  activeCall:  null,
  isMuted:     false,
  isOnHold:    false,
  notes:       "",
  duration:    0,

  setCallState:      (callState) => set({ callState }),
  setAgentStatus:    (agentStatus) => set({ agentStatus }),
  setActiveCall:     (activeCall) => set({ activeCall }),
  setMuted:          (isMuted) => set({ isMuted }),
  setOnHold:         (isOnHold) => set({ isOnHold }),
  setNotes:          (notes) => set({ notes }),
  incrementDuration: () => set((s) => ({ duration: s.duration + 1 })),
  reset: () => set({ callState: "idle", activeCall: null, isMuted: false, isOnHold: false, notes: "", duration: 0 }),
}))
