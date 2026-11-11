const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVersion, versionAtLeast, formatVersion } = require('../controllers/dockerVersion');

test('parseVersion extracts semantic versions with optional v prefix', () => {
  assert.deepEqual(parseVersion('2.33.1'), [2, 33, 1]);
  assert.deepEqual(parseVersion('v28.0.0'), [28, 0, 0]);
  assert.deepEqual(parseVersion('Docker Compose version v2.40.3'), [2, 40, 3]);
  assert.equal(parseVersion('unknown'), null);
  assert.equal(parseVersion(''), null);
});

test('versionAtLeast enforces the Docker Engine 28.0.0 minimum', () => {
  assert.equal(versionAtLeast([28, 0, 0], [28, 0, 0]), true);
  assert.equal(versionAtLeast([29, 1, 3], [28, 0, 0]), true);
  assert.equal(versionAtLeast([28, 1, 0], [28, 0, 0]), true);
  assert.equal(versionAtLeast([27, 5, 2], [28, 0, 0]), false);
  assert.equal(versionAtLeast([20, 10, 24], [28, 0, 0]), false);
});

test('versionAtLeast enforces the Docker Compose 2.33.1 minimum', () => {
  assert.equal(versionAtLeast([2, 33, 1], [2, 33, 1]), true);
  assert.equal(versionAtLeast([2, 40, 3], [2, 33, 1]), true);
  assert.equal(versionAtLeast([2, 24, 6], [2, 33, 1]), false);
  assert.equal(versionAtLeast([1, 29, 2], [2, 33, 1]), false);
  assert.equal(versionAtLeast(null, [2, 33, 1]), false);
});

test('formatVersion renders comparable versions', () => {
  assert.equal(formatVersion([2, 33, 1]), '2.33.1');
  assert.equal(formatVersion(null), 'desconocida');
});
