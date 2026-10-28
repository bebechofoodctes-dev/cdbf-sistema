// URL de la aplicación web de Apps Script (se obtiene al publicar Code.gs)
export const API_URL = 'https://script.google.com/macros/s/AKfycbxQdEww04d-EnzKTJwiDr-jT_or_HaPGkeKsv2WXbiEVAjaf1XMPX7DkjgxI1WwBs8/exec';

// Clave del local: llega en el enlace (?k=...) y se guarda en el dispositivo.
const k = new URLSearchParams(location.search).get('k');
if (k) localStorage.setItem('cdbf_k', k);

// POST como text/plain evita el preflight CORS que Apps Script no soporta.
export async function api(accion, datos = {}) {
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, k: localStorage.getItem('cdbf_k') || '', ...datos })
    });
    const j = await r.json();
    if (j.error === 'clave_invalida') {
      document.body.innerHTML = '<p style="font:18px system-ui;color:#e9eef4;text-align:center;margin:20vh 1rem">Este enlace ya no es válido.<br>Pedile uno nuevo al administrador.</p>';
    }
    return j;
  } catch {
    return { error: 'red' };
  }
}
