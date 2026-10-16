// views/error/error.js

window.addEventListener('DOMContentLoaded', () => {
  const installSection = document.getElementById('installSection');
  const installButton = document.getElementById('installButton');
  const passwordInput = document.getElementById('sudoPassword');
  const logSection = document.getElementById('logSection');
  const installLog = document.getElementById('installLog');
  const statusMsg = document.getElementById('statusMsg');
  const actionRequired = document.getElementById('actionRequired');
  const closeGrafenoButton = document.getElementById('closeGrafenoButton');
  const buttonRow = document.getElementById('buttonRow');
  const closeButton = document.getElementById('closeButton');

  const crossIcon = '<svg class="icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function showError(message) {
    statusMsg.textContent = ' ' + message;
    statusMsg.insertAdjacentHTML('afterbegin', crossIcon);
    statusMsg.className = 'error-msg';
    statusMsg.style.display = 'block';
  }

  window.electronAPI.getDockerStartupError().then((error) => {
    if (error?.code === 'COMPOSE_MISSING') {
      document.getElementById('errorTitle').textContent = 'Docker Compose v2 no está instalado';
      document.getElementById('errorDescription').textContent = error.message;
      document.getElementById('installSection').style.display = 'none';
      document.querySelector('.info-box').innerHTML = '<p>Instala el plugin oficial <code>docker-compose-plugin</code> para tu distribución y vuelve a iniciar Grafeno.</p><p><a href="https://docs.docker.com/compose/install/linux/">Documentación oficial de Docker Compose</a></p>';
    }
  });

  closeButton.addEventListener('click', () => {
    window.electronAPI.closeApp();
  });

  closeGrafenoButton.addEventListener('click', () => {
    window.electronAPI.closeApp();
  });

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') installButton.click();
  });

  installButton.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) {
      passwordInput.focus();
      return;
    }

    installButton.disabled = true;
    installButton.textContent = 'Instalando...';
    passwordInput.disabled = true;
    logSection.style.display = 'block';
    installLog.textContent = '';

    const outputHandler = window.electronAPI.onDockerInstallOutput((text) => {
      installLog.textContent += text;
      installLog.scrollTop = installLog.scrollHeight;
    });

    try {
      const result = await window.electronAPI.installDocker(password);
      window.electronAPI.removeDockerInstallOutputListener(outputHandler);

      if (result.success) {
        installSection.style.display = 'none';
        logSection.style.display = 'none';
        buttonRow.style.display = 'none';
        actionRequired.style.display = 'block';
      } else {
        showError('La instalación ha fallado. Revisa la contraseña e inténtalo de nuevo.');
        installButton.disabled = false;
        installButton.textContent = 'Reintentar';
        passwordInput.disabled = false;
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (err) {
      window.electronAPI.removeDockerInstallOutputListener(outputHandler);
      showError('Error inesperado: ' + err.message);
      installButton.disabled = false;
      installButton.textContent = 'Reintentar';
      passwordInput.disabled = false;
    }
  });
});
