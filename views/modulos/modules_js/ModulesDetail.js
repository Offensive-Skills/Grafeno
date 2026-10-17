// views/modules/modules_js/ModulesDetail.js

class ModulesDetail {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }
  
  showDetail(module, config, onFlagComplete, onUpdateColor) {
    this.container.innerHTML = '';
    // Título
    const titleElem = document.createElement('h2');
    titleElem.textContent = module.name;
    
    // Descripción
    const descElem = document.createElement('div');
    descElem.classList.add('description');
    descElem.textContent = module.description || window.i18n.t('modulos.noDesc');
    
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
    
    // Botón para descargar archivos (si module.has_file)
    let btnDescargarArchivo = null;
    if (module.has_file) {
      btnDescargarArchivo = document.createElement('button');
      btnDescargarArchivo.classList.add('btn-descargar-archivo');
      btnDescargarArchivo.textContent = window.i18n.t('modulos.download');
      btnDescargarArchivo.addEventListener('click', async () => {
        try {
          const response = await api.getFiles({ token: config.api_token, challengeID: module.id });
          if (!response.ok) {
            throw new Error(window.i18n.t('detail.httpError', { status: response.status }));
          }
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();

          let destFolder = localStorage.getItem('DestinationFile');
          if (!destFolder) {
            destFolder = await window.electronAPI.getDownloadsPath();
          }
          if (destFolder.startsWith('~')) {
            const homePath = await window.electronAPI.getHomePath();
            destFolder = destFolder.replace('~', homePath);
          }

          const filePath = await window.electronAPI.saveChallenge(destFolder, module.name, arrayBuffer);
          console.log(`Archivo guardado en: ${filePath}`);
        } catch (err) {
          console.error('Error al descargar archivos:', err);
        }
      });
    }
    
    // Mostrar la URL del módulo en grande
    const urlDisplay = document.createElement('div');
    urlDisplay.classList.add('module-url');
    urlDisplay.textContent = module.url || window.i18n.t('detail.noUrl');
    if (module.url) {
      urlDisplay.addEventListener('click', () => copyWithFeedback(module.url, urlDisplay));
    }
    
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
        flagResult.textContent = window.i18n.t('detail.enterFlag');
        flagResult.style.color = '#ff4f4f';
        return;
      }
      try {
        const data = {
          flag: flagValue,
          challengeID: module.id,
          token: config.api_token
        };
        const response = await fetch(config.endpoint_flag, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (response.status === 200) {
          flagResult.textContent = window.i18n.t('detail.correct');
          flagResult.style.color = '#beefbe';
          module.completed = true;
          if (typeof onFlagComplete === 'function') onFlagComplete(module);
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

window.ModulesDetail = ModulesDetail;
