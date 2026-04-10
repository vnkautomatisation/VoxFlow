export type Role = 'OWNER' | 'OWNER_STAFF' | 'ADMIN' | 'SUPERVISOR' | 'AGENT'
export type Plan = 'STARTER' | 'BASIC' | 'CONFORT' | 'PRO' | 'ENTERPRISE'
export type OrgStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'CANCELLED'
export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'ON_CALL' | 'BREAK' | 'BUSY'

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
