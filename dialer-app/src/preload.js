const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openDialer: () => ipcRenderer.send('open-dialer'),
  getToken:   () => localStorage.getItem('vf_tok'),
  getExt:     () => localStorage.getItem('vf_ext'),
})