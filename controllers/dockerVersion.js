// controllers/dockerVersion.js
// Utilidades para interpretar y comparar versiones de Docker y Docker Compose.

function parseVersion(raw) {
  const match = String(raw || '').match(/v?(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(version, minimum) {
  if (!Array.isArray(version) || !Array.isArray(minimum)) return false;
  for (let i = 0; i < 3; i += 1) {
    const current = version[i] || 0;
    const required = minimum[i] || 0;
    if (current > required) return true;
    if (current < required) return false;
  }
  return true;
}

function formatVersion(version) {
  return Array.isArray(version) ? version.join('.') : 'desconocida';
}

module.exports = { parseVersion, versionAtLeast, formatVersion };
