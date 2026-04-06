const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron')
const path = require('path')
const fs   = require('fs')

if (process.defaultApp) {
  if (process.argv.length >= 2)
    app.setAsDefaultProtocolClient('voxflow', process.execPath, [path.resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient('voxflow')
}

const gotTheLock = app.requestSingleInstanceLock()
let mainWindow = null
let tray = null

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
    width:           360,
    height:          700,
    resizable:       false,
    maximizable:     false,
    fullscreenable:  false,
    autoHideMenuBar: true,
    frame:           false,
    transparent:     false,
    alwaysOnTop:     false,
    skipTaskbar:     false,
    icon:            iconPath || undefined,
    webPreferences: {
      preload:          path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      allowRunningInsecureContent: false,
    },
  })

  // Charger depuis Next.js qui sert public/VoxFlow-Dialer.html
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001'
  mainWindow.loadURL(FRONTEND_URL + '/VoxFlow-Dialer.html')

  try {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    mainWindow.setPosition(Math.max(0, width - 375), Math.max(0, height - 715))
  } catch(e) {}

  ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize())
  ipcMain.on('window-close',    () => mainWindow && mainWindow.hide())
  ipcMain.on('window-show',     () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
  ipcMain.on('open-dialer',     () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } })
  ipcMain.on('window-move',     (_, { x, y }) => {
    if (!mainWindow) return
    const [cx, cy] = mainWindow.getPosition()
    mainWindow.setPosition(cx + x, cy + y)
  })

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
        { type:  'separator' },
        { label: 'Quitter', click: () => { mainWindow.destroy(); app.exit(0) } },
      ]))
      tray.on('click',        () => { mainWindow.show(); mainWindow.focus() })
      tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })
    } catch(e) { console.log('[tray]', e.message) }
  }

  mainWindow.on('close', e => { e.preventDefault(); mainWindow.hide() })

  // Permissions micro + audio pour le waveform et Twilio WebRTC
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

app.on('window-all-closed', () => {})