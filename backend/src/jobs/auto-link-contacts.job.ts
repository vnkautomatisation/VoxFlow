// ═══════════════════════════════════════════════════════════
// backend/src/jobs/auto-link-contacts.job.ts
// Tourne toutes les 60 secondes — lie les appels sans contact
// ═══════════════════════════════════════════════════════════

import { supabaseAdmin } from '../config/supabase'

const AREA_CODES: Record<string, { city: string; province: string; country: string }> = {
    "514": { city: "Montreal", province: "QC", country: "Canada" },
    "438": { city: "Montreal", province: "QC", country: "Canada" },
    "450": { city: "Rive-Sud", province: "QC", country: "Canada" },
    "579": { city: "Rive-Sud", province: "QC", country: "Canada" },
    "418": { city: "Quebec", province: "QC", country: "Canada" },
    "581": { city: "Quebec", province: "QC", country: "Canada" },
    "819": { city: "Outaouais", province: "QC", country: "Canada" },
    "873": { city: "Outaouais", province: "QC", country: "Canada" },
    "367": { city: "Quebec", province: "QC", country: "Canada" },
    "416": { city: "Toronto", province: "ON", country: "Canada" },
    "647": { city: "Toronto", province: "ON", country: "Canada" },
    "437": { city: "Toronto", province: "ON", country: "Canada" },
    "905": { city: "Grand Toronto", province: "ON", country: "Canada" },
    "289": { city: "Grand Toronto", province: "ON", country: "Canada" },
    "613": { city: "Ottawa", province: "ON", country: "Canada" },
    "343": { city: "Ottawa", province: "ON", country: "Canada" },
    "604": { city: "Vancouver", province: "BC", country: "Canada" },
    "778": { city: "Vancouver", province: "BC", country: "Canada" },
    "250": { city: "C.-Brit.", province: "BC", country: "Canada" },
    "403": { city: "Calgary", province: "AB", country: "Canada" },
    "587": { city: "Alberta", province: "AB", country: "Canada" },
    "780": { city: "Edmonton", province: "AB", country: "Canada" },
    "902": { city: "Maritimes", province: "NS", country: "Canada" },
    "506": { city: "N.-Brunswick", province: "NB", country: "Canada" },
    "204": { city: "Winnipeg", province: "MB", country: "Canada" },
    "306": { city: "Saskatchewan", province: "SK", country: "Canada" },
    "212": { city: "New York", province: "NY", country: "USA" },
    "213": { city: "Los Angeles", province: "CA", country: "USA" },
    "312": { city: "Chicago", province: "IL", country: "USA" },
    "617": { city: "Boston", province: "MA", country: "USA" },
    "305": { city: "Miami", province: "FL", country: "USA" },
    "415": { city: "San Francisco", province: "CA", country: "USA" },
    "206": { city: "Seattle", province: "WA", country: "USA" },
    "713": { city: "Houston", province: "TX", country: "USA" },
    "202": { city: "Washington", province: "DC", country: "USA" },
}

function getRegion(phone: string) {
    const d = phone.replace(/\D/g, "")
    const area = d.startsWith("1") ? d.substring(1, 4) : d.substring(0, 3)
    return AREA_CODES[area] || {}
}

async function autoLinkContacts() {
    try {
        // Appels terminés sans contact dans les 24 dernières heures
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const { data: unlinked } = await supabaseAdmin
            .from("calls")
            .select("id, from_number, to_number, direction, organization_id, status")
            .is("contact_id", null)
            .in("status", ["COMPLETED", "NO_ANSWER", "BUSY", "FAILED"])
            .gte("started_at", since)
            .limit(50)

        if (!unlinked || unlinked.length === 0) return

        console.log(`[AutoLink] ${unlinked.length} appels sans contact`)

        for (const call of unlinked) {
            try {
                const c = call as any
                const orgId = c.organization_id
                if (!orgId) continue

                // Numéro externe = from pour entrant, to pour sortant
                const extPhone = c.direction === "INBOUND" ? c.from_number : c.to_number
                if (!extPhone) continue

                const clean = extPhone.replace(/\D/g, "")
                const region = getRegion(extPhone)

                // 1. Chercher dans les contacts existants
                const { data: existing } = await supabaseAdmin
                    .from("contacts")
                    .select("id, first_name, last_name")
                    .eq("organization_id", orgId)
                    .or(`phone.ilike.%${clean.slice(-10)}%,phone.eq.${extPhone}`)
                    .limit(1)

                if (existing && existing.length > 0) {
                    // Lier l'appel au contact existant
                    await supabaseAdmin
                        .from("calls")
                        .update({ contact_id: (existing[0] as any).id })
                        .eq("id", c.id)

                    console.log(`[AutoLink] Appel ${c.id.substring(0, 8)} lié à ${(existing[0] as any).first_name}`)
                    continue
                }

                // 2. Numéro inconnu — créer un contact automatiquement
                // Ne pas créer pour les numéros Twilio internes ou sans indicatif
                if (!clean || clean.length < 7) continue

                const { data: newContact } = await supabaseAdmin
                    .from("contacts")
                    .insert({
                        organization_id: orgId,
                        first_name: "Appelant",
                        last_name: extPhone,
                        phone: extPhone,
                        city: region.city || null,
                        province: region.province || null,
                        country: region.country || "Canada",
                        status: "lead",
                    })
                    .select("id, first_name, last_name")
                    .single()

                if (newContact) {
                    await supabaseAdmin
                        .from("calls")
                        .update({ contact_id: (newContact as any).id })
                        .eq("id", c.id)

                    console.log(`[AutoLink] Contact créé: ${extPhone} (${region.city || "région inconnue"})`)
                }
            } catch (e: any) {
                console.error(`[AutoLink] Erreur appel ${(call as any).id}:`, e.message)
            }
        }
    } catch (e: any) {
        console.error("[AutoLink] Erreur globale:", e.message)
    }
}

export function startAutoLinkJob() {
    console.log("[AutoLink] Job démarré — interval 60s")
    autoLinkContacts() // Lancer immédiatement au démarrage
    setInterval(autoLinkContacts, 60 * 1000)
}