// shared/RetosDetail.js

class RetosDetail {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }
  
  showDetail(challenge, token, dockerManager, onVerWriteup, onFlagComplete) {
    this.container.innerHTML = '';
    // Título
    const titleElem = document.createElement('h2');
    titleElem.textContent = challenge.name;
    
    // Descripción
    const descElem = document.createElement('div');
    descElem.classList.add('description');
    descElem.textContent = challenge.description || window.i18n.t('detail.noDesc');
    
    // Fila para flag (input + botón)
    const flagRow = document.createElement('div');
    flagRow.classList.add('flag-row');
    const inputFlag = document.createElement('input');
    inputFlag.type = 'text';
    inputFlag.placeholder = window.i18n.t('detail.flagPlaceholder');
    const btnEnviarFlag = document.createElement('button');
    btnEnviarFlag.textContent = window.i18n.t('detail.sendFlag');
    flagRow.appendChild(inputFlag);
    flagRow.appendChild(btnEnviarFlag);
    
    // Resultado de flag
    const flagResult = document.createElement('div');
    flagResult.classList.add('flag-result');
    
    // Botón "Ver Writeup"
    const btnVerWriteup = document.createElement('button');
    btnVerWriteup.id = 'btn-ver-writeup';
      btnVerWriteup.textContent = window.i18n.t('detail.seeWriteup');
    btnVerWriteup.addEventListener('click', () => onVerWriteup(challenge));
    
    // Botón para descargar archivos (si challenge.has_file)
    let btnDescargarArchivo = null;
    if (challenge.has_file) {
      btnDescargarArchivo = document.createElement('button');
      btnDescargarArchivo.classList.add('btn-descargar-archivo');
      btnDescargarArchivo.textContent = window.i18n.t('detail.download');
      btnDescargarArchivo.addEventListener('click', async () => {
        let downloadStatus = document.getElementById('download-status');
        if (!downloadStatus) {
          downloadStatus = document.createElement('div');
          downloadStatus.id = 'download-status';
          downloadStatus.classList.add('download-status');
          btnDescargarArchivo.insertAdjacentElement('afterend', downloadStatus);
        }
        
        try {
          const response = await api.getFiles({ token: token, challengeID: challenge.id });
           if (!response.ok) {
            throw new Error(window.i18n.t('detail.httpError', { status: response.status }));
          }
          
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          
          // Determinar la carpeta destino
          let destFolder = localStorage.getItem('DestinationFile');
          if (!destFolder) {
            destFolder = await window.electronAPI.getDownloadsPath();
          }
          
          // Expandir ~ si es necesario
          if (destFolder.startsWith('~')) {
            const homePath = await window.electronAPI.getHomePath();
            destFolder = destFolder.replace('~', homePath);
          }
          
          const filePath = await window.electronAPI.saveChallenge(destFolder, challenge.name, arrayBuffer);
          downloadStatus.textContent = window.i18n.t('detail.saved', { path: filePath });
          downloadStatus.style.color = '#beefbe';
        } catch (err) {
          console.error('Error al descargar archivos del reto:', err);
          const msg = err.message || window.i18n.t('detail.downloadError');
          downloadStatus.textContent = msg;
          downloadStatus.style.color = '#ff4f4f';
        }
      });
    }
    
    // Sección Docker/Compose
    let dockerSection = null;
    const isDocker = challenge.is_docker === true || challenge.is_docker === 1;
    const isDockerCompose = challenge.is_docker_compose === true || challenge.is_docker_compose === 1;
    if (isDockerCompose && !isDocker) {
      console.warn(`El reto ${challenge.id} tiene is_docker_compose sin is_docker.`);
    } else if (isDocker && isDockerCompose && window.electronAPI.supportsCompose()) {
      dockerSection = dockerManager.createComposeSection(challenge, token);
    } else if (isDocker && !isDockerCompose) {
      dockerSection = dockerManager.createDockerSection(challenge);
    }
    
    // Agregar elementos al contenedor
    this.container.appendChild(titleElem);
    this.container.appendChild(descElem);
    this.container.appendChild(flagRow);
    this.container.appendChild(flagResult);
    this.container.appendChild(btnVerWriteup);
    if (btnDescargarArchivo) this.container.appendChild(btnDescargarArchivo);
    if (dockerSection) this.container.appendChild(dockerSection);
    
    // Evento: Enviar Flag
    btnEnviarFlag.addEventListener('click', async () => {
      const flagValue = inputFlag.value.trim();
      if (!flagValue) {
        flagResult.textContent = window.i18n.t('detail.enterFlag');
        flagResult.style.color = '#ff4f4f';
        return;
      }
      try {
        const challengeID = challenge.id
        const flag = flagValue
        const data = await api.submitChallenge({token, challengeID, flag})
        if (!data.error) {
          flagResult.textContent = window.i18n.t('detail.correct');
          flagResult.style.color = '#beefbe';
          challenge.completed = true;
          if (typeof onFlagComplete === 'function') onFlagComplete(challenge);
        } else {
          flagResult.textContent = window.i18n.t('detail.wrong');
          flagResult.style.color = '#ff4f4f';
        }
      } catch (error) {
        console.error('Error al enviar flag:', error);
        flagResult.textContent = window.i18n.t('detail.sendError');
        flagResult.style.color = '#ff4f4f';
      }
    });
  }
}

window.RetosDetail = RetosDetail;
