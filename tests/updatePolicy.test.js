const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_CHECK_INTERVAL_MS,
  isAutoUpdateSupported,
  detectPackageType,
  getPackageInstallPlan,
  shouldCheckForUpdates,
  formatUpdateError
} = require('../controllers/updatePolicy');

test('auto-update is supported on Linux only', () => {
  assert.equal(isAutoUpdateSupported('linux'), true);
  assert.equal(isAutoUpdateSupported('darwin'), false);
  assert.equal(isAutoUpdateSupported('win32'), false);
});

test('detectPackageType distinguishes deb, rpm and AppImage', () => {
  assert.equal(detectPackageType('deb\n'), 'deb');
  assert.equal(detectPackageType('rpm'), 'rpm');
  assert.equal(detectPackageType('deb', '/tmp/grafeno.AppImage'), 'appimage');
  assert.equal(detectPackageType('unknown'), 'unknown');
  assert.equal(detectPackageType(''), 'unknown');
});

test('package install plans use package managers without a shell', () => {
  assert.deepEqual(getPackageInstallPlan('deb', '/tmp/a.deb'), {
    needsSudo: true,
    command: 'dpkg',
    args: ['-i', '/tmp/a.deb'],
    fallback: { command: 'apt-get', args: ['install', '-f', '-y'] }
  });
  assert.deepEqual(getPackageInstallPlan('rpm', '/tmp/a.rpm'), {
    needsSudo: true,
    command: 'rpm',
    args: ['-U', '/tmp/a.rpm']
  });
  assert.deepEqual(getPackageInstallPlan('appimage', '/tmp/a.AppImage'), {
    needsSudo: false,
    native: true
  });
  assert.equal(getPackageInstallPlan('unknown', '/tmp/a'), null);
  assert.equal(getPackageInstallPlan('deb', ''), null);
});

test('periodic checks respect packaging, platform, interval and busy states', () => {
  const now = 10_000_000;
  const base = { isPackaged: true, platform: 'linux', now };

  assert.equal(shouldCheckForUpdates({ ...base, lastCheckAt: null }), true);
  assert.equal(shouldCheckForUpdates({ ...base, lastCheckAt: now - DEFAULT_CHECK_INTERVAL_MS }), true);
  assert.equal(shouldCheckForUpdates({ ...base, lastCheckAt: now - DEFAULT_CHECK_INTERVAL_MS + 1 }), false);
  assert.equal(shouldCheckForUpdates({ ...base, isPackaged: false, lastCheckAt: null }), false);
  assert.equal(shouldCheckForUpdates({ ...base, platform: 'darwin', lastCheckAt: null }), false);
  assert.equal(shouldCheckForUpdates({ ...base, lastCheckAt: null, state: 'downloading' }), false);
  assert.equal(shouldCheckForUpdates({ ...base, lastCheckAt: now, intervalMs: 1000 }), false);
  assert.equal(
    shouldCheckForUpdates({ ...base, lastCheckAt: now - 1000, intervalMs: 1000 }),
    true
  );
});

test('update errors are translated into actionable messages', () => {
  const notFound = formatUpdateError(new Error('Cannot find latest-linux.yml: HttpError: 404'));
  assert.match(notFound.message, /metadatos válidos/);

  const network = formatUpdateError(new Error('getaddrinfo ENOTFOUND github.com'));
  assert.match(network.message, /No se pudo conectar/);

  const zip = formatUpdateError(new Error('ZIP file not provided: ERR_UPDATER_ZIP_FILE_NOT_FOUND'));
  assert.match(zip.message, /macOS/);

  const generic = formatUpdateError(new Error('unexpected failure'));
  assert.match(generic.message, /No se pudo comprobar/);
  assert.match(generic.detail, /unexpected failure/);
});
