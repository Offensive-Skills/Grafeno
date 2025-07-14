// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const remoteMain = require('@electron/remote/main');
const path = require('path');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

remoteMain.initialize();

let mainWindow;

function checkDockerInstalled() {
  return new Promise((resolve, reject) => {
    exec('docker --version', (error, stdout, stderr) => {
      if (error) {
        return reject(new Error('Docker no está instalado o no se encontró. Puedes instalar Docker usando el script de https://github.com/Offensive-Skills/Grafeno/blob/main/setup_docker.sh (para Ubuntu y Kali Linux)'));
      }
      resolve();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Grafeno',
    backgroundColor: '#2f3136',
    icon: path.join(__dirname, 'assets', 'images', 'logo_grafeno.png'),
    webPreferences: {
      nodeIntegration: true, 
      contextIsolation: false
    }
  });

  checkDockerInstalled()
    .then(() => {
      mainWindow.loadFile(path.join(__dirname, 'views', 'login', 'login.html'));
    })
    .catch((err) => {
      console.error(err);
      mainWindow.loadFile(path.join(__dirname, 'views', 'error', 'error.html'));
    });
  //mainWindow.webContents.openDevTools();
  mainWindow.setMenu(null); // Elimina el menú de la ventana
  mainWindow.setMenuBarVisibility(false);
  remoteMain.enable(mainWindow.webContents);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  autoUpdater.checkForUpdatesAndNotify();
}

// Configuración de los eventos de autoUpdater

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


ipcMain.on('close-app', () => {
  app.quit();
});


