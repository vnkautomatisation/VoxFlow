// ══════════════════════════════════════════════════════════════
//  VoxFlow Dialer — Minimal Electron Shell
//  v1.2.1 — diagnostic logs + extended tray menu + ready-to-show
//
//  Rôle minimal :
//   - Crée une fenêtre frameless 380x720 (show: false → évite écran noir)
//   - Charge http://localhost:3001/dialer
//   - Handle voxflow:// protocole (click-to-call depuis le portail)
//   - Serveur HTTP 127.0.0.1:9876 pour push auth/dial/supervision
//   - Tray icon avec menu étendu (afficher, recharger, portail, logs, devtools)
//   - Logs complets pour diagnostiquer load / dom-ready / render crash
//   - Fallback error.html si frontend unreachable
// ══════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, shell } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')
const http = require('http')
const channels = require('./src/ipc-channels')

app.commandLine.appendSwitch('high-dpi-support', '1')

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

log('[boot] VoxFlow Dialer v1.2.1 — loading', DIALER_URL)

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
            webSecurity:      false, // pour CORS loopback en dev
        },
    })

    log('[createWindow] loading', DIALER_URL)
    mainWindow.loadURL(DIALER_URL).catch(err => log('[loadURL error]', err.message))

    // Events diagnostiques — sans ces logs on ne sait jamais si le
    // renderer a chargé, ce qui rend l'écran noir indébug-able.
    mainWindow.webContents.on('did-start-loading', () => log('[load] started'))
    mainWindow.webContents.on('did-finish-load',   () => log('[load] finish', mainWindow.webContents.getURL()))
    mainWindow.webContents.on('dom-ready',         () => log('[load] dom-ready'))
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

    // Render process crash → recharge
    mainWindow.webContents.on('render-process-gone', (_, details) => {
        log('[render-process-gone]', details.reason, details.exitCode)
        if (details.reason !== 'clean-exit') {
            setTimeout(() => mainWindow?.loadURL(DIALER_URL).catch(() => {}), 500)
        }
    })

    // Log les erreurs JS du renderer
    mainWindow.webContents.on('console-message', (_, level, message) => {
        if (level >= 2) log('[renderer]', message) // warn / error seulement
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
function createTray() {
    const iconCandidate = ['src/tray.png', 'src/icon.png', 'src/icon.ico']
        .map(p => path.join(__dirname, p))
        .find(p => { try { fs.accessSync(p); return true } catch { return false } })
    if (!iconCandidate) return

    try {
        tray = new Tray(nativeImage.createFromPath(iconCandidate))
        tray.setToolTip('VoxFlow Dialer v' + app.getVersion())
        tray.setContextMenu(Menu.buildFromTemplate([
            { label: 'VoxFlow Dialer — v' + app.getVersion(), enabled: false },
            { type: 'separator' },
            { label: 'Afficher le dialer', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } } },
            { label: 'Masquer', click: () => mainWindow?.hide() },
            { label: 'Recharger', accelerator: 'F5', click: () => mainWindow?.loadURL(DIALER_URL) },
            { type: 'separator' },
            { label: 'Ouvrir le portail VoxFlow', click: () => shell.openExternal(FRONTEND_URL) },
            { label: 'Ouvrir les logs',          click: () => shell.openPath(LOG_FILE) },
            { label: 'Ouvrir le dossier logs',   click: () => shell.openPath(LOG_DIR)  },
            { type: 'separator' },
            { label: 'DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.openDevTools({ mode: 'detach' }) },
            { type: 'separator' },
            { label: 'Quitter', accelerator: 'Ctrl+Q', click: () => { if (mainWindow) mainWindow.destroy(); app.exit(0) } },
        ]))
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
