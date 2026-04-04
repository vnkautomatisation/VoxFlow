# VoxFlow — Plateforme SaaS Call Center

> Un produit de **VNK Automatisation Inc.** | Montreal, Quebec, Canada

## Stack

| Composant | Technologie |
|-----------|-------------|
| Frontend  | Next.js 14, TypeScript, Tailwind, Lucide React |
| Backend   | Node.js, Express, TypeScript |
| BDD       | Supabase (PostgreSQL) |
| Cache     | Upstash Redis |
| Telephonie| Twilio Voice WebRTC |
| Paiements | Stripe |
| IA        | OpenAI Whisper + GPT-4o mini |
| Deploy    | Railway (backend) + Vercel (frontend) |

## URLs locales

| Service   | URL |
|-----------|-----|
| Frontend  | http://localhost:3001 |
| Backend   | http://localhost:4000 |
| API Health| http://localhost:4000/api/v1/health |

## Comptes de test

| Role  | Email | Mot de passe |
|-------|-------|-------------|
| Owner | owner@voxflow.io | VoxFlow123! |
| Admin | admin@test.com | VoxFlow123! |
| Agent | agent@test.com | VoxFlow123! |

## Pages principales

| Page | URL |
|------|-----|
| Landing | /marketing |
| Login | /login |
| Register | /register |
| Onboarding | /onboarding |
| Owner Dashboard | /owner/dashboard |
| Admin Dashboard | /admin/dashboard |
| CRM | /admin/crm |
| Routage ACD | /admin/queues |
| Supervision | /admin/supervision |
| Boite unifiee | /admin/inbox |
| IA + Dialer | /admin/ia |
| Integrations | /admin/integrations |
| Agent Dashboard | /agent/dashboard |
| Profil | /profile |
| Securite | /profile/security |

## 10 Phases completees

| Phase | Description | Statut |
|-------|-------------|--------|
| 1 | Auth JWT + roles + BDD | COMPLETE |
| 2 | Onboarding + Register + Email | COMPLETE |
| 3 | CRM Contacts complet | COMPLETE |
| 4 | Softphone Pro + Popup flottant | COMPLETE |
| 5 | Routage ACD avance | COMPLETE |
| 6 | Supervision temps reel | COMPLETE |
| 7 | Multicanal (WhatsApp+Chat+Email) | COMPLETE |
| 8 | IA avancee + Power Dialer | COMPLETE |
| 9 | Integrations API | COMPLETE |
| 10 | Securite 2FA + Deploiement | COMPLETE |

## Deploiement

### Backend (Railway)
1. railway.app > New Project > GitHub > VoxFlow/backend
2. Configurer les variables .env.production.example
3. Railway deploie automatiquement

### Frontend (Vercel)
1. vercel.com > New Project > GitHub > VoxFlow/frontend
2. Root directory: frontend
3. Configurer les variables d environnement

---
VNK Automatisation Inc. - 2026
