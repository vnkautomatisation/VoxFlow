import { Router, Request, Response } from "express"
import { authenticate, AuthRequest, resolveOrgId } from "../../middleware/auth"
import { requireFeature } from "../../middleware/features"
import { twilioService } from "../../services/twilio/twilio.service"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"
import voiceRoutes from './voice'

const router = Router()
const BACKEND = () => process.env.BACKEND_URL || "http://localhost:4000"
// Utilise resolveOrgId qui permet ?orgId uniquement pour OWNER/OWNER_STAFF.
// ATTENTION: cette helper n'est utilisé QUE pour les routes authentifiées.
// Les handlers TwiML publics (webhooks Twilio) ont leur propre logique
// car Twilio passe l'orgId dans l'URL (pas de JWT).
const getOrgId = (req: AuthRequest) => resolveOrgId(req)

// ── Détection pays depuis numéro ─────────────────────────────
const COUNTRY_PREFIXES: Record<string, string> = {
    "1": "CA_US", "52": "MX", "33": "FR", "32": "BE", "41": "CH", "352": "LU",
    "44": "GB", "49": "DE", "34": "ES", "39": "IT", "351": "PT", "31": "NL",
    "43": "AT", "353": "IE", "48": "PL", "46": "SE", "47": "NO", "45": "DK",
    "358": "FI", "40": "RO", "36": "HU", "420": "CZ", "421": "SK", "385": "HR", "30": "GR",
    "212": "MA", "213": "DZ", "216": "TN", "221": "SN", "225": "CI", "237": "CM",
    "234": "NG", "254": "KE", "27": "ZA", "55": "BR", "54": "AR", "56": "CL",
    "57": "CO", "51": "PE", "81": "JP", "82": "KR", "86": "CN", "91": "IN",
    "61": "AU", "64": "NZ", "7": "RU", "380": "UA", "971": "AE", "966": "SA",
    "972": "IL", "90": "TR",
}

const REGION_NAMES: Record<string, string> = {
    CA_US: "Canada / États-Unis", MX: "Mexique", FR: "France", BE: "Belgique",
    CH: "Suisse", LU: "Luxembourg", GB: "Royaume-Uni", DE: "Allemagne",
    ES: "Espagne", IT: "Italie", PT: "Portugal", NL: "Pays-Bas", AT: "Autriche",
    IE: "Irlande", PL: "Pologne", SE: "Suède", NO: "Norvège", DK: "Danemark",
    FI: "Finlande", RO: "Roumanie", HU: "Hongrie", CZ: "Tchéquie", SK: "Slovaquie",
    HR: "Croatie", GR: "Grèce", MA: "Maroc", DZ: "Algérie", TN: "Tunisie",
    SN: "Sénégal", CI: "Côte d'Ivoire", CM: "Cameroun", NG: "Nigeria",
    KE: "Kenya", ZA: "Afrique du Sud", BR: "Brésil", AR: "Argentine",
    CL: "Chili", CO: "Colombie", PE: "Pérou", JP: "Japon", KR: "Corée du Sud",
    CN: "Chine", IN: "Inde", AU: "Australie", NZ: "Nouvelle-Zélande",
    RU: "Russie", UA: "Ukraine", AE: "Émirats arabes", SA: "Arabie Saoudite",
    IL: "Israël", TR: "Turquie",
}

const PLAN_REGIONS: Record<string, string[]> = {
    basic: ["CA_US"],
    confort: ["CA_US", "MX"],
    premium: Object.keys(REGION_NAMES),
}

function detectCountry(phone: string): string {
    const d = phone.replace(/\D/g, "")
    if ((d.startsWith("1") && d.length >= 11) || d.length === 10) return "CA_US"
    for (let len = 3; len >= 1; len--) {
        const p = d.substring(0, len)
        if (COUNTRY_PREFIXES[p]) return COUNTRY_PREFIXES[p]
    }
    return "UNKNOWN"
}

// Conversion code pays → drapeau emoji (Regional Indicator Symbols)
// Ex: "FR" → 🇫🇷 · "CA" → 🇨🇦 · "CA_US" → 🇨🇦 (on privilégie CA pour la région)
const COUNTRY_ISO2: Record<string, string> = {
    CA_US: 'CA', MX: 'MX', FR: 'FR', BE: 'BE', CH: 'CH', LU: 'LU',
    GB: 'GB', DE: 'DE', ES: 'ES', IT: 'IT', PT: 'PT', NL: 'NL',
    AT: 'AT', IE: 'IE', PL: 'PL', SE: 'SE', NO: 'NO', DK: 'DK',
    FI: 'FI', RO: 'RO', HU: 'HU', CZ: 'CZ', SK: 'SK', HR: 'HR',
    GR: 'GR', MA: 'MA', DZ: 'DZ', TN: 'TN', SN: 'SN', CI: 'CI',
    CM: 'CM', NG: 'NG', KE: 'KE', ZA: 'ZA', BR: 'BR', AR: 'AR',
    CL: 'CL', CO: 'CO', PE: 'PE', JP: 'JP', KR: 'KR', CN: 'CN',
    IN: 'IN', AU: 'AU', NZ: 'NZ', RU: 'RU', UA: 'UA', AE: 'AE',
    SA: 'SA', IL: 'IL', TR: 'TR',
}

function countryFlag(code: string): string {
    const iso = COUNTRY_ISO2[code] || code.substring(0, 2).toUpperCase()
    if (iso.length !== 2) return '🌐'
    // 127397 = 0x1F1E6 - 'A'.charCodeAt(0)
    const offset = 127397
    return String.fromCodePoint(...iso.split('').map(c => c.charCodeAt(0) + offset))
}

async function getOrgAllowedRegions(orgId: string): Promise<string[]> {
    try {
        const { data } = await supabaseAdmin
            .from("subscriptions").select("plan, allowed_regions")
            .eq("organization_id", orgId).eq("status", "ACTIVE").single()
        if (!data) return ["CA_US"]
        if ((data as any).allowed_regions?.length > 0) return (data as any).allowed_regions
        return PLAN_REGIONS[(data as any).plan] || ["CA_US"]
    } catch { return ["CA_US"] }
}

async function validateDest(to: string, orgId: string) {
    const country = detectCountry(to)
    const allowed = await getOrgAllowedRegions(orgId)
    if (allowed.includes(country) || country === "UNKNOWN") {
        return { allowed: true, country, countryName: REGION_NAMES[country] || country }
    }
    const { data: sub } = await supabaseAdmin
        .from("subscriptions").select("plan")
        .eq("organization_id", orgId).eq("status", "ACTIVE").single()
    return { allowed: false, country, countryName: REGION_NAMES[country] || country, plan: (sub as any)?.plan }
}

// Vérifie que l'organisation a le droit d'effectuer des appels SORTANTS
// selon son forfait. Les plans STARTER / BASIC / INBOUND sont entrant seulement.
// Appelé avant toute tentative d'appel sortant (frontend + backend).
//
// Retourne { allowed: true } si OK, ou { allowed: false, reason } sinon.
async function validateDialerPlan(orgId: string): Promise<{ allowed: boolean, reason?: string, plan?: string }> {
    try {
        const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("plan, status")
            .eq("id", orgId)
            .maybeSingle()

        if (!org) return { allowed: false, reason: "Organisation introuvable" }

        const planUpper = String((org as any).plan || "").toUpperCase()
        // Plans inbound-only → refuser les appels sortants
        if (["STARTER", "BASIC", "INBOUND"].includes(planUpper)) {
            return {
                allowed: false,
                plan:    planUpper,
                reason:  `Les appels sortants ne sont pas inclus dans votre forfait ${planUpper}. Passez au forfait CONFORT ou supérieur pour activer le dialer sortant.`,
            }
        }

        return { allowed: true, plan: planUpper }
    } catch {
        // Fail-open en cas d'erreur DB pour ne pas bloquer le service
        return { allowed: true }
    }
}

// ── helpers ──────────────────────────────────────────────────
async function findContactByPhone(phone: string, orgId: string) {
    try {
        const clean = phone.replace(/\D/g, "")
        const { data } = await supabaseAdmin
            .from("contacts").select("id, first_name, last_name, company, phone, email")
            .eq("organization_id", orgId)
            .or(`phone.ilike.%${clean}%,phone.eq.${phone}`).limit(1)
        return data?.[0] || null
    } catch { return null }
}

// ════════════════════════════════════════════════════════════
//  TOKEN WEBRTC
// ════════════════════════════════════════════════════════════
router.get("/token", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const identity = req.user!.userId
        const token = await twilioService.generateToken(identity, getOrgId(req))
        sendSuccess(res, { token, identity, configured: true })
    } catch {
        sendSuccess(res, { token: "demo_" + Date.now(), identity: req.user!.userId, configured: false })
    }
})

// ════════════════════════════════════════════════════════════
//  VÉRIFICATION DESTINATION (appelé par le dialer avant de composer)
// ════════════════════════════════════════════════════════════
router.get("/check-destination", authenticate, requireFeature('outbound_calls'), async (req: AuthRequest, res: Response) => {
    try {
        const to = String(req.query.to || "").trim()
        const orgId = getOrgId(req)
        if (!to) return sendError(res, "Numéro requis", 400)

        const check = await validateDest(to, orgId)
        const allowed = await getOrgAllowedRegions(orgId)
        sendSuccess(res, {
            ...check,
            allowedRegions: allowed.map(r => ({ code: r, name: REGION_NAMES[r] || r })),
        })
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  APPEL SORTANT
// ════════════════════════════════════════════════════════════
router.post("/call/outbound", authenticate, requireFeature('outbound_calls'), async (req: AuthRequest, res: Response) => {
    const { to, contactId, fromNumber } = req.body
    const orgId = getOrgId(req)
    const userId = req.user!.userId

    if (!to) return sendError(res, "Numéro requis", 400)

    // Note: le gating plan (outbound_calls) est appliqué par requireFeature().
    // Ici on valide juste la région géographique selon le forfait.
    const check = await validateDest(to, orgId)
    if (!check.allowed) {
        return sendError(res,
            `Appels vers ${check.countryName} non inclus dans votre forfait ${check.plan || "actuel"}. ` +
            `Passez au forfait supérieur pour appeler dans cette région.`, 403)
    }

    const contact = contactId
        ? (await supabaseAdmin.from("contacts").select("*").eq("id", contactId).single()).data
        : await findContactByPhone(to, orgId)

    const { data: call, error: insertError } = await supabaseAdmin.from("calls").insert({
        organization_id: orgId,
        agent_id: userId,
        contact_id: contact?.id || null,
        from_number: fromNumber || process.env.TWILIO_PHONE_NUMBER,
        to_number: to,
        direction: "OUTBOUND",
        status: "RINGING",
        started_at: new Date().toISOString(),
    }).select().single()

    if (insertError || !call) return sendError(res, "Erreur DB: " + insertError?.message, 500)

    const callId = (call as any).id
    await supabaseAdmin.from("agents").update({ status: "BUSY" }).eq("user_id", userId)

    try {
        const twilioCall = await twilioService.makeOutboundCall({
            to,
            from: fromNumber || process.env.TWILIO_PHONE_NUMBER || "",
            callbackUrl: BACKEND() + "/api/v1/telephony/webhook/answer",
            statusUrl: BACKEND() + "/api/v1/telephony/webhook/status",
        })
        await supabaseAdmin.from("calls").update({ twilio_sid: twilioCall.sid }).eq("id", callId)
        sendSuccess(res, { call: { ...(call as any), twilio_sid: twilioCall.sid }, contact, region: { country: check.country, countryName: check.countryName } }, 201)
    } catch (err: any) {
        await supabaseAdmin.from("calls").update({ status: "FAILED", ended_at: new Date().toISOString() }).eq("id", callId)
        await supabaseAdmin.from("agents").update({ status: "ONLINE" }).eq("user_id", userId)
        sendSuccess(res, { call: { ...(call as any), twilio_sid: null }, contact, warning: "Twilio indisponible: " + err.message }, 201)
    }
})

// ════════════════════════════════════════════════════════════
//  MUTE / HOLD / FIN / NOTES
// ════════════════════════════════════════════════════════════
router.patch("/call/:id/mute", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { mute, twilioSid } = req.body
        if (twilioSid) await twilioService.muteCall(twilioSid, mute)
        sendSuccess(res, { muted: mute })
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:id/hold", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { hold, twilioSid } = req.body
        if (twilioSid) await twilioService.holdCall(twilioSid, hold)
        sendSuccess(res, { onHold: hold })
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:id/end", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { duration, notes, twilioSid } = req.body
        await supabaseAdmin.from("calls").update({
            status: "COMPLETED", duration: duration || 0, notes: notes || null, ended_at: new Date().toISOString(),
        }).eq("id", req.params.id)
        const { data: c } = await supabaseAdmin.from("calls").select("agent_id").eq("id", req.params.id).single()
        if ((c as any)?.agent_id) await supabaseAdmin.from("agents").update({ status: "ONLINE" }).eq("user_id", (c as any).agent_id)
        if (twilioSid) {
            try {
                const twilio = (await import("twilio")).default
                await twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!).calls(twilioSid).update({ status: "completed" })
            } catch { }
        }
        sendSuccess(res, { ended: true })
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/call/:id/notes", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        await supabaseAdmin.from("calls").update({ notes: req.body.notes }).eq("id", req.params.id)
        sendSuccess(res, { saved: true })
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  TRANSFERT / CONFÉRENCE / SUPERVISION
// ════════════════════════════════════════════════════════════
router.post("/call/:id/transfer", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { to, type, twilioSid } = req.body
        if (!to) return sendError(res, "Destination requise", 400)
        if (twilioSid) sendSuccess(res, await twilioService.transferCall({ callSid: twilioSid, to, type: type || "blind" }))
        else sendSuccess(res, { transferred: true, simulated: true })
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/call/:id/conference", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const result = await twilioService.addParticipantToConference({ conferenceName: "conf-" + req.params.id, participantPhone: req.body.participant })
        sendSuccess(res, result)
    } catch { sendSuccess(res, { conference: true, simulated: true }) }
})

router.post("/call/:id/supervise", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { mode, twilioSid } = req.body
        if (twilioSid) sendSuccess(res, await twilioService.joinCallAsSupervisor({ callSid: twilioSid, supervisorId: req.user!.userId, mode: mode || "listen" }))
        else sendSuccess(res, { mode, simulated: true })
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  ENREGISTREMENTS / VOICEMAILS / NUMÉROS / HISTORIQUE
// ════════════════════════════════════════════════════════════
router.get("/call/:id/recordings", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { data } = await supabaseAdmin.from("calls").select("twilio_sid").eq("id", req.params.id).single()
        if (!(data as any)?.twilio_sid) return sendSuccess(res, [])
        sendSuccess(res, await twilioService.getRecordings((data as any).twilio_sid))
    } catch (err: any) { sendError(res, err.message) }
})

router.get("/voicemails", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { data } = await supabaseAdmin.from("voicemails")
            .select("*, contact:contacts(id, first_name, last_name, company)")
            .eq("organization_id", getOrgId(req)).order("created_at", { ascending: false }).limit(50)
        sendSuccess(res, data || [])
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/voicemail/:id/listen", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        await supabaseAdmin.from("voicemails").update({ status: "LISTENED" }).eq("id", req.params.id)
        sendSuccess(res, { listened: true })
    } catch (err: any) { sendError(res, err.message) }
})

router.get("/numbers", authenticate, async (req: AuthRequest, res: Response) => {
    try { sendSuccess(res, await twilioService.getPhoneNumbers()) }
    catch (err: any) { sendError(res, err.message) }
})

// GET /my-numbers — retourne les vrais numéros Twilio de l'org, enrichis
// avec pays détecté + drapeau ISO. Fusionne :
//   1. Twilio API (source de vérité) — incomingPhoneNumbers.list()
//   2. phone_numbers table en DB (cache + mapping org_id ← twilio_sid)
//
// Seuls les numéros dont le twilio_sid est mappé à l'org courante
// sont retournés, sauf si le twilio_sid n'existe pas (numéros simulés
// en dev) — dans ce cas on accepte les numéros DB avec le bon org_id
// pour ne pas casser le dev.
router.get("/my-numbers", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        // OWNER / OWNER_STAFF sans orgId → liste vide (staff VNK)
        const role = req.user?.role
        if (!orgId) {
            if (role === 'OWNER' || role === 'OWNER_STAFF') {
                return sendSuccess(res, { numbers: [], byCountry: {}, total: 0, sources: { twilio: 0, simulated: 0, db: 0 } })
            }
            return sendError(res, "Organisation requise", 403)
        }

        // 1. Lire la DB (mapping org → twilio_sid)
        const { data: dbNumbers, error } = await supabaseAdmin
            .from('phone_numbers')
            .select('number, country, twilio_sid')
            .eq('organization_id', orgId)
        if (error) throw new Error(error.message)

        const dbByNumber: Record<string, any> = {}
        const dbBySid:    Record<string, any> = {}
        ;(dbNumbers || []).forEach((n: any) => {
            dbByNumber[n.number] = n
            if (n.twilio_sid) dbBySid[n.twilio_sid] = n
        })

        // 2. Essayer de fetch Twilio (source de vérité). Fail-open si down.
        let twilioNums: any[] = []
        try {
            twilioNums = await twilioService.getPhoneNumbers()
        } catch (e: any) {
            console.warn('[my-numbers] Twilio fetch failed:', e?.message)
        }

        // 3. Fusionner : priorité Twilio pour les champs officiels
        //    Garder uniquement ceux mappés à l'org (twilio_sid ∈ dbBySid)
        const merged: any[] = []
        const seen = new Set<string>()

        for (const t of twilioNums) {
            if (!dbBySid[t.sid]) continue // pas mappé à cette org
            seen.add(t.phoneNumber)
            const detected = detectCountry(t.phoneNumber)
            const country  = dbBySid[t.sid]?.country || detected
            merged.push({
                number:        t.phoneNumber,
                friendly_name: t.friendlyName || t.phoneNumber,
                twilio_sid:    t.sid,
                country_code:  country,
                country_name:  REGION_NAMES[country] || country,
                flag:          countryFlag(country),
                source:        'twilio',
            })
        }

        // 4. Ajouter les numéros DB non retrouvés dans Twilio (simulés/legacy)
        for (const n of (dbNumbers || [])) {
            if (seen.has(n.number)) continue
            const detected = detectCountry(n.number)
            const country  = n.country || detected
            merged.push({
                number:        n.number,
                friendly_name: n.number,
                twilio_sid:    n.twilio_sid,
                country_code:  country,
                country_name:  REGION_NAMES[country] || country,
                flag:          countryFlag(country),
                source:        n.twilio_sid?.startsWith('simulated_') ? 'simulated' : 'db',
            })
        }

        // 5. Trier par pays puis numéro
        merged.sort((a, b) => {
            if (a.country_code !== b.country_code) return a.country_code.localeCompare(b.country_code)
            return a.number.localeCompare(b.number)
        })

        // 6. Grouper par pays pour affichage
        const byCountry: Record<string, any[]> = {}
        merged.forEach(n => {
            const key = n.country_code
            if (!byCountry[key]) byCountry[key] = []
            byCountry[key].push(n)
        })

        sendSuccess(res, {
            numbers:   merged,
            byCountry,
            total:     merged.length,
            sources:   {
                twilio:    merged.filter(n => n.source === 'twilio').length,
                simulated: merged.filter(n => n.source === 'simulated').length,
                db:        merged.filter(n => n.source === 'db').length,
            },
        })
    } catch (err: any) { sendError(res, err.message) }
})

router.get("/numbers/search", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        sendSuccess(res, await twilioService.searchAvailableNumbers(
            String(req.query.areaCode || "514"), String(req.query.country || "CA")
        ))
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/numbers/purchase", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        if (!req.body.phoneNumber) return sendError(res, "Numéro requis", 400)
        sendSuccess(res, await twilioService.purchasePhoneNumber(req.body.phoneNumber, getOrgId(req)))
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/numbers/:sid/assign", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const sid = Array.isArray(req.params.sid) ? req.params.sid[0] : req.params.sid
        const { ivrId, queueId } = req.body
        const orgId = getOrgId(req), b = BACKEND()
        let voiceUrl = `${b}/api/v1/telephony/webhook/voice?orgId=${orgId}`
        if (ivrId) voiceUrl = `${b}/api/v1/telephony/twiml/ivr/${ivrId}?orgId=${orgId}`
        if (queueId) voiceUrl = `${b}/api/v1/telephony/twiml/queue/${queueId}?orgId=${orgId}`
        await twilioService.configurePhoneNumber(sid, voiceUrl, `${b}/api/v1/telephony/webhook/status`)
        sendSuccess(res, { configured: true, voiceUrl })
    } catch (err: any) { sendError(res, err.message) }
})

router.get("/calls", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req), limit = parseInt(String(req.query.limit || "30"))
        let q = supabaseAdmin.from("calls")
            .select(`id, from_number, to_number, direction, status, duration, started_at, ended_at, notes, transcription, recording_url, ai_summary, agent_id, twilio_sid, quality_score, contact:contacts(id, first_name, last_name, company, phone)`)
            .eq("organization_id", orgId).order("started_at", { ascending: false }).limit(limit)
        if (req.user!.role === "AGENT") q = q.eq("agent_id", req.user!.userId)
        const { data } = await q
        sendSuccess(res, data || [])
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/status", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        await supabaseAdmin.from("agents").update({ status: req.body.status }).eq("user_id", req.user!.userId)
        sendSuccess(res, { status: req.body.status })
    } catch (err: any) { sendError(res, err.message) }
})

router.get("/lookup/:phone", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const phone = decodeURIComponent(Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone)
        sendSuccess(res, { contact: await findContactByPhone(phone, getOrgId(req)) })
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  WEBHOOKS TWILIO
// ════════════════════════════════════════════════════════════
router.post("/webhook/voice", async (req: Request, res: Response) => {
    try {
        const { From, To, CallSid } = req.body

        // Trouver l'org via le numero appele (To) dans phone_numbers
        // Fallback sur orgId en query string (pour compat legacy)
        let orgId = ''
        if (To) {
            const { data: phone } = await supabaseAdmin
                .from("phone_numbers").select("organization_id")
                .eq("number", To).limit(1).single()
            if (phone) orgId = phone.organization_id
        }
        if (!orgId) orgId = String(req.query.orgId || '')
        if (!orgId) {
            console.error("[webhook/voice] No org found for number:", To)
            res.set("Content-Type", "text/xml")
            return res.send(`<?xml version="1.0"?><Response><Say language="fr-CA">Numero non configure.</Say><Hangup/></Response>`)
        }

        const contact = await findContactByPhone(From, orgId)

        // Creer la row calls
        await supabaseAdmin.from("calls").insert({
            organization_id: orgId, twilio_sid: CallSid, from_number: From, to_number: To,
            direction: "INBOUND", status: "RINGING", contact_id: contact?.id || null,
            started_at: new Date().toISOString(),
        })

        // Trouver un agent ONLINE (pas busy) pour router l'appel
        let agentIdentity = ""
        const { data: agents } = await supabaseAdmin.from("agents").select("user_id")
            .eq("organization_id", orgId).eq("status", "ONLINE").limit(1)
        if (agents?.length) {
            agentIdentity = agents[0].user_id
            // Marquer l'agent comme BUSY
            await supabaseAdmin.from("agents").update({ status: "BUSY" }).eq("user_id", agentIdentity)
        }

        if (agentIdentity) {
            res.set("Content-Type", "text/xml")
            res.send(twilioService.generateIncomingTwiML({ agentIdentity }))
        } else {
            // Aucun agent dispo → voicemail
            const vmUrl = BACKEND() + "/api/v1/telephony/webhook/voicemail?orgId=" + orgId
            res.set("Content-Type", "text/xml")
            res.send(`<?xml version="1.0"?><Response>
                <Say language="fr-CA">Tous nos agents sont occupes. Laissez un message apres le signal.</Say>
                <Record maxLength="120" playBeep="true" recordingStatusCallback="${vmUrl}"/>
            </Response>`)
        }
    } catch (err: any) {
        console.error("[webhook/voice]", err.message)
        res.set("Content-Type", "text/xml")
        res.send(`<?xml version="1.0"?><Response><Say language="fr-CA">Erreur. Rappelez plus tard.</Say></Response>`)
    }
})

router.post("/webhook/status", async (req: Request, res: Response) => {
    try {
        const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body
        if (!CallSid) return res.json({ ok: true })

        const statusMap: Record<string, string> = {
            "queued": "RINGING", "ringing": "RINGING", "in-progress": "IN_PROGRESS",
            "completed": "COMPLETED", "busy": "BUSY", "failed": "FAILED",
            "no-answer": "NO_ANSWER", "canceled": "CANCELLED",
        }
        const update: any = { status: statusMap[CallStatus] || CallStatus.toUpperCase() }
        if (CallDuration) update.duration = parseInt(CallDuration)
        if (RecordingUrl) update.recording_url = RecordingUrl + ".mp3"
        if (["completed", "failed", "busy", "no-answer", "canceled"].includes(CallStatus)) {
            update.ended_at = new Date().toISOString()
        }
        await supabaseAdmin.from("calls").update(update).eq("twilio_sid", CallSid)

        if (["completed", "failed", "busy", "no-answer", "canceled"].includes(CallStatus)) {
            const { data: call } = await supabaseAdmin.from("calls")
                .select("id, agent_id, from_number, to_number, direction, contact_id, organization_id")
                .eq("twilio_sid", CallSid).single()

            if ((call as any)?.agent_id) {
                await supabaseAdmin.from("agents").update({ status: "ONLINE" }).eq("user_id", (call as any).agent_id)
            }

            // Auto-link contact
            if (call && !(call as any).contact_id) {
                const extPhone = (call as any).direction === "INBOUND" ? (call as any).from_number : (call as any).to_number
                const orgId = (call as any).organization_id
                if (extPhone && orgId) {
                    try {
                        const clean = extPhone.replace(/\D/g, "")
                        if (clean.length >= 7) {
                            const { data: existing } = await supabaseAdmin.from("contacts").select("id")
                                .eq("organization_id", orgId)
                                .or(`phone.ilike.%${clean.slice(-10)}%,phone.eq.${extPhone}`).limit(1)
                            if (existing?.length) {
                                await supabaseAdmin.from("calls").update({ contact_id: (existing[0] as any).id }).eq("twilio_sid", CallSid)
                            } else {
                                const countryCode = detectCountry(extPhone)
                                const area = clean.startsWith("1") ? clean.substring(1, 4) : clean.substring(0, 3)
                                const NA: Record<string, { city: string; province: string; country: string }> = {
                                    "514": { city: "Montréal", province: "QC", country: "Canada" }, "438": { city: "Montréal", province: "QC", country: "Canada" },
                                    "450": { city: "Rive-Sud", province: "QC", country: "Canada" }, "418": { city: "Québec", province: "QC", country: "Canada" },
                                    "819": { city: "Outaouais", province: "QC", country: "Canada" }, "416": { city: "Toronto", province: "ON", country: "Canada" },
                                    "647": { city: "Toronto", province: "ON", country: "Canada" }, "613": { city: "Ottawa", province: "ON", country: "Canada" },
                                    "604": { city: "Vancouver", province: "BC", country: "Canada" }, "403": { city: "Calgary", province: "AB", country: "Canada" },
                                    "212": { city: "New York", province: "NY", country: "États-Unis" }, "213": { city: "Los Angeles", province: "CA", country: "États-Unis" },
                                    "312": { city: "Chicago", province: "IL", country: "États-Unis" }, "305": { city: "Miami", province: "FL", country: "États-Unis" },
                                    "713": { city: "Houston", province: "TX", country: "États-Unis" }, "404": { city: "Atlanta", province: "GA", country: "États-Unis" },
                                }
                                const region = NA[area] || { city: null, province: null, country: REGION_NAMES[countryCode] || "Inconnu" }
                                // Formater le numero proprement comme nom
                                const fmtPhone = extPhone.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4')
                                const { data: newC } = await supabaseAdmin.from("contacts").insert({
                                    organization_id: orgId,
                                    first_name: "",
                                    last_name: fmtPhone || extPhone,
                                    phone: extPhone,
                                    city: (region as any).city || null,
                                    province: (region as any).province || null,
                                    country: (region as any).country || "Canada",
                                    status: "lead",
                                }).select("id").single()
                                if (newC) await supabaseAdmin.from("calls").update({ contact_id: (newC as any).id }).eq("twilio_sid", CallSid)
                            }
                        }
                    } catch (e: any) { console.error("[AutoLink]", e.message) }
                }
            }
        }

        if (RecordingUrl) {
            const { data: call } = await supabaseAdmin.from("calls").select("id").eq("twilio_sid", CallSid).single()
            if (call) twilioService.transcribeAudio(RecordingUrl + ".mp3", (call as any).id).catch(() => { })
        }

        res.json({ ok: true })
    } catch { res.json({ ok: true }) }
})

router.post("/webhook/voicemail", async (req: Request, res: Response) => {
    try {
        const { CallSid, RecordingUrl, From, To } = req.body
        const orgId = String(req.query.orgId || "org_test_001")
        if (orgId) {
            const contact = await findContactByPhone(From, orgId)
            await supabaseAdmin.from("voicemails").insert({
                organization_id: orgId, twilio_sid: CallSid, from_number: From, to_number: To,
                recording_url: RecordingUrl + ".mp3", contact_id: contact?.id || null,
                status: "NEW", created_at: new Date().toISOString(),
            })
            if (RecordingUrl) twilioService.transcribeAudio(RecordingUrl + ".mp3", "vm-" + CallSid).catch(() => { })
        }
        res.set("Content-Type", "text/xml")
        res.send(`<?xml version="1.0"?><Response></Response>`)
    } catch {
        res.set("Content-Type", "text/xml")
        res.send(`<?xml version="1.0"?><Response></Response>`)
    }
})

router.get("/twiml/hold-music", (_req: Request, res: Response) => {
    res.set("Content-Type", "text/xml")
    res.send(`<?xml version="1.0"?><Response><Play loop="0">http://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.mp3</Play></Response>`)
})

router.get("/twiml/conference/:name", (req: Request, res: Response) => {
    const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name
    const isSup = req.query.supervisor === "true"
    res.set("Content-Type", "text/xml")
    res.send(twilioService.generateConferenceTwiML(name, isSup))
})

router.get("/twiml/voicemail", (req: Request, res: Response) => {
    res.set("Content-Type", "text/xml")
    res.send(twilioService.generateVoicemailTwiML(String(req.query.orgId || "org_test_001")))
})

// ── TwiML IVR (menu interactif) ──────────────────────────────
// GET /twiml/ivr/:id — racine du menu IVR
// Si flow_json existe (react-flow builder), compile le flow en TwiML.
// Sinon fallback sur l'ancien format nodes (twilioService.generateIvrTwiML).
import { compileFlowToTwiML } from "../../services/ivr/ivr-compiler"

router.get("/twiml/ivr/:id", async (req: Request, res: Response) => {
    try {
        const ivrId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
        const orgId = String(req.query.orgId || "")

        const { data: ivr } = await supabaseAdmin
            .from("ivr_configs")
            .select("id, name, welcome_message, timeout, max_retries, nodes, flow_json")
            .eq("id", ivrId)
            .maybeSingle()

        res.set("Content-Type", "text/xml")
        if (!ivr) {
            res.send(twilioService.generateVoicemailTwiML(orgId))
            return
        }

        // Priorite au flow_json (react-flow builder) si present
        if (ivr.flow_json && typeof ivr.flow_json === 'object' && (ivr.flow_json as any).nodes?.length) {
            res.send(compileFlowToTwiML(ivr.flow_json as any, { orgId, ivrId }))
            return
        }

        // Fallback ancien format
        res.send(twilioService.generateIvrTwiML(ivr, orgId))
    } catch (err: any) {
        res.set("Content-Type", "text/xml")
        res.send(`<?xml version="1.0"?><Response><Say language="fr-CA" voice="alice">Une erreur est survenue. Au revoir.</Say><Hangup/></Response>`)
    }
})

// POST /twiml/ivr/:id/gather — callback après saisie DTMF utilisateur
router.post("/twiml/ivr/:id/gather", async (req: Request, res: Response) => {
    try {
        const ivrId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
        const orgId = String(req.query.orgId || "")
        const digit = String(req.body?.Digits || req.query?.Digits || "")

        const { data: ivr } = await supabaseAdmin
            .from("ivr_configs")
            .select("id, name, welcome_message, timeout, max_retries, nodes")
            .eq("id", ivrId)
            .maybeSingle()

        res.set("Content-Type", "text/xml")
        if (!ivr) {
            res.send(`<?xml version="1.0"?><Response><Hangup/></Response>`)
            return
        }
        res.send(twilioService.generateIvrActionTwiML(ivr, digit, orgId))
    } catch (err: any) {
        res.set("Content-Type", "text/xml")
        res.send(`<?xml version="1.0"?><Response><Hangup/></Response>`)
    }
})

// GET /twiml/queue/:id — enqueue un appel dans une file d'attente ACD
router.get("/twiml/queue/:id", async (req: Request, res: Response) => {
    try {
        const queueId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
        const orgId   = String(req.query.orgId || "")

        const { data: queue } = await supabaseAdmin
            .from("queues")
            .select("id, name, welcome_message, music_on_hold")
            .eq("id", queueId)
            .maybeSingle()

        res.set("Content-Type", "text/xml")
        if (!queue) {
            // Fallback si queue inexistante — voicemail générique
            res.send(twilioService.generateVoicemailTwiML(orgId))
            return
        }
        res.send(twilioService.generateQueueTwiML(queue, orgId))
    } catch (err: any) {
        res.set("Content-Type", "text/xml")
        res.send(`<?xml version="1.0"?><Response><Say language="fr-CA" voice="alice">File d'attente indisponible. Au revoir.</Say><Hangup/></Response>`)
    }
})

// ════════════════════════════════════════════════════════════
//  NUMEROS BLOQUES
// ════════════════════════════════════════════════════════════
router.get("/blocked-numbers", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { data } = await supabaseAdmin
            .from("blocked_numbers")
            .select("id, phone, reason, created_at, created_by")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
        sendSuccess(res, data || [])
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/blocked-numbers", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { phone, reason } = req.body
        if (!phone) return sendError(res, "Numéro requis", 400)
        const { data, error } = await supabaseAdmin.from("blocked_numbers").insert({
            organization_id: orgId,
            phone: phone.trim(),
            reason: reason || null,
            created_by: req.user!.userId,
        }).select().single()
        if (error) return sendError(res, error.message)
        sendSuccess(res, data, 201)
    } catch (err: any) { sendError(res, err.message) }
})

router.delete("/blocked-numbers/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { error } = await supabaseAdmin
            .from("blocked_numbers")
            .delete()
            .eq("id", req.params.id)
            .eq("organization_id", orgId)
        if (error) return sendError(res, error.message)
        sendSuccess(res, { deleted: true })
    } catch (err: any) { sendError(res, err.message) }
})

router.use('/', voiceRoutes)
export default router