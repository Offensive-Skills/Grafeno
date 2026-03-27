// shared/DockerManager.js
class DockerManager {
  constructor() {
    this.dockerState = {};
    this.checkInterval = null;
  }

  createDockerSection(challenge) {
    const dockerSection = document.createElement('div');
    dockerSection.classList.add('docker-section');

    const ipContainer = document.createElement('div');
    ipContainer.innerHTML = `<strong>IP del contenedor:</strong> <span id="container-ip">Inactive</span>`;

    const loadingSpan = document.createElement('span');
    loadingSpan.classList.add('docker-loading');
    loadingSpan.style.display = 'none';
    loadingSpan.textContent = ' (Iniciando contenedor...)';
    const spinner = document.createElement('span');
    spinner.classList.add('docker-spinner');
    loadingSpan.prepend(spinner);
    loadingSpan.style.color = '#beefbe';
    ipContainer.appendChild(loadingSpan);

    const dockerButtons = document.createElement('div');
    dockerButtons.classList.add('docker-buttons');

    const btnIniciar = document.createElement('button');
    btnIniciar.textContent = 'Iniciar';
    const btnDetener = document.createElement('button');
    btnDetener.textContent = 'Detener';
    const btnReiniciar = document.createElement('button');
    btnReiniciar.textContent = 'Reiniciar';

    dockerButtons.appendChild(btnIniciar);
    dockerButtons.appendChild(btnDetener);
    dockerButtons.appendChild(btnReiniciar);

    dockerSection.appendChild(ipContainer);
    dockerSection.appendChild(dockerButtons);

    const containerIpSpan = ipContainer.querySelector('#container-ip');
    const key = challenge.name + challenge.version;

    if (this.dockerState[key] === 'pulling') {
      loadingSpan.textContent = ' (Iniciando contenedor...)';
      loadingSpan.style.color = '#beefbe';
      loadingSpan.style.display = 'inline';
    } else if (this.dockerState[key] === 'deteniendo') {
      loadingSpan.textContent = ' (Deteniendo contenedor...)';
      loadingSpan.style.color = '#ff4f4f';
      loadingSpan.style.display = 'inline';
    }

    // Copiar IP al hacer click
    containerIpSpan.addEventListener('click', () => {
      if (containerIpSpan.textContent.trim() !== 'Inactive') {
        navigator.clipboard.writeText(containerIpSpan.textContent.trim());
        console.log('IP copiada:', containerIpSpan.textContent.trim());
      }
    });

    // Eventos Docker
    btnIniciar.addEventListener('click', () => {
      this.dockerState[key] = 'pulling';
      loadingSpan.textContent = ' (Iniciando contenedor...)';
      loadingSpan.style.color = '#beefbe';
      loadingSpan.style.display = 'inline';
      this.runDockerScript(challenge.name, challenge.version, 0, (data) => {
        loadingSpan.innerHTML = '';
        const spinner = document.createElement('span');
        spinner.classList.add('docker-spinner');
        loadingSpan.appendChild(spinner);
        if (data.phase === 'downloading') {
          loadingSpan.appendChild(document.createTextNode(` (Descargando imagen... ${data.percent}%)`));
        } else if (data.phase === 'preparing') {
          loadingSpan.appendChild(document.createTextNode(` (Preparando contenedor...)`));
        }
      })
        .then(() => {
          console.log('Contenedor iniciado/reiniciado.');
          this.dockerState[key] = 'idle';
          loadingSpan.style.display = 'none';
          this.checkContainerIp(challenge.name, challenge.version, containerIpSpan);
        })
        .catch(err => {
          console.error(err);
          this.dockerState[key] = 'idle';
          loadingSpan.style.display = 'none';
        });
    });

    btnDetener.addEventListener('click', () => {
      this.dockerState[key] = 'deteniendo';
      loadingSpan.textContent = ' (Deteniendo contenedor...)';
      loadingSpan.style.color = '#ff4f4f';
      loadingSpan.style.display = 'inline';
      this.runDockerScript(challenge.name, challenge.version, 1)
        .then(() => {
          console.log('Contenedor detenido.');
          this.dockerState[key] = 'idle';
          loadingSpan.style.display = 'none';
          this.checkContainerIp(challenge.name, challenge.version, containerIpSpan);
        })
        .catch(err => {
          console.error(err);
          this.dockerState[key] = 'idle';
          loadingSpan.style.display = 'none';
        });
    });

    btnReiniciar.addEventListener('click', () => {
      this.dockerState[key] = 'pulling';
      loadingSpan.textContent = ' (Iniciando contenedor...)';
      loadingSpan.style.color = '#beefbe';
      loadingSpan.style.display = 'inline';
      this.runDockerScript(challenge.name, challenge.version, 0, (data) => {
        loadingSpan.innerHTML = '';
        const spinner = document.createElement('span');
        spinner.classList.add('docker-spinner');
        loadingSpan.appendChild(spinner);
        if (data.phase === 'downloading') {
          loadingSpan.appendChild(document.createTextNode(` (Descargando imagen... ${data.percent}%)`));
        } else if (data.phase === 'preparing') {
          loadingSpan.appendChild(document.createTextNode(` (Preparando contenedor...)`));
        }
      })
        .then(() => {
          console.log('Contenedor reiniciado.');
          this.dockerState[key] = 'idle';
          loadingSpan.style.display = 'none';
          this.checkContainerIp(challenge.name, challenge.version, containerIpSpan);
        })
        .catch(err => {
          console.error(err);
          this.dockerState[key] = 'idle';
          loadingSpan.style.display = 'none';
        });
    });

    this.checkInterval = setInterval(() => {
      this.checkContainerIp(challenge.name, challenge.version, containerIpSpan);
    }, 5000);
    this.checkContainerIp(challenge.name, challenge.version, containerIpSpan);

    return dockerSection;
  }

  runDockerScript(title, version, mode, statusCallback) {
    const progressHandler = statusCallback
      ? window.electronAPI.onDockerProgress((data) => { statusCallback(data); })
      : null;

    return window.electronAPI.runContainer(title, version, mode)
      .finally(() => {
        if (progressHandler) {
          window.electronAPI.removeDockerProgressListener(progressHandler);
        }
      });
  }

  async checkContainerIp(title, version, ipElement) {
    try {
      const ip = await window.electronAPI.checkContainer(title, version);
      ipElement.textContent = ip === 'Inactive' ? 'Inactive' : ip;
    } catch (error) {
      console.error('Error al ejecutar checkContainer:', error);
      ipElement.textContent = 'Inactive';
    }
  }
}

window.DockerManager = DockerManager;
