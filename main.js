// main.js
const { app, BrowserWindow, ipcMain, dialog, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec, execFile } = require('child_process');
const { autoUpdater, CancellationToken } = require('electron-updater');
const {
  parseNetworkTemplates,
  renderComposeTemplate,
  selectDynamicSubnets,
  findPostUpConflicts
} = require('./controllers/composeNetworkAllocator');
const { parseVersion, versionAtLeast, formatVersion } = require('./controllers/dockerVersion');
const { createUpdateState, reduce, canCheck } = require('./controllers/updateState');
const { detectPackageType, getPackageInstallPlan, shouldCheckForUpdates, DEFAULT_CHECK_INTERVAL_MS } = require('./controllers/updatePolicy');

let mainWindow;
let harborCredentials = null;
const composeOperations = new Set();
let startupDockerError = null;
let updateState = createUpdateState();
let updateLogPath = null;
let downloadCancellationToken = null;
let pendingUpdateInfo = null;
let promptedUpdateVersion = null;
let updateInstallWindow = null;
let updateCheckTimer = null;
const UPDATE_CHECK_INTERVAL_MS = Number(process.env.GRAFENO_UPDATE_INTERVAL_MS) > 0
  ? Number(process.env.GRAFENO_UPDATE_INTERVAL_MS)
  : DEFAULT_CHECK_INTERVAL_MS;

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

const MIN_DOCKER_VERSION = [28, 0, 0];
const MIN_COMPOSE_VERSION = [2, 33, 1];
const MIN_DOCKER_LABEL = formatVersion(MIN_DOCKER_VERSION);
const MIN_COMPOSE_LABEL = formatVersion(MIN_COMPOSE_VERSION);

function execCommand(command) {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

function createDockerError(code, message, vars = {}) {
  const error = new Error(message);
  error.code = code;
  error.vars = vars;
  return error;
}

function getStandaloneComposeVersion() {
  return new Promise((resolve) => {
    exec('docker-compose version', (error, stdout) => {
      if (error) return resolve(null);
      const parsed = parseVersion(stdout);
      resolve(parsed ? formatVersion(parsed) : String(stdout || '').trim() || null);
    });
  });
}

function getDockerPackageName() {
  return new Promise((resolve) => {
    exec('dpkg -S "$(command -v docker)"', (error, stdout) => {
      if (error) return resolve(null);
      const match = String(stdout || '').match(/^([^:\n]+):/);
      resolve(match ? match[1].trim() : null);
    });
  });
}

async function checkDockerInstalled() {
  const dockerResult = await execCommand('docker --version');
  if (dockerResult.error) {
    throw createDockerError(
      'DOCKER_MISSING',
      'Docker no está instalado o no se encontró. Puedes instalar Docker usando el instalador de Grafeno.'
    );
  }

  if (process.platform !== 'linux') return;

  const composeResult = await execCommand('docker compose version --short');
  const composeVersion = parseVersion(composeResult.stdout);

  if (composeResult.error || !composeVersion) {
    const standaloneVersion = await getStandaloneComposeVersion();
    if (standaloneVersion) {
      throw createDockerError(
        'COMPOSE_STANDALONE',
        `Se ha detectado docker-compose ${standaloneVersion}, pero Grafeno necesita el plugin 'docker compose' v${MIN_COMPOSE_LABEL} o superior.`,
        { version: standaloneVersion, minimum: MIN_COMPOSE_LABEL }
      );
    }
    throw createDockerError(
      'COMPOSE_MISSING',
      `No se ha encontrado el plugin 'docker compose'. Grafeno necesita Docker Compose v${MIN_COMPOSE_LABEL} o superior.`,
      { minimum: MIN_COMPOSE_LABEL }
    );
  }

  if (!versionAtLeast(composeVersion, MIN_COMPOSE_VERSION)) {
    throw createDockerError(
      'COMPOSE_OUTDATED',
      `Docker Compose ${formatVersion(composeVersion)} es anterior a v${MIN_COMPOSE_LABEL}, la versión mínima que necesita Grafeno.`,
      { version: formatVersion(composeVersion), minimum: MIN_COMPOSE_LABEL }
    );
  }

  const infoResult = await execCommand("docker info --format '{{.ServerVersion}}'");
  if (infoResult.error) {
    const combined = `${infoResult.stdout}${infoResult.stderr}`;
    if (/permission denied|not a docker group|docker\.sock/i.test(combined) || infoResult.error.code === 13) {
      throw createDockerError(
        'DOCKER_PERM_MISSING',
        'Tu usuario no tiene permisos para comunicarse con Docker. Falta añadirlo al grupo docker.'
      );
    }
    if (/Is the docker daemon running|Cannot connect to the Docker daemon|connection refused/i.test(combined)) {
      throw createDockerError(
        'DOCKER_DAEMON_STOPPED',
        'El servicio de Docker no está iniciado. Inícialo con: sudo systemctl start docker'
      );
    }
    throw createDockerError('DOCKER_ERROR', `No se pudo conectar con Docker: ${combined.trim()}`);
  }

  const serverVersion = parseVersion(infoResult.stdout);
  if (!versionAtLeast(serverVersion, MIN_DOCKER_VERSION)) {
    const packageName = await getDockerPackageName();
    const versionLabel = packageName
      ? `${formatVersion(serverVersion)} (${packageName})`
      : formatVersion(serverVersion);
    throw createDockerError(
      'DOCKER_OUTDATED',
      `Docker ${versionLabel} es anterior a ${MIN_DOCKER_LABEL}, la versión mínima que necesita Grafeno para el gateway de gestión.`,
      { version: versionLabel, minimum: MIN_DOCKER_LABEL }
    );
  }

  console.log(`[docker] Engine ${formatVersion(serverVersion)} | Compose ${formatVersion(composeVersion)}`);
}

async function refreshDockerStatus() {
  try {
    await checkDockerInstalled();
    startupDockerError = null;
    return true;
  } catch (error) {
    startupDockerError = {
      code: error.code || 'DOCKER_ERROR',
      message: error.message,
      vars: error.vars || {}
    };
    return false;
  }
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

  refreshDockerStatus().then((dockerReady) => {
    const view = dockerReady
      ? path.join(__dirname, 'views', 'login', 'login.html')
      : path.join(__dirname, 'views', 'error', 'error.html');
    mainWindow.loadFile(view);
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

  checkForUpdatesNow();
}

// ── IPC Handlers ────────────────────────────────────────────────────

// Navegación
ipcMain.on('login-success', async () => {
  const dockerReady = await refreshDockerStatus();
  const view = dockerReady
    ? path.join(__dirname, 'views', 'main', 'mainMenu.html')
    : path.join(__dirname, 'views', 'error', 'error.html');
  mainWindow.loadFile(view);
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
  if (String(mode) === '0') await checkDockerInstalled();
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
    if (mode === 'start') {
      await checkDockerInstalled();
      return await runComposeStartWithNetworkRetry(id);
    }
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

ipcMain.handle('app:get-version', () => app.getVersion());

// Clipboard
ipcMain.handle('clipboard:write', async (_event, text) => {
  clipboard.writeText(text);
  return true;
});

// Docker: instalar Docker en el sistema
const INSTALL_TIMEOUT_MS = 60 * 60 * 1000;
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
    }, INSTALL_TIMEOUT_MS);

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

function getUpdateLogPath() {
  if (updateLogPath) return updateLogPath;
  try {
    const logDir = app.getPath('logs');
    fs.mkdirSync(logDir, { recursive: true });
    updateLogPath = path.join(logDir, 'updater.log');
  } catch {
    updateLogPath = path.join(os.tmpdir(), 'grafeno-updater.log');
  }
  return updateLogPath;
}

function logUpdateEvent(message) {
  try {
    const logPath = getUpdateLogPath();
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 1024 * 1024) {
      fs.truncateSync(logPath, 0);
    }
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {
    // El log de actualización nunca debe romper la app.
  }
}

function getUpdateStatusPayload() {
  return {
    ...updateState,
    logPath: getUpdateLogPath(),
    hasPendingUpdate: Boolean(pendingUpdateInfo)
  };
}

function broadcastUpdateState() {
  const payload = getUpdateStatusPayload();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('updates:status', payload);
  }
}

function applyUpdateEvent(event) {
  updateState = reduce(updateState, event);
  updateState.currentVersion = app.getVersion();
  broadcastUpdateState();

  if (event.type === 'progress') return updateState;

  if (event.type === 'error') {
    logUpdateEvent(`ERROR: ${event.error && event.error.message ? event.error.message : 'desconocido'}`);
  } else {
    logUpdateEvent(`${event.type}${event.version ? ` ${event.version}` : ''}`);
  }
  return updateState;
}

function handleUpdateError(error) {
  applyUpdateEvent({ type: 'error', error, at: Date.now() });
  logUpdateEvent(error && error.stack ? error.stack : String(error));
}

async function checkForUpdatesNow() {
  if (['downloaded', 'installing'].includes(updateState.state)) return updateState;
  if (!canCheck(updateState)) return updateState;

  applyUpdateEvent({ type: 'checking' });
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result == null && updateState.state === 'checking') {
      applyUpdateEvent({ type: 'not-available' });
    }
    return updateState;
  } catch (error) {
    handleUpdateError(error);
    return updateState;
  }
}

function startUpdateCheckTimer() {
  if (updateCheckTimer || !app.isPackaged) return;
  updateCheckTimer = setInterval(() => {
    if (shouldCheckForUpdates({
      isPackaged: app.isPackaged,
      platform: process.platform,
      lastCheckAt: updateState.lastCheckedAt,
      state: updateState.state,
      intervalMs: UPDATE_CHECK_INTERVAL_MS
    })) {
      checkForUpdatesNow();
    }
  }, Math.max(1000, UPDATE_CHECK_INTERVAL_MS));
}

ipcMain.handle('updates:get-status', () => getUpdateStatusPayload());

ipcMain.handle('updates:check-now', async () => {
  const status = await checkForUpdatesNow();
  return { ok: true, status: { ...status, logPath: getUpdateLogPath(), hasPendingUpdate: Boolean(pendingUpdateInfo) } };
});

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

function startUpdateDownload() {
  if (updateState.state !== 'available' || downloadCancellationToken) return;

  const token = new CancellationToken();
  downloadCancellationToken = token;
  applyUpdateEvent({ type: 'downloading', version: updateState.version });

  autoUpdater.downloadUpdate(token).catch((error) => {
    if (token.cancelled) return;
    handleUpdateError(error);
  }).finally(() => {
    if (downloadCancellationToken === token) downloadCancellationToken = null;
  });
}

function cancelUpdateDownload() {
  if (!downloadCancellationToken) return false;
  downloadCancellationToken.cancel();
  downloadCancellationToken = null;
  applyUpdateEvent({ type: 'cancelled' });
  return true;
}

function getInstalledPackageType() {
  if (process.env.APPIMAGE) return 'appimage';
  try {
    const packageTypePath = path.join(process.resourcesPath, 'package-type');
    if (fs.existsSync(packageTypePath)) {
      return detectPackageType(fs.readFileSync(packageTypePath, 'utf8'), process.env.APPIMAGE);
    }
  } catch {
    // Sin package-type no se puede instalar de forma personalizada.
  }
  return 'unknown';
}

function findPackageFileInfo(info, packageType) {
  const extension = packageType === 'deb' ? '.deb' : packageType === 'rpm' ? '.rpm' : null;
  if (!extension || !info || !Array.isArray(info.files)) return null;
  return info.files.find((file) => typeof file.url === 'string' && file.url.toLowerCase().endsWith(extension)) || null;
}

function verifyDownloadedPackage(info, packageType) {
  const filePath = info && info.downloadedFile;
  if (!filePath || !fs.existsSync(filePath)) throw new Error('No se encontró el paquete descargado.');

  const fileInfo = findPackageFileInfo(info, packageType);
  if (!fileInfo) throw new Error('La actualización no incluye un paquete válido.');

  const stats = fs.statSync(filePath);
  if (fileInfo.size && stats.size !== fileInfo.size) throw new Error('El tamaño del paquete no coincide.');

  const hash = crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');
  if (fileInfo.sha512 && hash !== fileInfo.sha512) throw new Error('La firma del paquete no coincide.');
  return filePath;
}

function runSudoCommand(password, command, args, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve) => {
    const child = spawn('sudo', ['-S', command, ...args], { detached: false });
    let output = '';
    let settled = false;
    const stripAnsi = (text) => text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // El proceso ya terminó.
      }
    }, timeoutMs);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    try {
      child.stdin.write(password + '\n');
      child.stdin.end();
    } catch {
      // El proceso pudo haber terminado antes de recibir la contraseña.
    }

    child.stdout.on('data', (data) => {
      output += stripAnsi(data.toString());
    });
    child.stderr.on('data', (data) => {
      const text = stripAnsi(data.toString());
      if (!/password for|\[sudo\]/i.test(text)) output += text;
    });
    child.on('error', (error) => finish({ success: false, output: `${output}${error.message}` }));
    child.on('close', (code) => finish({ success: code === 0, output }));
  });
}

async function installDownloadedUpdate(password) {
  if (!pendingUpdateInfo) {
    return { success: false, error: 'No hay una actualización descargada.' };
  }

  const packageType = getInstalledPackageType();
  const plan = getPackageInstallPlan(packageType, pendingUpdateInfo.downloadedFile);
  if (!plan) {
    return { success: false, error: 'El tipo de paquete instalado no permite actualizar automáticamente.' };
  }
  if (plan.native) {
    autoUpdater.quitAndInstall();
    return { success: true, native: true };
  }
  if (typeof password !== 'string' || password.length === 0 || password.length > 256) {
    return { success: false, error: 'Introduce tu contraseña de administrador.' };
  }

  try {
    verifyDownloadedPackage(pendingUpdateInfo, packageType);
  } catch (error) {
    return { success: false, error: error.message };
  }

  applyUpdateEvent({ type: 'installing' });
  const runPlan = (command, args) => runSudoCommand(password, command, args);
  let result = await runPlan(plan.command, plan.args);
  if (!result.success && plan.fallback) {
    result = await runPlan(plan.fallback.command, plan.fallback.args);
  }

  if (!result.success) {
    applyUpdateEvent({ type: 'error', error: new Error(result.output || 'No se pudo instalar el paquete.') });
    return { success: false, error: 'No se pudo instalar la actualización.', output: result.output };
  }

  logUpdateEvent(`installed ${updateState.version}`);
  setImmediate(() => {
    app.relaunch();
    app.exit(0);
  });
  return { success: true, output: result.output };
}

function openUpdateInstallWindow() {
  if (updateInstallWindow && !updateInstallWindow.isDestroyed()) {
    updateInstallWindow.focus();
    return;
  }

  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  updateInstallWindow = new BrowserWindow({
    width: 460,
    height: 340,
    parent,
    modal: Boolean(parent),
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Instalar actualización',
    backgroundColor: '#2f3136',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'views', 'update', 'password-preload.js')
    }
  });

  updateInstallWindow.setMenu(null);
  updateInstallWindow.loadFile(path.join(__dirname, 'views', 'update', 'password.html'));
  updateInstallWindow.on('closed', () => {
    updateInstallWindow = null;
  });
}

function beginUpdateInstall() {
  if (!pendingUpdateInfo || !['downloaded', 'error'].includes(updateState.state)) {
    return { success: false, error: 'No hay una actualización lista para instalar.' };
  }

  const packageType = getInstalledPackageType();
  if (packageType === 'appimage') {
    autoUpdater.quitAndInstall();
    return { success: true, native: true };
  }
  if (packageType !== 'deb' && packageType !== 'rpm') {
    return { success: false, error: 'El tipo de paquete instalado no permite actualizar automáticamente.' };
  }

  openUpdateInstallWindow();
  return { success: true, needsPassword: true };
}

ipcMain.handle('updates:cancel-download', () => ({ ok: cancelUpdateDownload() }));
ipcMain.handle('updates:install', () => beginUpdateInstall());
ipcMain.handle('updates:install-with-password', async (_event, password) => installDownloadedUpdate(password));
ipcMain.on('updates:close-install-window', () => {
  if (updateInstallWindow && !updateInstallWindow.isDestroyed()) updateInstallWindow.close();
});

autoUpdater.on('checking-for-update', () => {
  applyUpdateEvent({ type: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  applyUpdateEvent({ type: 'available', version: info && info.version ? info.version : null });
  startUpdateDownload();
});

autoUpdater.on('download-progress', (progress) => {
  applyUpdateEvent({
    type: 'progress',
    percent: progress && progress.percent ? progress.percent : 0,
    bytesPerSecond: progress && progress.bytesPerSecond ? progress.bytesPerSecond : 0,
    transferred: progress && progress.transferred ? progress.transferred : 0,
    total: progress && progress.total ? progress.total : 0
  });
});

autoUpdater.on('update-not-available', () => {
  applyUpdateEvent({ type: 'not-available' });
});

autoUpdater.on('update-downloaded', (info) => {
  pendingUpdateInfo = info;
  applyUpdateEvent({
    type: 'downloaded',
    version: info && info.version ? info.version : null,
    total: info && info.files && info.files[0] ? info.files[0].size : 0
  });

  const version = info && info.version ? info.version : '';
  if (promptedUpdateVersion === version) return;
  promptedUpdateVersion = version;

  const updaterStrings = (app.getLocale() || 'es').startsWith('en')
    ? {
      title: 'Update ready',
      message: 'The update has been downloaded. Restart Grafeno now to install it?',
      buttons: ['Restart now', 'Close']
    }
    : {
      title: 'Actualización lista',
      message: 'La actualización se ha descargado. ¿Quieres reiniciar Grafeno ahora para instalarla?',
      buttons: ['Reiniciar ahora', 'Cerrar']
    };
  const dialogOptions = {
    type: 'info',
    title: updaterStrings.title,
    message: updaterStrings.message,
    buttons: updaterStrings.buttons,
    defaultId: 0,
    cancelId: 1
  };

  const showDialog = mainWindow && !mainWindow.isDestroyed()
    ? dialog.showMessageBox(mainWindow, dialogOptions)
    : dialog.showMessageBox(dialogOptions);

  showDialog.then((result) => {
    if (result.response === 0) beginUpdateInstall();
  }).catch((error) => {
    handleUpdateError(error);
  });
});

autoUpdater.on('error', (err) => {
  handleUpdateError(err);
});

// ── Ciclo de vida de la app ─────────────────────────────────────────

app.whenReady().then(() => {
  updateState = { ...updateState, currentVersion: app.getVersion() };
  createWindow();
  startUpdateCheckTimer();
});

app.on('before-quit', () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
});

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
