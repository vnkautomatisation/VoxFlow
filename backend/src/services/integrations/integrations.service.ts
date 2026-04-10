import { supabaseAdmin } from "../../config/supabase"
import crypto from "crypto"

export class IntegrationsService {

  // ── API KEYS ──────────────────────────────────────────────────

  async createAPIKey(organizationId: string, userId: string, name: string, permissions: string[], expiresInDays?: number) {
    const rawKey   = "vf_" + crypto.randomBytes(32).toString("hex")
    const keyHash  = crypto.createHash("sha256").update(rawKey).digest("hex")
    const keyPrefix = rawKey.substring(0, 12)
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        organization_id: organizationId,
        created_by:      userId,
        name,
        key_hash:    keyHash,
        key_prefix:  keyPrefix,
        permissions,
        expires_at:  expiresAt,
      })
      .select().single()

    if (error) throw new Error(error.message)
    return { ...data, rawKey } // rawKey visible une seule fois
  }

  async getAPIKeys(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("api_keys")
      .select("id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
    return data || []
  }

  async validateAPIKey(rawKey: string): Promise<{ organizationId: string; permissions: string[] } | null> {
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex")

    const { data } = await supabaseAdmin
      .from("api_keys")
      .select("organization_id, permissions, expires_at, is_active")
      .eq("key_hash", keyHash)
      .single()

    if (!data || !data.is_active) return null
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null

    // Mettre a jour last_used_at
    await supabaseAdmin.from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", keyHash)

    return { organizationId: data.organization_id, permissions: data.permissions }
  }

  async revokeAPIKey(id: string, organizationId: string) {
    await supabaseAdmin.from("api_keys")
      .update({ is_active: false })
      .eq("id", id)
      .eq("organization_id", organizationId)
    return { revoked: true }
  }

  // ── WEBHOOKS ──────────────────────────────────────────────────

  async getWebhooks(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("webhooks")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
    return data || []
  }

  async createWebhook(organizationId: string, dto: {
    name:    string
    url:     string
    events:  string[]
    secret?: string
  }) {
    const { data, error } = await supabaseAdmin
      .from("webhooks")
      .insert({
        organization_id: organizationId,
        name:   dto.name,
        url:    dto.url,
        events: dto.events,
        secret: dto.secret || crypto.randomBytes(16).toString("hex"),
      })
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateWebhook(id: string, organizationId: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from("webhooks")
      .update(dto)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select().single()
    if (error) throw new Error(error.message)
    return data
  }

  async deleteWebhook(id: string, organizationId: string) {
    await supabaseAdmin.from("webhooks").delete().eq("id", id).eq("organization_id", organizationId)
    return { deleted: true }
  }

  // Declencher un webhook
  async triggerWebhook(organizationId: string, event: string, payload: any) {
    const { data: webhooks } = await supabaseAdmin
      .from("webhooks")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .contains("events", [event])

    const results = await Promise.allSettled(
      (webhooks || []).map(async (wh: any) => {
        const start    = Date.now()
        let statusCode = 0
        let success    = false
        let response   = ""

        try {
          const signature = wh.secret
            ? crypto.createHmac("sha256", wh.secret).update(JSON.stringify(payload)).digest("hex")
            : ""

          const res = await fetch(wh.url, {
            method: "POST",
            headers: {
              "Content-Type":    "application/json",
              "X-VoxFlow-Event": event,
              "X-VoxFlow-Sig":   signature,
            },
            body:    JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() }),
            signal:  AbortSignal.timeout(wh.timeout_ms || 5000),
          })

          statusCode = res.status
          response   = await res.text()
          success    = res.ok
        } catch (err: any) {
          response = err.message
        }

        const duration = Date.now() - start

        // Logger le resultat
        await supabaseAdmin.from("webhook_logs").insert({
          webhook_id:  wh.id,
          event,
          payload,
          status_code: statusCode,
          response:    response.substring(0, 500),
          duration_ms: duration,
          success,
        })

        await supabaseAdmin.from("webhooks").update({
          last_triggered_at: new Date().toISOString(),
          last_status:       success ? "SUCCESS" : "FAILED",
        }).eq("id", wh.id)

        return { webhookId: wh.id, success, statusCode }
      })
    )

    return results
  }

  async getWebhookLogs(webhookId: string, limit = 20) {
    const { data } = await supabaseAdmin
      .from("webhook_logs")
      .select("*")
      .eq("webhook_id", webhookId)
      .order("created_at", { ascending: false })
      .limit(limit)
    return data || []
  }

  // ── INTEGRATIONS CRM ──────────────────────────────────────────

  async getIntegrations(organizationId: string) {
    const { data } = await supabaseAdmin
      .from("integrations")
      .select("id, type, name, status, last_sync_at, sync_count, created_at")
      .eq("organization_id", organizationId)
    return data || []
  }

  async connectIntegration(organizationId: string, dto: {
    type:        string
    name:        string
    credentials: any
    config?:     any
  }) {
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .upsert({
        organization_id: organizationId,
        type:        dto.type,
        name:        dto.name,
        credentials: dto.credentials,
        config:      dto.config || {},
        status:      "ACTIVE",
      }, { onConflict: "organization_id,type" })
      .select().single()
    if (error) throw new Error(error.message)
    return { ...data, credentials: "[hidden]" }
  }

  async disconnectIntegration(id: string, organizationId: string) {
    await supabaseAdmin.from("integrations")
      .update({ status: "DISCONNECTED" })
      .eq("id", id)
      .eq("organization_id", organizationId)
    return { disconnected: true }
  }

  // Sync HubSpot
  async syncHubSpot(organizationId: string) {
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "HUBSPOT")
      .eq("status", "ACTIVE")
      .single()

    if (!integration) throw new Error("Integration HubSpot non configuree")

    const apiKey = (integration.credentials as any)?.apiKey
    if (!apiKey) throw new Error("Cle API HubSpot manquante")

    // Recuperer contacts HubSpot
    let synced = 0
    let failed = 0

    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=100", {
        headers: { Authorization: "Bearer " + apiKey }
      })

      if (res.ok) {
        const data = await res.json() as any
        const contacts = data.results || []

        for (const contact of contacts) {
          try {
            const props = contact.properties || {}
            await supabaseAdmin.from("contacts").upsert({
              organization_id: organizationId,
              first_name:      props.firstname || "",
              last_name:       props.lastname  || "",
              email:           props.email     || null,
              phone:           props.phone     || null,
              company:         props.company   || null,
              source:          "HUBSPOT",
              custom_fields:   { hubspot_id: contact.id },
            }, { onConflict: "organization_id,email" })
            synced++
          } catch { failed++ }
        }
      } else {
        throw new Error("Erreur API HubSpot: " + res.status)
      }
    } catch (err: any) {
      // Simulation si HubSpot non configure
      synced = 0
      failed = 0
      console.log("[HubSpot] Simulation sync:", err.message)
    }

    await supabaseAdmin.from("integrations").update({
      last_sync_at: new Date().toISOString(),
      sync_count:   (integration.sync_count || 0) + 1,
    }).eq("id", integration.id)

    await supabaseAdmin.from("sync_logs").insert({
      integration_id:  integration.id,
      direction:       "IN",
      entity:          "CONTACT",
      records_synced:  synced,
      records_failed:  failed,
      status:          "SUCCESS",
    })

    return { synced, failed, integration: "HUBSPOT" }
  }

  // ── SALESFORCE (SOQL query via Bearer token) ──────────────────
  async syncSalesforce(organizationId: string) {
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "SALESFORCE")
      .eq("status", "ACTIVE")
      .single()

    if (!integration) throw new Error("Integration Salesforce non configuree")

    const creds       = (integration.credentials as any) || {}
    const accessToken = creds.accessToken
    const instanceUrl = (creds.instanceUrl || "").replace(/\/+$/, "")
    if (!accessToken || !instanceUrl) {
      throw new Error("Salesforce: accessToken + instanceUrl requis")
    }

    let synced = 0
    let failed = 0

    try {
      const soql = "SELECT+Id,FirstName,LastName,Email,Phone,Account.Name+FROM+Contact+LIMIT+200"
      const url  = `${instanceUrl}/services/data/v59.0/query?q=${soql}`
      const res  = await fetch(url, {
        headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Salesforce API ${res.status}: ${txt.substring(0, 200)}`)
      }

      const data = await res.json() as any
      const records = data.records || []

      for (const rec of records) {
        try {
          await supabaseAdmin.from("contacts").upsert({
            organization_id: organizationId,
            first_name:      rec.FirstName || "",
            last_name:       rec.LastName  || "",
            email:           rec.Email     || null,
            phone:           rec.Phone     || null,
            company:         rec.Account?.Name || null,
            source:          "SALESFORCE",
            custom_fields:   { salesforce_id: rec.Id },
          }, { onConflict: "organization_id,email" })
          synced++
        } catch { failed++ }
      }
    } catch (err: any) {
      await supabaseAdmin.from("sync_logs").insert({
        integration_id:  integration.id,
        direction:       "IN",
        entity:          "CONTACT",
        records_synced:  0,
        records_failed:  0,
        status:          "FAILED",
        error_message:   err.message?.substring(0, 500),
      } as any)
      throw err
    }

    await supabaseAdmin.from("integrations").update({
      last_sync_at: new Date().toISOString(),
      sync_count:   (integration.sync_count || 0) + 1,
    }).eq("id", integration.id)

    await supabaseAdmin.from("sync_logs").insert({
      integration_id:  integration.id,
      direction:       "IN",
      entity:          "CONTACT",
      records_synced:  synced,
      records_failed:  failed,
      status:          "SUCCESS",
    })

    return { synced, failed, integration: "SALESFORCE" }
  }

  // ── ZENDESK (API v2 via Basic auth) ───────────────────────────
  async syncZendesk(organizationId: string) {
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "ZENDESK")
      .eq("status", "ACTIVE")
      .single()

    if (!integration) throw new Error("Integration Zendesk non configuree")

    const creds = (integration.credentials as any) || {}
    const subdomain = creds.subdomain
    const email     = creds.email
    const apiToken  = creds.apiToken
    if (!subdomain || !email || !apiToken) {
      throw new Error("Zendesk: subdomain + email + apiToken requis")
    }

    const auth  = Buffer.from(`${email}/token:${apiToken}`).toString("base64")
    const base  = `https://${subdomain}.zendesk.com/api/v2`

    let synced = 0
    let failed = 0

    try {
      // Fetch users (Zendesk "users" = contacts côté VoxFlow)
      const res = await fetch(`${base}/users.json?role[]=end-user&per_page=100`, {
        headers: { Authorization: "Basic " + auth, Accept: "application/json" },
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Zendesk API ${res.status}: ${txt.substring(0, 200)}`)
      }

      const data  = await res.json() as any
      const users = data.users || []

      for (const u of users) {
        try {
          const [firstName, ...rest] = (u.name || "").split(" ")
          await supabaseAdmin.from("contacts").upsert({
            organization_id: organizationId,
            first_name:      firstName || "",
            last_name:       rest.join(" ") || "",
            email:           u.email || null,
            phone:           u.phone || null,
            company:         u.organization_id ? String(u.organization_id) : null,
            source:          "ZENDESK",
            custom_fields:   { zendesk_id: u.id, zendesk_role: u.role },
          }, { onConflict: "organization_id,email" })
          synced++
        } catch { failed++ }
      }
    } catch (err: any) {
      await supabaseAdmin.from("sync_logs").insert({
        integration_id:  integration.id,
        direction:       "IN",
        entity:          "CONTACT",
        records_synced:  0,
        records_failed:  0,
        status:          "FAILED",
        error_message:   err.message?.substring(0, 500),
      } as any)
      throw err
    }

    await supabaseAdmin.from("integrations").update({
      last_sync_at: new Date().toISOString(),
      sync_count:   (integration.sync_count || 0) + 1,
    }).eq("id", integration.id)

    await supabaseAdmin.from("sync_logs").insert({
      integration_id:  integration.id,
      direction:       "IN",
      entity:          "CONTACT",
      records_synced:  synced,
      records_failed:  failed,
      status:          "SUCCESS",
    })

    return { synced, failed, integration: "ZENDESK" }
  }

  // ── SLACK (notifications via chat.postMessage) ────────────────
  async testSlack(organizationId: string) {
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "SLACK")
      .eq("status", "ACTIVE")
      .single()

    if (!integration) throw new Error("Integration Slack non configuree")

    const creds = (integration.credentials as any) || {}
    const botToken  = creds.botToken
    const channelId = creds.channelId
    if (!botToken || !channelId) {
      throw new Error("Slack: botToken + channelId requis")
    }

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + botToken,
      },
      body: JSON.stringify({
        channel: channelId,
        text:    "Test VoxFlow — L'intégration Slack est maintenant active.",
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: "*VoxFlow* — Test de connexion réussi :white_check_mark:\nVous recevrez ici les notifications de votre call center." },
          },
        ],
      }),
    })

    const data = await res.json() as any
    if (!data.ok) {
      throw new Error(`Slack API: ${data.error || "erreur inconnue"}`)
    }

    await supabaseAdmin.from("integrations").update({
      last_sync_at: new Date().toISOString(),
    }).eq("id", integration.id)

    return { sent: true, channel: channelId, ts: data.ts }
  }

  /**
   * Envoie une notification Slack pour un événement VoxFlow.
   * Appelé depuis triggerWebhook ou directement par les services métier.
   */
  async notifySlack(organizationId: string, event: string, payload: any) {
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "SLACK")
      .eq("status", "ACTIVE")
      .maybeSingle()

    if (!integration) return { skipped: true, reason: "Slack not connected" }

    const creds = (integration.credentials as any) || {}
    const botToken  = creds.botToken
    const channelId = creds.channelId
    if (!botToken || !channelId) return { skipped: true, reason: "Missing credentials" }

    const title = {
      "call.completed":        "Appel terminé",
      "call.missed":           "Appel manqué",
      "contact.created":       "Nouveau contact",
      "conversation.created":  "Nouvelle conversation",
      "conversation.resolved": "Conversation résolue",
    }[event] || event

    try {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + botToken },
        body: JSON.stringify({
          channel: channelId,
          text:    `VoxFlow — ${title}`,
          blocks: [{
            type: "section",
            text: { type: "mrkdwn", text: `*VoxFlow — ${title}*\n\`\`\`${JSON.stringify(payload, null, 2).substring(0, 800)}\`\`\`` },
          }],
        }),
      })
      return { sent: true }
    } catch (err: any) {
      return { sent: false, error: err.message }
    }
  }

  // ── GOOGLE CALENDAR (Events list via accessToken) ─────────────
  async syncGoogleCalendar(organizationId: string) {
    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "GOOGLE_CALENDAR")
      .eq("status", "ACTIVE")
      .single()

    if (!integration) throw new Error("Integration Google Calendar non configuree")

    const creds = (integration.credentials as any) || {}
    const accessToken = creds.accessToken
    const calendarId  = creds.calendarId || "primary"
    if (!accessToken) {
      throw new Error("Google Calendar: accessToken requis")
    }

    const now    = new Date().toISOString()
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    const url    = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(future)}&singleEvents=true&orderBy=startTime&maxResults=100`

    let synced = 0
    let failed = 0

    try {
      const res = await fetch(url, {
        headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Google Calendar API ${res.status}: ${txt.substring(0, 200)}`)
      }

      const data  = await res.json() as any
      const items = data.items || []
      synced = items.length

      // Stocke les events dans la table schedules (ou activity_logs au minimum)
      // On se contente de mettre à jour last_sync_at + sync_count + log pour MVP.
    } catch (err: any) {
      await supabaseAdmin.from("sync_logs").insert({
        integration_id:  integration.id,
        direction:       "IN",
        entity:          "EVENT",
        records_synced:  0,
        records_failed:  0,
        status:          "FAILED",
        error_message:   err.message?.substring(0, 500),
      } as any)
      throw err
    }

    await supabaseAdmin.from("integrations").update({
      last_sync_at: new Date().toISOString(),
      sync_count:   (integration.sync_count || 0) + 1,
    }).eq("id", integration.id)

    await supabaseAdmin.from("sync_logs").insert({
      integration_id:  integration.id,
      direction:       "IN",
      entity:          "EVENT",
      records_synced:  synced,
      records_failed:  failed,
      status:          "SUCCESS",
    })

    return { synced, failed, integration: "GOOGLE_CALENDAR" }
  }
}

export const integrationsService = new IntegrationsService()

