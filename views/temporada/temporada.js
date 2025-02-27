// views/temporada/temporada.js
const { ipcRenderer } = require('electron');
const api = require('../../controllers/apiEndpoints'); // Reutilizamos si es idéntico
const RetosList = require('../retos/retos_js/RetosList'); // Reutilizamos la lista de retos
const TemporadaDetail = require('./temporada_js/TemporadaDetail');
const ContextManager = require('../retos/retos_js/ContextManager');
const token = localStorage.getItem('apiToken');

let currentChallenges = [];

window.addEventListener('DOMContentLoaded', async () => {
  const btnAtras = document.getElementById('btn-atras');
  
  await fetchChallenges();
  
  btnAtras.addEventListener('click', () => {
    ContextManager.saveRetosScroll(document.getElementById('temporada-list').scrollTop);
    window.location.href = '../main/mainMenu.html';
  });
});

async function fetchChallenges() {
  try {
    // Llamamos a la función que ya devuelve JSON
    currentChallenges = await api.getSeasonalChallenge({ token });
    
    const listModule = new RetosList('temporada-list');
    listModule.renderList(currentChallenges, (challenge) => {
      showChallengeDetail(challenge);
    });
    
    const savedScroll = ContextManager.getRetosScroll();
    if (savedScroll) {
      document.getElementById('temporada-list').scrollTop = parseInt(savedScroll, 10);
    }
    
    const storedChallengeName = ContextManager.getSelectedChallenge();
    if (storedChallengeName) {
      const storedChallenge = currentChallenges.find(ch => ch.name === storedChallengeName);
      if (storedChallenge) {
        showChallengeDetail(storedChallenge);
        const targetItem = document.querySelector(`.challenge-item[data-name="${storedChallenge.name}"]`);
        if (targetItem) {
          targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (currentChallenges.length > 0) {
        showChallengeDetail(currentChallenges[0]);
      }
    } else if (currentChallenges.length > 0) {
      showChallengeDetail(currentChallenges[0]);
    } else {
      document.getElementById('temporada-detail').innerHTML = `<p style="text-align:center; margin-top:20px; color:#ccc;">No se encontraron retos de temporada</p>`;
    }
  } catch (error) {
    console.error(error);
    alert('Error al obtener retos de temporada. Revisa la consola para más detalles.');
  }
}

function showChallengeDetail(challenge) {
  ContextManager.saveSelectedChallenge(challenge.name);
  const detailModule = new TemporadaDetail('temporada-detail');
  detailModule.showDetail(challenge, token, (challenge) => {
    localStorage.setItem('currentChallenge', JSON.stringify(challenge));
    ContextManager.saveRetosScroll(document.getElementById('temporada-list').scrollTop);
    // Aquí podrías definir otra acción si fuera necesario.
  }, updateChallengeColor);
}

function updateChallengeColor(challenge) {
  const listContainer = document.getElementById('temporada-list');
  const items = listContainer.querySelectorAll('.challenge-item');
  items.forEach(item => {
    if (item.textContent === challenge.name) {
      item.classList.remove('challenge-pending');
      item.classList.add('challenge-completed');
    }
  });
}
