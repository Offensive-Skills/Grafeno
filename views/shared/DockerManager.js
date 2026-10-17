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
    label.textContent = useCompose ? window.i18n.t('docker.ipCompose') : window.i18n.t('docker.ipContainer');
    const ipSpan = document.createElement('span');
    ipSpan.textContent = window.i18n.t('docker.inactive');
    ipSpan.id = `container-ip-${challenge.id}`;
    ipContainer.append(label, ipSpan);

    const loadingSpan = document.createElement('span');
    loadingSpan.classList.add('docker-loading');
    loadingSpan.style.display = 'none';
    const spinner = document.createElement('span');
    spinner.classList.add('docker-spinner');
    loadingSpan.append(spinner, document.createTextNode(' ' + window.i18n.t('docker.starting')));
    loadingSpan.style.color = '#beefbe';
    ipContainer.appendChild(loadingSpan);

    const buttons = document.createElement('div');
    buttons.classList.add('docker-buttons');
    const startButton = document.createElement('button');
    startButton.textContent = window.i18n.t('docker.start');
    const stopButton = document.createElement('button');
    stopButton.textContent = window.i18n.t('docker.stop');
    const restartButton = document.createElement('button');
    restartButton.textContent = window.i18n.t('docker.restart');
    buttons.append(startButton, stopButton, restartButton);
    section.append(ipContainer, buttons);

    const key = useCompose ? `compose-${challenge.id}` : `${challenge.name}${challenge.version}`;
    ipSpan.classList.add('ip-copyable');
    ipSpan.addEventListener('click', () => {
      ipSpan.querySelector('.copy-feedback')?.remove();
      const ip = ipSpan.textContent.trim();
      if (ip && ip !== 'Inactive') copyWithFeedback(ip, ipSpan);
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
      setLoading(isStarting ? window.i18n.t('docker.starting') : window.i18n.t('docker.stopping'), isStarting ? '#beefbe' : '#ff4f4f');

      const progressHandler = isStarting
        ? window.electronAPI.onDockerProgress((data) => {
          if (data.operationId !== key) return;
          if (data.phase === 'downloading') {
            setLoading(data.percent == null ? window.i18n.t('docker.downloading') : window.i18n.t('docker.downloadingPct', { percent: data.percent }));
          } else if (data.phase === 'preparing') {
            setLoading(window.i18n.t('docker.preparing'));
          } else if (data.phase === 'authenticating') {
            setLoading(window.i18n.t('docker.authenticating'));
          }
        })
        : null;

      try {
        if (useCompose) {
          if (isStarting) {
            const response = await api.getCompose({ token, challengeID: challenge.id });
            if (!response || response.error) {
              throw new Error(response?.error || window.i18n.t('docker.composeError'));
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
        setLoading(error.message || window.i18n.t('docker.errorOp'), '#ff4f4f');
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
      ipElement.textContent = ip === 'Inactive' ? window.i18n.t('docker.inactive') : ip;
    } catch (error) {
      console.error('Error al consultar la IP del entorno:', error);
      ipElement.textContent = window.i18n.t('docker.inactive');
    }
  }
}

window.DockerManager = DockerManager;
