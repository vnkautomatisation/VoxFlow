const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    // Fenetre
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close'),
    show: () => ipcRenderer.send('window-show'),
    move: (x, y) => ipcRenderer.send('window-move', { x, y }),

    // Appel — notifier Electron pour bloquer/debloquer actualisation
    callStarted: () => ipcRenderer.send('call-started'),
    callEnded: () => ipcRenderer.send('call-ended'),

    // Auth sync depuis le portail
    onAuthSync: (callback) => {
        ipcRenderer.on('auth-sync', (_, data) => callback(data))
    },

    // Dial — recevoir un numero depuis le CRM
    onDialNumber: (callback) => {
        ipcRenderer.on('dial-number', (_, data) => callback(data))
    },
    removeDialListener: () => {
        ipcRenderer.removeAllListeners('dial-number')
    },

    // Supervision — recevoir les events de la page Live
    onSupervisionJoin: (callback) => {
        ipcRenderer.on('supervision-join', (_, data) => callback(data))
    },
    removeSupervisionListener: () => {
        ipcRenderer.removeAllListeners('supervision-join')
    },
})