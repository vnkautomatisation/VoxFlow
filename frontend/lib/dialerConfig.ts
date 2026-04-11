/**
 * Single source of truth for dialer-side config URLs.
 * Used by useAuth.ts, useDialer.ts, and the dialer page to avoid
 * having `'http://localhost:4000'` and `'http://localhost:3001'` littered
 * across the codebase.
 *
 * Override via env :
 *   NEXT_PUBLIC_API_URL     — the backend base URL
 *   NEXT_PUBLIC_APP_URL     — the frontend (portal) base URL
 */
export const DIALER_CONFIG = {
  API_URL:
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '') ||
    'http://localhost:4000',
  PORTAL_URL:
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_APP_URL : '') ||
    'http://localhost:3001',
} as const
