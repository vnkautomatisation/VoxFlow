import { z } from 'zod'

export const loginSchema = z.object({
  email:    z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères'),
})

// Register public: utilisé par le formulaire /register UI. Crée toujours
// un nouveau ADMIN avec sa propre organisation (self-signup).
// Le rôle est FORCÉ à ADMIN côté backend — on n'accepte jamais OWNER ici
// (sécurité: OWNER ne se crée qu'via une migration manuelle ou un autre
// OWNER existant via /api/v1/owner/organizations).
export const registerSchema = z.object({
  email:    z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe minimum 8 caractères'),
  name:     z.string().min(2, 'Nom minimum 2 caractères'),
  orgName:  z.string().min(2, 'Nom d\'organisation requis'),
  plan:     z.enum(['STARTER', 'BASIC', 'CONFORT', 'PRO', 'ENTERPRISE']).default('STARTER'),
})

export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: result.error.flatten().fieldErrors,
      })
    }
    req.body = result.data
    next()
  }
}
