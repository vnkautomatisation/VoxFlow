# Architecture VoxFlow

## Vue d'ensemble
VoxFlow est une plateforme SaaS multi-tenant de call center.

## Niveaux utilisateurs
1. **Owner (VNK)** — Propriétaire de la plateforme
2. **Admin** — Entreprises clientes
3. **Agent** — Téléphonistes des entreprises

## Flux d'un appel entrant
1. Client appelle le numéro Twilio de l'entreprise
2. Twilio envoie un webhook POST au backend VoxFlow
3. Backend consulte la config IVR de l'organisation
4. Appel routé vers la bonne file d'attente
5. Agent reçoit la sonnerie via WebRTC (softphone navigateur)
6. Agent décroche — connexion bidirectionnelle établie
7. Fin d'appel — transcription IA + résumé sauvegardés en BDD

## Décisions techniques clés
- Multi-tenant : isolation par organization_id sur toutes les tables
- Temps réel : Socket.io + Redis pour statuts agents
- Téléphonie : Twilio maintenant, migration Telnyx possible plus tard
- Auth : JWT + Supabase Auth avec Row Level Security
- Stockage enregistrements : Supabase Storage (démarrage), S3 (scale)
