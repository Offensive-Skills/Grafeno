const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createUpdateState,
  canCheck,
  canDownload,
  canInstall,
  reduce
} = require('../controllers/updateState');

function apply(events, initial = createUpdateState({ currentVersion: '2.2.0' })) {
  return events.reduce((state, event) => reduce(state, event), initial);
}

test('update state walks the full download lifecycle', () => {
  const state = apply([
    { type: 'checking' },
    { type: 'available', version: '2.2.1' },
    { type: 'downloading', version: '2.2.1' },
    { type: 'progress', percent: 42, bytesPerSecond: 1024, transferred: 42, total: 100 },
    { type: 'downloaded', version: '2.2.1', total: 100 },
    { type: 'installing' }
  ]);

  assert.equal(state.state, 'installing');
  assert.equal(state.version, '2.2.1');
  assert.equal(state.currentVersion, '2.2.0');
  assert.equal(state.percent, 100);
  assert.equal(state.error, null);
});

test('cancel returns to available and clears progress', () => {
  const state = apply([
    { type: 'available', version: '2.2.1' },
    { type: 'downloading', version: '2.2.1' },
    { type: 'progress', percent: 30, transferred: 30, total: 100 },
    { type: 'cancelled' }
  ]);

  assert.equal(state.state, 'available');
  assert.equal(state.percent, 0);
  assert.equal(state.transferred, 0);
});

test('not-available returns to idle and records the check time', () => {
  const state = reduce(createUpdateState(), { type: 'not-available', at: 1234 });
  assert.equal(state.state, 'idle');
  assert.equal(state.lastCheckedAt, 1234);
  assert.equal(state.version, null);
});

test('errors are formatted and keep the check timestamp', () => {
  const state = reduce(createUpdateState(), {
    type: 'error',
    error: new Error('HttpError: 404'),
    at: 5678
  });
  assert.equal(state.state, 'error');
  assert.match(state.error.message, /metadatos válidos/);
  assert.equal(state.lastCheckedAt, 5678);
});

test('unsupported platforms are represented explicitly', () => {
  const state = reduce(createUpdateState(), {
    type: 'unsupported',
    reason: 'macOS no soporta autoactualización sin firma'
  });
  assert.equal(state.state, 'unsupported');
  assert.equal(state.supported, false);
  assert.match(state.reason, /macOS/);
});

test('state guards prevent unsafe operations', () => {
  const downloading = apply([{ type: 'available', version: '2' }, { type: 'downloading', version: '2' }]);
  assert.equal(canCheck(downloading), false);
  assert.equal(canDownload(downloading), false);
  assert.equal(canInstall(downloading), false);

  const available = apply([{ type: 'available', version: '2' }]);
  assert.equal(canCheck(available), true);
  assert.equal(canDownload(available), true);

  const downloaded = apply([
    { type: 'available', version: '2' },
    { type: 'downloaded', version: '2' }
  ]);
  assert.equal(canInstall(downloaded), true);
});

test('reset keeps the running version and support metadata', () => {
  const state = reduce(
    createUpdateState({ currentVersion: '2.2.0', supported: false, reason: 'macOS' }),
    { type: 'reset' }
  );
  assert.equal(state.currentVersion, '2.2.0');
  assert.equal(state.supported, false);
  assert.equal(state.reason, 'macOS');
  assert.equal(state.state, 'idle');
});
