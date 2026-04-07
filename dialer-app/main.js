const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')

if (process.defaultApp) {
    if (process.argv.length >= 2)
        app.setAsDefaultProtocolClient('voxflow', process.execPath, [path.resolve(process.argv[1])])
} else {
    app.setAsDefaultProtocolClient('voxflow')
}

const gotTheLock = app.requestSingleInstanceLock()
let mainWindow = null
let tray = null
let callActive = false
let localServer = null

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.show(); mainWindow.focus()
        }
    })
    app.on('open-url', (event) => {
        event.preventDefault()
        if (mainWindow) { mainWindow.show(); mainWindow.focus() }
    })
    app.whenReady().then(createWindow)
}

function injectToken(token, role, url) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const t = JSON.stringify(token)
    const r = JSON.stringify(role || 'AGENT')
    const u = JSON.stringify(url || 'http://localhost:4000')
    mainWindow.webContents.executeJavaScript(
        'localStorage.setItem("vf_tok",'  + t + ');' +
        'localStorage.setItem("vf_role",' + r + ');' +
        'localStorage.setItem("vf_url",'  + u + ');' +
        'console.log("[Electron] token injecte, role:", ' + r + ');'
    ).catch(() => {})
}

function injectLogout() {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.executeJavaScript(
        'localStorage.removeItem("vf_tok");' +
        'localStorage.removeItem("vf_role");' +
        'localStorage.setItem("vf_logout", Date.now().toString());' +
        'setTimeout(()=>localStorage.removeItem("vf_logout"),200);' +
        'console.log("[Electron] logout injecte");'
    ).catch(() => {})
}

function createWindow() {
    const iconCandidates = [
        path.join(__dirname, 'src', 'icon.ico'),
        path.join(__dirname, 'src', 'icon.png'),
        path.join(__dirname, 'icon.ico'),
    ]
    const iconPath = iconCandidates.find(p => {
        try { fs.accessSync(p); return true } catch { return false }
    })

    mainWindow = new BrowserWindow({
        width: 360, height: 700,
        resizable: false, maximizable: false,
        fullscreenable: false, autoHideMenuBar: true,
        frame: false, transparent: false,
        alwaysOnTop: false, skipTaskbar: false,
        icon: iconPath || undefined,
        webPreferences: {
            preload: path.join(__dirname, 'src', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            allowRunningInsecureContent: false,
        },
    })

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001'
    mainWindow.loadURL(FRONTEND_URL + '/dialer')

    try {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize
        mainWindow.setPosition(Math.max(0, width - 375), Math.max(0, height - 715))
    } catch (e) {}

    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isReload = input.key === 'F5' || (input.key === 'r' && (input.control || input.meta))
        if (isReload && callActive) event.preventDefault()
    })

    ipcMain.on('call-started',    () => { callActive = true })
    ipcMain.on('call-ended',      () => { callActive = false })
    ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize())
    ipcMain.on('window-close',    () => mainWindow && mainWindow.hide())
    ipcMain.on('window-show',     () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
    ipcMain.on('open-dialer',     () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
    ipcMain.on('window-move', (_, { x, y }) => {
        if (!mainWindow) return
        const [cx, cy] = mainWindow.getPosition()
        mainWindow.setPosition(cx + x, cy + y)
    })
    ipcMain.on('supervision-join', (_, data) => {
        if (!mainWindow) return
        mainWindow.show(); mainWindow.focus()
        mainWindow.webContents.send('supervision-join', data)
    })

    const trayPath = [
        path.join(__dirname, 'src', 'tray.png'),
        path.join(__dirname, 'src', 'icon.png'),
        iconPath,
    ].filter(Boolean).find(p => {
        try { fs.accessSync(p); return true } catch { return false }
    })

    if (trayPath) {
        try {
            tray = new Tray(nativeImage.createFromPath(trayPath))
            tray.setToolTip('VoxFlow Dialer')
            tray.setContextMenu(Menu.buildFromTemplate([
                { label: 'Ouvrir VoxFlow Dialer', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } } },
                { type: 'separator' },
                { label: 'Quitter', click: () => { if (mainWindow) mainWindow.destroy(); app.exit(0) } },
            ]))
            tray.on('click',        () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
            tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
        } catch (e) { console.log('[tray]', e.message) }
    }

    mainWindow.on('close', e => { e.preventDefault(); mainWindow.hide() })
    mainWindow.on('closed', () => { mainWindow = null })

    mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, cb) => {
        cb(['media', 'audioCapture', 'microphone', 'notifications'].includes(permission))
    })
    mainWindow.webContents.session.setPermissionCheckHandler((wc, permission) => {
        return ['media', 'audioCapture', 'microphone', 'notifications'].includes(permission)
    })

    app.setAppUserModelId('io.voxflow.dialer')
    startLocalServer()
}

function startLocalServer() {
    localServer = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

        if (!mainWindow || mainWindow.isDestroyed()) {
            res.writeHead(503); res.end(JSON.stringify({ error: 'window not ready' })); return
        }

        const readBody = (cb) => {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
                try { cb(JSON.parse(body)) }
                catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })) }
            })
        }

        if (req.method === 'POST' && req.url === '/auth-sync') {
            readBody(data => {
                console.log('[Electron] auth-sync:', data.action, data.role || '')
                if (data.action === 'login' && data.token) {
                    injectToken(data.token, data.role, data.url)
                } else if (data.action === 'logout') {
                    injectLogout()
                }
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            }); return
        }

        if (req.method === 'POST' && req.url === '/dial') {
            readBody(data => {
                console.log('[Electron] dial:', data.phone)
                if (mainWindow) { mainWindow.show(); mainWindow.focus() }
                mainWindow.webContents.send('dial-number', { phone: data.phone })
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            }); return
        }

        if (req.method === 'POST' && req.url === '/supervision') {
            readBody(data => {
                console.log('[Electron] supervision:', data.mode)
                if (mainWindow) { mainWindow.show(); mainWindow.focus() }
                mainWindow.webContents.send('supervision-join', data)
                res.writeHead(200); res.end(JSON.stringify({ ok: true }))
            }); return
        }

        res.writeHead(404); res.end()
    })

    localServer.on('error', err => {
        if (err.code === 'EADDRINUSE') console.log('[Electron] Port 9876 deja occupe')
        else console.error('[Electron] Erreur serveur:', err.message)
    })

    localServer.listen(9876, '127.0.0.1', () => {
        console.log('[Electron] Serveur local port 9876 pret')
    })
}

app.on('window-all-closed', () => {})