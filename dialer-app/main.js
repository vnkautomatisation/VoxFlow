// ══════════════════════════════════════════════════════════════
//  VoxFlow Dialer — Minimal Electron Shell
//  v1.2.5 — ROOT FIX : enable webSecurity + sandbox + disable Site Isolation
//
//  Rôle minimal :
//   - Crée une fenêtre frameless 380x720 (show: false → évite écran noir)
//   - Charge http://localhost:3001/dialer
//   - Handle voxflow:// protocole (click-to-call depuis le portail)
//   - Serveur HTTP 127.0.0.1:9876 pour push auth/dial/supervision
//   - Tray icon avec menu étendu : afficher/masquer, recharger,
//     toujours au premier plan, portail, logs, devtools
//   - Logs complets pour diagnostiquer load / dom-ready / render crash
//   - Fallback error.html si frontend unreachable OU si le renderer crash
//     (PAS de auto-reload → évite les boucles crash→load→crash)
// ══════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')
const http = require('http')
const channels = require('./src/ipc-channels')

app.commandLine.appendSwitch('high-dpi-support', '1')

// Beaucoup de crashs renderer "Access Violation -1073741819" sur Windows
// Electron 28 viennent du compositeur GPU (Chromium 120). On désactive
// l'accélération matérielle — le dialer est UI-only, pas de perf GPU
// nécessaire (pas de canvas lourd, pas de 3D). Résout aussi les crashs
// liés à WebRTC/Twilio qui partagent le pipeline GPU.
app.disableHardwareAcceleration()

// Switches qui éliminent plusieurs classes de crashs connus sur Windows
// Electron 28 + Next.js dev + Twilio WebRTC :
//  - CalculateNativeWinOcclusion : bug Chromium quand la fenêtre est
//    masquée/restaurée rapidement (tray → show)
//  - HardwareMediaKeyHandling + MediaSessionService : crashs au moment
//    de l'init d'AudioContext (qui arrive quand Twilio.Device se charge)
//  - IsolateOrigins,site-per-process : Site Isolation de Chromium 120
//    qui recrée le renderer process sur chaque in-place nav — c'est
//    exactement la cause du crash -1073741819 qu'on observe dans les
//    logs (nav-start (in-place) → render-process-gone 150ms plus tard).
//  - disable-renderer-backgrounding + disable-background-timer-throttling :
//    évite que Chromium suspende le renderer 43 ms après load.
app.commandLine.appendSwitch(
    'disable-features',
    'CalculateNativeWinOcclusion,HardwareMediaKeyHandling,MediaSessionService,IsolateOrigins,site-per-process'
)
app.commandLine.appendSwitch('disable-site-isolation-trials')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

// ── Config ──────────────────────────────────────────────────
const FRONTEND_URL = process.env.VOXFLOW_FRONTEND_URL || 'http://localhost:3001'
const DIALER_URL   = FRONTEND_URL + '/dialer'
const LOCAL_PORT   = 9876
const LOG_DIR      = path.join(os.homedir(), '.voxflow')
const LOG_FILE     = path.join(LOG_DIR, 'dialer.log')

try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch {}

function log(...args) {
    const line = '[' + new Date().toISOString() + '] ' + args.map(a =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ')
    console.log(line)
    try { fs.appendFileSync(LOG_FILE, line + '\n') } catch {}
}

log('[boot] VoxFlow Dialer v1.2.5 — loading', DIALER_URL)

// ── Protocole voxflow:// ────────────────────────────────────
if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('voxflow', process.execPath, [path.resolve(process.argv[1])])
} else {
    app.setAsDefaultProtocolClient('voxflow')
}

// ── State ──────────────────────────────────────────────────
let mainWindow  = null
let tray        = null
let callActive  = false
let localServer = null

// ── Helpers JS injection dans le renderer ─────────────────
function injectToken(token, role, url) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const t = JSON.stringify(token || '')
    const r = JSON.stringify(role || 'AGENT')
    const u = JSON.stringify(url || 'http://localhost:4000')
    mainWindow.webContents.executeJavaScript(
        'try{' +
        '  localStorage.setItem("vf_tok", ' + t + ');' +
        '  localStorage.setItem("vf_role", ' + r + ');' +
        '  localStorage.setItem("vf_url", ' + u + ');' +
        '  if (location.pathname.startsWith("/dialer")) location.reload();' +
        '}catch(e){console.error(e)}'
    ).catch(err => log('[inject token]', err.message))
}

function injectLogout() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.executeJavaScript(
        'try{' +
        '  ["vf_tok","vf_role","vf_ext","vf_plan","vf_plan_id","vf_plan_name","vf_features","vf_limits","vf_trial","vf_name"]' +
        '    .forEach(k => localStorage.removeItem(k));' +
        '  localStorage.setItem("vf_logout", Date.now().toString());' +
        '  setTimeout(() => localStorage.removeItem("vf_logout"), 200);' +
        '}catch(e){}'
    ).catch(err => log('[inject logout]', err.message))
}

function injectFeatureRefresh(features, trial) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const f = JSON.stringify(features || {})
    const t = JSON.stringify(trial || null)
    mainWindow.webContents.executeJavaScript(
        'try{' +
        '  localStorage.setItem("vf_features", ' + f + ');' +
        '  if (' + t + ') localStorage.setItem("vf_trial", JSON.stringify(' + t + '));' +
        '  window.dispatchEvent(new StorageEvent("storage", { key: "vf_features" }));' +
        '}catch(e){}'
    ).catch(err => log('[inject features]', err.message))
}

function parseVoxflowUrl(raw) {
    try {
        const u = new URL(raw)
        if (u.protocol !== 'voxflow:') return null
        return {
            action: u.hostname || 'open',
            tok:    u.searchParams.get('tok') || '',
            url:    u.searchParams.get('url') || '',
            role:   u.searchParams.get('role') || '',
        }
    } catch { return null }
}

// ── createWindow ───────────────────────────────────────────
function createWindow() {
    const iconPath = ['src/icon.ico', 'src/icon.png']
        .map(p => path.join(__dirname, p))
        .find(p => { try { fs.accessSync(p); return true } catch { return false } })

    const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

    mainWindow = new BrowserWindow({
        width:  380,
        height: 720,
        x: Math.max(0, screenW - 380 - 16),
        y: Math.max(0, screenH - 720 - 16),
        show:            false, // attend ready-to-show → pas d'écran noir
        resizable:       false,
        maximizable:     false,
        fullscreenable:  false,
        autoHideMenuBar: true,
        frame:           false,
        transparent:     false,
        backgroundColor: '#111118',
        icon:            iconPath || undefined,
        webPreferences: {
            preload:          path.join(__dirname, 'src', 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          true,  // renderer sandboxé — évite les crashs Chromium 120 sur Windows
            webSecurity:      true,  // RÉACTIVÉ — avec sécurité off, Chromium 120 crash sur les in-place nav.
                                      // Le CORS backend autorise déjà localhost:3001, donc pas besoin de le désactiver.
            allowRunningInsecureContent: false,
        },
    })

    log('[createWindow] loading', DIALER_URL)
    mainWindow.loadURL(DIALER_URL).catch(err => log('[loadURL error]', err.message))

    // Events diagnostiques — sans ces logs on ne sait jamais si le
    // renderer a chargé, ce qui rend l'écran noir indébug-able.
    mainWindow.webContents.on('did-start-loading', () => log('[load] started →', mainWindow.webContents.getURL()))
    mainWindow.webContents.on('did-finish-load',   () => log('[load] finish  →', mainWindow.webContents.getURL()))
    mainWindow.webContents.on('dom-ready',         () => log('[load] dom-ready →', mainWindow.webContents.getURL()))
    mainWindow.webContents.on('will-navigate', (_, url) => log('[will-navigate]', url))
    mainWindow.webContents.on('will-redirect', (_, url) => log('[will-redirect]', url))
    // did-start-navigation catche aussi les location.reload() et les
    // client-side router transitions (Next.js App Router), contrairement
    // à will-navigate qui ne voit que les nav initiées par l'utilisateur
    // et les link clicks. C'est ici qu'on verra si Next.js fast-refresh
    // déclenche un reload fantôme.
    mainWindow.webContents.on('did-start-navigation', (_, url, isInPlace, isMainFrame) => {
        if (!isMainFrame) return
        log('[nav-start]', isInPlace ? '(in-place)' : '(new)', url)
    })
    mainWindow.webContents.on('did-frame-navigate', (_, url, httpCode, _desc, isMainFrame) => {
        if (!isMainFrame) return
        log('[nav-done]', httpCode, url)
    })
    mainWindow.once('ready-to-show', () => {
        log('[window] ready-to-show, showing')
        mainWindow.show()
    })

    // Fallback error.html si le frontend est unreachable
    mainWindow.webContents.on('did-fail-load', (_, code, desc, url) => {
        if (url && url.includes('error.html')) return // guard anti-loop
        if (code === -3) return // ERR_ABORTED lors d'une navigation normale
        log('[did-fail-load]', code, desc, url)
        mainWindow.loadFile(path.join(__dirname, 'src', 'error.html'))
            .catch(e => log('[error.html]', e.message))
    })

    // Render process crash — NO auto-reload.
    // Un auto-reload silencieux masque les vrais bugs (preload cassé,
    // JS fatal dans le renderer) et crée une boucle infinie crash→load
    // →crash. On log le crash et on bascule sur error.html ; l'utilisateur
    // peut cliquer "Recharger" dans la tray une fois le bug corrigé.
    mainWindow.webContents.on('render-process-gone', (_, details) => {
        log('[render-process-gone]', details.reason, details.exitCode)
        if (details.reason === 'clean-exit') return
        mainWindow?.loadFile(path.join(__dirname, 'src', 'error.html'))
            .catch(e => log('[error.html after crash]', e.message))
    })

    // Log les erreurs JS du renderer — on filtre les warnings de sécurité
    // d'Electron (webSecurity disabled, CSP, etc.) qui spamment le log.
    mainWindow.webContents.on('console-message', (_, level, message) => {
        if (level < 2) return
        if (message.includes('Electron Security Warning')) return
        if (message.includes('This warning will not show up')) return
        if (message.includes('Fast Refresh')) return
        log('[renderer]', level, message.slice(0, 400))
    })

    // Crash handlers plus verbeux
    mainWindow.webContents.on('unresponsive', () => log('[unresponsive] renderer frozen'))
    mainWindow.webContents.on('responsive',   () => log('[responsive] renderer back'))
    mainWindow.webContents.on('preload-error', (_, preloadPath, err) => {
        log('[preload-error]', preloadPath, err.message)
    })

    // Permissions (micro, notifications)
    mainWindow.webContents.session.setPermissionRequestHandler((_, permission, cb) => {
        cb(['media', 'audioCapture', 'microphone', 'notifications'].includes(permission))
    })
    mainWindow.webContents.session.setPermissionCheckHandler((_, permission) => {
        return ['media', 'audioCapture', 'microphone', 'notifications'].includes(permission)
    })

    // Liens externes → navigateur système
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith(FRONTEND_URL)) return { action: 'allow' }
        shell.openExternal(url)
        return { action: 'deny' }
    })

    // Bloquer F5/Ctrl+R pendant un appel actif
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isReload = input.key === 'F5' || (input.key === 'r' && (input.control || input.meta))
        if (isReload && callActive) event.preventDefault()
    })

    mainWindow.on('close', e => { e.preventDefault(); mainWindow.hide() })
    mainWindow.on('closed', () => { mainWindow = null })
}

// ── Tray ────────────────────────────────────────────────────
function buildTrayMenu() {
    const alwaysOnTop = mainWindow ? mainWindow.isAlwaysOnTop() : false
    return Menu.buildFromTemplate([
        { label: 'VoxFlow Dialer — v' + app.getVersion(), enabled: false },
        { type: 'separator' },
        { label: 'Afficher le dialer', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } } },
        { label: 'Masquer', click: () => mainWindow?.hide() },
        { label: 'Recharger', accelerator: 'F5', click: () => mainWindow?.loadURL(DIALER_URL) },
        {
            label:   'Toujours au premier plan',
            type:    'checkbox',
            checked: alwaysOnTop,
            click:   (item) => {
                if (!mainWindow) return
                mainWindow.setAlwaysOnTop(item.checked, 'floating')
                log('[tray] alwaysOnTop', item.checked)
                // Rebuild menu pour refléter le nouvel état
                tray?.setContextMenu(buildTrayMenu())
            },
        },
        { type: 'separator' },
        { label: 'Ouvrir le portail VoxFlow', click: () => shell.openExternal(FRONTEND_URL) },
        { label: 'Ouvrir les logs',          click: () => shell.openPath(LOG_FILE) },
        { label: 'Ouvrir le dossier logs',   click: () => shell.openPath(LOG_DIR)  },
        { type: 'separator' },
        { label: 'DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.openDevTools({ mode: 'detach' }) },
        { type: 'separator' },
        { label: 'Quitter', accelerator: 'Ctrl+Q', click: () => { if (mainWindow) mainWindow.destroy(); app.exit(0) } },
    ])
}

function createTray() {
    const iconCandidate = ['src/tray.png', 'src/icon.png', 'src/icon.ico']
        .map(p => path.join(__dirname, p))
        .find(p => { try { fs.accessSync(p); return true } catch { return false } })
    if (!iconCandidate) return

    try {
        tray = new Tray(nativeImage.createFromPath(iconCandidate))
        tray.setToolTip('VoxFlow Dialer v' + app.getVersion())
        tray.setContextMenu(buildTrayMenu())
        tray.on('click',        () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
        tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
        log('[tray] created with', iconCandidate)
    } catch (e) { log('[tray error]', e.message) }
}

// ── HTTP local server 127.0.0.1:9876 ───────────────────────
function startLocalServer() {
    localServer = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin',  '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

        if (req.method === 'GET' && req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ ok: true, version: '1.2.0', callActive }))
        }

        if (!mainWindow || mainWindow.isDestroyed()) {
            res.writeHead(503); return res.end(JSON.stringify({ error: 'Window not ready' }))
        }

        const readBody = (cb) => {
            let body = ''
            req.on('data', c => { body += c })
            req.on('end', () => {
                try { cb(JSON.parse(body || '{}')) }
                catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })) }
            })
        }

        if (req.method === 'POST' && req.url === '/auth-sync') {
            return readBody(data => {
                log('[http] /auth-sync', data.action || '?')
                if (data.action === 'login' && data.token) injectToken(data.token, data.role, data.url)
                else if (data.action === 'logout') injectLogout()
                else if (data.action === 'refresh-features') injectFeatureRefresh(data.features, data.trial)
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            })
        }

        if (req.method === 'POST' && req.url === '/dial') {
            return readBody(data => {
                log('[http] /dial', data.phone)
                mainWindow.show(); mainWindow.focus()
                mainWindow.webContents.send(channels.dialNumber, { phone: data.phone })
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            })
        }

        if (req.method === 'POST' && req.url === '/supervision') {
            return readBody(data => {
                log('[http] /supervision', data.mode)
                mainWindow.show(); mainWindow.focus()
                mainWindow.webContents.send(channels.supervisionJoin, data)
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            })
        }

        res.writeHead(404); res.end()
    })

    localServer.on('error', err => {
        if (err.code === 'EADDRINUSE') log('[http] port', LOCAL_PORT, 'in use')
        else log('[http]', err.message)
    })

    localServer.listen(LOCAL_PORT, '127.0.0.1', () => {
        log('[http] ready on 127.0.0.1:' + LOCAL_PORT)
    })
}

// ── IPC handlers ──────────────────────────────────────────
ipcMain.on(channels.callStarted,    () => { callActive = true })
ipcMain.on(channels.callEnded,      () => { callActive = false })
ipcMain.on(channels.windowMinimize, () => mainWindow?.minimize())
ipcMain.on(channels.windowClose,    () => mainWindow?.hide())
ipcMain.on(channels.windowShow,     () => { mainWindow?.show(); mainWindow?.focus() })
ipcMain.on(channels.windowMove, (_, { x, y }) => {
    if (!mainWindow) return
    const [cx, cy] = mainWindow.getPosition()
    mainWindow.setPosition(cx + (x || 0), cy + (y || 0))
})

// ── App lifecycle ─────────────────────────────────────────
app.whenReady().then(() => {
    createWindow()
    createTray()
    startLocalServer()
    app.setAppUserModelId('io.voxflow.dialer')
})

app.on('second-instance', (_, argv) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
    }
    const url = argv.find(a => a.startsWith('voxflow://'))
    if (url) {
        const parsed = parseVoxflowUrl(url)
        if (parsed?.tok) injectToken(parsed.tok, parsed.role, parsed.url)
    }
})

app.on('open-url', (event, url) => {
    event.preventDefault()
    const parsed = parseVoxflowUrl(url)
    if (parsed?.tok) injectToken(parsed.tok, parsed.role, parsed.url)
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
})

app.on('window-all-closed', () => {}) // reste dans la tray

app.on('before-quit', () => {
    try { localServer?.close() } catch {}
})
