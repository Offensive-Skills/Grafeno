// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const remoteMain = require('@electron/remote/main');
const path = require('path');
const { autoUpdater } = require('electron-updater');

remoteMain.initialize();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Grafeno',
    backgroundColor: '#2f3136',
    webPreferences: {
      nodeIntegration: true, // Habilita nodeIntegration para pruebas
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'views/login', 'login.html'));

  // Abre las DevTools para ver logs y errores
  //mainWindow.webContents.openDevTools();
  mainWindow.setMenu(null); // Elimina el menú de la ventana
  mainWindow.setMenuBarVisibility(false); // Evita que se muestre presionando Alt
  remoteMain.enable(mainWindow.webContents);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Inicia la comprobación de actualizaciones al crear la ventana
  autoUpdater.checkForUpdatesAndNotify();
}

// Configuración de los eventos de autoUpdater

// Cuando se detecta que hay una actualización disponible
autoUpdater.on('update-available', (info) => {
  console.log('Actualización disponible:', info);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Actualización descargada:', info);
  dialog.showMessageBox({
    type: 'info',
    title: 'Actualización disponible',
    message: 'La actualización se ha descargado. ¿Deseas reiniciar la aplicación para instalarla?',
    buttons: ['Reiniciar', 'Más tarde']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  console.error('Error durante la actualización:', err);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('login-success', () => {
  mainWindow.loadFile(path.join(__dirname, 'views/main', 'mainMenu.html'));
});
