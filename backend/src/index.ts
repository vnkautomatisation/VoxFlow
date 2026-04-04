import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { config } from './config/env'

// Routes
import healthRoutes  from './routes/health/index'
import authRoutes    from './routes/auth/index'
import ownerRoutes   from './routes/owner/index'
import adminRoutes   from './routes/admin/index'
import webhookRoutes from './routes/webhooks/index'

const app = express()

// ── Rate limiting ────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      100,
  message:  { success: false, error: 'Trop de requêtes, réessayez plus tard' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10, // 10 tentatives de login par 15min
  message:  { success: false, error: 'Trop de tentatives de connexion' },
})

// ── Middlewares globaux ──────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin:      config.cors.origin,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(morgan(config.app.env === 'production' ? 'combined' : 'dev'))
app.use(cookieParser())
app.use(limiter)

// Stripe webhook — body brut avant express.json()
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/v1/health',   healthRoutes)
app.use('/api/v1/auth',     authLimiter, authRoutes)
app.use('/api/v1/owner',    ownerRoutes)
app.use('/api/v1/admin',    adminRoutes)
app.use('/api/v1/webhooks', webhookRoutes)

// Route racine
app.get('/', (req, res) => {
  res.json({
    app:       'VoxFlow API',
    version:   '1.0.0',
    company:   'VNK Automatisation Inc.',
    endpoints: {
      health:   '/api/v1/health',
      auth:     '/api/v1/auth',
      owner:    '/api/v1/owner',
      admin:    '/api/v1/admin',
    },
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   'Route non trouvée',
    path:    req.originalUrl,
  })
})

// Error handler global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erreur non gérée:', err)
  res.status(500).json({
    success: false,
    error:   config.app.env === 'production' ? 'Erreur serveur' : err.message,
  })
})

// ── Démarrage ────────────────────────────────────────────────────
app.listen(config.app.port, () => {
  console.log('')
  console.log('  ╔════════════════════════════════════════════╗')
  console.log('  ║     VoxFlow Backend — Phase 1 Auth         ║')
  console.log('  ╠════════════════════════════════════════════╣')
  console.log('  ║  URL    : http://localhost:' + config.app.port + '             ║')
  console.log('  ║  ENV    : ' + config.app.env + '                       ║')
  console.log('  ║  Auth   : JWT + Supabase + Bcrypt          ║')
  console.log('  ║  Roles  : OWNER / ADMIN / AGENT            ║')
  console.log('  ╚════════════════════════════════════════════╝')
  console.log('')
})

export default app
