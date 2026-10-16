// shared/clipboard.js
window.copyWithFeedback = async (text, anchorEl) => {
  try {
    await (navigator.clipboard ? navigator.clipboard.writeText(text) : window.electronAPI.writeClipboard(text));
    const feedback = document.createElement('span');
    feedback.classList.add('copy-feedback');
    feedback.textContent = '¡Copiado al portapapeles!';
    feedback.setAttribute('role', 'status');
    anchorEl.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1600);
  } catch (err) {
    console.error('Error al copiar al portapapeles:', err);
    await window.electronAPI.writeClipboard(text).catch(() => {});
  }
};
