// ══════════════════════════════════════════════════════════════
//  VoxFlow Dialer — Main Electron Process
//
//  Rôle :
//   - Crée une fenêtre frameless 380×720 qui charge le dialer
//     Next.js (http://localhost:3001/dialer en dev, prod URL sinon)
//   - Gère le protocole custom voxflow:// pour ouvrir l'app
//     depuis le navigateur avec un token pré-rempli
//   - Expose un serveur HTTP local sur 127.0.0.1:9876 pour que
//     le portail web puisse push auth tokens / dial / supervision
//     sans passer par le backend
//   - Retry avec backoff exponentiel si le frontend est down
//   - Fallback offline.html si le serveur n'est jamais atteignable
//   - Log fichier rotatif dans ~/.voxflow/dialer.log
//   - Permissions media (micro) accordées automatiquement
// ══════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell, session } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')
const http = require('http')

const channels = require('./src/ipc-channels')

// ── Configuration ────────────────────────────────────────────
const IS_DEV = !app.isPackaged || process.env.NODE_ENV === 'development'
// L'URL frontend est résolue depuis (dans l'ordre) :
//   1. VOXFLOW_FRONTEND_URL env var
//   2. ~/.voxflow/config.json { "frontendUrl": "https://..." }
//   3. http://localhost:3001 (défaut — tant que la prod n'est pas live)
function resolveFrontendUrl() {
    if (process.env.VOXFLOW_FRONTEND_URL) return process.env.VOXFLOW_FRONTEND_URL
    try {
        const cfgPath = path.join(os.homedir(), '.voxflow', 'config.json')
        if (fs.existsSync(cfgPath)) {
            const data = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
            if (data?.frontendUrl) return data.frontendUrl
        }
    } catch {}
    return 'http://localhost:3001'
}
const FRONTEND_URL = resolveFrontendUrl()
// Même URL exacte que le browser pour que le comportement soit identique.
// Le flag Electron est détecté via window.electronAPI côté renderer.
const DIALER_PATH  = '/dialer'
const DIALER_URL   = FRONTEND_URL + DIALER_PATH
const LOCAL_PORT   = 9876
const MAX_BOOT_RETRIES = 6
const BOOT_RETRY_BASE_MS = 400 // backoff: 400, 800, 1600, 3200 max 4000

// ── State ─────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock()
let mainWindow   = null
let tray         = null
let callActive   = false
let localServer  = null
let bootRetries  = 0
let currentUrl   = DIALER_URL
let offlineMode  = false

// ── Logging ──────────────────────────────────────────────────
const LOG_DIR  = path.join(os.homedir(), '.voxflow')
const LOG_FILE = path.join(LOG_DIR, 'dialer.log')
try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }) } catch {}

function log(...args) {
    const line = '[' + new Date().toISOString() + '] ' + args.map(a =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ')
    console.log(line)
    try { fs.appendFileSync(LOG_FILE, line + '\n') } catch {}
}

log('[boot] VoxFlow Dialer v1.1.0 starting')
log('[boot] mode:', IS_DEV ? 'DEV' : 'PROD', 'frontend:', FRONTEND_URL)

// ── Protocole custom voxflow:// ──────────────────────────────
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('voxflow', process.execPath, [path.resolve(process.argv[1])])
    }
} else {
    app.setAsDefaultProtocolClient('voxflow')
}

function parseVoxflowUrl(raw) {
    try {
        const u = new URL(raw)
        if (u.protocol !== 'voxflow:') return null
        return {
            action: u.hostname || u.pathname.replace(/^\/+/, '').split('/')[0] || 'open',
            tok:    u.searchParams.get('tok') || '',
            url:    u.searchParams.get('url') || '',
            role:   u.searchParams.get('role') || '',
        }
    } catch { return null }
}

if (!gotTheLock) {
    log('[boot] another instance running, exiting')
    app.quit()
} else {
    // Deuxième instance : on focus la première et on process l'URL passée
    app.on('second-instance', (_, argv) => {
        log('[boot] second-instance argv:', argv.join(' '))
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.show()
            mainWindow.focus()
        }
        // Chercher une URL voxflow:// dans argv
        const voxflowArg = argv.find(a => a.startsWith('voxflow://'))
        if (voxflowArg) {
            const parsed = parseVoxflowUrl(voxflowArg)
            if (parsed?.tok) injectToken(parsed.tok, parsed.role, parsed.url)
        }
    })

    // macOS : open-url pour le protocole
    app.on('open-url', (event, url) => {
        event.preventDefault()
        log('[boot] open-url:', url)
        const parsed = parseVoxflowUrl(url)
        if (parsed?.tok) injectToken(parsed.tok, parsed.role, parsed.url)
        if (mainWindow) { mainWindow.show(); mainWindow.focus() }
    })

    app.whenReady().then(() => {
        createWindow()
        startLocalServer()
    })
}

// ══════════════════════════════════════════════════════════════
//  Token injection dans le renderer
// ══════════════════════════════════════════════════════════════
function injectToken(token, role, url) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const t = JSON.stringify(token || '')
    const r = JSON.stringify(role || 'AGENT')
    const u = JSON.stringify(url || 'http://localhost:4000')
    mainWindow.webContents.executeJavaScript(
        'localStorage.setItem("vf_tok",'  + t + ');' +
        'localStorage.setItem("vf_role",' + r + ');' +
        'localStorage.setItem("vf_url",'  + u + ');' +
        'console.log("[Electron] token injected, role:", ' + r + ');' +
        'if (window.location.pathname.startsWith("/dialer")) window.location.reload();'
    ).catch(err => log('[inject] error:', err.message))
    log('[inject] token injected, role:', role)
}

function injectLogout() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.executeJavaScript(
        '["vf_tok","vf_role","vf_ext","vf_plan","vf_plan_id","vf_plan_name","vf_features","vf_limits","vf_trial","vf_name"]' +
        '.forEach(k => localStorage.removeItem(k));' +
        'localStorage.setItem("vf_logout", Date.now().toString());' +
        'setTimeout(() => localStorage.removeItem("vf_logout"), 200);' +
        'console.log("[Electron] logout injected");'
    ).catch(err => log('[inject] logout error:', err.message))
    log('[inject] logout')
}

function injectFeatureRefresh(features, trial) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const f = JSON.stringify(features || {})
    const t = JSON.stringify(trial || null)
    mainWindow.webContents.executeJavaScript(
        'try {' +
        '  localStorage.setItem("vf_features",' + f + ');' +
        '  if (' + t + ') localStorage.setItem("vf_trial", JSON.stringify(' + t + '));' +
        '  window.dispatchEvent(new StorageEvent("storage", { key: "vf_features" }));' +
        '  console.log("[Electron] features refreshed");' +
        '} catch (e) { console.error(e); }'
    ).catch(err => log('[inject] features error:', err.message))
}

// ══════════════════════════════════════════════════════════════
//  Window creation + boot retry logic
// ══════════════════════════════════════════════════════════════
function createWindow() {
    const iconCandidates = [
        path.join(__dirname, 'src', 'icon.ico'),
        path.join(__dirname, 'src', 'icon.png'),
    ]
    const iconPath = iconCandidates.find(p => {
        try { fs.accessSync(p); return true } catch { return false }
    })

    // Position par défaut : coin bas-droite de l'écran
    const display = screen.getPrimaryDisplay().workAreaSize
    const width   = 380
    const height  = 720
    const x = Math.max(0, display.width  - width  - 20)
    const y = Math.max(0, display.height - height - 20)

    mainWindow = new BrowserWindow({
        width, height, x, y,
        minWidth:  360,
        minHeight: 600,
        resizable:       false,
        maximizable:     false,
        fullscreenable:  false,
        autoHideMenuBar: true,
        frame:           false,
        transparent:     false,
        backgroundColor: '#111118',
        alwaysOnTop:     false,
        skipTaskbar:     false,
        icon:            iconPath || undefined,
        show:            false, // Afficher après le first load (ou offline page)
        webPreferences: {
            preload:                       path.join(__dirname, 'src', 'preload.js'),
            contextIsolation:              true,
            nodeIntegration:               false,
            allowRunningInsecureContent:   false,
            sandbox:                       false, // preload a besoin de require()
            webSecurity:                   !IS_DEV, // désactiver en dev pour CORS loopback
        },
    })

    // Afficher dès que prêt (pas de flash blanc)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
        mainWindow.focus()
        log('[window] shown')
    })

    // ── Boot : charger directement le dialer ─────────────────
    // Si le load échoue (did-fail-load), on bascule sur offline.html.
    // Si le retry exceed MAX_BOOT_RETRIES, on reste sur offline.
    loadWithRetry()

    // ── IPC handlers ───────────────────────────────────────────
    ipcMain.on(channels.callStarted,    () => { callActive = true;  log('[call] started') })
    ipcMain.on(channels.callEnded,      () => { callActive = false; log('[call] ended')   })
    ipcMain.on(channels.windowMinimize, () => mainWindow && mainWindow.minimize())
    ipcMain.on(channels.windowClose,    () => mainWindow && mainWindow.hide())
    ipcMain.on(channels.windowShow,     () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
    ipcMain.on(channels.windowMove, (_, { x, y }) => {
        if (!mainWindow) return
        const [cx, cy] = mainWindow.getPosition()
        mainWindow.setPosition(cx + (x || 0), cy + (y || 0))
    })
    ipcMain.on(channels.retryLoad, () => {
        log('[retry] user requested')
        bootRetries = 0
        offlineMode = false
        loadWithRetry()
    })
    ipcMain.on(channels.openExternal, (_, url) => {
        if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url)
    })
    ipcMain.on(channels.setAlwaysOnTop, (_, on) => {
        if (mainWindow) mainWindow.setAlwaysOnTop(!!on)
    })

    // ── Bloquer F5/Ctrl+R pendant un appel ────────────────────
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isReload = input.key === 'F5' || (input.key === 'r' && (input.control || input.meta))
        if (isReload && callActive) {
            event.preventDefault()
            log('[guard] reload blocked during active call')
        }
    })

    // ── Permissions media (micro) ──────────────────────────────
    mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, cb) => {
        const allowed = ['media', 'audioCapture', 'microphone', 'notifications'].includes(permission)
        log('[perm] request:', permission, '→', allowed ? 'allow' : 'deny')
        cb(allowed)
    })
    mainWindow.webContents.session.setPermissionCheckHandler((wc, permission) => {
        return ['media', 'audioCapture', 'microphone', 'notifications'].includes(permission)
    })

    // ── Ouvrir les liens externes dans le navigateur ──────────
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith(FRONTEND_URL)) return { action: 'allow' }
        shell.openExternal(url)
        return { action: 'deny' }
    })

    // ── Cycle de vie ───────────────────────────────────────────
    mainWindow.on('close', e => {
        e.preventDefault()
        mainWindow.hide()
        log('[window] hide on close')
    })
    mainWindow.on('closed', () => { mainWindow = null })

    // ── Tray icon ──────────────────────────────────────────────
    createTray()

    app.setAppUserModelId('io.voxflow.dialer')
}

// Charge l'URL avec retry exponentiel. Fallback offline.html après N tentatives.
// Affiche immédiatement offline.html en mode "connexion en cours"
// pour ne pas laisser l'utilisateur sur un écran noir pendant le
// DNS/TCP/TLS handshake vers le frontend.
function showLoadingPage() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const offlineFile = path.join(__dirname, 'src', 'offline.html')
    const hash = '#url=' + encodeURIComponent(DIALER_URL) + '&retries=0&mode=loading'
    mainWindow.loadFile(offlineFile, { hash }).catch(err => {
        log('[loading] loadFile error:', err.message)
    })
}

function loadWithRetry() {
    if (!mainWindow || mainWindow.isDestroyed()) return

    currentUrl = DIALER_URL
    log('[load] attempt', bootRetries + 1, '/', MAX_BOOT_RETRIES, '→', DIALER_URL)

    mainWindow.loadURL(DIALER_URL).then(() => {
        log('[load] success')
        bootRetries = 0
        offlineMode = false
        sendConnectionState(true)
    }).catch(err => {
        log('[load] failed:', err.message)
        bootRetries++
        if (bootRetries >= MAX_BOOT_RETRIES) {
            log('[load] max retries reached, loading offline page')
            showOfflinePage()
        } else {
            const delay = Math.min(BOOT_RETRY_BASE_MS * Math.pow(2, bootRetries - 1), 8000)
            log('[load] retry in', delay, 'ms')
            setTimeout(() => loadWithRetry(), delay)
        }
    })

    // Gérer les échecs de chargement après coup
    mainWindow.webContents.once('did-fail-load', (_, errCode, errDesc, validatedUrl) => {
        if (validatedUrl && validatedUrl.includes('offline.html')) return
        log('[load] did-fail-load:', errCode, errDesc)
        if (!offlineMode) showOfflinePage()
    })
}

function showOfflinePage() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    offlineMode = true
    sendConnectionState(false)
    const offlineFile = path.join(__dirname, 'src', 'offline.html')
    const hash = '#url=' + encodeURIComponent(DIALER_URL) + '&retries=' + bootRetries
    mainWindow.loadFile(offlineFile, { hash }).catch(err => {
        log('[offline] loadFile error:', err.message)
    })
}

function sendConnectionState(online) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    try {
        mainWindow.webContents.send(channels.connectionState, { online, retries: bootRetries, url: DIALER_URL })
    } catch {}
}

// ══════════════════════════════════════════════════════════════
//  System tray
// ══════════════════════════════════════════════════════════════
function createTray() {
    const trayCandidates = [
        path.join(__dirname, 'src', 'tray.png'),
        path.join(__dirname, 'src', 'icon.png'),
        path.join(__dirname, 'src', 'icon.ico'),
    ].find(p => {
        try { fs.accessSync(p); return true } catch { return false }
    })

    if (!trayCandidates) {
        log('[tray] no icon found, skipping')
        return
    }

    try {
        tray = new Tray(nativeImage.createFromPath(trayCandidates))
        tray.setToolTip('VoxFlow Dialer')
        tray.setContextMenu(Menu.buildFromTemplate([
            { label: 'Afficher VoxFlow Dialer', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } } },
            { label: 'Toujours au premier plan', type: 'checkbox', click: (item) => {
                if (mainWindow) mainWindow.setAlwaysOnTop(item.checked)
            } },
            { type: 'separator' },
            { label: 'Recharger', click: () => { bootRetries = 0; loadWithRetry() } },
            { label: 'Ouvrir le dossier de logs', click: () => shell.openPath(LOG_DIR) },
            { type: 'separator' },
            { label: 'Quitter', click: () => { if (mainWindow) mainWindow.destroy(); app.exit(0) } },
        ]))
        tray.on('click',        () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
        tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
        log('[tray] created')
    } catch (e) {
        log('[tray] error:', e.message)
    }
}

// ══════════════════════════════════════════════════════════════
//  Serveur HTTP local 127.0.0.1:9876
//
//  Permet au portail web d'envoyer :
//   - /auth-sync       : push token au login ou logout
//   - /dial            : click-to-call depuis le CRM
//   - /supervision     : admin barge-in
//   - /refresh-features : plan changé, re-lire vf_features
//   - /ping            : health check (utilisé par le portail)
// ══════════════════════════════════════════════════════════════
function startLocalServer() {
    localServer = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin',  '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        res.setHeader('Access-Control-Max-Age',       '600')

        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

        // Health check — disponible même si la window n'est pas encore prête
        if (req.method === 'GET' && req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, version: '1.1.0', offlineMode, callActive }))
            return
        }

        if (!mainWindow || mainWindow.isDestroyed()) {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Window not ready' }))
            return
        }

        const readBody = (cb) => {
            let body = ''
            req.on('data', c => { body += c })
            req.on('end', () => {
                try { cb(JSON.parse(body || '{}')) }
                catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: e.message }))
                }
            })
        }

        // POST /auth-sync — push du token
        if (req.method === 'POST' && req.url === '/auth-sync') {
            return readBody(data => {
                log('[http] /auth-sync action:', data.action, 'role:', data.role || '—')
                if (data.action === 'login' && data.token) {
                    injectToken(data.token, data.role, data.url)
                } else if (data.action === 'logout') {
                    injectLogout()
                } else if (data.action === 'refresh-features') {
                    injectFeatureRefresh(data.features, data.trial)
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
            })
        }

        // POST /dial — click-to-call
        if (req.method === 'POST' && req.url === '/dial') {
            return readBody(data => {
                log('[http] /dial phone:', data.phone)
                mainWindow.show(); mainWindow.focus()
                mainWindow.webContents.send(channels.dialNumber, { phone: data.phone })
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            })
        }

        // POST /supervision — admin barge-in
        if (req.method === 'POST' && req.url === '/supervision') {
            return readBody(data => {
                log('[http] /supervision mode:', data.mode)
                mainWindow.show(); mainWindow.focus()
                mainWindow.webContents.send(channels.supervisionJoin, data)
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            })
        }

        // POST /refresh-features — force un refresh du /me
        if (req.method === 'POST' && req.url === '/refresh-features') {
            return readBody(data => {
                log('[http] /refresh-features')
                injectFeatureRefresh(data.features, data.trial)
                mainWindow.webContents.send(channels.refreshFeatures)
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            })
        }

        res.writeHead(404); res.end()
    })

    localServer.on('error', err => {
        if (err.code === 'EADDRINUSE') {
            log('[http] port', LOCAL_PORT, 'already in use — another instance running')
        } else {
            log('[http] server error:', err.message)
        }
    })

    localServer.listen(LOCAL_PORT, '127.0.0.1', () => {
        log('[http] local server ready on 127.0.0.1:' + LOCAL_PORT)
    })
}

// ══════════════════════════════════════════════════════════════
//  App lifecycle
// ══════════════════════════════════════════════════════════════
// Ne pas quitter quand toutes les fenêtres sont fermées (tray persiste)
app.on('window-all-closed', () => {
    log('[app] all windows closed — tray persists')
})

app.on('before-quit', () => {
    log('[app] before-quit')
    if (localServer) {
        try { localServer.close() } catch {}
    }
})
