// preload.js — Puente seguro entre el proceso main y los renderers
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Navegación
  loginSuccess: () => ipcRenderer.send('login-success'),
  closeApp: () => ipcRenderer.send('close-app'),

  // Docker
  dockerLogin: (username, apiToken) => ipcRenderer.invoke('docker:login', username, apiToken),
  runContainer: (title, version, mode) => ipcRenderer.invoke('docker:run-container', title, version, mode),
  onDockerProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('docker:progress', handler);
    return handler;
  },
  removeDockerProgressListener: (handler) => ipcRenderer.removeListener('docker:progress', handler),
  checkContainer: (title, version) => ipcRenderer.invoke('docker:check-container', title, version),
  resetData: () => ipcRenderer.invoke('docker:reset-data'),

  // Archivos
  saveChallenge: (destFolder, challengeName, arrayBuffer) =>
    ipcRenderer.invoke('files:save-challenge', destFolder, challengeName, Array.from(new Uint8Array(arrayBuffer))),
  getHomePath: () => ipcRenderer.invoke('app:get-home-dir'),
  getDownloadsPath: () => ipcRenderer.invoke('app:get-downloads-dir'),

  // Clipboard
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

  // Docker install
  installDocker: (password) => ipcRenderer.invoke('docker:install', password),
  onDockerInstallOutput: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('docker:install-output', handler);
    return handler;
  },
  removeDockerInstallOutputListener: (handler) =>
    ipcRenderer.removeListener('docker:install-output', handler),

  // App
  restartApp: () => ipcRenderer.send('restart-app'),
});
