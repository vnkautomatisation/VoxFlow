import { Router, Response } from "express"
import { authenticate, AuthRequest } from "../../middleware/auth"
import { supabaseAdmin } from "../../config/supabase"
import { sendSuccess, sendError } from "../../utils/response"

const router = Router()
// Source de vérité: JWT décodé uniquement. Pas de fallback query —
// empêche un attaquant de passer ?orgId=OTHER_ORG.
const getOrgId = (req: AuthRequest) => String(req.user?.organizationId || "")

// ── Indicatifs régionaux Canada/USA ───────────────────────────
// ── Indicatifs pays ───────────────────────────────────────────
const COUNTRY_CODES: Record<string, string> = {
    "1": "Canada/États-Unis", "33": "France", "44": "Royaume-Uni",
    "32": "Belgique", "41": "Suisse", "352": "Luxembourg", "49": "Allemagne",
    "34": "Espagne", "39": "Italie", "351": "Portugal", "31": "Pays-Bas",
    "43": "Autriche", "353": "Irlande", "48": "Pologne", "46": "Suède",
    "47": "Norvège", "45": "Danemark", "358": "Finlande", "40": "Roumanie",
    "36": "Hongrie", "420": "Tchéquie", "421": "Slovaquie", "385": "Croatie",
    "30": "Grèce", "52": "Mexique", "212": "Maroc", "213": "Algérie",
    "216": "Tunisie", "221": "Sénégal", "225": "Côte d'Ivoire", "237": "Cameroun",
    "243": "RD Congo", "234": "Nigeria", "254": "Kenya", "27": "Afrique du Sud",
    "55": "Brésil", "54": "Argentine", "56": "Chili", "57": "Colombie",
    "51": "Pérou", "81": "Japon", "82": "Corée du Sud", "86": "Chine",
    "91": "Inde", "61": "Australie", "64": "Nouvelle-Zélande", "7": "Russie",
    "380": "Ukraine", "971": "Émirats arabes", "966": "Arabie Saoudite",
    "972": "Israël", "90": "Turquie",
} as any

// ── Indicatifs régionaux Amérique du Nord (+1) ────────────────
const NA_REGIONS: Record<string, { city: string; province: string; countryCode: string }> = {
    "514": { city: "Montréal", province: "QC", countryCode: "CA" },
    "438": { city: "Montréal", province: "QC", countryCode: "CA" },
    "450": { city: "Rive-Sud MTL", province: "QC", countryCode: "CA" },
    "579": { city: "Rive-Sud MTL", province: "QC", countryCode: "CA" },
    "418": { city: "Québec", province: "QC", countryCode: "CA" },
    "581": { city: "Québec", province: "QC", countryCode: "CA" },
    "819": { city: "Outaouais", province: "QC", countryCode: "CA" },
    "873": { city: "Outaouais", province: "QC", countryCode: "CA" },
    "367": { city: "Québec", province: "QC", countryCode: "CA" },
    "416": { city: "Toronto", province: "ON", countryCode: "CA" },
    "647": { city: "Toronto", province: "ON", countryCode: "CA" },
    "437": { city: "Toronto", province: "ON", countryCode: "CA" },
    "905": { city: "Grand Toronto", province: "ON", countryCode: "CA" },
    "289": { city: "Grand Toronto", province: "ON", countryCode: "CA" },
    "365": { city: "Grand Toronto", province: "ON", countryCode: "CA" },
    "613": { city: "Ottawa", province: "ON", countryCode: "CA" },
    "343": { city: "Ottawa", province: "ON", countryCode: "CA" },
    "519": { city: "Windsor", province: "ON", countryCode: "CA" },
    "226": { city: "London", province: "ON", countryCode: "CA" },
    "548": { city: "Kitchener", province: "ON", countryCode: "CA" },
    "705": { city: "Sudbury", province: "ON", countryCode: "CA" },
    "807": { city: "Thunder Bay", province: "ON", countryCode: "CA" },
    "604": { city: "Vancouver", province: "BC", countryCode: "CA" },
    "778": { city: "Vancouver", province: "BC", countryCode: "CA" },
    "236": { city: "Vancouver", province: "BC", countryCode: "CA" },
    "250": { city: "C.-Brit.", province: "BC", countryCode: "CA" },
    "403": { city: "Calgary", province: "AB", countryCode: "CA" },
    "587": { city: "Alberta", province: "AB", countryCode: "CA" },
    "780": { city: "Edmonton", province: "AB", countryCode: "CA" },
    "825": { city: "Alberta", province: "AB", countryCode: "CA" },
    "902": { city: "Maritimes", province: "NS", countryCode: "CA" },
    "782": { city: "Maritimes", province: "NS", countryCode: "CA" },
    "506": { city: "N.-Brunswick", province: "NB", countryCode: "CA" },
    "204": { city: "Winnipeg", province: "MB", countryCode: "CA" },
    "431": { city: "Manitoba", province: "MB", countryCode: "CA" },
    "306": { city: "Saskatchewan", province: "SK", countryCode: "CA" },
    "639": { city: "Saskatchewan", province: "SK", countryCode: "CA" },
    "709": { city: "Terre-Neuve", province: "NL", countryCode: "CA" },
    "867": { city: "Territoires", province: "YT", countryCode: "CA" },
    "212": { city: "New York", province: "NY", countryCode: "US" },
    "917": { city: "New York", province: "NY", countryCode: "US" },
    "646": { city: "New York", province: "NY", countryCode: "US" },
    "332": { city: "New York", province: "NY", countryCode: "US" },
    "718": { city: "Brooklyn", province: "NY", countryCode: "US" },
    "213": { city: "Los Angeles", province: "CA", countryCode: "US" },
    "323": { city: "Los Angeles", province: "CA", countryCode: "US" },
    "818": { city: "Los Angeles", province: "CA", countryCode: "US" },
    "310": { city: "Santa Monica", province: "CA", countryCode: "US" },
    "415": { city: "San Francisco", province: "CA", countryCode: "US" },
    "408": { city: "San Jose", province: "CA", countryCode: "US" },
    "619": { city: "San Diego", province: "CA", countryCode: "US" },
    "312": { city: "Chicago", province: "IL", countryCode: "US" },
    "773": { city: "Chicago", province: "IL", countryCode: "US" },
    "617": { city: "Boston", province: "MA", countryCode: "US" },
    "305": { city: "Miami", province: "FL", countryCode: "US" },
    "786": { city: "Miami", province: "FL", countryCode: "US" },
    "407": { city: "Orlando", province: "FL", countryCode: "US" },
    "813": { city: "Tampa", province: "FL", countryCode: "US" },
    "206": { city: "Seattle", province: "WA", countryCode: "US" },
    "713": { city: "Houston", province: "TX", countryCode: "US" },
    "214": { city: "Dallas", province: "TX", countryCode: "US" },
    "512": { city: "Austin", province: "TX", countryCode: "US" },
    "210": { city: "San Antonio", province: "TX", countryCode: "US" },
    "404": { city: "Atlanta", province: "GA", countryCode: "US" },
    "202": { city: "Washington DC", province: "DC", countryCode: "US" },
    "702": { city: "Las Vegas", province: "NV", countryCode: "US" },
    "602": { city: "Phoenix", province: "AZ", countryCode: "US" },
    "303": { city: "Denver", province: "CO", countryCode: "US" },
    "215": { city: "Philadelphia", province: "PA", countryCode: "US" },
    "216": { city: "Cleveland", province: "OH", countryCode: "US" },
    "313": { city: "Detroit", province: "MI", countryCode: "US" },
    "612": { city: "Minneapolis", province: "MN", countryCode: "US" },
    "503": { city: "Portland", province: "OR", countryCode: "US" },
    "704": { city: "Charlotte", province: "NC", countryCode: "US" },
    "615": { city: "Nashville", province: "TN", countryCode: "US" },
    "502": { city: "Louisville", province: "KY", countryCode: "US" },
    "317": { city: "Indianapolis", province: "IN", countryCode: "US" },
    "314": { city: "St. Louis", province: "MO", countryCode: "US" },
    "504": { city: "La Nouvelle-Orléans", province: "LA", countryCode: "US" },
    "801": { city: "Salt Lake City", province: "UT", countryCode: "US" },
    "808": { city: "Honolulu", province: "HI", countryCode: "US" },
    "907": { city: "Anchorage", province: "AK", countryCode: "US" },
}

function getRegion(phone: string): { city?: string; province?: string; country?: string } {
    if (!phone) return {}
    const d = phone.replace(/\D/g, "")
    if (d.length < 7) return {}

    // Amérique du Nord (+1)
    let naDigits = ""
    if (d.startsWith("1") && d.length >= 11) naDigits = d.substring(1)
    else if (d.length === 10) naDigits = d

    if (naDigits.length >= 10) {
        const area = naDigits.substring(0, 3)
        const reg = NA_REGIONS[area]
        if (reg) {
            return { city: reg.city, province: reg.province, country: reg.countryCode === "CA" ? "Canada" : "États-Unis" }
        }
        return { country: "Canada" }
    }

    // International — essayer indicatifs de 3 à 1 chiffres
    const ccEntries = Object.entries(COUNTRY_CODES).sort((a, b) => b[0].length - a[0].length)
    for (const [cc, country] of ccEntries) {
        if (d.startsWith(cc)) {
            return { country: country as string }
        }
    }

    return {}
}

function parseName(raw: string): { first_name: string; last_name: string } {
    const parts = raw.trim().split(/\s+/)
    if (parts.length === 1) return { first_name: "", last_name: raw }
    // Format téléphonie souvent NOM PRENOM (majuscules)
    const isAllCaps = raw === raw.toUpperCase()
    if (isAllCaps && parts.length >= 2) {
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
        return { last_name: cap(parts[0]), first_name: parts.slice(1).map(cap).join(" ") }
    }
    return { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] }
}

// ════════════════════════════════════════════════════════════
//  CONTACTS — CRUD
// ════════════════════════════════════════════════════════════
router.get("/contacts", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const limit = parseInt(String(req.query.limit || "100"))
        const offset = parseInt(String(req.query.offset || "0"))
        const status = req.query.status as string | undefined

        // Essayer avec tags d'abord, fallback sans si table manquante
        let contacts: any[] = []
        try {
            let q = supabaseAdmin
                .from("contacts")
                .select(`
          id, first_name, last_name, email, phone, company, position, status,
          address, city, province, postal_code, country,
          notes, created_at, last_called_at, call_count,
          tags:contact_tags(tag:tags(id, name, color))
        `)
                .eq("organization_id", orgId)
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1)

            if (status) q = q.eq("status", status)
            const { data, error } = await q
            if (error) throw error

            contacts = (data || []).map((c: any) => ({
                ...c,
                tags: c.tags?.map((t: any) => t.tag).filter(Boolean) || [],
            }))
        } catch {
            // Fallback sans tags
            let q2 = supabaseAdmin
                .from("contacts")
                .select("id, first_name, last_name, email, phone, company, position, status, address, city, province, postal_code, country, notes, created_at, last_called_at, call_count")
                .eq("organization_id", orgId)
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1)

            if (status) q2 = q2.eq("status", status)
            const { data: data2 } = await q2
            contacts = (data2 || []).map((c: any) => ({ ...c, tags: [] }))
        }

        sendSuccess(res, contacts)
    } catch (err: any) { sendError(res, err.message) }
})

router.get("/contacts/search", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const q = String(req.query.q || "").trim()
        if (!q) return sendSuccess(res, [])

        const { data } = await supabaseAdmin
            .from("contacts")
            .select("id, first_name, last_name, email, phone, company, city, province")
            .eq("organization_id", orgId)
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
            .limit(20)

        sendSuccess(res, data || [])
    } catch (err: any) { sendError(res, err.message) }
})

router.get("/contacts/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        // Org scoping CRITIQUE : sans .eq("organization_id", orgId) un user
        // d'une org A pourrait lire les contacts d'une org B juste en
        // connaissant l'UUID. Ajoute en P0 security fix.
        let contact: any = null
        try {
            const { data } = await supabaseAdmin
                .from("contacts").select(`*, tags:contact_tags(tag:tags(id,name,color))`)
                .eq("id", req.params.id)
                .eq("organization_id", orgId)
                .single()
            if (!data) return sendError(res, "Contact introuvable", 404)
            contact = { ...data, tags: (data as any).tags?.map((t: any) => t.tag).filter(Boolean) || [] }
        } catch {
            const { data } = await supabaseAdmin
                .from("contacts").select("*")
                .eq("id", req.params.id)
                .eq("organization_id", orgId)
                .single()
            if (!data) return sendError(res, "Contact introuvable", 404)
            contact = { ...data, tags: [] }
        }
        sendSuccess(res, contact)
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/contacts", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { first_name, last_name, email, phone, company, position,
            address, city, province, postal_code, country, notes, status, tags, custom_fields } = req.body

        if (!first_name && !last_name && !phone) return sendError(res, "Nom ou telephone requis", 400)

        // Auto-enrichir la région si phone fourni mais pas city/province
        const region = (phone && !city) ? getRegion(phone) : {}

        const { data, error } = await supabaseAdmin
            .from("contacts")
            .insert({
                organization_id: orgId,
                first_name: first_name || "",
                last_name: last_name || "",
                email: email || null,
                phone: phone || null,
                company: company || null,
                position: position || null,
                address: address || null,
                city: city || region.city || null,
                province: province || region.province || null,
                postal_code: postal_code || null,
                country: country || region.country || "Canada",
                notes: notes || null,
                status: status || "lead",
                custom_fields: custom_fields || {},
            })
            .select()
            .single()

        if (error) throw error

        // Assigner les tags si fournis
        if (tags && tags.length > 0 && data) {
            await supabaseAdmin.from("contact_tags").insert(
                tags.map((tagId: string) => ({ contact_id: (data as any).id, tag_id: tagId }))
            )
        }

        sendSuccess(res, data, 201)
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/contacts/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const updates: any = {}
        const fields = ["first_name", "last_name", "email", "phone", "company", "position",
            "address", "city", "province", "postal_code", "country", "notes", "status", "custom_fields"]
        fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })
        updates.updated_at = new Date().toISOString()

        // Org scoping CRITIQUE : le .eq("organization_id", orgId) empeche un
        // user d'une autre org de modifier ce contact meme avec l'UUID.
        const { data, error } = await supabaseAdmin
            .from("contacts").update(updates)
            .eq("id", req.params.id)
            .eq("organization_id", orgId)
            .select().single()
        if (error) throw error
        if (!data) return sendError(res, "Contact introuvable", 404)
        sendSuccess(res, data)
    } catch (err: any) { sendError(res, err.message) }
})

router.delete("/contacts/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        // Verifie l'ownership AVANT de supprimer les tags puis le contact.
        const { data: contact } = await supabaseAdmin
            .from("contacts").select("id")
            .eq("id", req.params.id)
            .eq("organization_id", orgId)
            .single()
        if (!contact) return sendError(res, "Contact introuvable", 404)

        await supabaseAdmin.from("contact_tags").delete().eq("contact_id", req.params.id)
        await supabaseAdmin.from("contacts").delete()
            .eq("id", req.params.id)
            .eq("organization_id", orgId)
        sendSuccess(res, { deleted: true })
    } catch (err: any) { sendError(res, err.message) }
})

// Historique appels d'un contact
router.get("/contacts/:id/calls", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { data } = await supabaseAdmin
            .from("calls")
            .select("id, direction, status, duration, started_at, ended_at, from_number, to_number")
            .eq("contact_id", req.params.id)
            .order("started_at", { ascending: false })
            .limit(20)
        sendSuccess(res, data || [])
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  TAGS
// ════════════════════════════════════════════════════════════
router.get("/tags", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        try {
            const { data } = await supabaseAdmin
                .from("tags").select("id, name, color")
                .eq("organization_id", getOrgId(req)).order("name")
            sendSuccess(res, data || [])
        } catch {
            sendSuccess(res, [])
        }
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/tags", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { data } = await supabaseAdmin.from("tags").insert({
            organization_id: getOrgId(req),
            name: req.body.name,
            color: req.body.color || "#7b61ff",
        }).select().single()
        sendSuccess(res, data, 201)
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  ENRICHISSEMENT AUTOMATIQUE
// ════════════════════════════════════════════════════════════

// GET /crm/enrich?phone=+15141234567
// Retourne les infos disponibles : DB locale + région + Twilio Lookup
router.get("/enrich", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const phone = String(req.query.phone || "").trim()
        const orgId = getOrgId(req)
        if (!phone) return sendError(res, "phone requis", 400)

        const clean = phone.replace(/\D/g, "")
        const region = getRegion(phone)

        // 1. Chercher dans la DB locale
        const { data: existing } = await supabaseAdmin
            .from("contacts")
            .select("id, first_name, last_name, company, phone, email, address, city, province, postal_code, country, tags:contact_tags(tag:tags(id,name,color))")
            .eq("organization_id", orgId)
            .or(`phone.ilike.%${clean.slice(-10)}%,phone.eq.${phone}`)
            .limit(1)

        if (existing && existing.length > 0) {
            const c = existing[0] as any
            return sendSuccess(res, {
                found: true,
                source: "database",
                contact: { ...c, tags: c.tags?.map((t: any) => t.tag).filter(Boolean) || [] },
                region,
            })
        }

        // 2. Twilio Lookup — nom de l'abonné
        let callerName: string | null = null
        let lineType: string | null = null

        try {
            const twilio = (await import("twilio")).default
            const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
            const lookup = await (client.lookups.v2.phoneNumbers(phone) as any)
                .fetch({ fields: ["caller_name", "line_type_intelligence"] })
            callerName = lookup?.callerName?.callerName || null
            lineType = lookup?.lineTypeIntelligence?.type || null
        } catch {
            // Twilio Lookup optionnel
        }

        const parsed = callerName ? parseName(callerName) : { first_name: "", last_name: "" }

        sendSuccess(res, {
            found: false,
            source: callerName ? "twilio_lookup" : "region_only",
            callerName,
            lineType,
            region,
            suggestion: {
                first_name: parsed.first_name,
                last_name: parsed.last_name || phone,
                phone,
                city: region.city || "",
                province: region.province || "",
                country: region.country || "Canada",
            },
        })
    } catch (err: any) { sendError(res, err.message) }
})

// POST /crm/enrich/save
// Crée ou met à jour un contact automatiquement (appelé après chaque appel)
router.post("/enrich/save", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { phone, callId, first_name, last_name, callerName, city, province, country } = req.body
        const orgId = getOrgId(req)
        if (!phone) return sendError(res, "phone requis", 400)

        const clean = phone.replace(/\D/g, "")
        const region = getRegion(phone)

        // Chercher si le contact existe
        const { data: existing } = await supabaseAdmin
            .from("contacts")
            .select("id, city, province, country")
            .eq("organization_id", orgId)
            .or(`phone.ilike.%${clean.slice(-10)}%,phone.eq.${phone}`)
            .limit(1)

        if (existing && existing.length > 0) {
            const c = existing[0] as any
            // Enrichir les champs manquants seulement
            const updates: any = {}
            if (!c.city && (city || region.city)) updates.city = city || region.city
            if (!c.province && (province || region.province)) updates.province = province || region.province
            if (!c.country && (country || region.country)) updates.country = country || region.country

            if (Object.keys(updates).length > 0) {
                await supabaseAdmin.from("contacts").update(updates).eq("id", c.id)
            }
            if (callId) {
                await supabaseAdmin.from("calls").update({ contact_id: c.id }).eq("id", callId)
            }
            // Incrémenter call_count et last_called_at
            try { await supabaseAdmin.rpc("increment_call_count", { contact_id: c.id }) } catch { }

            return sendSuccess(res, { action: "linked", contactId: c.id })
        }

        // Créer automatiquement un nouveau contact
        const parsed = callerName ? parseName(callerName) : { first_name: "", last_name: "" }
        const finalFirst = first_name || parsed.first_name || ""
        const finalLast = last_name || parsed.last_name || phone

        const { data: newContact } = await supabaseAdmin
            .from("contacts")
            .insert({
                organization_id: orgId,
                first_name: finalFirst,
                last_name: finalLast,
                phone,
                city: city || region.city || null,
                province: province || region.province || null,
                country: country || region.country || "Canada",
                status: "lead",
            })
            .select()
            .single()

        if (callId && newContact) {
            await supabaseAdmin.from("calls")
                .update({ contact_id: (newContact as any).id })
                .eq("id", callId)
        }

        sendSuccess(res, { action: "created", contact: newContact }, 201)
    } catch (err: any) { sendError(res, err.message) }
})

// GET /crm/lookup?phone=
router.get("/lookup", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const phone = String(req.query.phone || "").trim()
        const orgId = getOrgId(req)
        if (!phone) return sendError(res, "phone requis", 400)
        const clean = phone.replace(/\D/g, "")
        const { data } = await supabaseAdmin
            .from("contacts")
            .select("id, first_name, last_name, company, phone, email, city, province, country, tags:contact_tags(tag:tags(id,name,color))")
            .eq("organization_id", orgId)
            .or(`phone.ilike.%${clean.slice(-10)}%,phone.eq.${phone}`)
            .limit(1)
        const c = data?.[0] as any
        sendSuccess(res, {
            contact: c ? { ...c, tags: c.tags?.map((t: any) => t.tag).filter(Boolean) || [] } : null,
            region: getRegion(phone),
        })
    } catch (err: any) { sendError(res, err.message) }
})

// Stats CRM
router.get("/stats", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { data: contacts } = await supabaseAdmin
            .from("contacts")
            .select("id, status, city, province, created_at, call_count, phone, email")
            .eq("organization_id", orgId)

        const all = contacts || []
        sendSuccess(res, {
            total: all.length,
            byStatus: Object.fromEntries(
                ["lead", "contacted", "qualified", "proposal", "won", "lost"].map(s => [s, all.filter(c => c.status === s).length])
            ),
            withPhone: all.filter(c => c.phone).length,
            withEmail: all.filter(c => c.email).length,
            called: all.filter(c => c.call_count && c.call_count > 0).length,
            topCities: Object.entries(
                all.reduce((acc: any, c: any) => { if (c.city) { acc[c.city] = (acc[c.city] || 0) + 1 }; return acc }, {})
            ).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5),
        })
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  CALENDRIER (appointments — migration 038)
// ════════════════════════════════════════════════════════════

router.get("/appointments", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { start, end } = req.query as { start?: string; end?: string }
        let query = supabaseAdmin.from("appointments")
            .select("id, title, description, starts_at, ends_at, status, location, contact_id, agent_id, reminder_minutes")
            .eq("organization_id", orgId)
            .order("starts_at")
        if (start) query = query.gte("starts_at", start)
        if (end)   query = query.lte("starts_at", end)
        const { data, error } = await query
        if (error) throw error
        sendSuccess(res, data || [])
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/appointments", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { title, description, starts_at, ends_at, contact_id, agent_id, location, reminder_minutes, status, type, notes } = req.body
        if (!title || !starts_at || !ends_at) return sendError(res, "Titre et dates requis", 400)
        const { data, error } = await supabaseAdmin.from("appointments").insert({
            organization_id: orgId, title, description, starts_at, ends_at, status: status || 'SCHEDULED',
            contact_id: contact_id || null, agent_id: agent_id || req.user?.userId || null,
            location: location || null, reminder_minutes: reminder_minutes ?? 15,
            type: type || 'CALL', notes: notes || null,
        }).select().single()
        if (error) throw error
        sendSuccess(res, data, 201)
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/appointments/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const fields = ["title","description","starts_at","ends_at","status","location","contact_id","agent_id","reminder_minutes","type","notes"]
        const updates: any = {}
        fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })
        const { data, error } = await supabaseAdmin.from("appointments")
            .update(updates).eq("id", req.params.id).eq("organization_id", orgId).select().single()
        if (error) throw error
        sendSuccess(res, data)
    } catch (err: any) { sendError(res, err.message) }
})

router.delete("/appointments/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        await supabaseAdmin.from("appointments").delete().eq("id", req.params.id).eq("organization_id", orgId)
        sendSuccess(res, { deleted: true })
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  DEVIS / QUOTES (migration 038)
// ════════════════════════════════════════════════════════════

router.get("/quotes", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin.from("quotes")
            .select("*").eq("organization_id", getOrgId(req)).order("created_at", { ascending: false })
        if (error) throw error
        sendSuccess(res, data || [])
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/quotes", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { contact_id, items, notes, valid_until, tax_rate } = req.body
        const parsedItems = Array.isArray(items) ? items : []
        const subtotal = parsedItems.reduce((s: number, i: any) => s + (Number(i.qty || 1) * Number(i.unit_price || 0)), 0)
        const rate = Number(tax_rate) || 14.975
        const tax = Math.round(subtotal * rate) / 100
        const total = subtotal + tax
        // Auto-generate number
        const { count } = await supabaseAdmin.from("quotes").select("id", { count: "exact" }).eq("organization_id", orgId)
        const num = `DEV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

        const { data, error } = await supabaseAdmin.from("quotes").insert({
            organization_id: orgId, contact_id: contact_id || null, number: num,
            items: parsedItems, subtotal, tax_rate: rate, tax_amount: tax, total,
            notes: notes || null, valid_until: valid_until || null,
            created_by: req.user?.userId || null,
        }).select().single()
        if (error) throw error
        sendSuccess(res, data, 201)
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/quotes/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const updates: any = {}
        const fields = ["status","items","subtotal","tax_rate","tax_amount","total","notes","valid_until","pdf_url"]
        fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })
        const { data, error } = await supabaseAdmin.from("quotes")
            .update(updates).eq("id", req.params.id).eq("organization_id", getOrgId(req)).select().single()
        if (error) throw error
        sendSuccess(res, data)
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  EMAIL TEMPLATES (migration 038)
// ════════════════════════════════════════════════════════════

router.get("/email-templates", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin.from("email_templates")
            .select("*").eq("organization_id", getOrgId(req)).eq("is_active", true).order("name")
        if (error) throw error
        sendSuccess(res, data || [])
    } catch (err: any) { sendError(res, err.message) }
})

router.post("/email-templates", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { name, subject, body_html, variables, category } = req.body
        if (!name || !subject) return sendError(res, "Nom et sujet requis", 400)
        const { data, error } = await supabaseAdmin.from("email_templates").insert({
            organization_id: getOrgId(req), name, subject, body_html: body_html || '',
            variables: variables || [], category: category || 'general',
        }).select().single()
        if (error) throw error
        sendSuccess(res, data, 201)
    } catch (err: any) { sendError(res, err.message) }
})

router.patch("/email-templates/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const updates: any = {}
        const fields = ["name","subject","body_html","variables","category","is_active"]
        fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] })
        const { data, error } = await supabaseAdmin.from("email_templates")
            .update(updates).eq("id", req.params.id).eq("organization_id", getOrgId(req)).select().single()
        if (error) throw error
        sendSuccess(res, data)
    } catch (err: any) { sendError(res, err.message) }
})

router.delete("/email-templates/:id", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { error } = await supabaseAdmin.from("email_templates")
            .delete().eq("id", req.params.id).eq("organization_id", getOrgId(req))
        if (error) throw error
        sendSuccess(res, { deleted: true })
    } catch (err: any) { sendError(res, err.message) }
})

// ════════════════════════════════════════════════════════════
//  SEND EMAIL FROM TEMPLATE
// ════════════════════════════════════════════════════════════

router.post("/email-templates/:id/send", authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const orgId = getOrgId(req)
        const { contact_id } = req.body
        if (!contact_id) return sendError(res, "contact_id requis", 400)

        // Charger le template
        const { data: tpl, error: tplErr } = await supabaseAdmin.from("email_templates")
            .select("*").eq("id", req.params.id).eq("organization_id", orgId).single()
        if (tplErr || !tpl) return sendError(res, "Template introuvable", 404)

        // Charger le contact
        const { data: contact, error: ctErr } = await supabaseAdmin.from("contacts")
            .select("*").eq("id", contact_id).eq("organization_id", orgId).single()
        if (ctErr || !contact) return sendError(res, "Contact introuvable", 404)

        // Remplacer les variables
        const replace = (s: string) => s
            .replace(/\{\{prenom\}\}/g, contact.first_name || '')
            .replace(/\{\{nom\}\}/g, contact.last_name || '')
            .replace(/\{\{entreprise\}\}/g, contact.company || '')
            .replace(/\{\{email\}\}/g, contact.email || '')
            .replace(/\{\{telephone\}\}/g, contact.phone || '')
            .replace(/\{\{agent\}\}/g, (req.user as any)?.name || 'Agent')
            .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('fr-CA'))

        const subject = replace(tpl.subject)
        const body = replace(tpl.body_html)

        // Envoyer via le service email si configure
        try {
            const { emailService } = await import("../../services/email/email.service")
            await (emailService as any).send({ to: contact.email, subject, html: body })
        } catch {
            // Fallback : log et retour succes (pas d'email reel en dev)
        }

        // Logger l'activite
        try {
            await supabaseAdmin.from("contact_activities").insert({
                organization_id: orgId,
                contact_id,
                type: 'EMAIL',
                description: `Email envoye : ${subject}`,
                metadata: { template_id: tpl.id, template_name: tpl.name },
                created_by: req.user?.userId,
            })
        } catch {}

        sendSuccess(res, { sent: true, to: contact.email, subject })
    } catch (err: any) { sendError(res, err.message) }
})

export default router