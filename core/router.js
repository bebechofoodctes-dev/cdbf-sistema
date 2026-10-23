// Router por hash: #/cocina, #/cajero, etc. Carga cada módulo recién cuando se entra a él.
const rutas = new Map();

async function navegar() {
  const nombre = location.hash.replace(/^#\/?/, '').split('/')[0];
  const cont = document.getElementById('app-container');
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('activo', a.dataset.route === nombre));
  const cargar = rutas.get(nombre);
  if (!cargar) { cont.innerHTML = '<p class="aviso">Esa pantalla no existe.</p>'; return; }
  try {
    const modulo = await cargar();
    cont.innerHTML = '';
    modulo.mount(cont);
  } catch (e) {
    console.error(e);
    cont.innerHTML = '<p class="aviso">Este módulo todavía no está listo.</p><pre class="detalle"></pre>';
    cont.querySelector('.detalle').textContent = e.message; // detalle técnico, útil mientras desarrollamos
  }
}

export const router = {
  register(nombre, cargar) { rutas.set(nombre, cargar); return this; },
  init() { addEventListener('hashchange', navegar); navegar(); }
};
