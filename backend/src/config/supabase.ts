import { createClient } from '@supabase/supabase-js'
import { config } from './env'

// Client admin (service role) — accès complet, côté serveur uniquement
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Client public (anon key) — accès limité par RLS
export const supabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey
)
