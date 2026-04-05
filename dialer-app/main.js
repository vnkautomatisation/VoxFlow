const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } = require("electron")
const path = require("path")

// Fix DPI Windows
app.commandLine.appendSwitch("high-dpi-support", "1")
app.commandLine.appendSwitch("force-device-scale-factor", "1")

// ── URL unique — servi par Next.js (dev) ou Vercel (prod) ────────
// Un seul fichier HTML : frontend\public\VoxFlow-Dialer.html
const IS_DEV   = !app.isPackaged
const BASE_URL = IS_DEV
  ? "http://localhost:3001/VoxFlow-Dialer.html"
  : "https://app.voxflow.io/VoxFlow-Dialer.html"

// Protocole voxflow://
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("voxflow", process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient("voxflow")
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

let win = null, tray = null
let pendingTok = "", pendingUrl = "http://localhost:4000"

function parseArgs(args) {
  for (const arg of args) {
    if (arg.startsWith("voxflow://")) {
      try {
        const u   = new URL(arg)
        const tok = u.searchParams.get("tok") || ""
        const api = u.searchParams.get("url") || "http://localhost:4000"
        if (tok) { pendingTok = tok; pendingUrl = api }
      } catch {}
    }
    if (arg.startsWith("--tok=")) pendingTok = arg.split("=")[1]
    if (arg.startsWith("--url=")) pendingUrl = arg.split("=")[1]
  }
}

parseArgs(process.argv)

function buildURL() {
  if (!pendingTok) return BASE_URL
  return BASE_URL + "?tok=" + encodeURIComponent(pendingTok) + "&url=" + encodeURIComponent(pendingUrl)
}

function createWindow() {
  const { screen } = require("electron")
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    width:  360,
    height: 700,
    x: width  - 360 - 16,
    y: height - 700 - 16,
    frame:           false,
    titleBarStyle:   "hidden",
    backgroundColor: "#18181f",
    resizable:       false,
    maximizable:     false,
    fullscreenable:  false,
    skipTaskbar:     false,
    alwaysOnTop:     false,
    icon: path.join(__dirname, "src", "icon.ico"),
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, "src", "preload.js"),
      webSecurity:      false, // Autorise localhost en dev
    },
  })

  win.loadURL(buildURL())

  // Retry si le frontend n est pas encore démarré
  win.webContents.on("did-fail-load", (e, code) => {
    if (IS_DEV) {
      console.log("[VoxFlow] Frontend pas prêt — retry dans 2s...")
      setTimeout(() => { if (win) win.loadURL(buildURL()) }, 2000)
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  win.on("close", (e) => {
    if (!app.isQuiting) { e.preventDefault(); win.hide() }
  })

  win.on("closed", () => { win = null })
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "src", "tray.png")))
  tray.setToolTip("VoxFlow Dialer")
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Ouvrir VoxFlow",
      click: () => { if (win) { win.show(); win.focus() } else createWindow() }
    },
    { type: "separator" },
    { label: "Quitter", click: () => { app.isQuiting = true; app.quit() } }
  ]))
  tray.on("click", () => {
    if (!win) { createWindow(); return }
    if (win.isVisible()) win.hide(); else { win.show(); win.focus() }
  })
}

function injectToken(tok, url) {
  if (!win || !tok) return
  win.webContents.executeJavaScript(`
    try {
      localStorage.setItem("vf_tok", ${JSON.stringify(tok)});
      localStorage.setItem("vf_url", ${JSON.stringify(url)});
      if (window.S) { window.S.tok = ${JSON.stringify(tok)}; window.S.url = ${JSON.stringify(url)}; }
      if (window.initTwilioDevice) {
        if (window.__TwilioDevice) { window.__TwilioDevice.destroy(); window.__TwilioDevice = null; }
        initTwilioDevice(${JSON.stringify(url)}, ${JSON.stringify(tok)});
      }
      if (typeof showView === "function" && window.S?.tok) showView("main");
      if (typeof loadData === "function") loadData();
    } catch(e) { console.error(e) }
  `).catch(() => {})
}

ipcMain.on("window-minimize", () => win?.minimize())
ipcMain.on("window-close",    () => win?.hide())
ipcMain.on("window-move",     (e, { x, y }) => win?.setPosition(x, y))

app.whenReady().then(() => {
  createWindow()
  createTray()
  if (pendingTok) {
    win.webContents.once("did-finish-load", () => {
      setTimeout(() => injectToken(pendingTok, pendingUrl), 800)
    })
  }
})

app.on("second-instance", (e, argv) => {
  parseArgs(argv)
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show(); win.focus()
    if (pendingTok) injectToken(pendingTok, pendingUrl)
  }
})

app.on("open-url", (e, url) => {
  e.preventDefault()
  try {
    const u = new URL(url)
    pendingTok = u.searchParams.get("tok") || pendingTok
    pendingUrl = u.searchParams.get("url") || pendingUrl
    if (win) { win.show(); win.focus(); injectToken(pendingTok, pendingUrl) }
  } catch {}
})

app.on("window-all-closed", () => {})