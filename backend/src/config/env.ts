import dotenv from 'dotenv'
dotenv.config()

export const config = {
  app: {
    port:    parseInt(process.env.PORT || '4000'),
    env:     process.env.NODE_ENV || 'development',
    url:     process.env.APP_URL || 'http://localhost:3001',
    apiUrl:  process.env.API_URL || 'http://localhost:4000',
  },
  supabase: {
    url:        process.env.SUPABASE_URL || '',
    anonKey:    process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
  jwt: {
    secret:         process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    expiresIn:      process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret:  process.env.REFRESH_TOKEN_SECRET || 'refresh-secret',
  },
  redis: {
    url:       process.env.REDIS_URL || 'redis://localhost:6379',
    restUrl:   process.env.UPSTASH_REDIS_REST_URL || '',
    restToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },
  twilio: {
    accountSid:  process.env.TWILIO_ACCOUNT_SID || '',
    authToken:   process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    apiKey:      process.env.TWILIO_API_KEY || '',
    apiSecret:   process.env.TWILIO_API_SECRET || '',
    appSid:      process.env.TWILIO_APP_SID || '',
  },
  stripe: {
    secretKey:      process.env.STRIPE_SECRET_KEY || '',
    webhookSecret:  process.env.STRIPE_WEBHOOK_SECRET || '',
    prices: {
      starter:    process.env.STRIPE_PRICE_STARTER || '',
      pro:        process.env.STRIPE_PRICE_PRO || '',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE || '',
    },
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model:  process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  email: {
    apiKey:    process.env.RESEND_API_KEY || '',
    from:      process.env.EMAIL_FROM || 'noreply@voxflow.io',
    fromName:  process.env.EMAIL_FROM_NAME || 'VoxFlow',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  },
}
