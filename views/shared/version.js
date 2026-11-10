// views/shared/version.js
// Rellena cualquier elemento [data-app-version] con la versión de la app.

window.addEventListener('DOMContentLoaded', async () => {
  const targets = document.querySelectorAll('[data-app-version]');
  if (!targets.length || !window.electronAPI?.getAppVersion) return;

  try {
    const version = await window.electronAPI.getAppVersion();
    if (typeof version !== 'string' || !version) return;
    targets.forEach((el) => {
      el.textContent = `v${version}`;
    });
  } catch {
    // Informativo: si falla, no se muestra nada.
  }
});
