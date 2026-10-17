// views/error/error.js

window.addEventListener('DOMContentLoaded', () => {
  const installSection = document.getElementById('installSection');
  const installButton = document.getElementById('installButton');
  const cancelInstallButton = document.getElementById('cancelInstallButton');
  const passwordInput = document.getElementById('sudoPassword');
  const logSection = document.getElementById('logSection');
  const installLog = document.getElementById('installLog');
  const statusMsg = document.getElementById('statusMsg');
  const actionRequired = document.getElementById('actionRequired');
  const closeGrafenoButton = document.getElementById('closeGrafenoButton');
  const buttonRow = document.getElementById('buttonRow');
  const closeButton = document.getElementById('closeButton');
  const errorTitle = document.getElementById('errorTitle');
  const errorDescription = document.getElementById('errorDescription');
  const infoBox = document.querySelector('.info-box');

  const crossIcon = '<svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const STATES = {
    DOCKER_MISSING: {
      titleKey: 'error.dockerMissing.title',
      descKey: 'error.dockerMissing.desc',
      buttonKey: 'error.dockerMissing.btn'
    },
    COMPOSE_MISSING: {
      titleKey: 'error.composeMissing.title',
      descKey: 'error.composeMissing.desc',
      buttonKey: 'error.composeMissing.btn'
    },
    DOCKER_PERM_MISSING: {
      titleKey: 'error.permMissing.title',
      descKey: 'error.permMissing.desc',
      buttonKey: 'error.permMissing.btn'
    },
    DOCKER_DAEMON_STOPPED: {
      titleKey: 'error.daemonStopped.title',
      descKey: 'error.daemonStopped.desc',
      buttonKey: 'error.daemonStopped.btn'
    }
  };

  let startupError = null;
  let installRunning = false;

  function showError(message) {
    statusMsg.textContent = ' ' + message;
    statusMsg.insertAdjacentHTML('afterbegin', crossIcon);
    statusMsg.className = 'error-msg';
    statusMsg.style.display = 'block';
  }

  function showLoading(message) {
    statusMsg.textContent = ' ' + message;
    statusMsg.insertAdjacentHTML('afterbegin', '<span class="status-spinner" aria-hidden="true"></span>');
    statusMsg.className = 'status-loading';
    statusMsg.style.display = 'block';
  }

  function hideStatus() {
    statusMsg.textContent = '';
    statusMsg.className = '';
    statusMsg.style.display = 'none';
  }

  function isPasswordError(output) {
    return /incorrect password|sorry, try again|contrase.i?a incorrecta/i.test(output || '');
  }

  function applyState(state) {
    const config = STATES[state] || STATES.DOCKER_MISSING;
    errorTitle.textContent = window.i18n.t(config.titleKey);
    errorDescription.textContent = window.i18n.t(config.descKey);
    installButton.textContent = window.i18n.t(config.buttonKey);

    if (state === 'COMPOSE_MISSING') {
      infoBox.innerHTML = `<p>${window.i18n.t('error.composeInfoBox')}</p>`;
    } else if (state === 'DOCKER_PERM_MISSING') {
      infoBox.innerHTML = `<p>${window.i18n.t('error.permInfoBox')}</p>`;
    } else if (state === 'DOCKER_DAEMON_STOPPED') {
      infoBox.innerHTML = `<p>${window.i18n.t('error.daemonInfoBox')}</p>`;
    }

    // El estado de servicio parado usa otro flujo (systemctl), el resto el script de instalación
    installButton.dataset.flow = state === 'DOCKER_DAEMON_STOPPED' ? 'start-service' : 'install';
  }

  function showRestartRequired(reloginNeeded) {
    installSection.style.display = 'none';
    logSection.style.display = 'none';
    buttonRow.style.display = 'none';
    hideStatus();
    if (reloginNeeded) {
      document.querySelector('.action-title').textContent = window.i18n.t('error.actionTitleRelogin');
      document.querySelector('.action-text').innerHTML = window.i18n.t('error.actionTextRelogin');
    } else {
      document.querySelector('.action-title').textContent = window.i18n.t('error.actionTitleRestart');
      document.querySelector('.action-text').textContent = window.i18n.t('error.actionTextRestart');
    }
    const steps = document.querySelector('.action-steps');
    if (reloginNeeded) {
      steps.innerHTML = `<li><span class="step-num">1</span><span>${window.i18n.t('error.step1')}</span></li>`
        + `<li><span class="step-num">2</span><span>${window.i18n.t('error.step2')}</span></li>`
        + `<li><span class="step-num">3</span><span>${window.i18n.t('error.step3')}</span></li>`;
      closeGrafenoButton.textContent = window.i18n.t('error.closeGrafeno');
    } else {
      steps.style.display = 'none';
      closeGrafenoButton.textContent = window.i18n.t('error.restartGrafeno');
    }
    actionRequired.style.display = 'block';
  }

  function resetAfterFailure(message) {
    hideStatus();
    showError(message);
    installButton.disabled = false;
    installButton.textContent = window.i18n.t('error.retry');
    passwordInput.disabled = false;
    passwordInput.value = '';
    passwordInput.focus();
    cancelInstallButton.style.display = 'none';
    installRunning = false;
  }

  window.electronAPI.getDockerStartupError().then((error) => {
    startupError = error;
    applyState(error?.code || 'DOCKER_MISSING');
  });

  closeButton.addEventListener('click', () => {
    window.electronAPI.closeApp();
  });

  closeGrafenoButton.addEventListener('click', () => {
    if (closeGrafenoButton.textContent === 'Reiniciar Grafeno') {
      window.electronAPI.restartApp();
    } else {
      window.electronAPI.closeApp();
    }
  });

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') installButton.click();
  });

  cancelInstallButton.addEventListener('click', async () => {
    if (!installRunning) return;
    cancelInstallButton.disabled = true;
    showLoading(window.i18n.t('error.canceling'));
    await window.electronAPI.cancelDockerInstall();
  });

  installButton.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) {
      passwordInput.focus();
      return;
    }

    installButton.disabled = true;
    passwordInput.disabled = true;
    logSection.style.display = 'block';
    installLog.textContent = '';
    hideStatus();
    installRunning = true;
    cancelInstallButton.style.display = 'inline-block';
    cancelInstallButton.disabled = false;

    const flow = installButton.dataset.flow;
    if (flow === 'start-service') {
      installButton.textContent = window.i18n.t('error.startingService');
      showLoading(window.i18n.t('error.startingService'));
    } else {
      installButton.textContent = window.i18n.t('error.installing');
      showLoading(window.i18n.t('error.installing'));
    }

    const outputHandler = window.electronAPI.onDockerInstallOutput((text) => {
      installLog.textContent += text;
      installLog.scrollTop = installLog.scrollHeight;
    });

    try {
      const result = flow === 'start-service'
        ? await window.electronAPI.startDockerService(password)
        : await window.electronAPI.installDocker(password);
      window.electronAPI.removeDockerInstallOutputListener(outputHandler);
      cancelInstallButton.style.display = 'none';

      if (result.success) {
        if (startupError?.code === 'COMPOSE_MISSING' || startupError?.code === 'DOCKER_DAEMON_STOPPED') {
          showRestartRequired(false);
        } else {
          showRestartRequired(true);
        }
        installRunning = false;
      } else if (result.cancelled) {
        resetAfterFailure(window.i18n.t('error.cancelMsg'));
      } else if (isPasswordError(result.output)) {
        resetAfterFailure(window.i18n.t('error.wrongPassword'));
      } else {
        resetAfterFailure(window.i18n.t('error.installFail'));
      }
    } catch (err) {
      window.electronAPI.removeDockerInstallOutputListener(outputHandler);
      cancelInstallButton.style.display = 'none';
      resetAfterFailure(window.i18n.t('error.unexpected', { msg: err.message }));
    }
  });
});
