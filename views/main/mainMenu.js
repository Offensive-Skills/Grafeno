const { ipcRenderer } = require('electron');

const path = require('path');
const api = require('../../controllers/apiEndpoints'); // Importamos nuestro módulo de API


window.addEventListener('DOMContentLoaded', () => {
  initMenuButtons();
  initStats();
});

/**
 * Inicializa los eventos de los botones del menú.
 */
function initMenuButtons() {
  document.getElementById('btn-retos').addEventListener('click', () => {
    window.location.href = '../retos/retos.html';
  });

  document.getElementById('btn-temporada').addEventListener('click', () => {
    window.location.href = '../temporada/temporada.html';
  });

  document.getElementById('btn-cursos').addEventListener('click', () => {
    window.location.href = '../cursos/cursos.html';
  });

  document.getElementById('btn-config').addEventListener('click', () => {
    window.location.href = '../config/config.html';
  });


  document.getElementById('btn-ranking').addEventListener('click', () => {
    window.location.href = '../ranking/ranking.html';
  });
}

/**
 * Realiza la petición para obtener estadísticas y renderiza el gráfico Radar.
 */
async function initStats() {
  const apiToken = localStorage.getItem('apiToken') || 'TU_API_TOKEN';
  try {
    const data = await api.getStats({ token: apiToken });
    if (data.error) {
      alert("Error: " + data.error);
    } else {
      renderChart(data);
    }
  } catch (err) {
    console.error("Error al obtener estadísticas:", err);
    alert("Error al obtener estadísticas.");
  }
}


function renderChart(stats) {
  const topics = Object.keys(stats);
  const percentages = topics.map(topic => stats[topic]);

  const ctx = document.getElementById('statsChart').getContext('2d');
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: topics,
      datasets: [{
        label: 'Progreso (%)',
        data: percentages,
        backgroundColor: 'rgba(190, 239, 190, 0.2)', // Verde translúcido
        borderColor: '#beefbe',
        borderWidth: 2,
        pointBackgroundColor: '#beefbe'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Configuración específica para eje radial (Chart.js v3+)
      scales: {
        r: {
          // Rango
          beginAtZero: true,
          min: 0,
          max: 100,
          // Ocultar la escala numérica
          ticks: {
            display: false
          },
          // Color de las líneas radiales
          angleLines: {
            color: '#666'
          },
          // Color de la cuadrícula (cículos concéntricos)
          grid: {
            color: '#666'
          },
          // Color de las etiquetas (temas)
          pointLabels: {
            color: '#beefbe',
            font: {
              family: 'Courier Prime',
              size: 12
            }
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#beefbe',
            font: {
              family: 'Courier Prime'
            }
          }
        }
      }
    }
  });
}
