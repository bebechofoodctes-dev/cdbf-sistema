// URL de la aplicación web de Apps Script (se obtiene al publicar Code.gs)
export const API_URL = 'https://script.google.com/macros/s/AKfycbziT-J0dYKIHtZH-a28lEJcCj7u2Lnu8sTnjn57azb3n89M717unLwciFnJvNy0aQ/exec';

// POST como text/plain evita el preflight CORS que Apps Script no soporta.
export async function api(accion, datos = {}) {
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion, ...datos })
    });
    return await r.json();
  } catch {
    return { error: 'red' };
  }
}
