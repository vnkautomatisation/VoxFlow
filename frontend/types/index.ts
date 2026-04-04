export type Role = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'AGENT'
export type Plan = 'STARTER' | 'PRO' | 'ENTERPRISE'
export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'ON_CALL' | 'BREAK'

export interface User {
  id:             string
  email:          string
  name:           string
  role:           Role
  organizationId: string | null
  createdAt:      string
}

export interface Organization {
  id:        string
  name:      string
  slug:      string
  plan:      Plan
  status:    'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  createdAt: string
}
