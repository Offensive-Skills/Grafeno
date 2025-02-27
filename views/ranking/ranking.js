// views/ranking.js
const api_token = localStorage.getItem('apiToken');

window.addEventListener('DOMContentLoaded', async () => {
  // Configurar botón de Atrás
  const btnAtras = document.getElementById('btn-atras');
  btnAtras.addEventListener('click', () => {
    window.location.href = '../main/mainMenu.html';
  });

  await loadRanking();
});

async function loadRanking() {
  try {
    const api = require('../../controllers/apiEndpoints');
    // Llamada al endpoint /get_ranking
    const rankingBlob = await api.getRanking();
    const rankingText = await rankingBlob.text();
    let rankingData = JSON.parse(rankingText);
    
    // Llamada al endpoint /get_user_points para el usuario actual
    const userBlob = await api.getUserPoints(api_token);
    const userText = await userBlob.text();
    const currentUser = JSON.parse(userText);
    
    renderRanking(rankingData, currentUser);
  } catch (error) {
    console.error('Error al cargar el ranking:', error);
    alert('Error al cargar el ranking');
  }
}

function renderRanking(rankingData, currentUser) {
  const tbody = document.getElementById('top10-body');
  tbody.innerHTML = '';
  
  // Solo se mostrarán los 10 primeros usuarios
  const topUsers = rankingData.slice(0, 10);
  let foundCurrentUser = false;
  
  topUsers.forEach((user, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${index + 1}</td>
                     <td>${user.user_login}</td>
                     <td>${user.points}</td>`;
    
    if (user.user_login === currentUser.user_login) {
      row.classList.add('highlight');
      foundCurrentUser = true;
    }
    tbody.appendChild(row);
  });
  
  if (!foundCurrentUser) {
    // Aquí añades la fila extra para el usuario actual.
    const extraContainer = document.getElementById('extra-ranking');
    extraContainer.style.display = 'block'; // Asegurarte de que se muestre si hubiera contenido
    extraContainer.innerHTML = ''; // Limpiar contenido previo
    
    // Determinar la posición real del usuario
    let position = rankingData.findIndex(user => user.username === currentUser.user_login) + 1;
    if (position === 0) {
      position = topUsers.length + 1;
    }
    
    // Crear una tabla interna para la fila extra
    const table = document.createElement('table');
    const tbodyExtra = document.createElement('tbody');
    const row = document.createElement('tr');
    row.innerHTML = `<td>${currentUser.position}</td>
                     <td>${currentUser.user_login}</td>
                     <td>${currentUser.points}</td>`;
    row.classList.add('highlight');
    tbodyExtra.appendChild(row);
    table.appendChild(tbodyExtra);
    
    extraContainer.appendChild(table);
  } else {
    // Si el usuario está en el top 10, se oculta o se limpia el contenedor extra.
    document.getElementById('extra-ranking').style.display = 'none';
  }
  
}
