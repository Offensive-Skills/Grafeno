// controllers/updateState.js
// Máquina de estados pura del ciclo de actualización.

const { formatUpdateError } = require('./updatePolicy');

const INITIAL_STATE = Object.freeze({
  state: 'idle',
  version: null,
  currentVersion: null,
  percent: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  lastCheckedAt: null,
  error: null,
  supported: true,
  reason: null
});

function createUpdateState(overrides = {}) {
  return { ...INITIAL_STATE, ...overrides };
}

function canCheck(state) {
  return !['checking', 'downloading', 'installing'].includes(state.state);
}

function canDownload(state) {
  return state.state === 'available' || state.state === 'error';
}

function canInstall(state) {
  return state.state === 'downloaded' && Boolean(state.version);
}

function reduce(state, event) {
  const base = state || createUpdateState();
  const at = event && event.at ? event.at : Date.now();

  switch (event.type) {
    case 'reset':
      return createUpdateState({
        currentVersion: base.currentVersion,
        supported: base.supported,
        reason: base.reason,
        lastCheckedAt: base.lastCheckedAt
      });

    case 'checking':
      return {
        ...base,
        state: 'checking',
        error: null,
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0
      };

    case 'available':
      return {
        ...base,
        state: 'available',
        version: event.version || null,
        error: null,
        lastCheckedAt: at
      };

    case 'downloading':
      return {
        ...base,
        state: 'downloading',
        version: event.version || base.version,
        error: null,
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0
      };

    case 'progress':
      return {
        ...base,
        state: 'downloading',
        percent: Number(event.percent) || 0,
        bytesPerSecond: Number(event.bytesPerSecond) || 0,
        transferred: Number(event.transferred) || 0,
        total: Number(event.total) || 0
      };

    case 'downloaded':
      return {
        ...base,
        state: 'downloaded',
        version: event.version || base.version,
        percent: 100,
        transferred: event.total || base.total,
        total: event.total || base.total,
        bytesPerSecond: 0,
        error: null,
        lastCheckedAt: at
      };

    case 'installing':
      return {
        ...base,
        state: 'installing',
        error: null
      };

    case 'not-available':
      return {
        ...base,
        state: 'idle',
        version: null,
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
        error: null,
        lastCheckedAt: at
      };

    case 'cancelled':
      return {
        ...base,
        state: 'available',
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
        error: null
      };

    case 'unsupported':
      return {
        ...base,
        state: 'unsupported',
        supported: false,
        reason: event.reason || null,
        error: null
      };

    case 'error':
      return {
        ...base,
        state: 'error',
        error: formatUpdateError(event.error),
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
        lastCheckedAt: at
      };

    default:
      return base;
  }
}

module.exports = {
  INITIAL_STATE,
  createUpdateState,
  canCheck,
  canDownload,
  canInstall,
  reduce
};
