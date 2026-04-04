# API VoxFlow

Base URL développement : http://localhost:4000/api/v1

## Authentification
Header requis sur toutes les routes protégées :
Authorization: Bearer <jwt_token>

## Routes

### Auth
- POST /auth/login
- POST /auth/register
- POST /auth/refresh
- POST /auth/logout

### Owner (role: OWNER uniquement)
- GET  /owner/organizations
- POST /owner/organizations
- PATCH /owner/organizations/:id
- DELETE /owner/organizations/:id
- GET  /owner/stats

### Admin (role: ADMIN)
- GET  /admin/agents
- POST /admin/agents
- GET  /admin/queues
- POST /admin/queues
- GET  /admin/reports

### Calls
- GET  /calls
- GET  /calls/:id
- POST /calls/token    — Token WebRTC Twilio
- POST /calls/outbound — Appel sortant

### Webhooks (Twilio + Stripe)
- POST /webhooks/twilio/voice
- POST /webhooks/twilio/status
- POST /webhooks/stripe
