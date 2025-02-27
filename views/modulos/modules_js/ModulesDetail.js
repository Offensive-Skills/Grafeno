// views/modules/modules_js/ModulesDetail.js
const { clipboard } = require('electron');
const ApiEndpoints = require('../../../controllers/apiEndpoints'); // Si lo necesitas para la URL de descarga

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
    descElem.textContent = module.description || 'Sin descripción';
    
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
    
    // Botón para descargar archivos (si module.has_file)
    let btnDescargarArchivo = null;
    if (module.has_file) {
      btnDescargarArchivo = document.createElement('button');
      btnDescargarArchivo.classList.add('btn-descargar-archivo');
      btnDescargarArchivo.textContent = 'Descargar archivos del módulo';
      btnDescargarArchivo.addEventListener('click', () => {
        const fileURL = ApiEndpoints.buildDownloadFileURL(config.api_token, module.id);
        window.open(fileURL, '_blank');
      });
    }
    
    // Mostrar la URL del módulo en grande
    const urlDisplay = document.createElement('div');
    urlDisplay.classList.add('module-url');
    urlDisplay.textContent = module.url || 'No hay URL disponible';
    
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
          flagResult.textContent = '¡Flag correcta!';
          flagResult.style.color = '#beefbe';
          module.completed = true;
          if (typeof onFlagComplete === 'function') onFlagComplete(module);
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

module.exports = ModulesDetail;
