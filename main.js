// main.js
const { app, BrowserWindow, ipcMain, dialog, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec, execFile } = require('child_process');
const { autoUpdater } = require('electron-updater');
const {
  parseNetworkTemplates,
  renderComposeTemplate,
  selectDynamicSubnets,
  findPostUpConflicts
} = require('./controllers/composeNetworkAllocator');

let mainWindow;
let harborCredentials = null;
const composeOperations = new Set();
let startupDockerError = null;

function getComposeCacheDir(challengeID) {
  const id = String(challengeID);
  if (!/^\d+$/.test(id)) throw new Error('Identificador de reto inválido.');
  return path.join(os.homedir(), '.cache', 'grafeno', 'compose', id);
}

function cacheCompose(challengeID, composeYaml, composeSha256) {
  if (process.platform !== 'linux') throw new Error('Docker Compose solo está disponible en Linux.');
  if (typeof composeYaml !== 'string' || Buffer.byteLength(composeYaml, 'utf8') > 256 * 1024) {
    throw new Error('El fichero Compose no es válido o supera 256 KiB.');
  }
  if (typeof composeSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(composeSha256)) {
    throw new Error('Hash Compose inválido.');
  }
  const actualHash = crypto.createHash('sha256').update(composeYaml, 'utf8').digest('hex');
  if (actualHash !== composeSha256.toLowerCase()) throw new Error('El hash del fichero Compose no coincide.');

  const directory = getComposeCacheDir(challengeID);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const yamlPath = path.join(directory, 'docker-compose.yml');
  const hashPath = path.join(directory, 'compose.sha256');
  if (fs.existsSync(yamlPath) && fs.existsSync(hashPath)) {
    const cachedHash = fs.readFileSync(hashPath, 'utf8').trim();
    if (cachedHash === actualHash && crypto.createHash('sha256').update(fs.readFileSync(yamlPath)).digest('hex') === actualHash) {
      fs.chmodSync(yamlPath, 0o600);
      fs.chmodSync(hashPath, 0o600);
      return yamlPath;
    }
  }

  const suffix = `${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const yamlTemp = `${yamlPath}.${suffix}`;
  const hashTemp = `${hashPath}.${suffix}`;
  try {
    fs.writeFileSync(yamlTemp, composeYaml, { mode: 0o600, flag: 'wx' });
    fs.writeFileSync(hashTemp, `${actualHash}\n`, { mode: 0o600, flag: 'wx' });
    fs.renameSync(yamlTemp, yamlPath);
    fs.renameSync(hashTemp, hashPath);
  } finally {
    for (const temporaryPath of [yamlTemp, hashTemp]) {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
  }
  return yamlPath;
}

function getVerifiedComposePath(challengeID) {
  const directory = getComposeCacheDir(challengeID);
  const yamlPath = path.join(directory, 'docker-compose.yml');
  const hashPath = path.join(directory, 'compose.sha256');
  if (!fs.existsSync(yamlPath) || !fs.existsSync(hashPath)) throw new Error('No hay un Compose válido en caché.');
  const expectedHash = fs.readFileSync(hashPath, 'utf8').trim();
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(yamlPath)).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || expectedHash !== actualHash) {
    throw new Error('La caché Compose está dañada; vuelve a cargar el reto.');
  }
  return yamlPath;
}

function writeFileAtomically(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, contents, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

async function prepareRuntimeCompose(challengeID, rejectedSubnets = {}) {
  const templatePath = getVerifiedComposePath(challengeID);
  const directory = path.dirname(templatePath);
  const template = fs.readFileSync(templatePath, 'utf8');
  const templateSha256 = fs.readFileSync(path.join(directory, 'compose.sha256'), 'utf8').trim();
  const networkTemplates = parseNetworkTemplates(template);
  const allocationPath = path.join(directory, 'allocation.json');
  const runtimePath = path.join(directory, 'docker-compose.runtime.yml');
  let previousAllocation = {};

  if (fs.existsSync(allocationPath)) {
    try {
      const allocation = JSON.parse(fs.readFileSync(allocationPath, 'utf8'));
      if (allocation.template_sha256 === templateSha256 && allocation.networks && typeof allocation.networks === 'object') {
        previousAllocation = allocation.networks;
      }
    } catch {
      previousAllocation = {};
    }
  }

  const allocations = Object.keys(networkTemplates).length
    ? await selectDynamicSubnets(String(challengeID), networkTemplates, previousAllocation, rejectedSubnets)
    : {};
  const runtimeYaml = renderComposeTemplate(template, allocations);
  const runtimeSha256 = crypto.createHash('sha256').update(runtimeYaml, 'utf8').digest('hex');
  writeFileAtomically(runtimePath, runtimeYaml);
  writeFileAtomically(allocationPath, `${JSON.stringify({
    template_sha256: templateSha256,
    networks: allocations,
    runtime_sha256: runtimeSha256
  }, null, 2)}\n`);
  return { runtimePath, allocations };
}

function getVerifiedRuntimeComposePath(challengeID) {
  const templatePath = getVerifiedComposePath(challengeID);
  const directory = path.dirname(templatePath);
  const allocationPath = path.join(directory, 'allocation.json');
  const runtimePath = path.join(directory, 'docker-compose.runtime.yml');
  if (!fs.existsSync(allocationPath) || !fs.existsSync(runtimePath)) {
    throw new Error('No hay una configuración Compose renderizada en caché; inicia el reto antes de detenerlo.');
  }
  const allocation = JSON.parse(fs.readFileSync(allocationPath, 'utf8'));
  const runtimeHash = crypto.createHash('sha256').update(fs.readFileSync(runtimePath)).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(allocation.template_sha256 || '') || allocation.runtime_sha256 !== runtimeHash) {
    throw new Error('La configuración Compose renderizada está dañada; vuelve a cargar el reto.');
  }
  return runtimePath;
}

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
        const dockerError = new Error('Docker no está instalado o no se encontró. Puedes instalar Docker usando el script de https://github.com/Offensive-Skills/Grafeno/blob/main/setup_docker.sh (para Ubuntu y Kali Linux)');
        dockerError.code = 'DOCKER_MISSING';
        return reject(dockerError);
      }
      if (process.platform !== 'linux') return resolve();
      exec('docker compose version --short', (composeError, composeVersion) => {
        const versionMatch = composeVersion?.match(/v?(\d+)\.(\d+)\.(\d+)/);
        const version = versionMatch?.slice(1).map(Number);
        const minimumVersion = [2, 33, 1];
        const meetsMinimum = version && (version[0] > minimumVersion[0]
          || (version[0] === minimumVersion[0] && version[1] > minimumVersion[1])
          || (version[0] === minimumVersion[0] && version[1] === minimumVersion[1] && version[2] >= minimumVersion[2]));
        if (composeError || !meetsMinimum) {
          const composeErrorMessage = new Error('Docker Compose v2.33.1 o superior es necesario para la selección explícita del gateway de gestión. Instala/actualiza el plugin docker-compose-plugin y reinicia Grafeno.');
          composeErrorMessage.code = 'COMPOSE_MISSING';
          return reject(composeErrorMessage);
        }
        exec('docker info', (infoError, infoStdout, infoStderr) => {
          if (!infoError) return resolve();
          const combined = `${infoStdout || ''}${infoStderr || ''}`;
          if (/permission denied|not a docker group|docker\.sock/i.test(combined) || infoError.code === 13) {
            const permError = new Error('Tu usuario no tiene permisos para comunicarse con Docker. Falta añadirlo al grupo docker.');
            permError.code = 'DOCKER_PERM_MISSING';
            return reject(permError);
          }
          if (/Is the docker daemon running|Cannot connect to the Docker daemon|connection refused/i.test(combined)) {
            const daemonError = new Error('El servicio de Docker no está iniciado. Inícialo con: sudo systemctl start docker');
            daemonError.code = 'DOCKER_DAEMON_STOPPED';
            return reject(daemonError);
          }
          const genericError = new Error('No se pudo conectar con Docker: ' + combined.trim());
          genericError.code = 'DOCKER_ERROR';
          return reject(genericError);
        });
      });
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
      startupDockerError = { code: err.code || 'DOCKER_ERROR', message: err.message };
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

  autoUpdater.checkForUpdates();
}

// ── IPC Handlers ────────────────────────────────────────────────────

// Navegación
ipcMain.on('login-success', () => {
  mainWindow.loadFile(path.join(__dirname, 'views/main', 'mainMenu.html'));
});

ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.handle('docker:get-startup-error', () => startupDockerError);

function dockerLogin(username, apiToken) {
  if (typeof username !== 'string' || !username.trim() || username.length > 255 || /\s/.test(username)) {
    return Promise.resolve(false);
  }
  if (typeof apiToken !== 'string' || !apiToken || apiToken.length > 4096) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = spawn('docker', ['login', 'harbor.offs.es', '-u', username, '--password-stdin']);
    child.stdout.resume();
    child.stderr.resume();
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
    child.stdin.on('error', () => {});
    child.stdin.end(`${apiToken}\n`);
  });
}

ipcMain.handle('docker:login', async (_event, username, apiToken) => {
  const success = await dockerLogin(username, apiToken);
  harborCredentials = success ? { username, apiToken } : null;
  return success;
});

function publishDockerProgress(data, operationId) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('docker:progress', { ...data, operationId });
}

function runManagedScript(scriptName, args, progressMode = 'none', operationId) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [getScriptPath(scriptName), ...args]);
    let output = '';
    let lineBuffer = '';
    let totalLayers = 0;
    let completedLayers = 0;

    const handleOutput = (data) => {
      const text = data.toString();
      output += text;
      if (output.length > 256 * 1024) output = output.slice(-256 * 1024);
      lineBuffer += text;
      if (lineBuffer.length > 64 * 1024) lineBuffer = lineBuffer.slice(-64 * 1024);
      const lines = lineBuffer.split(/[\r\n]+/);
      lineBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('GRAFENO_STATUS=')) continue;
        if (progressMode === 'compose') {
          if (/\bpull\b/i.test(line)) publishDockerProgress({ phase: 'downloading' }, operationId);
          else if (/\bup\b/i.test(line)) publishDockerProgress({ phase: 'preparing' }, operationId);
        } else if (progressMode === 'container') {
          if (line.includes('Pulling fs layer')) totalLayers++;
          if (line.includes('Download complete') || line.includes('Already exists')) completedLayers++;
          if (totalLayers > 0) {
            const percent = Math.min(99, Math.floor((completedLayers / totalLayers) * 100));
            publishDockerProgress({ percent, phase: 'downloading' }, operationId);
          } else if (/pull|download/i.test(line)) {
            publishDockerProgress({ phase: 'downloading' }, operationId);
          }
        }
      }
    };

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);
    child.on('error', reject);
    child.on('close', (code) => {
      output += lineBuffer;
      const status = output.match(/^GRAFENO_STATUS=(ok|error phase=([a-z_]+) reason=([a-z_]+))\s*$/m);
      if (code === 0 && status?.[1] === 'ok') {
        publishDockerProgress({ percent: 100, phase: 'done' }, operationId);
        resolve('Process finished');
        return;
      }
      const error = new Error('No se pudo completar la operación Docker. Revisa que la imagen exista y que tengas permisos en Harbor.');
      error.phase = status?.[2] || 'unknown';
      error.reason = status?.[3] || 'script_failed';
      error.exitCode = code;
      reject(error);
    });
  });
}

async function runManagedScriptWithAuthRetry(scriptName, args, progressMode, operationId) {
  try {
    return await runManagedScript(scriptName, args, progressMode, operationId);
  } catch (error) {
    if (error.phase !== 'pull' || error.reason !== 'unauthorized' || !harborCredentials) throw error;
    publishDockerProgress({ phase: 'authenticating' }, operationId);
    const authenticated = await dockerLogin(harborCredentials.username, harborCredentials.apiToken);
    if (!authenticated) throw new Error('La sesión de Harbor ha caducado o no tienes permisos para descargar esta imagen.');
    return runManagedScript(scriptName, args, progressMode, operationId);
  }
}

// Docker: ejecutar contenedor (con streaming de progreso)
ipcMain.handle('docker:run-container', async (_event, title, version, mode) => {
  const domain = 'harbor.offs.es/challenges/';
  const operationId = `${title}${version}`;
  return runManagedScriptWithAuthRetry('containerManager.sh', [domain, String(title), String(version), String(mode)], 'container', operationId);
});

ipcMain.handle('compose:cache', async (_event, challengeID, composeYaml, composeSha256) => {
  cacheCompose(challengeID, composeYaml, composeSha256);
  return true;
});

async function runComposeStartWithNetworkRetry(challengeID) {
  const rejectedSubnets = {};
  let lastConflict = null;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { runtimePath, allocations } = await prepareRuntimeCompose(challengeID, rejectedSubnets);
    try {
      const result = await runManagedScriptWithAuthRetry(
        'composeManager.sh',
        ['start', challengeID, runtimePath],
        'compose',
        `compose-${challengeID}`
      );
      const conflicts = await findPostUpConflicts(challengeID, allocations);
      if (Object.keys(conflicts).length === 0) return result;
      const unallocatedNetworkConflicts = Object.keys(conflicts).filter((name) => !Object.hasOwn(allocations, name));
      if (unallocatedNetworkConflicts.length > 0) {
        await runManagedScriptWithAuthRetry(
          'composeManager.sh',
          ['stop', challengeID, runtimePath],
          'none',
          `compose-${challengeID}`
        );
        throw new Error(`Docker asignó una bridge en un prefijo que se solapa con rutas del host: ${unallocatedNetworkConflicts.join(', ')}. Revisa default-address-pools de Docker.`);
      }
      lastConflict = new Error(`La red asignada se solapó con una ruta que apareció durante el arranque: ${Object.values(conflicts).join(', ')}`);
      Object.assign(rejectedSubnets, Object.fromEntries(
        Object.entries(conflicts).map(([name, cidr]) => [name, [...(rejectedSubnets[name] || []), cidr]])
      ));
    } catch (error) {
      if (error.phase !== 'up' || error.reason !== 'network_conflict') throw error;
      lastConflict = error;
      for (const [name, cidr] of Object.entries(allocations)) {
        rejectedSubnets[name] = [...(rejectedSubnets[name] || []), cidr];
      }
    }

    await runManagedScriptWithAuthRetry(
      'composeManager.sh',
      ['stop', challengeID, runtimePath],
      'none',
      `compose-${challengeID}`
    );
  }

  throw new Error(`No se encontró una red libre tras ${maxAttempts} intentos. Revisa rutas locales/VPNs. Último conflicto: ${lastConflict?.message || 'desconocido'}`);
}

ipcMain.handle('compose:run', async (_event, challengeID, mode) => {
  if (process.platform !== 'linux') throw new Error('Docker Compose solo está disponible en Linux.');
  if (!['start', 'stop'].includes(mode)) throw new Error('Modo Compose inválido.');
  const id = String(challengeID);
  if (composeOperations.has(id)) throw new Error('Ya hay una operación en curso para este reto.');
  composeOperations.add(id);
  try {
    if (mode === 'start') return await runComposeStartWithNetworkRetry(id);
    const runtimePath = getVerifiedRuntimeComposePath(id);
    return await runManagedScriptWithAuthRetry('composeManager.sh', ['stop', id, runtimePath], 'none', `compose-${id}`);
  } finally {
    composeOperations.delete(id);
  }
});

ipcMain.handle('compose:check', async (_event, challengeID) => {
  if (process.platform !== 'linux') return 'Inactive';
  const scriptPath = getScriptPath('checkCompose.sh');
  return new Promise((resolve) => {
    execFile('bash', [scriptPath, String(challengeID)], (error, stdout) => {
      if (error) {
        console.error('Error al ejecutar checkCompose.sh:', error.message);
        resolve('Inactive');
      } else {
        resolve(stdout.trim() || 'Inactive');
      }
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
let activeInstallChild = null;
let activeInstallTimer = null;

function terminateInstallProcess(signal = 'SIGTERM') {
  if (!activeInstallChild) return;
  const child = activeInstallChild;
  try {
    child.kill(signal);
  } catch (_err) {
    // El proceso ya terminó o no admite la señal
  }
  setTimeout(() => {
    try {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    } catch (_err) {
      // El proceso ya terminó
    }
  }, 3000).unref();
}

ipcMain.handle('docker:cancel-install', () => {
  if (!activeInstallChild) return { cancelled: false };
  if (activeInstallTimer) {
    clearTimeout(activeInstallTimer);
    activeInstallTimer = null;
  }
  terminateInstallProcess('SIGTERM');
  activeInstallChild = null;
  return { cancelled: true };
});

ipcMain.handle('docker:install', async (_event, password) => {
  const localScriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'setup_docker.sh')
    : path.join(app.getAppPath(), 'setup_docker.sh');
  const scriptExists = fs.existsSync(localScriptPath);

  let installCmd;
  if (scriptExists) {
    installCmd = `bash '${localScriptPath.replace(/'/g, "'\\''")}'`;
  } else {
    const repoUrl = 'https://raw.githubusercontent.com/Offensive-Skills/Grafeno/main/setup_docker.sh';
    installCmd = [
      'command -v curl >/dev/null 2>&1 && {',
      `  curl -fsSL '${repoUrl}' | bash -s`,
      '} || command -v wget >/dev/null 2>&1 && {',
      `  wget -qO- '${repoUrl}' | bash -s`,
      '} || {',
      '  apt-get update -y && apt-get install -y curl &&',
      `  curl -fsSL '${repoUrl}' | bash -s`,
      '}'
    ].join('\n');
  }

  return new Promise((resolve, reject) => {
    const child = spawn('sudo', ['-S', 'bash', '-c', installCmd], {
      detached: false
    });
    activeInstallChild = child;

    const clearTimer = () => {
      if (activeInstallTimer) {
        clearTimeout(activeInstallTimer);
        activeInstallTimer = null;
      }
    };

    activeInstallTimer = setTimeout(() => {
      terminateInstallProcess('SIGTERM');
    }, 10 * 60 * 1000);

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

    child.on('error', (err) => {
      if (activeInstallChild === child) {
        activeInstallChild = null;
        clearTimer();
      }
      reject(err);
    });

    child.on('close', (code, signal) => {
      if (activeInstallChild === child) {
        activeInstallChild = null;
        clearTimer();
      }
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        resolve({ success: false, output, cancelled: true });
        return;
      }
      resolve({ success: code === 0, output });
    });
  });
});

// Docker: iniciar el servicio del daemon (daemon detenido)
ipcMain.handle('docker:start-service', async (_event, password) => {
  return new Promise((resolve, reject) => {
    const child = spawn('sudo', ['-S', 'systemctl', 'start', 'docker']);
    child.stdin.write(password + '\n');
    child.stdin.end();

    let output = '';
    const stripAnsi = (text) => text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');

    child.stderr.on('data', (data) => {
      const text = stripAnsi(data.toString());
      if (!text.includes('[sudo]') && !text.includes('password for')) output += text;
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve({ success: code === 0, output }));
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
  const updaterStrings = (app.getLocale() || 'es').startsWith('en')
    ? { title: 'Update available', message: 'The update has been downloaded. Restart the application to install it?', buttons: ['Restart', 'Later'] }
    : { title: 'Actualización disponible', message: 'La actualización se ha descargado. ¿Deseas reiniciar la aplicación para instalarla?', buttons: ['Reiniciar', 'Más tarde'] };
  const dialogOptions = {
    type: 'info',
    title: updaterStrings.title,
    message: updaterStrings.message,
    buttons: updaterStrings.buttons
  };

  const showDialog = mainWindow && !mainWindow.isDestroyed()
    ? dialog.showMessageBox(mainWindow, dialogOptions)
    : dialog.showMessageBox(dialogOptions);

  showDialog.then((result) => {
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
