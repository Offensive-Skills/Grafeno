// modules/DockerManager.js
const { spawn, execFile } = require('child_process');
const path = require('path');
const { app, clipboard } = require('@electron/remote')


class DockerManager {
  constructor() {
    this.dockerState = {}; // key: challengeName+challengeVersion, value: state
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
        const { clipboard } = require('electron');
        clipboard.writeText(containerIpSpan.textContent.trim());
        console.log('IP copiada:', containerIpSpan.textContent.trim());
      }
    });

    // Eventos Docker
    btnIniciar.addEventListener('click', () => {
      this.dockerState[key] = 'pulling';
      loadingSpan.textContent = ' (Iniciando contenedor...)';
      loadingSpan.style.color = '#beefbe';
      loadingSpan.style.display = 'inline';
      this.runDockerScript(challenge.name, challenge.version, 0, (percent) => {
        loadingSpan.innerHTML = '';
        const spinner = document.createElement('span');
        spinner.classList.add('docker-spinner');
        loadingSpan.appendChild(spinner);
        loadingSpan.appendChild(document.createTextNode(` (Iniciando contenedor... ${percent}%)`));
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
      this.runDockerScript(challenge.name, challenge.version, 0, (percent) => {
        loadingSpan.innerHTML = '';
        const spinner = document.createElement('span');
        spinner.classList.add('docker-spinner');
        loadingSpan.appendChild(spinner);
        loadingSpan.appendChild(document.createTextNode(` (Iniciando contenedor... ${percent}%)`));
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
    return new Promise((resolve, reject) => {
      const basePath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked')
        : app.getAppPath();
      const scriptPath = path.join(basePath, 'scripts', 'containerManager.sh');

      const domain = 'harbor.offs.es/challenges/';

      const child = spawn('bash', [scriptPath, domain, title, version, mode]);

      let totalLayers = 0;
      let completedLayers = 0;

      child.stdout.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n');
        lines.forEach(line => {
          if (line.includes('Pulling fs layer')) totalLayers++;
          if (line.includes('Pull complete') || line.includes('Download complete') || line.includes('Already exists')) completedLayers++;
        });

        if (totalLayers > 0 && statusCallback) {
          let percent = Math.floor((completedLayers / totalLayers) * 100);
          if (percent > 100) percent = 99;
          statusCallback(percent);
        }
      });

      child.stderr.on('data', (data) => {
        console.error(`Docker STDERR: ${data}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          if (statusCallback) statusCallback(100);
          resolve('Process finished');
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }


  checkContainerIp(title, version, ipElement) {
    // Mismo manejo de rutas: producción apunta a la carpeta desempaquetada, en desarrollo a la raíz del proyecto.
    const basePath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked')
      : app.getAppPath();
    const scriptPath = path.join(basePath, 'scripts', 'checkContainer.sh');

    execFile('bash', [scriptPath, title, version], (error, stdout, stderr) => {
      if (error) {
        console.error('Error al ejecutar checkContainer.sh:', error);
        ipElement.textContent = 'Inactive';
      } else {
        const ip = stdout.trim();
        ipElement.textContent = ip === 'Inactive' ? 'Inactive' : ip;
      }
    });
  }

}

module.exports = DockerManager;
