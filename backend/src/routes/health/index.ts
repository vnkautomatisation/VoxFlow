import { Router } from 'express'
import { config } from '../../config/env'

const router = Router()

router.get('/', (req, res) => {
  res.json({
    success: true,
    status:  'healthy',
    app:     'VoxFlow API',
    version: '1.0.0',
    env:     config.app.env,
    company: 'VNK Automatisation Inc.',
    timestamp: new Date().toISOString(),
  })
})

export default router
