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
  let currentState = null;
  let restartRelogin = null;
  let retryMode = false;
  let currentButtonKey = null;
  let currentStatusKind = null;
  let currentStatusKey = null;
  let currentStatusVars = null;

  function showStatus(kind, key, vars) {
    currentStatusKind = kind;
    currentStatusKey = key;
    currentStatusVars = vars;
    statusMsg.textContent = ' ' + window.i18n.t(key, vars);
    statusMsg.insertAdjacentHTML('afterbegin', kind === 'error' ? crossIcon : '<span class="status-spinner" aria-hidden="true"></span>');
    statusMsg.className = kind === 'error' ? 'error-msg' : 'status-loading';
    statusMsg.style.display = 'block';
  }

  function showError(key, vars) {
    showStatus('error', key, vars);
  }

  function showLoading(key, vars) {
    showStatus('loading', key, vars);
  }

  function hideStatus() {
    currentStatusKind = null;
    currentStatusKey = null;
    currentStatusVars = null;
    statusMsg.textContent = '';
    statusMsg.className = '';
    statusMsg.style.display = 'none';
  }

  function setInstallButton(key) {
    currentButtonKey = key;
    installButton.textContent = window.i18n.t(key);
  }

  function isPasswordError(output) {
    return /incorrect password|sorry, try again|contrase.i?a incorrecta/i.test(output || '');
  }

  function applyState(state) {
    const config = STATES[state] || STATES.DOCKER_MISSING;
    currentState = state;
    restartRelogin = null;
    retryMode = false;
    errorTitle.textContent = window.i18n.t(config.titleKey);
    errorTitle.setAttribute('data-i18n', config.titleKey);
    errorDescription.textContent = window.i18n.t(config.descKey);
    errorDescription.setAttribute('data-i18n', config.descKey);
    if (!installRunning) {
      setInstallButton(config.buttonKey);
      installButton.setAttribute('data-i18n', config.buttonKey);
    }

    if (state === 'COMPOSE_MISSING') {
      infoBox.innerHTML = `<p data-i18n-html="error.composeInfoBox">${window.i18n.t('error.composeInfoBox')}</p>`;
    } else if (state === 'DOCKER_PERM_MISSING') {
      infoBox.innerHTML = `<p data-i18n-html="error.permInfoBox">${window.i18n.t('error.permInfoBox')}</p>`;
    } else if (state === 'DOCKER_DAEMON_STOPPED') {
      infoBox.innerHTML = `<p data-i18n-html="error.daemonInfoBox">${window.i18n.t('error.daemonInfoBox')}</p>`;
    }

    // El estado de servicio parado usa otro flujo (systemctl), el resto el script de instalación
    installButton.dataset.flow = state === 'DOCKER_DAEMON_STOPPED' ? 'start-service' : 'install';
  }

  function showRestartRequired(reloginNeeded) {
    restartRelogin = reloginNeeded;
    retryMode = false;
    installSection.style.display = 'none';
    logSection.style.display = 'none';
    buttonRow.style.display = 'none';
    hideStatus();
    const titleKey = reloginNeeded ? 'error.actionTitleRelogin' : 'error.actionTitleRestart';
    const textKey = reloginNeeded ? 'error.actionTextRelogin' : 'error.actionTextRestart';
    const titleEl = document.querySelector('.action-title');
    const textEl = document.querySelector('.action-text');
    titleEl.textContent = window.i18n.t(titleKey);
    titleEl.setAttribute('data-i18n', titleKey);
    textEl.innerHTML = window.i18n.t(textKey);
    textEl.setAttribute('data-i18n-html', textKey);
    const steps = document.querySelector('.action-steps');
    if (reloginNeeded) {
      steps.style.display = '';
      steps.innerHTML = `<li><span class="step-num">1</span><span data-i18n="error.step1">${window.i18n.t('error.step1')}</span></li>`
        + `<li><span class="step-num">2</span><span data-i18n="error.step2">${window.i18n.t('error.step2')}</span></li>`
        + `<li><span class="step-num">3</span><span data-i18n="error.step3">${window.i18n.t('error.step3')}</span></li>`;
      closeGrafenoButton.textContent = window.i18n.t('error.closeGrafeno');
      closeGrafenoButton.setAttribute('data-i18n', 'error.closeGrafeno');
    } else {
      steps.style.display = 'none';
      closeGrafenoButton.textContent = window.i18n.t('error.restartGrafeno');
      closeGrafenoButton.setAttribute('data-i18n', 'error.restartGrafeno');
    }
    closeGrafenoButton.dataset.action = reloginNeeded ? 'close' : 'restart';
    actionRequired.style.display = 'block';
  }

  function resetAfterFailure(key, vars) {
    hideStatus();
    showError(key, vars);
    installButton.disabled = false;
    setInstallButton('error.retry');
    passwordInput.disabled = false;
    passwordInput.value = '';
    passwordInput.focus();
    cancelInstallButton.style.display = 'none';
    installRunning = false;
    retryMode = true;
  }

  document.addEventListener('langchange', () => {
    if (restartRelogin !== null) {
      showRestartRequired(restartRelogin);
      return;
    }
    if (currentState) {
      applyState(currentState);
      if (installRunning) {
        if (currentButtonKey) setInstallButton(currentButtonKey);
        if (currentStatusKey) showStatus(currentStatusKind, currentStatusKey, currentStatusVars);
      } else if (retryMode) {
        setInstallButton('error.retry');
      }
    }
  });

  window.electronAPI.getDockerStartupError().then((error) => {
    startupError = error;
    applyState(error?.code || 'DOCKER_MISSING');
  });

  closeButton.addEventListener('click', () => {
    window.electronAPI.closeApp();
  });

  closeGrafenoButton.addEventListener('click', () => {
    if (closeGrafenoButton.dataset.action === 'restart') {
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
    showLoading('error.canceling');
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
    const flowKey = flow === 'start-service' ? 'error.startingService' : 'error.installing';
    setInstallButton(flowKey);
    showLoading(flowKey);

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
        resetAfterFailure('error.cancelMsg');
      } else if (isPasswordError(result.output)) {
        resetAfterFailure('error.wrongPassword');
      } else {
        resetAfterFailure('error.installFail');
      }
    } catch (err) {
      window.electronAPI.removeDockerInstallOutputListener(outputHandler);
      cancelInstallButton.style.display = 'none';
      resetAfterFailure('error.unexpected', { msg: err.message });
    }
  });
});
