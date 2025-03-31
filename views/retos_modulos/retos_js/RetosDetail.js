// modules/RetosDetail.js
const { clipboard } = require('electron');
const api = require('../../../controllers/apiEndpoints');
const path = require('path');

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
    
    // Botón "Ver Writeup"
    const btnVerWriteup = document.createElement('button');
    btnVerWriteup.id = 'btn-ver-writeup';
    btnVerWriteup.textContent = 'Ver Writeup';
    btnVerWriteup.addEventListener('click', () => onVerWriteup(challenge));
    
    // Botón para descargar archivos (si challenge.has_file)
    let btnDescargarArchivo = null;
    if (challenge.has_file) {
      btnDescargarArchivo = document.createElement('button');
      btnDescargarArchivo.classList.add('btn-descargar-archivo');
      btnDescargarArchivo.textContent = 'Descargar archivos del reto';
      btnDescargarArchivo.addEventListener('click', async () => {
        // Seleccionar el contenedor de estado; si no existe, crearlo
        let downloadStatus = document.getElementById('download-status');
        if (!downloadStatus) {
          downloadStatus = document.createElement('div');
          downloadStatus.id = 'download-status';
          downloadStatus.classList.add('download-status');
          // Insertar justo debajo del botón btn-descargar-archivo
          btnDescargarArchivo.insertAdjacentElement('afterend', downloadStatus);
        }
        
        try {
          // Llamada al endpoint get_files
          const response = await api.getFiles({ token: token, challengeID: challenge.id });
          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
          }
          
          // Convertir la respuesta a Blob, luego a ArrayBuffer y finalmente a Buffer
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Determinar la carpeta destino:
          let destFolder = localStorage.getItem('DestinationFile');
          if (!destFolder) {
            let app;
            try {
              app = require('electron').remote.app;
            } catch (e) {
              app = require('@electron/remote').app;
            }
            destFolder = app.getPath('downloads');
          }
          
          // Expandir ~ si es necesario
          if (destFolder.startsWith('~')) {
            destFolder = destFolder.replace('~', process.env.HOME);
          }
          
          const fs = require('fs');
          // Comprobar si la carpeta destino existe:
          if (!fs.existsSync(destFolder)) {
            downloadStatus.textContent = `Error al almacenar el fichero, la carpeta "${destFolder}" indicada en configuración no se ha encontrado.`;
            downloadStatus.style.color = '#ff4f4f';
            return;
          }
          
          // Crear una subcarpeta con el nombre del reto (si no existe)
          const challengeFolder = path.join(destFolder, challenge.name);
          if (!fs.existsSync(challengeFolder)) {
            fs.mkdirSync(challengeFolder, { recursive: true });
          }
          
          // Guardar el archivo ZIP en la subcarpeta, con nombre <challenge.name>.zip
          const filePath = path.join(challengeFolder, `${challenge.name}.zip`);
          fs.writeFileSync(filePath, buffer);
          downloadStatus.textContent = `Archivo guardado en: ${filePath}`;
          downloadStatus.style.color = '#beefbe';
        } catch (err) {
          console.error('Error al descargar archivos del reto:', err);
          downloadStatus.textContent = 'Error al descargar archivos del reto.';
          downloadStatus.style.color = '#ff4f4f';
        }
      });
      
      
    }
    
    // Sección Docker (si challenge.is_docker)
    let dockerSection = null;
    if (challenge.is_docker) {
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
        flagResult.textContent = 'Introduce una flag.';
        flagResult.style.color = '#ff4f4f';
        return;
      }
      try {
        const challengeID = challenge.id
        const flag = flagValue
        const data = await api.submitChallenge({token, challengeID, flag})
        if (!data.error) {
          flagResult.textContent = '¡Flag correcta!';
          flagResult.style.color = '#beefbe';
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

module.exports = RetosDetail;
