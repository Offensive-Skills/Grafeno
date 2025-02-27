// views/writeup.js

// Se asume que el token y el challenge se almacenaron previamente en localStorage
const apiToken = localStorage.getItem('apiToken') || 'TU_API_TOKEN';
const currentChallenge = JSON.parse(localStorage.getItem('currentChallenge') || '{}');
const api = require('../../controllers/apiEndpoints'); // Importamos nuestro módulo de API

window.addEventListener('DOMContentLoaded', () => {
  const btnAtras = document.getElementById('btn-atras');
  const writeupContent = document.getElementById('writeup-content');

  // Botón "Atrás": regresa a la vista de retos
  btnAtras.addEventListener('click', () => {
    const goBack = localStorage.getItem('lastPageUsed')
    if (goBack === "retos"){
      window.location.href = '../retos/retos.html';
    } else {
      window.location.href = '../retos_modulos/retos_modulos.html';
    }
    
  });

  async function fetchWriteup() {
    try {
      // Llamamos a la función del API que ya devuelve el JSON directamente
      const data = await api.getWriteup({ token: apiToken, challengeID: currentChallenge.id });

      if (data.error) {
        writeupContent.innerHTML = `<p class="error">${data.error}</p>`;
      } else {
        // Convertir Markdown a HTML usando marked.js
        const htmlContent = marked.parse(data.content);
        writeupContent.innerHTML = htmlContent;
        enableCodeCopy(); // Habilitamos la copia de los bloques de código
      }
    } catch (error) {
      console.error('Error al obtener el writeup:', error);
      writeupContent.innerHTML = `<p class="error">Error al cargar el writeup. Revisa la consola para más detalles.</p>`;
    }
  }

  // Función para hacer "copiables" los bloques de código sin incluir el tooltip
  function enableCodeCopy() {
    const codeBlocks = document.querySelectorAll('.writeup-content pre');
    codeBlocks.forEach(pre => {
      // Agregar un span para el tooltip
      const tooltip = document.createElement('span');
      tooltip.classList.add('copy-tooltip');
      tooltip.textContent = 'Copiado';
      pre.appendChild(tooltip);

      pre.addEventListener('click', () => {
        // Clonar el bloque y eliminar el tooltip de la copia
        const clone = pre.cloneNode(true);
        const tooltipElem = clone.querySelector('.copy-tooltip');
        if (tooltipElem) tooltipElem.remove();

        navigator.clipboard.writeText(clone.innerText)
          .then(() => {
            pre.classList.add('copied');
            setTimeout(() => {
              pre.classList.remove('copied');
            }, 1500);
          })
          .catch(err => console.error('Error al copiar el código:', err));
      });
    });
  }

  fetchWriteup();
});
