const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("voxflow", {
  minimize: ()     => ipcRenderer.send("window-minimize"),
  close:    ()     => ipcRenderer.send("window-close"),
  move:     (x, y) => ipcRenderer.send("window-move", { x, y }),
  platform: process.platform,
})
