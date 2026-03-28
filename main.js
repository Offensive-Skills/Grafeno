// main.js
const { app, BrowserWindow, ipcMain, dialog, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec, execFile } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function getScriptPath(scriptName) {
  const basePath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : app.getAppPath();
  return path.join(basePath, 'scripts', scriptName);
}

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
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
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

  if (process.env.GRAFENO_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

  // Abrir enlaces externos en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  autoUpdater.checkForUpdatesAndNotify();
}

// ── IPC Handlers ────────────────────────────────────────────────────

// Navegación
ipcMain.on('login-success', () => {
  mainWindow.loadFile(path.join(__dirname, 'views/main', 'mainMenu.html'));
});

ipcMain.on('close-app', () => {
  app.quit();
});

// Docker login
ipcMain.handle('docker:login', async (_event, username, apiToken) => {
  const harbor = 'harbor.offs.es';
  return new Promise((resolve) => {
    const dockerLogin = spawn('docker', ['login', harbor, '-u', username, '-p', apiToken]);

    dockerLogin.stdout.on('data', (data) => {
      console.log(`STDOUT: ${data}`);
    });

    dockerLogin.stderr.on('data', (data) => {
      console.error(`STDERR: ${data}`);
    });

    dockerLogin.on('close', (code) => {
      resolve(code === 0);
    });

    dockerLogin.on('error', () => {
      resolve(false);
    });
  });
});

// Docker: ejecutar contenedor (con streaming de progreso)
ipcMain.handle('docker:run-container', async (_event, title, version, mode) => {
  const scriptPath = getScriptPath('containerManager.sh');
  const domain = 'harbor.offs.es/challenges/';

  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath, domain, title, version, mode]);

    let totalLayers = 0;
    let downloadedLayers = 0;
    let downloadPhaseComplete = false;

    child.stdout.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.includes('Pulling fs layer')) totalLayers++;
        if (line.includes('Download complete') || line.includes('Already exists')) {
          downloadedLayers++;
        }
      });

      if (totalLayers > 0 && mainWindow) {
        if (downloadedLayers < totalLayers) {
          const percent = Math.floor((downloadedLayers / totalLayers) * 100);
          mainWindow.webContents.send('docker:progress', { percent, phase: 'downloading' });
        } else if (!downloadPhaseComplete) {
          downloadPhaseComplete = true;
          mainWindow.webContents.send('docker:progress', { percent: 100, phase: 'preparing' });
        }
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`Docker STDERR: ${data}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        if (mainWindow) mainWindow.webContents.send('docker:progress', { percent: 100, phase: 'done' });
        resolve('Process finished');
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
});

// Docker: comprobar IP del contenedor
ipcMain.handle('docker:check-container', async (_event, title, version) => {
  const scriptPath = getScriptPath('checkContainer.sh');
  return new Promise((resolve) => {
    execFile('bash', [scriptPath, title, version], (error, stdout) => {
      if (error) {
        console.error('Error al ejecutar checkContainer.sh:', error);
        resolve('Inactive');
      } else {
        const ip = stdout.trim();
        resolve(ip === 'Inactive' ? 'Inactive' : ip);
      }
    });
  });
});

// Docker: resetear datos (eliminar contenedores e imágenes)
ipcMain.handle('docker:reset-data', async () => {
  const scriptPath = getScriptPath('resetData.sh');
  return new Promise((resolve, reject) => {
    execFile('bash', [scriptPath], (error) => {
      if (error) {
        console.error(`Error al resetear datos: ${error}`);
        reject(error);
      } else {
        console.log('Reset de datos completado');
        resolve(true);
      }
    });
  });
});

// Archivos: guardar descarga de reto
ipcMain.handle('files:save-challenge', async (_event, destFolder, challengeName, arrayData) => {
  const buffer = Buffer.from(arrayData);
  const challengeFolder = path.join(destFolder, challengeName);

  if (!fs.existsSync(destFolder)) {
    throw new Error(`La carpeta "${destFolder}" indicada en configuración no se ha encontrado.`);
  }

  if (!fs.existsSync(challengeFolder)) {
    fs.mkdirSync(challengeFolder, { recursive: true });
  }

  const filePath = path.join(challengeFolder, `${challengeName}.zip`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
});

// App: obtener rutas del sistema
ipcMain.handle('app:get-home-dir', async () => {
  return app.getPath('home');
});

ipcMain.handle('app:get-downloads-dir', async () => {
  return app.getPath('downloads');
});

// Clipboard
ipcMain.handle('clipboard:write', async (_event, text) => {
  clipboard.writeText(text);
  return true;
});

// Docker: instalar Docker en el sistema
ipcMain.handle('docker:install', async (_event, password) => {
  const installCmd = "curl -fsSL 'https://raw.githubusercontent.com/Offensive-Skills/Grafeno/main/setup_docker.sh' | bash -s";

  return new Promise((resolve, reject) => {
    const child = spawn('sudo', ['-S', 'bash', '-c', installCmd]);

    child.stdin.write(password + '\n');
    child.stdin.end();

    let output = '';
    const stripAnsi = (text) => text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');

    child.stdout.on('data', (data) => {
      const text = stripAnsi(data.toString());
      output += text;
      if (mainWindow) mainWindow.webContents.send('docker:install-output', text);
    });

    child.stderr.on('data', (data) => {
      const text = stripAnsi(data.toString());
      if (!text.includes('[sudo]') && !text.includes('password for')) {
        output += text;
        if (mainWindow) mainWindow.webContents.send('docker:install-output', text);
      }
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, output });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
});

// Reiniciar la aplicación
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// ── Configuración de autoUpdater ────────────────────────────────────

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

// ── Ciclo de vida de la app ─────────────────────────────────────────

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

