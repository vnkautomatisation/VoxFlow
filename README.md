# VoxFlow — Plateforme SaaS Call Center

> Un produit de **VNK Automatisation Inc.**

## Description
VoxFlow est une plateforme SaaS de call center complète avec 3 niveaux d'utilisateurs :
- **Owner** (VNK) — Gestion globale, facturation, revenus
- **Admin** — Entreprises clientes, gestion de leurs agents
- **Agent** — Interface de travail, softphone WebRTC, CRM

## Stack technique

| Couche          | Technologie                        |
|-----------------|------------------------------------|
| Frontend        | Next.js 14 + TypeScript            |
| Backend         | Node.js + Express                  |
| Base de données | Supabase (PostgreSQL)              |
| Cache           | Redis (Upstash)                    |
| Téléphonie      | Twilio (VoIP, WebRTC, SMS)        |
| Paiements       | Stripe                             |
| IA              | OpenAI Whisper + GPT-4o mini       |
| Emails          | Resend                             |
| Déploiement     | Vercel (front) + Railway (back)   |

## Structure du projet

\\\
VoxFlow/
├── frontend/          # Next.js 14 — interface utilisateur
├── backend/           # Node.js — API REST + WebSockets
├── assets/            # Logos, images, audio partagés
├── docs/              # Documentation projet
├── scripts/           # Scripts utilitaires
├── infra/             # Docker, Nginx, SSL
└── .github/           # CI/CD GitHub Actions
\\\

## Démarrage rapide

\\\powershell
# 1. Variables d'environnement
Copy-Item frontend\.env.example frontend\.env.local
Copy-Item backend\.env.example  backend\.env

# 2. Docker (Postgres + Redis local)
docker-compose up -d

# 3. Frontend
cd frontend
npm install
npm run dev

# 4. Backend (nouveau terminal)
cd backend
npm install
npm run dev
\\\

URLs de développement :
- Frontend : http://localhost:3000
- Backend  : http://localhost:4000
- Redis UI : http://localhost:8081

---
© 2026 VNK Automatisation Inc. — Tous droits réservés
