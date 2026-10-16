// views/error/error.js

window.addEventListener('DOMContentLoaded', () => {
  const installSection = document.getElementById('installSection');
  const installButton = document.getElementById('installButton');
  const passwordInput = document.getElementById('sudoPassword');
  const logSection = document.getElementById('logSection');
  const installLog = document.getElementById('installLog');
  const statusMsg = document.getElementById('statusMsg');
  const restartButton = document.getElementById('restartButton');
  const closeButton = document.getElementById('closeButton');

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

  restartButton.addEventListener('click', () => {
    window.electronAPI.rebootSystem();
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
        statusMsg.innerHTML = '✅ Docker instalado correctamente.<br><br>⚠️ <strong>Es necesario reiniciar el equipo</strong> para completar la instalación y poder usar Grafeno.';
        statusMsg.className = 'success-msg';
        statusMsg.style.display = 'block';
        restartButton.style.display = 'inline-block';
      } else {
        statusMsg.textContent = '❌ La instalación ha fallado. Revisa la contraseña e inténtalo de nuevo.';
        statusMsg.className = 'error-msg';
        statusMsg.style.display = 'block';
        installButton.disabled = false;
        installButton.textContent = 'Reintentar';
        passwordInput.disabled = false;
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (err) {
      window.electronAPI.removeDockerInstallOutputListener(outputHandler);
      statusMsg.textContent = '❌ Error inesperado: ' + err.message;
      statusMsg.className = 'error-msg';
      statusMsg.style.display = 'block';
      installButton.disabled = false;
      installButton.textContent = 'Reintentar';
      passwordInput.disabled = false;
    }
  });
});
