// views/config/config.js
const { execFile } = require('child_process');
const path = require('path');

window.addEventListener('DOMContentLoaded', () => {
  const destinationInput = document.getElementById('destinationInput');
  const btnAtras = document.getElementById('btn-atras');
  const btnReset = document.getElementById('btn-reset');
  const resetStatus = document.getElementById('reset-status');
  
  // Cargar la ruta destino guardada (si existe)
  const storedDestination = localStorage.getItem('DestinationFile');
  if (storedDestination) {
    destinationInput.value = storedDestination;
  }
  
  // Al perder el foco, guardar la ruta destino
  destinationInput.addEventListener('blur', () => {
    const newDestination = destinationInput.value.trim();
    if (newDestination) {
      localStorage.setItem('DestinationFile', newDestination);
    } else {
      localStorage.removeItem('DestinationFile');
    }
  });
  
  // Botón Atrás: vuelve al menú principal
  btnAtras.addEventListener('click', () => {
    window.location.href = '../main/mainMenu.html';
  });
  
  // Botón Reset: Ejecuta el script para resetear datos y muestra el estado en el HTML
  btnReset.addEventListener('click', () => {
    resetStatus.textContent = 'Eliminando contenido de la aplicación...';
    resetStatus.style.color = '#ffffff';
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'resetData.sh');
    execFile('bash', [scriptPath], (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al resetear datos: ${error}`);
        resetStatus.textContent = 'Error al resetear datos.';
        resetStatus.style.color = '#ff4f4f';
      } else {
        console.log("Reset de datos completado");
        resetStatus.textContent = "Reset de datos completado.";
        resetStatus.style.color = '#beefbe';
      }
    });
  });
});
