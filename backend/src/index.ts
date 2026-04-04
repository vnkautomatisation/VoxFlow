import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config/env'

// Routes
import healthRoutes  from './routes/health/index'
import authRoutes    from './routes/auth/index'
import ownerRoutes   from './routes/owner/index'
import adminRoutes   from './routes/admin/index'
import webhookRoutes from './routes/webhooks/index'

const app = express()

// ── Middlewares globaux ──────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin:      config.cors.origin,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))
app.use(morgan(config.app.env === 'production' ? 'combined' : 'dev'))

// Stripe webhook nécessite le body brut (avant express.json)
app.use('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Routes ───────────────────────────────────────────────────
app.use('/api/v1/health',    healthRoutes)
app.use('/api/v1/auth',      authRoutes)
app.use('/api/v1/owner',     ownerRoutes)
app.use('/api/v1/admin',     adminRoutes)
app.use('/api/v1/webhooks',  webhookRoutes)

// Route racine
app.get('/', (req, res) => {
  res.json({
    app:     'VoxFlow API',
    version: '1.0.0',
    company: 'VNK Automatisation Inc.',
    docs:    '/api/v1/health',
  })
})

// ── 404 handler ──────────────────────────────────────────────
app.use( (req, res) => {
  res.status(404).json({
    success: false,
    error:   'Route non trouvée',
    path:    req.originalUrl,
  })
})

// ── Démarrage ────────────────────────────────────────────────
app.listen(config.app.port, () => {
  console.log('')
  console.log('  ╔═══════════════════════════════════════╗')
  console.log('  ║     VoxFlow Backend — Démarré         ║')
  console.log('  ╠═══════════════════════════════════════╣')
  console.log('  ║  URL  : http://localhost:' + config.app.port + '          ║')
  console.log('  ║  ENV  : ' + config.app.env + '                    ║')
  console.log('  ║  VNK  : VNK Automatisation Inc.       ║')
  console.log('  ╚═══════════════════════════════════════╝')
  console.log('')
})

export default app


