// ── Route GET /api/v1/auth/me — VoxFlow ──────────────────────────────────────
// Ajouter dans routes/auth.ts ou équivalent
// Retourne le profil complet incluant extension SIP et plan d'abonnement

router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    // Récupérer user + organization en une requête
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, email, name, first_name, last_name,
        role, status, agent_status, extension, avatar_url,
        organization_id,
        organizations (
          id, name, plan, status,
          seats_used, seats_total
        )
      `)
      .eq('id', userId)
      .single()

    if (error || !user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
    }

    // Déterminer le plan effectif
    const org = user.organizations
    const orgPlan = org?.plan || 'STARTER'

    // Mapper plan -> permission dialer
    // STARTER / BASIC = entrants seulement
    // CONFORT / PRO / ENTERPRISE / FULL = accès complet
    const inboundOnlyPlans = ['STARTER', 'BASIC', 'INBOUND_ONLY']
    const dialerPlan = inboundOnlyPlans.includes(orgPlan) ? 'INBOUND_ONLY' : 'FULL'

    return res.json({
      success: true,
      data: {
        id:           user.id,
        email:        user.email,
        name:         user.name,
        first_name:   user.first_name,
        last_name:    user.last_name,
        role:         user.role,
        status:       user.status,
        agent_status: user.agent_status,
        extension:    user.extension,    // <-- clé pour le dialer
        avatar_url:   user.avatar_url,
        organization: {
          id:          org?.id,
          name:        org?.name,
          plan:        orgPlan,
          seats_used:  org?.seats_used,
          seats_total: org?.seats_total,
        },
        // Champ simplifié pour le dialer
        plan: dialerPlan,                // 'FULL' | 'INBOUND_ONLY'
      }
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
})
