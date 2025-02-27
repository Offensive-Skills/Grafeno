// views/retos.js
const { ipcRenderer } = require('electron');
const path = require('path');
const { clipboard } = require('electron');



const RetosApi = require('./retos_js/RetosApi');
const RetosList = require('./retos_js/RetosList');
const RetosDetail = require('./retos_js/RetosDetail');
const DockerManager = require('./retos_js/DockerManager');
const ContextManager = require('./retos_js/ContextManager');
const api_token = localStorage.getItem('apiToken')


let currentChallenges = [];
let selectedChallenge = null;
const dockerManager = new DockerManager();

window.addEventListener('DOMContentLoaded', async () => {
  const selectDificultad = document.getElementById('select-dificultad');
  const selectTematica = document.getElementById('select-tematica');
  const selectEstado = document.getElementById('select-estado');
  const btnBuscar = document.getElementById('btn-buscar');
  const btnAtras = document.getElementById('btn-atras');

  // Cargar filtros previos
  const filters = ContextManager.getFilters();
  selectDificultad.value = filters.dificultad;
  selectTematica.value = filters.tematica;
  selectEstado.value = filters.estado;

  await fetchChallenges();

  btnBuscar.addEventListener('click', fetchChallenges);
  btnAtras.addEventListener('click', () => {
    ContextManager.saveRetosScroll(document.getElementById('retos-list').scrollTop);
    window.location.href = '../main/mainMenu.html';
  });
});

async function fetchChallenges() {
  const selectDificultad = document.getElementById('select-dificultad');
  const selectTematica = document.getElementById('select-tematica');
  const selectEstado = document.getElementById('select-estado');
  const level = selectDificultad.value;
  const topic = selectTematica.value;
  const type = selectEstado.value;
  
  // Guardar filtros
  ContextManager.saveFilters({ dificultad: level, tematica: topic, estado: type });
  
  try {
    currentChallenges = await RetosApi.fetchChallenges(api_token, level, topic, type);
    const retosListModule = new RetosList('retos-list');
    retosListModule.renderList(currentChallenges, (challenge) => {
      showChallengeDetail(challenge);
    });
    const savedScroll = ContextManager.getRetosScroll();
    if (savedScroll) {
      document.getElementById('retos-list').scrollTop = parseInt(savedScroll, 10);
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
      document.getElementById('reto-detail').innerHTML = `<p style="text-align:center; margin-top:20px; color:#ccc;">No se encontraron retos con estos filtros</p>`;
    }
  } catch (error) {
    console.error(error);
    alert('Error al obtener retos. Revisa la consola para más detalles.');
  }
}

function showChallengeDetail(challenge) {
  selectedChallenge = challenge;
  ContextManager.saveSelectedChallenge(challenge.name);
  // Detener cualquier intervalo Docker previo
  if (dockerManager.checkInterval) {
    clearInterval(dockerManager.checkInterval);
    dockerManager.checkInterval = null;
  }
  const retosDetailModule = new RetosDetail('reto-detail');
  retosDetailModule.showDetail(challenge, api_token, dockerManager, (challenge) => {
    localStorage.setItem('currentChallenge', JSON.stringify(challenge));
    ContextManager.saveRetosScroll(document.getElementById('retos-list').scrollTop);
    localStorage.setItem('lastPageUsed', 'retos');
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
