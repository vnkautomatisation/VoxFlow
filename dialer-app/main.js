const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')

if (process.defaultApp) {
    if (process.argv.length >= 2)
        app.setAsDefaultProtocolClient('voxflow', process.execPath, [path.resolve(process.argv[1])])
} else {
    app.setAsDefaultProtocolClient('voxflow')
}

const gotTheLock = app.requestSingleInstanceLock()
let mainWindow = null
let tray = null
let callActive = false   // Track si un appel est en cours

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.show()
            mainWindow.focus()
        }
    })
    app.on('open-url', (event) => {
        event.preventDefault()
        if (mainWindow) { mainWindow.show(); mainWindow.focus() }
    })
    app.whenReady().then(createWindow)
}

function createWindow() {
    const iconCandidates = [
        path.join(__dirname, 'src', 'icon.ico'),
        path.join(__dirname, 'src', 'icon.png'),
        path.join(__dirname, 'icon.ico'),
    ]
    const iconPath = iconCandidates.find(p => { try { fs.accessSync(p); return true } catch { return false } })

    mainWindow = new BrowserWindow({
        width: 360,
        height: 700,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        frame: false,
        transparent: false,
        alwaysOnTop: false,
        skipTaskbar: false,
        icon: iconPath || undefined,
        webPreferences: {
            preload: path.join(__dirname, 'src', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            allowRunningInsecureContent: false,
        },
    })

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001'
    mainWindow.loadURL(FRONTEND_URL + '/VoxFlow-Dialer.html')

    try {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize
        mainWindow.setPosition(Math.max(0, width - 375), Math.max(0, height - 715))
    } catch (e) { }

    // ── Bloquer F5 / Ctrl+R pendant un appel actif ─────────────
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isReload = input.key === 'F5' ||
            (input.key === 'r' && (input.control || input.meta))
        if (isReload && callActive) {
            event.preventDefault()
            console.log('[Electron] Actualisation bloquée — appel en cours')
        }
    })

    // ── IPC — statut appel (depuis le dialer) ──────────────────
    ipcMain.on('call-started', () => {
        callActive = true
        console.log('[Electron] Appel démarré — actualisation désactivée')
    })
    ipcMain.on('call-ended', () => {
        callActive = false
        console.log('[Electron] Appel terminé — actualisation réactivée')
    })

    // ── IPC — Supervision (depuis la page Live via HTTP polling) ─
    ipcMain.on('supervision-join', (_, data) => {
        // data = { mode: 'listen'|'whisper'|'barge', callId, conferenceName }
        console.log('[Electron] Supervision:', data.mode, data.callId)
        if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
            // Envoyer au renderer (dialer HTML)
            mainWindow.webContents.send('supervision-join', data)
        }
    })

    // ── IPC — Fenêtre ──────────────────────────────────────────
    ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize())
    ipcMain.on('window-close', () => mainWindow && mainWindow.hide())
    ipcMain.on('window-show', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
    ipcMain.on('open-dialer', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
    ipcMain.on('window-move', (_, { x, y }) => {
        if (!mainWindow) return
        const [cx, cy] = mainWindow.getPosition()
        mainWindow.setPosition(cx + x, cy + y)
    })

    // ── Tray ───────────────────────────────────────────────────
    const trayPath = [
        path.join(__dirname, 'src', 'tray.png'),
        path.join(__dirname, 'src', 'icon.png'),
        iconPath,
    ].filter(Boolean).find(p => { try { fs.accessSync(p); return true } catch { return false } })

    if (trayPath) {
        try {
            tray = new Tray(nativeImage.createFromPath(trayPath))
            tray.setToolTip('VoxFlow Dialer')
            tray.setContextMenu(Menu.buildFromTemplate([
                { label: 'Ouvrir VoxFlow Dialer', click: () => { mainWindow.show(); mainWindow.focus() } },
                { type: 'separator' },
                { label: 'Quitter', click: () => { mainWindow.destroy(); app.exit(0) } },
            ]))
            tray.on('click', () => { mainWindow.show(); mainWindow.focus() })
            tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })
        } catch (e) { console.log('[tray]', e.message) }
    }

    mainWindow.on('close', e => { e.preventDefault(); mainWindow.hide() })

    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowed = ['media', 'audioCapture', 'microphone', 'notifications']
        callback(allowed.includes(permission))
    })

    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
        const allowed = ['media', 'audioCapture', 'microphone', 'notifications']
        return allowed.includes(permission)
    })

    app.setAppUserModelId('io.voxflow.dialer')
}

app.on('window-all-closed', () => { })

// ── API HTTP locale pour recevoir les events de supervision ──
// La page Live envoie POST http://localhost:9876/supervision
// Electron relaie au dialer
const http = require('http')

const localServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    if (req.method === 'POST' && req.url === '/auth-sync') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
            try {
                const data = JSON.parse(body)
                if (mainWindow) {
                    mainWindow.webContents.send('auth-sync', data)
                    console.log('[Electron] Auth sync:', data.action, data.email || '')
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
            } catch (e) {
                res.writeHead(400); res.end(JSON.stringify({ error: e.message }))
            }
        })
        return
    }

    if (req.method === 'POST' && req.url === '/dial') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
            try {
                const data = JSON.parse(body)
                console.log('[Electron] Dial recu:', data.phone)
                if (mainWindow) {
                    mainWindow.show()
                    mainWindow.focus()
                    // Envoyer le numero au dialer HTML
                    mainWindow.webContents.send('dial-number', { phone: data.phone })
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
            } catch (e) {
                res.writeHead(400); res.end(JSON.stringify({ error: e.message }))
            }
        })
        return
    }

    if (req.method === 'POST' && req.url === '/supervision') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
            try {
                const data = JSON.parse(body)
                console.log('[Electron] Supervision recu:', data.mode)
                if (mainWindow) {
                    mainWindow.show()
                    mainWindow.focus()
                    mainWindow.webContents.send('supervision-join', data)
                }
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
            } catch (e) {
                res.writeHead(400); res.end(JSON.stringify({ error: e.message }))
            }
        })
        return
    }

    res.writeHead(404); res.end()
})

localServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('[Electron] Port 9876 deja occupe - instance deja active')
        // Pas de crash - l autre instance gere le port
    } else {
        console.error('[Electron] Erreur serveur:', err.message)
    }
})

localServer.listen(9876, '127.0.0.1', () => {
    console.log('[Electron] Serveur local supervision sur port 9876')
})