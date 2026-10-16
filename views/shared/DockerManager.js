// shared/DockerManager.js
class DockerManager {
  constructor() {
    this.dockerState = {};
    this.checkInterval = null;
  }

  createDockerSection(challenge) {
    return this.createSection(challenge, false);
  }

  createComposeSection(challenge, token) {
    return this.createSection(challenge, true, token);
  }

  createSection(challenge, useCompose, token) {
    const section = document.createElement('div');
    section.classList.add('docker-section');

    const ipContainer = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = useCompose ? 'IP del servicio principal: ' : 'IP del contenedor: ';
    const ipSpan = document.createElement('span');
    ipSpan.textContent = 'Inactive';
    ipSpan.id = `container-ip-${challenge.id}`;
    ipContainer.append(label, ipSpan);

    const loadingSpan = document.createElement('span');
    loadingSpan.classList.add('docker-loading');
    loadingSpan.style.display = 'none';
    const spinner = document.createElement('span');
    spinner.classList.add('docker-spinner');
    loadingSpan.append(spinner, document.createTextNode(' Iniciando contenedor...'));
    loadingSpan.style.color = '#beefbe';
    ipContainer.appendChild(loadingSpan);

    const buttons = document.createElement('div');
    buttons.classList.add('docker-buttons');
    const startButton = document.createElement('button');
    startButton.textContent = 'Iniciar';
    const stopButton = document.createElement('button');
    stopButton.textContent = 'Detener';
    const restartButton = document.createElement('button');
    restartButton.textContent = 'Reiniciar';
    buttons.append(startButton, stopButton, restartButton);
    section.append(ipContainer, buttons);

    const key = useCompose ? `compose-${challenge.id}` : `${challenge.name}${challenge.version}`;
    ipSpan.addEventListener('click', () => {
      const ip = ipSpan.textContent.trim();
      if (ip && ip !== 'Inactive') navigator.clipboard.writeText(ip);
    });

    const setBusy = (busy) => {
      startButton.disabled = busy;
      stopButton.disabled = busy;
      restartButton.disabled = busy;
    };

    const setLoading = (text, color = '#beefbe') => {
      loadingSpan.replaceChildren();
      const currentSpinner = document.createElement('span');
      currentSpinner.classList.add('docker-spinner');
      loadingSpan.append(currentSpinner, document.createTextNode(` ${text}`));
      loadingSpan.style.color = color;
      loadingSpan.style.display = 'inline';
    };

    const runOperation = async (mode, button) => {
      if (button.disabled) return;
      const isStarting = mode === 0 || mode === 'start';
      setBusy(true);
      this.dockerState[key] = isStarting ? 'pulling' : 'deteniendo';
      setLoading(isStarting ? 'Iniciando contenedor...' : 'Deteniendo contenedor...', isStarting ? '#beefbe' : '#ff4f4f');

      const progressHandler = isStarting
        ? window.electronAPI.onDockerProgress((data) => {
          if (data.operationId !== key) return;
          if (data.phase === 'downloading') {
            setLoading(data.percent == null ? 'Descargando imágenes...' : `Descargando imagen... ${data.percent}%`);
          } else if (data.phase === 'preparing') {
            setLoading('Preparando contenedor...');
          } else if (data.phase === 'authenticating') {
            setLoading('Renovando sesión de Harbor...');
          }
        })
        : null;

      try {
        if (useCompose) {
          if (isStarting) {
            const response = await api.getCompose({ token, challengeID: challenge.id });
            if (!response || response.error) {
              throw new Error(response?.error || 'No se pudo obtener la configuración Compose.');
            }
            await window.electronAPI.cacheCompose(
              challenge.id,
              response.compose_yaml,
              response.compose_sha256
            );
          }
          await window.electronAPI.runCompose(challenge.id, isStarting ? 'start' : 'stop');
        } else {
          await window.electronAPI.runContainer(challenge.name, challenge.version, isStarting ? 0 : 1);
        }
        loadingSpan.style.display = 'none';
      } catch (error) {
        console.error('Error al gestionar el entorno Docker:', error);
        setLoading(error.message || 'No se pudo completar la operación Docker.', '#ff4f4f');
      } finally {
        if (progressHandler) window.electronAPI.removeDockerProgressListener(progressHandler);
        this.dockerState[key] = 'idle';
        setBusy(false);
        await this.checkIp(challenge, ipSpan, useCompose);
      }
    };

    startButton.addEventListener('click', () => runOperation(useCompose ? 'start' : 0, startButton));
    stopButton.addEventListener('click', () => runOperation(useCompose ? 'stop' : 1, stopButton));
    restartButton.addEventListener('click', () => runOperation(useCompose ? 'start' : 0, restartButton));

    this.checkInterval = setInterval(() => this.checkIp(challenge, ipSpan, useCompose), 5000);
    this.checkIp(challenge, ipSpan, useCompose);
    return section;
  }

  async checkIp(challenge, ipElement, useCompose) {
    try {
      const ip = useCompose
        ? await window.electronAPI.checkCompose(challenge.id)
        : await window.electronAPI.checkContainer(challenge.name, challenge.version);
      ipElement.textContent = ip === 'Inactive' ? 'Inactive' : ip;
    } catch (error) {
      console.error('Error al consultar la IP del entorno:', error);
      ipElement.textContent = 'Inactive';
    }
  }
}

window.DockerManager = DockerManager;
