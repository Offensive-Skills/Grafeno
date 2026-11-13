// controllers/updatePolicy.js
// Reglas puras de la autoactualización, sin dependencias de Electron.

const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BUSY_STATES = new Set(['checking', 'downloading', 'installing']);

function isAutoUpdateSupported(platform) {
  return platform === 'linux';
}

function detectPackageType(packageTypeContent, appImagePath) {
  if (appImagePath) return 'appimage';

  const value = String(packageTypeContent || '').trim().toLowerCase();
  if (value === 'deb' || value === 'rpm') return value;
  return 'unknown';
}

function getPackageInstallPlan(packageType, filePath) {
  if (!filePath) return null;

  switch (packageType) {
    case 'deb':
      return {
        needsSudo: true,
        command: 'dpkg',
        args: ['-i', filePath],
        fallback: { command: 'apt-get', args: ['install', '-f', '-y'] }
      };
    case 'rpm':
      return {
        needsSudo: true,
        command: 'rpm',
        args: ['-U', '--nosignature', filePath]
      };
    case 'appimage':
      return { needsSudo: false, native: true };
    default:
      return null;
  }
}

function shouldCheckForUpdates({
  isPackaged,
  platform,
  lastCheckAt,
  now = Date.now(),
  intervalMs = DEFAULT_CHECK_INTERVAL_MS,
  state
}) {
  if (!isPackaged) return false;
  if (!isAutoUpdateSupported(platform)) return false;
  if (state && BUSY_STATES.has(state)) return false;
  if (!lastCheckAt) return true;
  return now - lastCheckAt >= intervalMs;
}

function formatUpdateError(error) {
  const rawMessage = error && error.message
    ? String(error.message)
    : 'Error desconocido al comprobar actualizaciones.';
  const detail = error && error.stack ? String(error.stack) : rawMessage;

  if (/ERR_UPDATER_CHANNEL_FILE_NOT_FOUND|Cannot find latest-linux|HttpError: 404|\b404\b/i.test(rawMessage)) {
    return {
      message: 'El servidor de actualizaciones no tiene metadatos válidos para esta versión.',
      detail
    };
  }

  if (/ERR_UPDATER_ZIP_FILE_NOT_FOUND/i.test(rawMessage)) {
    return {
      message: 'La actualización de macOS no incluye el paquete necesario.',
      detail
    };
  }

  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|network|socket hang up/i.test(rawMessage)) {
    return {
      message: 'No se pudo conectar con el servidor de actualizaciones. Revisa la conexión.',
      detail
    };
  }

  return {
    message: 'No se pudo comprobar o instalar la actualización.',
    detail
  };
}

module.exports = {
  DEFAULT_CHECK_INTERVAL_MS,
  BUSY_STATES,
  isAutoUpdateSupported,
  detectPackageType,
  getPackageInstallPlan,
  shouldCheckForUpdates,
  formatUpdateError
};
