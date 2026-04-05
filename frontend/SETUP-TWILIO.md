# Configuration Twilio pour VoxFlow

## Etape 1 — Variables .env

Dans `backend/.env`, remplacer les valeurs placeholders par tes vraies cles :

```
TWILIO_ACCOUNT_SID=ACxxxxxxx  <- Console Twilio > Account SID
TWILIO_AUTH_TOKEN=xxxxxxx     <- Console Twilio > Auth Token
TWILIO_PHONE_NUMBER=+1514xxxx <- Le numero que tu achetes
TWILIO_TWIML_APP_SID=APxxxxx  <- Cree dans l etape 3
TWILIO_API_KEY=SKxxxxxxx      <- Cree dans l etape 4
TWILIO_API_SECRET=xxxxxxx     <- Cree dans l etape 4
```

## Etape 2 — Acheter un numero

1. Console Twilio > Phone Numbers > Buy a Number
2. Chercher +1 (514) ou +1 (438) pour Montreal
3. Acheter (environ 1$/mois)

## Etape 3 — Creer une TwiML App

1. Console Twilio > Voice > TwiML Apps > Create
2. Nom: "VoxFlow Production"
3. Voice Request URL: `https://api.voxflow.io/api/v1/telephony/webhook/voice`
   (ou `https://VOTRE-URL-RAILWAY.up.railway.app/api/v1/telephony/webhook/voice`)
4. Status Callback URL: `https://api.voxflow.io/api/v1/telephony/webhook/status`
5. Copier le SID dans TWILIO_TWIML_APP_SID

## Etape 4 — Creer des cles API (pour le token WebRTC)

1. Console Twilio > Account > API Keys > Create API Key
2. Type: Standard
3. Nom: "VoxFlow WebRTC"
4. Copier SID dans TWILIO_API_KEY
5. Copier Secret dans TWILIO_API_SECRET (seulement visible une fois!)

## Etape 5 — Configurer le numero achete

Le script configure automatiquement via l API, mais tu peux aussi le faire manuellement :
1. Console Twilio > Phone Numbers > Manage > ton numero
2. Voice Configuration > A Call Comes In:
   - Webhook: `https://api.voxflow.io/api/v1/telephony/webhook/voice`
   - Method: POST

## Test local avec ngrok (pendant le developpement)

```bash
# Terminal 1
ngrok http 4000

# Copier l URL ngrok (ex: https://abc123.ngrok.io)
# Mettre dans .env:
# BACKEND_URL=https://abc123.ngrok.io
```

## Test appel entrant

1. Appelle ton numero Twilio depuis un telephone
2. Le popup VoxFlow devrait sonner dans le navigateur
3. Clique "Decrocher"
4. La fiche CRM du client apparait si le numero est connu

## Test appel sortant

1. Dans le popup VoxFlow, entre un numero
2. Clique "Appeler"
3. L appel est initie via Twilio
4. Le client recoit un vrai appel depuis ton numero VoxFlow
