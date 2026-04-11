// ══════════════════════════════════════════════════════════════
//  VoxFlow Dialer — IPC channels source of truth
//
//  Importé par main.js (côté process principal) et preload.js
//  (côté contextBridge) pour éviter la duplication de strings.
//
//  Toutes les communications entre le renderer (Next.js /dialer)
//  et le process principal passent par ces channels.
// ══════════════════════════════════════════════════════════════

const channels = {
  // ── Renderer → Main (send) ─────────────────────────────────
  windowMinimize: 'window-minimize',
  windowClose:    'window-close',
  windowShow:     'window-show',
  windowMove:     'window-move',
  windowDrag:     'window-drag',

  // État d'appel : bloque F5/Ctrl+R pendant un appel actif
  callStarted:    'call-started',
  callEnded:      'call-ended',

  // Actions utilisateur envoyées au main
  retryLoad:      'retry-load',
  openExternal:   'open-external',
  setAlwaysOnTop: 'set-always-on-top',

  // ── Main → Renderer (on) ───────────────────────────────────
  authSync:        'auth-sync',        // Token push depuis le portail
  dialNumber:      'dial-number',      // CRM click-to-call
  supervisionJoin: 'supervision-join', // Admin barge-in
  refreshFeatures: 'refresh-features', // Plan changed, re-fetch /me
  connectionState: 'connection-state', // { online: bool, retries: number }
}

module.exports = channels
