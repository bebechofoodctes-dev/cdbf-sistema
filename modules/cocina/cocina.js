import { api, ahora } from '../../core/api.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hora = s => (s || '').slice(11, 16);
const CSS = `
.k{--fondo:#151a22;--card:#202833;--txt:#e9eef4;--tenue:#93a1b3;--espera:#f0b13c;--proceso:#4da3e0;--listo:#56c48f;
 background:var(--fondo);color:var(--txt);min-height:100vh;font:18px/1.35 system-ui,sans-serif}
.k h1{font-size:2rem;margin:0 0 1rem}.k button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:.9rem 1.2rem;cursor:pointer;background:var(--proceso);color:#06121d}
.k button.sec{background:#2d3846;color:var(--txt)}.k input{display:block;width:100%;font:inherit;padding:.8rem;margin:0 0 .6rem;border-radius:10px;border:2px solid #34404f;background:#10151c;color:var(--txt)}
.kl{max-width:30rem;margin:0 auto;padding:12vh 1.2rem}.err{color:var(--espera);min-height:1.4em}
.kh{padding:.8rem 1.2rem;color:var(--tenue);border-bottom:1px solid #2a3340}
.kb{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;padding:.8rem;align-items:start}
.kb h2{font-size:1.1rem;margin:0 0 .6rem}.kb section:nth-child(1) h2{color:var(--espera)}.kb section:nth-child(2) h2{color:var(--proceso)}.kb section:nth-child(3) h2{color:var(--listo)}
.c{background:var(--card);border-radius:12px;padding:.9rem;margin-bottom:.7rem;border-left:6px solid var(--espera)}
.c[data-e=EN_PREPARACION]{border-color:var(--proceso)}.c[data-e=LISTA]{border-color:var(--listo)}
.c.am{box-shadow:0 0 0 2px var(--espera)}.c.rj{box-shadow:0 0 0 3px #e5584f}
.c h3{margin:0}.c small{color:var(--tenue)}.c ul{list-style:none;padding:0;margin:.6rem 0;font-size:1.25rem}.c li em{display:block;color:var(--espera);font-size:1rem}
.c p{margin:.3rem 0;color:var(--tenue)}.c .tm{color:var(--txt);font-weight:700;font-size:1.2rem}.c button{width:100%;margin-top:.5rem}
.kt{position:fixed;bottom:1rem;left:50%;transform:translateX(-50%)}
@media(max-width:900px){.kb{grid-template-columns:1fr}}`;

let timers = [], ctx;
function beep() {
  try {
    ctx ??= new AudioContext(); ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2;
    o.start(); o.stop(ctx.currentTime + 0.25);
  } catch { /* sin audio */ }
}

export function mount(root) {
  timers.forEach(clearInterval); timers = [];
  const ses = JSON.parse(sessionStorage.getItem('cocina') || 'null');
  ses ? tablero(root, ses) : login(root);
}

function login(root) {
  root.innerHTML = `<style>${CSS}</style><div class="k"><div class="kl"><h1>¿Quiénes cocinan hoy?</h1>
    <div id="nom"></div><button class="sec" id="mas">Agregar otra persona</button><p class="err"></p><button id="ok">Entrar a cocina</button></div></div>`;
  const nom = root.querySelector('#nom'), err = root.querySelector('.err');
  const add = () => nom.insertAdjacentHTML('beforeend', '<input placeholder="Nombre y apellido">');
  add(); root.querySelector('#mas').onclick = add;
  root.querySelector('#ok').onclick = async () => {
    const nombres = [...nom.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
    if (!nombres.length) { err.textContent = 'Escribí al menos un nombre y apellido.'; return; }
    beep(); // el clic habilita el sonido del navegador
    const r = await api('sesion_cocina', { nombres });
    if (r.error) { err.textContent = r.error === 'sin_jornada' ? 'El cajero todavía no inició las ventas.' : 'No se pudo conectar. Probá de nuevo.'; return; }
    const s = { nombres, j: r.id_jornada };
    sessionStorage.setItem('cocina', JSON.stringify(s)); tablero(root, s);
  };
}

function tablero(root, ses) {
  const n = ses.nombres, saludo = n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n.at(-1) : n[0];
  root.innerHTML = `<style>${CSS}</style><div class="k"><div class="kh">Hola ${esc(saludo)}, excelente jornada para hoy!</div>
    <div class="kb"><section><h2>Entrantes (<span id="n1">0</span>)</h2><div id="p1"></div></section>
    <section><h2>En preparación (<span id="n2">0</span>)</h2><div id="p2"></div></section>
    <section><h2>Finalizados (<span id="n3">0</span>)</h2><div id="p3"></div></section></div><div class="kt" id="kt"></div></div>`;
  const ESTADOS = ['RECIBIDA', 'EN_PREPARACION', 'LISTA'];
  let v = '', vistos = null, data = { tandas: [] };

  const tarjeta = t => {
    const titulo = t.tipo === 'SALON' ? `Mesa ${esc(t.mesa)}, tanda ${esc(t.nro)}` : esc(t.cliente);
    const items = t.items.map(i => `<li>${esc(i.c)} x ${esc(i.n)}${i.o ? `<em>${esc(i.o)}</em>` : ''}</li>`).join('');
    const info = t.estado === 'RECIBIDA' ? `<p>Esperando <span class="tm" data-d="${t.envio}"></span></p>`
      : t.estado === 'EN_PREPARACION' ? `<p>Inició ${hora(t.inicio)} - preparando <span class="tm" data-d="${t.inicio}"></span></p>`
      : `<p>Inició ${hora(t.inicio)} - terminó ${hora(t.fin)}</p>`;
    const btn = t.estado === 'RECIBIDA' ? `<button data-id="${t.id}" data-a="EN_PREPARACION" data-u="RECIBIDA">Preparar pedido</button>`
      : t.estado === 'EN_PREPARACION' ? `<button data-id="${t.id}" data-a="LISTA" data-u="EN_PREPARACION">Pedido finalizado</button>` : '';
    return `<article class="c" data-e="${t.estado}"><h3>${titulo}</h3><small>Pedido ${esc(t.cuenta)}, ${esc(t.tipo.toLowerCase())}</small><ul>${items}</ul>${info}${btn}</article>`;
  };

  function pintar() {
    ESTADOS.forEach((e, i) => {
      const L = data.tandas.filter(t => t.estado === e).sort((a, b) => (a.envio > b.envio) - (a.envio < b.envio));
      root.querySelector('#p' + (i + 1)).innerHTML = L.map(tarjeta).join('');
      root.querySelector('#n' + (i + 1)).textContent = L.length;
    });
    root.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => cambiar(b.dataset.id, b.dataset.a, b.dataset.u));
    tic();
  }

  function tic() {
    root.querySelectorAll('.tm').forEach(e => {
      const seg = Math.max(0, (ahora() - new Date(e.dataset.d.replace(' ', 'T') + '-03:00')) / 1000 | 0), min = seg / 60;
      e.textContent = `${min | 0}:${String(seg % 60).padStart(2, '0')}`;
      const c = e.closest('.c');
      c.classList.toggle('am', !!data.amarillo && min >= data.amarillo && !(data.rojo && min >= data.rojo));
      c.classList.toggle('rj', !!data.rojo && min >= data.rojo);
    });
  }

  async function cargar() {
    if (!root.querySelector('.kb')) return;
    const r = await api('cocina_estado', { v, j: ses.j });
    if (r.error === 'sin_jornada') { sessionStorage.removeItem('cocina'); return login(root); }
    if (r.error || r.sin_cambios) return;
    if (r.id_jornada !== ses.j) { sessionStorage.removeItem('cocina'); return login(root); }
    v = r.v; data = r;
    if (vistos && r.tandas.some(t => t.estado === 'RECIBIDA' && !vistos.has(t.id))) beep();
    vistos = new Set(r.tandas.map(t => t.id));
    pintar();
  }

  async function cambiar(id, a, volver) {
    await api('cocina_cambiar', { id, a, j: ses.j, usuario: n.join(', ') });
    v = ''; await cargar();
    const kt = root.querySelector('#kt'); kt.innerHTML = '<button class="sec" id="und">Deshacer</button>';
    const quitar = setTimeout(() => kt.innerHTML = '', 6000);
    kt.querySelector('#und').onclick = async () => {
      clearTimeout(quitar); kt.innerHTML = '';
      await api('cocina_cambiar', { id, a: volver, j: ses.j, usuario: n.join(', ') }); v = ''; await cargar();
    };
  }

  timers.push(setInterval(tic, 1000), setInterval(cargar, 3000));
  cargar();
}
