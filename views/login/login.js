const { ipcRenderer } = require('electron');
const { attemptDockerLogin } = require('../../scripts/dockerLogin');
const QRCodeStyling = require("qr-code-styling");
const api = require('../../controllers/apiEndpoints'); 

window.addEventListener('DOMContentLoaded', () => {
  // Generar el código QR en el contenedor
  const qrContainer = document.querySelector(".qr-container");
  const qrCode = new QRCodeStyling({
    width: 300,
    height: 300,
    type: "svg",
    data: "https://offs.es/",
    qrOptions: { margin: 0 },
    dotsOptions: { color: "#beefbe", type: "rounded" },
    backgroundOptions: { color: "#2b2b2b" },
    imageOptions: { crossOrigin: "anonymous", margin: 0 }
  });
  qrCode.append(qrContainer);

  // Verificar si hay algún warning notificable usando la API
  api.getWarningNotification()
  .then(data => {
    if (data.msg.trim().toLowerCase() !== "ok") {
      showWarning(data.msg);
    }
  })
  .catch(err => {
    console.error("Error en warningNotification:", err);
  });


  // Pre-cargar credenciales guardadas (si existen)
  const storedUsername = localStorage.getItem('rememberedUsername');
  const storedApiToken = localStorage.getItem('rememberedApiToken');
  if (storedUsername) {
    document.getElementById('username').value = storedUsername;
  }
  if (storedApiToken) {
    document.getElementById('apiToken').value = storedApiToken;
    document.getElementById('rememberCreds').checked = true;
  }

  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('error-message');
  const loadingOverlay = document.getElementById('loadingOverlay');

  // Al enviar el formulario, si el checkbox está marcado se guardan las credenciales
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMessage.textContent = '';
    loadingOverlay.style.display = 'flex';

    const username = document.getElementById('username').value.trim();
    const apiToken = document.getElementById('apiToken').value.trim();
    const remember = document.getElementById('rememberCreds').checked;

    if (remember) {
      localStorage.setItem('rememberedUsername', username);
      localStorage.setItem('rememberedApiToken', apiToken);
    } else {
      localStorage.removeItem('rememberedUsername');
      localStorage.removeItem('rememberedApiToken');
    }

    const success = await attemptDockerLogin(username, apiToken);
    loadingOverlay.style.display = 'none';

    if (success) {
      localStorage.setItem('apiToken', apiToken);
      ipcRenderer.send('login-success');
    } else {
      errorMessage.textContent = 'Usuario o API-TOKEN incorrectos';
      ipcRenderer.send('login-failed');
    }
  });
});

/**
 * Crea y muestra un recuadro de warning elegante debajo del login.
 * @param {string} message - Mensaje de warning a mostrar.
 */
function showWarning(message) {
  if (document.getElementById("warning-container")) return;
  const warningContainer = document.createElement("div");
  warningContainer.id = "warning-container";
  warningContainer.className = "warning-container";
  warningContainer.textContent = message;
  const loginOverlay = document.getElementById("loginOverlay");
  loginOverlay.appendChild(warningContainer);
}
