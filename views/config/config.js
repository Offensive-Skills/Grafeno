// views/config/config.js

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
  
  btnReset.addEventListener('click', async () => {
    resetStatus.textContent = 'Eliminando contenido de la aplicación...';
    resetStatus.style.color = '#ffffff';

    try {
      await window.electronAPI.resetData();
      console.log("Reset de datos completado");
      resetStatus.textContent = "Reset de datos completado.";
      resetStatus.style.color = '#beefbe';
    } catch (error) {
      console.error(`Error al resetear datos: ${error}`);
      resetStatus.textContent = 'Error al resetear datos.';
      resetStatus.style.color = '#ff4f4f';
    }
  });
  
});
