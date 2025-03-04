// views/writeup.js

const apiToken = localStorage.getItem('apiToken') || 'TU_API_TOKEN';
const currentChallenge = JSON.parse(localStorage.getItem('currentChallenge') || '{}');
const api = require('../../controllers/apiEndpoints');

window.addEventListener('DOMContentLoaded', () => {
  const btnAtras = document.getElementById('btn-atras');
  const writeupContent = document.getElementById('writeup-content');

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

  function enableCodeCopy() {
    const codeBlocks = document.querySelectorAll('.writeup-content pre');
    codeBlocks.forEach(pre => {
      const tooltip = document.createElement('span');
      tooltip.classList.add('copy-tooltip');
      tooltip.textContent = 'Copiado';
      pre.appendChild(tooltip);

      pre.addEventListener('click', () => {
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
