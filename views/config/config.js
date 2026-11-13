// views/config/config.js

window.addEventListener('DOMContentLoaded', () => {
  const destinationInput = document.getElementById('destinationInput');
  const btnAtras = document.getElementById('btn-atras');
  const btnReset = document.getElementById('btn-reset');
  const resetStatus = document.getElementById('reset-status');
  
  // Cargar la ruta destino guardada (si existe)
  const storedDestination = localStorage.getItem('DestinationFile');
  if (storedDestination) {
    destinationInput.value = storedDestination;
  }
  
  // Al perder el foco, guardar la ruta destino
  destinationInput.addEventListener('blur', () => {
    const newDestination = destinationInput.value.trim();
    if (newDestination) {
      localStorage.setItem('DestinationFile', newDestination);
    } else {
      localStorage.removeItem('DestinationFile');
    }
  });
  
  // Botón Atrás: vuelve al menú principal
  btnAtras.addEventListener('click', () => {
    window.location.href = '../main/mainMenu.html';
  });
  
  btnReset.addEventListener('click', async () => {
    resetStatus.textContent = window.i18n.t('config.resetting');
    resetStatus.style.color = '#ffffff';

    try {
      await window.electronAPI.resetData();
      console.log("Reset de datos completado");
      resetStatus.textContent = window.i18n.t('config.resetDone');
      resetStatus.style.color = '#beefbe';
    } catch (error) {
      console.error(`Error al resetear datos: ${error}`);
      resetStatus.textContent = window.i18n.t('config.resetError');
      resetStatus.style.color = '#ff4f4f';
    }
  });

  const updateStateEl = document.getElementById('update-state');
  const updateLastCheck = document.getElementById('update-last-check');
  const updateProgressWrap = document.getElementById('update-progress-wrap');
  const updateProgressBar = document.getElementById('update-progress-bar');
  const updateError = document.getElementById('update-error');
  const updateLogPath = document.getElementById('update-log-path');
  const btnCheckUpdates = document.getElementById('btn-check-updates');
  const btnCancelUpdate = document.getElementById('btn-cancel-update');
  const btnInstallUpdate = document.getElementById('btn-install-update');
  let lastUpdateState = null;

  function updateStatusText(state) {
    const version = state && state.version ? state.version : '';
    switch (state && state.state) {
      case 'checking':
        return window.i18n.t('config.updateChecking');
      case 'available':
        return window.i18n.t('config.updateAvailable', { version });
      case 'downloading':
        return window.i18n.t('config.updateDownloading', { percent: Math.round(Number(state.percent) || 0) });
      case 'downloaded':
        return window.i18n.t('config.updateReady', { version });
      case 'installing':
        return window.i18n.t('config.updateInstalling');
      case 'error':
        return window.i18n.t('config.updateError');
      case 'unsupported':
        return window.i18n.t('config.updateUnsupported');
      default:
        return window.i18n.t('config.updateIdle');
    }
  }

  function renderUpdateState(state) {
    lastUpdateState = state;
    if (!state) return;

    const status = state.state;
    const canInstall = status === 'downloaded' || (status === 'error' && state.hasPendingUpdate);

    updateStateEl.textContent = updateStatusText(state);
    updateLastCheck.textContent = state.lastCheckedAt
      ? new Date(state.lastCheckedAt).toLocaleString()
      : window.i18n.t('config.updateNever');

    const downloading = status === 'downloading';
    updateProgressWrap.hidden = !downloading;
    updateProgressBar.style.width = downloading ? `${Math.max(0, Math.min(100, Math.round(Number(state.percent) || 0)))}%` : '0%';

    btnCheckUpdates.disabled = ['checking', 'downloading', 'installing'].includes(status);
    btnCheckUpdates.hidden = status === 'unsupported';
    btnCancelUpdate.hidden = !downloading;
    btnInstallUpdate.hidden = !canInstall;

    if (state.error) {
      updateError.hidden = false;
      updateError.textContent = state.error.message || window.i18n.t('config.updateError');
    } else {
      updateError.hidden = true;
      updateError.textContent = '';
    }

    updateLogPath.textContent = state.logPath
      ? window.i18n.t('config.updateLog', { path: state.logPath })
      : '';
  }

  function refreshUpdateLabels() {
    if (lastUpdateState) renderUpdateState(lastUpdateState);
  }

  window.electronAPI.getUpdateStatus().then(renderUpdateState).catch(() => {
    updateStateEl.textContent = window.i18n.t('config.updateError');
  });

  window.electronAPI.onUpdateStatus(renderUpdateState);
  document.addEventListener('langchange', refreshUpdateLabels);

  btnCheckUpdates.addEventListener('click', async () => {
    btnCheckUpdates.disabled = true;
    try {
      const result = await window.electronAPI.checkForUpdates();
      if (result && result.status) renderUpdateState(result.status);
    } finally {
      if (lastUpdateState) btnCheckUpdates.disabled = ['checking', 'downloading', 'installing'].includes(lastUpdateState.state);
    }
  });

  btnCancelUpdate.addEventListener('click', () => {
    window.electronAPI.cancelUpdateDownload();
  });

  btnInstallUpdate.addEventListener('click', async () => {
    btnInstallUpdate.disabled = true;
    try {
      await window.electronAPI.installUpdate();
    } finally {
      btnInstallUpdate.disabled = false;
    }
  });
});
