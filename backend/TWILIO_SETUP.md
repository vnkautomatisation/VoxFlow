# VoxFlow — Configuration Twilio

## Variables d'environnement (.env)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
BACKEND_URL=https://your-domain.ngrok-free.dev
```

## Configuration Twilio Console

### 1. TwiML App (pour appels SORTANTS via WebRTC)

Le dialer utilise Twilio.Device (WebRTC) pour les appels sortants.
Quand l'agent clique "Appeler", Device.connect() fire et Twilio appelle
le TwiML App webhook pour obtenir le TwiML.

**Console** : Voice > Manage > TwiML Apps > votre app

- **Voice Request URL** : `{BACKEND_URL}/api/v1/telephony/voice`
- **Method** : POST
- **Status Callback URL** : `{BACKEND_URL}/api/v1/telephony/webhook/status`

### 2. Phone Number (pour appels ENTRANTS)

Quand quelqu'un appelle votre numero Twilio, Twilio fait un webhook
vers votre serveur pour obtenir le TwiML de routage.

**Console** : Phone Numbers > Manage > Active Numbers > votre numero

- **Configure** > Voice & Fax
- **A call comes in** : Webhook
- **URL** : `{BACKEND_URL}/api/v1/telephony/webhook/voice`
- **Method** : POST
- **Status Callback URL** : `{BACKEND_URL}/api/v1/telephony/webhook/status`

### 3. ngrok (developpement local)

Twilio ne peut pas joindre localhost. Utilisez ngrok :

```bash
ngrok http 4000
```

Copiez l'URL HTTPS (ex: `https://abc123.ngrok-free.dev`) dans :
1. `.env` > `BACKEND_URL`
2. TwiML App > Voice Request URL
3. Phone Number > A call comes in

## Architecture des webhooks

```
Appel SORTANT :
  Agent clique "Appeler"
  → Twilio.Device.connect({ To: "+1514..." })
  → Twilio appelle TwiML App webhook
  → POST /api/v1/telephony/voice (voice.ts)
  → TwiML : <Dial callerId="+166..."><Number>+1514...</Number></Dial>
  → Twilio etablit l'appel

Appel ENTRANT :
  Quelqu'un appelle +16627035718
  → Twilio appelle phone number webhook
  → POST /api/v1/telephony/webhook/voice (index.ts)
  → Lookup org via phone_numbers table
  → Trouve agent ONLINE dans agents table
  → TwiML : <Dial><Client>{agentUserId}</Client></Dial>
  → Agent voit popup "Appel entrant" dans le dialer

Recording callback :
  → POST /api/v1/telephony/voice/recording (voice.ts)
  → Persist recording_url dans calls table

Status callback :
  → POST /api/v1/telephony/webhook/status (index.ts)
  → Update calls.status + duration + ended_at
  → Auto-link contact si pas deja lie
  → Auto-transcription Whisper si recording_url present
  → Reset agent status a ONLINE si appel termine

Voicemail :
  → POST /api/v1/telephony/webhook/voicemail (index.ts)
  → Insert dans voicemails table
  → Auto-transcription
```

## Verification rapide

```bash
# Backend up ?
curl http://localhost:4000/api/v1/health

# Twilio token OK ?
curl -H "Authorization: Bearer <JWT>" http://localhost:4000/api/v1/telephony/voice/token

# Calls en DB ?
# Via Supabase SQL Editor :
SELECT id, direction, status, twilio_sid, from_number, to_number
FROM calls ORDER BY started_at DESC LIMIT 5;
```
