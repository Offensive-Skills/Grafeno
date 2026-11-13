const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseChannelFile, verifyUpdateMetadata } = require('../scripts/verifyUpdateMetadata');

function sha512(value) {
  return crypto.createHash('sha512').update(value).digest('base64');
}

function writeYml(directory, fileName, version, entries, pathName) {
  const lines = [`version: ${version}`, 'files:'];
  for (const entry of entries) {
    lines.push(`  - url: ${entry.url}`);
    lines.push(`    sha512: ${entry.sha512}`);
    lines.push(`    size: ${entry.size}`);
  }
  lines.push(`path: ${pathName}`);
  const pathEntry = entries.find((entry) => entry.url === pathName) || entries[0];
  lines.push(`sha512: ${pathEntry.sha512}`);
  lines.push("releaseDate: '2026-01-01T00:00:00.000Z'");
  fs.writeFileSync(path.join(directory, fileName), `${lines.join('\n')}\n`);
}

function createFixture(options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'grafeno-updates-'));
  const version = options.version || '2.2.1';
  const entries = (names) => names.map((name) => {
    const content = `content-${name}`;
    fs.writeFileSync(path.join(directory, name), content);
    return { url: name, sha512: sha512(content), size: Buffer.byteLength(content) };
  });

  const x64 = entries([
    `grafeno_${version}_amd64.deb`,
    `grafeno_${version}_x86_64.AppImage`,
    `grafeno_${version}_x86_64.rpm`
  ]);
  const arm64 = entries([
    `grafeno_${version}_arm64.deb`,
    `grafeno_${version}_arm64.AppImage`,
    `grafeno_${version}_aarch64.rpm`
  ]);
  const mac = entries([`grafeno_${version}_mac_arm64.dmg`]);

  if (options.corruptHash) x64[0].sha512 = 'AAAA';
  if (options.pathOverride) {
    writeYml(directory, 'latest-linux.yml', version, x64, options.pathOverride);
  } else {
    writeYml(directory, 'latest-linux.yml', version, x64, x64[1].url);
  }
  writeYml(directory, 'latest-linux-arm64.yml', version, arm64, arm64[1].url);
  writeYml(directory, 'latest-mac.yml', version, mac, mac[0].url);

  return { directory, x64, arm64, mac, version };
}

test('parseChannelFile reads version, files and path', () => {
  const parsed = parseChannelFile([
    'version: 2.2.1',
    'files:',
    '  - url: grafeno_2.2.1_amd64.deb',
    '    sha512: abc',
    '    size: 10',
    '  - url: grafeno_2.2.1_x86_64.AppImage',
    '    sha512: def',
    '    size: 20',
    'path: grafeno_2.2.1_x86_64.AppImage',
    "releaseDate: '2026-01-01'"
  ].join('\n'));

  assert.equal(parsed.version, '2.2.1');
  assert.equal(parsed.files.length, 2);
  assert.equal(parsed.files[0].size, 10);
  assert.equal(parsed.path, 'grafeno_2.2.1_x86_64.AppImage');
});

test('valid metadata passes all channel checks', () => {
  const { directory, version } = createFixture();
  try {
    assert.deepEqual(verifyUpdateMetadata(directory, version), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('missing linux package is reported', () => {
  const { directory, version, x64 } = createFixture();
  try {
    fs.unlinkSync(path.join(directory, x64[0].url));
    const errors = verifyUpdateMetadata(directory, version);
    assert.ok(errors.some((error) => error.includes(`falta ${x64[0].url}`)));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('wrong sha512 is reported', () => {
  const { directory, version } = createFixture({ corruptHash: true });
  try {
    const errors = verifyUpdateMetadata(directory, version);
    assert.ok(errors.some((error) => error.includes('sha512 incorrecto')));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('version mismatch is reported', () => {
  const { directory } = createFixture();
  try {
    const errors = verifyUpdateMetadata(directory, '2.2.2');
    assert.ok(errors.some((error) => error.includes('version 2.2.1 != 2.2.2')));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('missing macOS dmg is reported', () => {
  const { directory, version, mac } = createFixture();
  try {
    fs.unlinkSync(path.join(directory, mac[0].url));
    const errors = verifyUpdateMetadata(directory, version);
    assert.ok(errors.some((error) => error.includes(`falta ${mac[0].url}`)));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('path outside the file list is reported', () => {
  const { directory, version } = createFixture({ pathOverride: 'missing.AppImage' });
  try {
    const errors = verifyUpdateMetadata(directory, version);
    assert.ok(errors.some((error) => error.includes('path missing.AppImage')));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
