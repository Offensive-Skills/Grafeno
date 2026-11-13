// views/update/password-preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updateAPI', {
  getUpdateStatus: () => ipcRenderer.invoke('updates:get-status'),
  installUpdateWithPassword: (password) => ipcRenderer.invoke('updates:install-with-password', password),
  closeInstallWindow: () => ipcRenderer.send('updates:close-install-window')
});
