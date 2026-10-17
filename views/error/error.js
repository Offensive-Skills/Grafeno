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
      title: 'Docker no está instalado',
      description: 'Grafeno necesita Docker para funcionar. Puedes instalarlo directamente desde aquí.',
      buttonText: 'Instalar Docker'
    },
    COMPOSE_MISSING: {
      title: 'Docker Compose v2 requiere instalación o actualización',
      description: 'Grafeno necesita Docker Compose v2.33.1 o superior. Puedes instalarlo o actualizarlo directamente desde aquí.',
      buttonText: 'Instalar / actualizar Docker Compose'
    },
    DOCKER_PERM_MISSING: {
      title: 'Tu usuario no pertenece al grupo docker',
      description: 'Docker está instalado, pero tu usuario no tiene permisos para usarlo. Introduce tu contraseña para añadirlo al grupo docker.',
      buttonText: 'Añadir mi usuario al grupo docker'
    },
    DOCKER_DAEMON_STOPPED: {
      title: 'El servicio Docker no está iniciado',
      description: 'Docker está instalado, pero su servicio no está en ejecución. Introduce tu contraseña para iniciarlo.',
      buttonText: 'Iniciar servicio Docker'
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
    errorTitle.textContent = config.title;
    errorDescription.textContent = config.description;
    installButton.textContent = config.buttonText;

    if (state === 'COMPOSE_MISSING') {
      infoBox.innerHTML = '<p>Se añadirá el repositorio oficial de Docker y se instalará o actualizará el plugin <code>docker-compose-plugin</code>.</p>';
    } else if (state === 'DOCKER_PERM_MISSING') {
      infoBox.innerHTML = '<p>Se añadirá tu usuario al grupo <strong>docker</strong>. Después deberás cerrar y volver a iniciar la sesión para que el cambio surta efecto.</p>';
    } else if (state === 'DOCKER_DAEMON_STOPPED') {
      infoBox.innerHTML = '<p>Se ejecutará <code>sudo systemctl start docker</code> para arrancar el servicio.</p>';
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
      document.querySelector('.action-title').textContent = 'Cierra sesión y vuelve a iniciarla';
      document.querySelector('.action-text').innerHTML = 'El cambio de grupo <strong>docker</strong> necesita una nueva sesión de trabajo.';
    } else {
      document.querySelector('.action-title').textContent = 'Reinicia Grafeno';
      document.querySelector('.action-text').textContent = 'La operación se ha completado correctamente. Reinicia Grafeno para volver a comprobar Docker.';
    }
    const steps = document.querySelector('.action-steps');
    if (reloginNeeded) {
      steps.innerHTML = '<li><span class="step-num">1</span><span>Cierra la sesión actual</span></li>'
        + '<li><span class="step-num">2</span><span>Vuelve a iniciar sesión</span></li>'
        + '<li><span class="step-num">3</span><span>Abre Grafeno</span></li>';
      closeGrafenoButton.textContent = 'Cerrar Grafeno';
    } else {
      steps.style.display = 'none';
      closeGrafenoButton.textContent = 'Reiniciar Grafeno';
    }
    actionRequired.style.display = 'block';
  }

  function resetAfterFailure(message) {
    hideStatus();
    showError(message);
    installButton.disabled = false;
    installButton.textContent = 'Reintentar';
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
    showLoading('Cancelando...');
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
      installButton.textContent = 'Iniciando servicio...';
      showLoading('Iniciando el servicio Docker...');
    } else {
      installButton.textContent = 'Instalando...';
      showLoading('Instalando Docker, esto puede tardar unos minutos...');
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
        resetAfterFailure('La instalación se ha cancelado. Inténtalo de nuevo cuando quieras.');
      } else if (isPasswordError(result.output)) {
        resetAfterFailure('La contraseña es incorrecta. Inténtalo de nuevo.');
      } else {
        resetAfterFailure('La instalación no se pudo completar. Revisa el registro para más detalles.');
      }
    } catch (err) {
      window.electronAPI.removeDockerInstallOutputListener(outputHandler);
      cancelInstallButton.style.display = 'none';
      resetAfterFailure('Error inesperado: ' + err.message);
    }
  });
});
