import { supabaseAdmin } from "../config/supabase"

/**
 * Job — Nettoyage des appels fantomes
 * Lance toutes les heures via setInterval dans index.ts
 * Termine les appels restes en RINGING/IN_PROGRESS depuis plus de 30 minutes
 */
export async function cleanGhostCalls() {
    try {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

        const { data: ghosts, error } = await supabaseAdmin
            .from("calls")
            .select("id, status, started_at, organization_id, agent_id")
            .in("status", ["RINGING", "IN_PROGRESS", "ON_HOLD"])
            .lt("started_at", cutoff)

        if (error || !ghosts?.length) return

        console.log(`[GhostCalls] ${ghosts.length} appel(s) fantome(s) detecte(s)`)

        const now = new Date().toISOString()

        for (const call of ghosts) {
            const age = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 60000)

            await supabaseAdmin
                .from("calls")
                .update({
                    status: "COMPLETED",
                    ended_at: now,
                    duration: 0,
                    notes: `Termine automatiquement (appel fantome — ${age} min sans activite)`,
                })
                .eq("id", call.id)

            // Remettre l'agent en ONLINE si il etait marque BUSY
            if (call.agent_id) {
                await supabaseAdmin
                    .from("agents")
                    .update({ status: "ONLINE" })
                    .eq("user_id", call.agent_id)
                    .eq("status", "BUSY")
            }

            console.log(`[GhostCalls] Termine: ${call.id} (age: ${age} min, statut: ${call.status})`)
        }

        console.log(`[GhostCalls] Nettoyage termine — ${ghosts.length} appel(s) clos`)
    } catch (err: any) {
        console.error("[GhostCalls] Erreur:", err.message)
    }
}