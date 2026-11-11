const test = require('node:test');
const assert = require('node:assert/strict');

global.localStorage = { getItem: () => 'es', setItem() {} };
global.document = { addEventListener() {}, querySelectorAll: () => [], dispatchEvent() {} };
global.window = {};

require('../views/shared/i18n.js');

const { dict } = global.window.i18n;

test('Spanish and English dictionaries expose the same keys', () => {
  assert.deepEqual(Object.keys(dict.es).sort(), Object.keys(dict.en).sort());
});

test('Docker version error messages exist in both languages', () => {
  const keys = [
    'error.dockerOutdated.title',
    'error.dockerOutdated.desc',
    'error.dockerOutdated.btn',
    'error.dockerOutdatedInfoBox',
    'error.composeStandalone.title',
    'error.composeStandalone.desc',
    'error.composeOutdated.title',
    'error.composeOutdated.desc'
  ];

  for (const key of keys) {
    assert.ok(dict.es[key], `missing es translation for ${key}`);
    assert.ok(dict.en[key], `missing en translation for ${key}`);
  }
});

test('version error descriptions interpolate the detected and minimum versions', () => {
  const vars = { version: '27.5.2 (docker.io)', minimum: '28.0.0' };
  const message = global.window.i18n.t('error.dockerOutdated.desc', vars);
  assert.match(message, /27\.5\.2 \(docker\.io\)/);
  assert.match(message, /28\.0\.0/);
});
