// views/update/password.js

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('installForm');
  const passwordInput = document.getElementById('password');
  const installButton = document.getElementById('installButton');
  const cancelButton = document.getElementById('cancelButton');
  const status = document.getElementById('installStatus');
  const output = document.getElementById('installOutput');
  const versionLabel = document.getElementById('update-version');

  window.updateAPI.getUpdateStatus().then((state) => {
    if (state && state.version) {
      versionLabel.textContent = window.i18n.t('update.installVersion', { version: state.version });
    }
  }).catch(() => {
    versionLabel.textContent = '';
  });

  cancelButton.addEventListener('click', () => {
    window.updateAPI.closeInstallWindow();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = passwordInput.value;
    if (!password) {
      status.textContent = window.i18n.t('update.installPasswordRequired');
      passwordInput.focus();
      return;
    }

    installButton.disabled = true;
    cancelButton.disabled = true;
    status.textContent = window.i18n.t('update.installingPackage');
    status.className = 'update-install-status is-loading';
    output.textContent = '';

    try {
      const result = await window.updateAPI.installUpdateWithPassword(password);
      if (result && result.success) {
        status.textContent = window.i18n.t('update.installSuccess');
        status.className = 'update-install-status is-success';
        return;
      }

      status.textContent = (result && result.error) || window.i18n.t('update.installError');
      status.className = 'update-install-status is-error';
      output.textContent = (result && result.output) || '';
      passwordInput.value = '';
      passwordInput.focus();
      installButton.disabled = false;
      cancelButton.disabled = false;
    } catch (error) {
      status.textContent = window.i18n.t('update.installError');
      status.className = 'update-install-status is-error';
      output.textContent = error && error.message ? error.message : '';
      passwordInput.value = '';
      passwordInput.focus();
      installButton.disabled = false;
      cancelButton.disabled = false;
    }
  });
});
