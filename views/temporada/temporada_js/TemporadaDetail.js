// views/temporada/temporada_js/TemporadaDetail.js

class TemporadaDetail {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }
  
  showDetail(challenge, token, onFlagComplete, onUpdateColor) {
    this.container.innerHTML = '';
    // Título
    const titleElem = document.createElement('h2');
    titleElem.textContent = `${challenge.name} - ${challenge.points}`;
    
    // Descripción
    const descElem = document.createElement('div');
    descElem.classList.add('description');
    descElem.textContent = challenge.description || 'Sin descripción';
    
    // Fila para flag (input + botón)
    const flagRow = document.createElement('div');
    flagRow.classList.add('flag-row');
    const inputFlag = document.createElement('input');
    inputFlag.type = 'text';
    inputFlag.placeholder = 'Introduce la flag';
    const btnEnviarFlag = document.createElement('button');
    btnEnviarFlag.textContent = 'Enviar flag';
    flagRow.appendChild(inputFlag);
    flagRow.appendChild(btnEnviarFlag);
    
    // Resultado de flag
    const flagResult = document.createElement('div');
    flagResult.classList.add('flag-result');
    
    // Botón para descargar archivos (si hay ficheros)
    let btnDescargarArchivo = null;
    if (challenge.has_file) {
      btnDescargarArchivo = document.createElement('button');
      btnDescargarArchivo.classList.add('btn-descargar-archivo');
      btnDescargarArchivo.textContent = 'Descargar archivos del reto';
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
            throw new Error(`Error HTTP: ${response.status}`);
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
          downloadStatus.textContent = `Archivo guardado en: ${filePath}`;
          downloadStatus.style.color = '#00aaff';
        } catch (err) {
          console.error('Error al descargar archivos del reto:', err);
          const msg = err.message || 'Error al descargar archivos del reto.';
          downloadStatus.textContent = msg;
          downloadStatus.style.color = '#ff4f4f';
        }
      });
    }
    
    // Mostrar la URL del reto en grande
    const urlDisplay = document.createElement('div');
    urlDisplay.classList.add('temporada-url');
    urlDisplay.textContent = challenge.server_ip || 'No hay URL disponible';
    
    // Agregar elementos al contenedor
    this.container.appendChild(titleElem);
    this.container.appendChild(descElem);
    this.container.appendChild(flagRow);
    this.container.appendChild(flagResult);
    if (btnDescargarArchivo) this.container.appendChild(btnDescargarArchivo);
    this.container.appendChild(urlDisplay);
    
    // Evento: Enviar Flag
    btnEnviarFlag.addEventListener('click', async () => {
      const flagValue = inputFlag.value.trim();
      if (!flagValue) {
        flagResult.textContent = 'Introduce una flag.';
        flagResult.style.color = '#ff4f4f';
        return;
      }
      try {
        const challengeID = challenge.id
        const flag = flagValue
        const response = await api.submitChallenge({ flag, challengeID, token });
        if (!response.error) {
          flagResult.textContent = '¡Flag correcta!';
          flagResult.style.color = '#00aaff';
          challenge.completed = true;
          if (typeof onFlagComplete === 'function') onFlagComplete(challenge);
        } else {
          flagResult.textContent = 'Flag incorrecta.';
          flagResult.style.color = '#ff4f4f';
        }
      } catch (error) {
        console.error('Error al enviar flag:', error);
        flagResult.textContent = 'Error al enviar la flag.';
        flagResult.style.color = '#ff4f4f';
      }
    });
  }
}

window.TemporadaDetail = TemporadaDetail;
