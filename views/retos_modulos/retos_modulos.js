// views/retos_modulos.js
const { ipcRenderer } = require('electron');
const RetosList = require('./retos_js/RetosList');
const RetosDetail = require('./retos_js/RetosDetail');
const DockerManager = require('./retos_js/DockerManager');
const api_token = localStorage.getItem('apiToken');

let currentChallenges = [];
let selectedChallenge = null;
const dockerManager = new DockerManager();

window.addEventListener('DOMContentLoaded', async () => {
  // Obtener el ID del módulo
  const module_id = localStorage.getItem('currentModuleId');
  if (!module_id) {
    alert('No se ha definido el module_id');
    return;
  }
  await fetchChallenges(module_id);
});

window.addEventListener('DOMContentLoaded', async () => {
  // Listener para el botón de atrás
  const btnAtras = document.getElementById('btn-atras');
  btnAtras.addEventListener('click', () => {
    window.location.href = '../modulos/modulos.html';
  });
  
  const module_id = localStorage.getItem('currentModuleId');
  if (!module_id) {
    alert('No se ha definido el module_id');
    return;
  }
  await fetchChallenges(module_id);
});


async function fetchChallenges(module_id) {
  try {
    const api = require('../../controllers/apiEndpoints');
    // Llamada para obtener retos asociados al módulo
    currentChallenges = await api.getChallengesModules({token: api_token, moduleID: module_id});
    
    const retosListModule = new RetosList('retos-list');
    retosListModule.renderList(currentChallenges, (challenge) => {
      showChallengeDetail(challenge);
    });
    
    if (currentChallenges.length > 0) {
      showChallengeDetail(currentChallenges[0]);
    } else {
      document.getElementById('reto-detail').innerHTML = `<p style="text-align:center; margin-top:20px; color:#ccc;">No se encontraron retos para este módulo</p>`;
    }
  } catch (error) {
    console.error(error);
    alert('Error al obtener retos. Revisa la consola para más detalles.');
  }
}

function showChallengeDetail(challenge) {
  selectedChallenge = challenge;
  // No se guarda contexto, ya que al volver se recargan los retos usando el module_id.
  
  // Detener cualquier intervalo Docker previo
  if (dockerManager.checkInterval) {
    clearInterval(dockerManager.checkInterval);
    dockerManager.checkInterval = null;
  }
  
  const retosDetailModule = new RetosDetail('reto-detail');
  retosDetailModule.showDetail(challenge, api_token, dockerManager, (challenge) => {
    localStorage.setItem('currentChallenge', JSON.stringify(challenge));
    localStorage.setItem('lastPageUsed', 'retos_modulo');
    window.location.href = '../writeup/writeup.html';
  }, updateChallengeColor);
}

function updateChallengeColor(challenge) {
  const retosList = document.getElementById('retos-list');
  const items = retosList.querySelectorAll('.challenge-item');
  items.forEach(item => {
    if (item.textContent === challenge.name) {
      item.classList.remove('challenge-pending');
      item.classList.add('challenge-completed');
    }
  });
}
