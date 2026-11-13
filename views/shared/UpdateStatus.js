// views/shared/UpdateStatus.js
// Banner reutilizable con el estado de la autoactualización.

(function () {
  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function mount(container) {
    if (!container || !window.electronAPI || !window.electronAPI.getUpdateStatus) return;

    const text = createElement('span', 'update-status-text');
    const progress = createElement('div', 'update-status-progress');
    const bar = createElement('div', 'update-status-bar');
    progress.appendChild(bar);

    const actions = createElement('div', 'update-status-actions');
    const cancelButton = createElement('button', '', window.i18n.t('update.cancel'));
    const installButton = createElement('button', '', window.i18n.t('update.install'));
    const settingsButton = createElement('button', '', window.i18n.t('update.settings'));
    actions.append(cancelButton, installButton, settingsButton);

    container.append(text, progress, actions);
    container.hidden = true;

    cancelButton.addEventListener('click', () => {
      window.electronAPI.cancelUpdateDownload();
    });

    installButton.addEventListener('click', async () => {
      installButton.disabled = true;
      try {
        const result = await window.electronAPI.installUpdate();
        if (result && result.success === false) {
          text.textContent = window.i18n.t('update.error');
          container.hidden = false;
        }
      } catch {
        text.textContent = window.i18n.t('update.error');
        container.hidden = false;
      } finally {
        installButton.disabled = false;
      }
    });

    settingsButton.addEventListener('click', () => {
      window.location.href = '../config/config.html';
    });

    function render(state) {
      if (!state) {
        container.hidden = true;
        return;
      }

      const status = state.state;
      const canInstall = status === 'downloaded' || (status === 'error' && state.hasPendingUpdate);
      container.hidden = false;
      progress.hidden = status !== 'downloading';
      cancelButton.hidden = status !== 'downloading';
      installButton.hidden = !canInstall;
      settingsButton.hidden = status !== 'error';
      installButton.disabled = false;

      if (status === 'downloading') {
        const percent = Math.max(0, Math.min(100, Math.round(Number(state.percent) || 0)));
        text.textContent = window.i18n.t('update.downloading', { percent });
        bar.style.width = `${percent}%`;
        return;
      }

      if (status === 'downloaded') {
        text.textContent = window.i18n.t('update.ready', { version: state.version || '' });
        bar.style.width = '100%';
        return;
      }

      if (status === 'available') {
        text.textContent = window.i18n.t('update.available', { version: state.version || '' });
        return;
      }

      if (status === 'installing') {
        text.textContent = window.i18n.t('update.installing');
        return;
      }

      if (status === 'error') {
        text.textContent = state.error && state.error.message
          ? state.error.message
          : window.i18n.t('update.error');
        text.title = state.error && state.error.detail ? state.error.detail : '';
        return;
      }

      if (status === 'unsupported') {
        text.textContent = window.i18n.t('update.unsupported');
        return;
      }

      container.hidden = true;
    }

    function refreshLabels() {
      cancelButton.textContent = window.i18n.t('update.cancel');
      installButton.textContent = window.i18n.t('update.install');
      settingsButton.textContent = window.i18n.t('update.settings');
      if (container._lastState) render(container._lastState);
    }

    window.electronAPI.getUpdateStatus().then((state) => {
      container._lastState = state;
      render(state);
    }).catch(() => {
      container.hidden = true;
    });

    window.electronAPI.onUpdateStatus((state) => {
      container._lastState = state;
      render(state);
    });

    document.addEventListener('langchange', refreshLabels);
  }

  window.UpdateStatus = { mount };
})();
