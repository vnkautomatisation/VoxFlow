// ══════════════════════════════════════════════════════════════
//  VoxFlow Dialer — Preload (contextBridge)
//
//  Expose une API sécurisée au renderer via `window.electronAPI`.
//  Le renderer est isolé (contextIsolation: true, sandbox: true par
//  défaut depuis Electron 20) donc il ne peut PAS accéder directement
//  à node/electron — il passe par cette API contrôlée.
//
//  IMPORTANT — les channels IPC sont INLINÉS ici, PAS require()d.
//  En mode sandbox (défaut Electron ≥ 20), le preload ne peut charger
//  que les built-ins d'Electron (`electron`, `events`, etc.), pas les
//  fichiers locaux. `require('./ipc-channels')` plantait le preload
//  ("module not found: ./ipc-channels"), ce qui crashait le renderer
//  en boucle. La copie des strings est synchronisée manuellement avec
//  src/ipc-channels.js (une vingtaine de lignes, trivial à maintenir).
// ══════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron')

// ── IPC channels (mirror de src/ipc-channels.js) ───────────
const channels = {
  // Renderer → Main (send)
  windowMinimize: 'window-minimize',
  windowClose:    'window-close',
  windowShow:     'window-show',
  windowMove:     'window-move',
  windowDrag:     'window-drag',
  callStarted:    'call-started',
  callEnded:      'call-ended',
  retryLoad:      'retry-load',
  openExternal:   'open-external',
  setAlwaysOnTop: 'set-always-on-top',
  // Main → Renderer (on)
  authSync:        'auth-sync',
  dialNumber:      'dial-number',
  supervisionJoin: 'supervision-join',
  refreshFeatures: 'refresh-features',
  connectionState: 'connection-state',
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window control ──────────────────────────────────────────
  minimize: ()       => ipcRenderer.send(channels.windowMinimize),
  close:    ()       => ipcRenderer.send(channels.windowClose),
  show:     ()       => ipcRenderer.send(channels.windowShow),
  move:     (x, y)   => ipcRenderer.send(channels.windowMove, { x, y }),
  drag:     (dx, dy) => ipcRenderer.send(channels.windowDrag, { dx, dy }),

  // ── Call state (bloque reload pendant un appel) ─────────────
  callStarted: () => ipcRenderer.send(channels.callStarted),
  callEnded:   () => ipcRenderer.send(channels.callEnded),

  // ── Actions utilisateur ────────────────────────────────────
  retryLoad:      ()    => ipcRenderer.send(channels.retryLoad),
  openExternal:   (url) => ipcRenderer.send(channels.openExternal, url),
  setAlwaysOnTop: (on)  => ipcRenderer.send(channels.setAlwaysOnTop, !!on),

  // ── Listeners (Main → Renderer) ────────────────────────────
  onAuthSync: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on(channels.authSync, handler)
    return () => ipcRenderer.removeListener(channels.authSync, handler)
  },

  onDialNumber: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on(channels.dialNumber, handler)
    return () => ipcRenderer.removeListener(channels.dialNumber, handler)
  },
  removeDialListener: () => ipcRenderer.removeAllListeners(channels.dialNumber),

  onSupervisionJoin: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on(channels.supervisionJoin, handler)
    return () => ipcRenderer.removeListener(channels.supervisionJoin, handler)
  },
  removeSupervisionListener: () => ipcRenderer.removeAllListeners(channels.supervisionJoin),

  onRefreshFeatures: (cb) => {
    const handler = () => cb()
    ipcRenderer.on(channels.refreshFeatures, handler)
    return () => ipcRenderer.removeListener(channels.refreshFeatures, handler)
  },

  onConnectionState: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on(channels.connectionState, handler)
    return () => ipcRenderer.removeListener(channels.connectionState, handler)
  },

  // ── Info statique ──────────────────────────────────────────
  version:  process.env.npm_package_version || '1.2.1',
  platform: process.platform,
})
