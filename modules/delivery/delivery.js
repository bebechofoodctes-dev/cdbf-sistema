import { api } from '../../core/api.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = n => '$' + Number(n).toLocaleString('es-AR');
const CSS = `
.dv{--card:#202833;--txt:#e9eef4;--tenue:#93a1b3;--acento:#4da3e0;--ok:#56c48f;--aviso:#f0b13c;max-width:42rem;margin:0 auto;padding:1rem;color:var(--txt);font:17px/1.35 system-ui,sans-serif}
.dv h1,.dv h2{margin:.2rem 0 .8rem}.dv h2{font-size:1.1rem;color:var(--tenue)}.dv button,.dv select,.dv a.bt{font:inherit;font-weight:700;border:0;border-radius:10px;padding:.9rem 1rem;cursor:pointer;background:var(--acento);color:#06121d;width:100%;display:block;text-align:center;text-decoration:none;margin-top:.5rem}
.dv select{background:#10151c;color:var(--txt);border:2px solid #34404f;font-weight:500}.dv .sec{background:#2d3846;color:var(--txt)}.dv .ok{background:var(--ok)}.dv button:disabled{opacity:.45}
.dv .c{background:var(--card);border-radius:12px;padding:.9rem;margin-bottom:.7rem;border-left:6px solid var(--aviso)}.dv .c.listo{border-color:var(--ok)}.dv .c.mio{border-color:var(--acento);box-shadow:0 0 0 2px var(--acento)}
.dv .c small,.dv .tenue{color:var(--tenue)}.dv ul{padding-left:1.1rem;margin:.4rem 0}.dv iframe{width:100%;height:38vh;border:0;border-radius:12px;background:#10151c}
.dv .g{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}.dv .g div{background:var(--card);border-radius:10px;padding:.7rem}.dv .g b{display:block;font-size:1.25rem}.dv .err{color:var(--aviso);min-height:1.3em}`;

let ctx, timer;
function beep() {
  try { ctx ??= new AudioContext(); ctx.resume(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .2; o.start(); o.stop(ctx.currentTime + .25); } catch { /* sin audio */ }
}
const coords = u => (/(-?\d{1,3}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/.exec(u || '') || []).slice(1, 3).join(',');
const lugar = p => coords(p.ubi) || p.dir || '';

export function mount(root) {
  clearInterval(timer);
  const nombre = localStorage.getItem('cdbf_repartidor');
  nombre && localStorage.getItem('cdbf_activo') === '1' ? principal(root, nombre) : inicio(root, nombre);
}

async function inicio(root, guardado) {
  root.innerHTML = `<style>${CSS}</style><div class="dv"><h1>Modo delivery</h1><p class="tenue">Cargando repartidores…</p></div>`;
  const r = await api('delivery_staff'), box = root.querySelector('.dv');
  if (r.error) {
    box.innerHTML = '<h1>Modo delivery</h1><p class="err"></p>';
    box.querySelector('.err').textContent = r.error === 'red' ? 'No se pudo conectar. Recargá la página.' : 'El servidor respondió con un error: ' + r.error;
    return;
  }
  box.innerHTML = `<h1>Modo delivery</h1><label class="tenue">¿Quién sos?</label>
    <select id="sel">${r.staff.map(s => `<option ${s.n === guardado ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select>
    <p class="err"></p><button id="on">Activar modo delivery</button>`;
  box.querySelector('#on').onclick = async () => {
    const nombre = box.querySelector('#sel').value; beep();
    const a = await api('delivery_activar', { nombre });
    if (a.error) { box.querySelector('.err').textContent = a.error === 'sin_jornada' ? 'El cajero todavía no inició las ventas.' : 'No se pudo activar: ' + a.error; return; }
    localStorage.setItem('cdbf_repartidor', nombre); localStorage.setItem('cdbf_activo', '1');
    try { await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
    principal(root, nombre);
  };
}

function principal(root, nombre) {
  root.innerHTML = `<style>${CSS}</style><div class="dv"><h1>Hola ${esc(nombre)}, excelente jornada para hoy!</h1>
    <h2>Pedidos con envío</h2><div id="ped"></div><p class="err" id="er"></p>
    <h2>Mapa</h2><iframe id="mapa" title="Mapa"></iframe><a class="bt sec" id="ruta" target="_blank" rel="noopener" hidden>Cómo llegar en Google Maps</a>
    <h2 style="margin-top:1rem">Tu jornada</h2><div class="g" id="res"></div>
    <button class="sec" id="off" style="margin-top:1.5rem">Desactivar modo delivery</button></div>`;
  let v = '', D = { pedidos: [], resumen: {} }, vistos = null, sel = null;
  const $ = q => root.querySelector(q);

  const mapa = p => {
    sel = p?.id; const q = p ? lugar(p) : '';
    $('#mapa').src = q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed` : 'about:blank';
    const a = $('#ruta'); a.hidden = !p; if (p) a.href = q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : p.ubi;
  };
  const tarjeta = p => `<article class="c ${p.estado === 'EN_CAMINO' ? 'mio' : p.listo ? 'listo' : ''}"><b>${esc(p.cliente)}</b> <small>${esc(p.cuenta)}</small>
    <ul>${p.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul><div>${esc(p.dir || 'Ubicación en enlace')}</div>
    <a class="bt sec" href="tel:${esc(p.tel)}">Llamar ${esc(p.tel)}</a><button class="sec" data-m="${esc(p.id)}">Ver en el mapa</button>
    ${p.estado === 'EN_CAMINO' ? `<button class="ok" data-e="${esc(p.id)}">Entregado</button>`
      : `<button data-t="${esc(p.id)}" ${p.listo ? '' : 'disabled'}>${p.listo ? 'Tomar pedido' : 'En cocina, esperá…'}</button>`}</article>`;

  function pintar() {
    const L = [...D.pedidos].sort((a, b) => (b.estado === 'EN_CAMINO') - (a.estado === 'EN_CAMINO'));
    $('#ped').innerHTML = L.length ? L.map(tarjeta).join('') : '<p class="tenue">No hay pedidos con envío por ahora.</p>';
    const R = D.resumen; $('#res').innerHTML = [['Envíos hechos', R.entregados], ['Básico', pesos(R.basico)], ['Por envíos', pesos(R.envios)], ['Total del día', pesos(R.total)], ['Efectivo a rendir', pesos(R.rendir || 0)]].map(([k, x]) => `<div>${k}<b>${x}</b></div>`).join('');
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => mapa(D.pedidos.find(p => p.id === b.dataset.m)));
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => accion('delivery_tomar', b.dataset.t));
    root.querySelectorAll('[data-e]').forEach(b => b.onclick = () => confirm('¿Confirmás que el cliente recibió el pedido?') && accion('delivery_entregar', b.dataset.e));
    if (!D.pedidos.some(p => p.id === sel)) mapa(L[0]);
  }
  async function cargar() {
    if (!$('#ped')) return;
    const r = await api('delivery_estado', { nombre, v });
    if (r.activo === false || r.error === 'sin_jornada') { localStorage.removeItem('cdbf_activo'); return mount(root); }
    if (r.error || r.sin_cambios) return;
    v = r.v; D = r;
    if (vistos && r.pedidos.some(p => p.listo && p.estado === 'PENDIENTE' && !vistos.has(p.id))) beep();
    vistos = new Set(r.pedidos.filter(p => p.listo).map(p => p.id)); pintar();
  }
  async function accion(a, id) {
    const r = await api(a, { nombre, id });
    $('#er').textContent = r.error ? ({ ya_tomado: 'Otro repartidor ya tomó ese pedido.', no_listo: 'Cocina todavía no lo terminó.' }[r.error] || 'No se pudo: ' + r.error) : '';
    v = ''; cargar();
  }
  $('#off').onclick = async () => {
    const r = await api('delivery_desactivar', { nombre });
    if (r.error) { $('#er').textContent = r.error === 'pedido_en_curso' ? 'Tenés un pedido en camino: entregalo antes de desactivar.' : 'No se pudo desactivar: ' + r.error; return; }
    localStorage.removeItem('cdbf_activo'); clearInterval(timer); inicio(root, nombre);
  };
  timer = setInterval(cargar, 4000); cargar();
}
