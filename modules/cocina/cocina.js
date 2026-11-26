import { db } from '../firebase-init/firebase-init.js';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  addDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hora = s => {
  if (!s) return '--:--';
  const str = String(s);
  const idx = str.indexOf('T') >= 0 ? str.indexOf('T') + 1 : 11;
  return str.slice(idx, idx + 5) || '--:--';
};
const ahoraMs = () => Date.now();
const fmtLocal = (d = new Date()) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

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

let timers = [], unsubs = [], ctx;
function beep() {
  try {
    ctx ??= new AudioContext(); ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2;
    o.start(); o.stop(ctx.currentTime + 0.25);
  } catch { /* sin audio */ }
}

function limpiar() {
  timers.forEach(clearInterval); timers = [];
  unsubs.forEach(fn => { try { fn(); } catch {} }); unsubs = [];
}

export function mount(root) {
  limpiar();
  const ses = JSON.parse(sessionStorage.getItem('cocina') || 'null');
  ses ? tablero(root, ses) : login(root);
}

async function buscarJornadaActiva() {
  const q = query(collection(db, 'jornadas'), where('estado', '==', 'ABIERTA'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function leerAlertasConfig() {
  const fallback = { amarillo: 20, rojo: 30 };
  try {
    const snap = await getDocs(collection(db, 'config'));
    const cfg = {};
    snap.docs.forEach(d => {
      const x = d.data();
      cfg[x.clave || d.id] = x.valor;
    });
    return {
      amarillo: Number(cfg.alerta_demora_amarillo_min ?? fallback.amarillo) || fallback.amarillo,
      rojo: Number(cfg.alerta_demora_rojo_min ?? fallback.rojo) || fallback.rojo
    };
  } catch {
    return fallback;
  }
}

function login(root) {
  limpiar();
  root.innerHTML = `<style>${CSS}</style><div class="k"><div class="kl"><h1>¿Quiénes cocinan hoy?</h1>
    <div id="nom"></div><button class="sec" id="mas">Agregar otra persona</button><p class="err"></p><button id="ok">Entrar a cocina</button></div></div>`;
  const nom = root.querySelector('#nom'), err = root.querySelector('.err');
  const add = () => nom.insertAdjacentHTML('beforeend', '<input placeholder="Nombre y apellido">');
  add(); root.querySelector('#mas').onclick = add;
  root.querySelector('#ok').onclick = async () => {
    const nombres = [...nom.querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
    if (!nombres.length) { err.textContent = 'Escribí al menos un nombre y apellido.'; return; }
    beep(); // el clic habilita el sonido del navegador
    err.textContent = '';
    try {
      const jornada = await buscarJornadaActiva();
      if (!jornada) {
        err.textContent = 'El cajero todavía no inició las ventas.';
        return;
      }
      const alertas = await leerAlertasConfig();
      const ahora = fmtLocal();

      await Promise.all(nombres.map((nombre, idx) => addDoc(collection(db, 'sesiones'), {
        id_sesion: `S-${Date.now()}-${idx}`,
        id_jornada: jornada.id,
        nombre,
        rol: 'COCINA',
        hora_ingreso: ahora,
        hora_egreso: ''
      })));

      const s = {
        nombres,
        j: jornada.id,
        amarillo: jornada.amarillo ?? alertas.amarillo,
        rojo: jornada.rojo ?? alertas.rojo
      };
      sessionStorage.setItem('cocina', JSON.stringify(s));
      tablero(root, s);
    } catch {
      err.textContent = 'No se pudo conectar. Probá de nuevo.';
    }
  };
}

function tablero(root, ses) {
  limpiar();
  const n = ses.nombres, saludo = n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n.at(-1) : n[0];
  root.innerHTML = `<style>${CSS}</style><div class="k"><div class="kh">Hola ${esc(saludo)}, excelente jornada para hoy!</div>
    <div class="kb"><section><h2>Entrantes (<span id="n1">0</span>)</h2><div id="p1"></div></section>
    <section><h2>En preparación (<span id="n2">0</span>)</h2><div id="p2"></div></section>
    <section><h2>Finalizados (<span id="n3">0</span>)</h2><div id="p3"></div></section></div><div class="kt" id="kt"></div></div>`;

  const ESTADOS = ['RECIBIDA', 'EN_PREPARACION', 'LISTA'];
  let vistos = null, data = { tandas: [], amarillo: ses.amarillo ?? 20, rojo: ses.rojo ?? 30 };

  const normalizarTanda = raw => {
    const envio = raw.hora_envio || raw.envio || raw.fecha || '';
    const inicio = raw.inicio || raw.hora_inicio_prep || '';
    const fin = raw.fin || raw.hora_fin_prep || '';
    const estado = ESTADOS.includes(raw.estado) ? raw.estado : (ESTADOS.includes(raw.estado_cocina) ? raw.estado_cocina : 'RECIBIDA');
    return {
      ...raw,
      estado,
      nro: raw.nro ?? raw.nro_tanda ?? 1,
      envio,
      inicio,
      fin
    };
  };

  const tarjeta = t => {
    const titulo = t.tipo === 'SALON' ? `Mesa ${esc(t.mesa)}, tanda ${esc(t.nro)}` : esc(t.cliente || 'Pedido');
    const items = (t.items || []).map(i => `<li>${esc(i.c)} x ${esc(i.n)}${i.o ? `<em>${esc(i.o)}</em>` : ''}</li>`).join('');
    const info = t.estado === 'RECIBIDA' ? `<p>Esperando <span class="tm" data-d="${esc(t.envio)}"></span></p>`
      : t.estado === 'EN_PREPARACION' ? `<p>Inició ${hora(t.inicio)} - preparando <span class="tm" data-d="${esc(t.inicio)}"></span></p>`
      : `<p>Inició ${hora(t.inicio)} - terminó ${hora(t.fin)}</p>`;
    const btn = t.estado === 'RECIBIDA' ? `<button data-id="${esc(t.id)}" data-a="EN_PREPARACION" data-u="RECIBIDA">Preparar pedido</button>`
      : t.estado === 'EN_PREPARACION' ? `<button data-id="${esc(t.id)}" data-a="LISTA" data-u="EN_PREPARACION">Pedido finalizado</button>` : '';
    return `<article class="c" data-e="${esc(t.estado)}"><h3>${titulo}</h3><small>Pedido ${esc(t.cuenta || t.id.slice(0, 6))}, ${esc(String(t.tipo || '').toLowerCase())}</small><ul>${items}</ul>${info}${btn}</article>`;
  };

  function pintar() {
    if (!root.querySelector('.kb')) return;
    ESTADOS.forEach((e, i) => {
      const L = data.tandas
        .filter(t => t.estado === e)
        .sort((a, b) => String(a.envio || '').localeCompare(String(b.envio || '')));
      root.querySelector('#p' + (i + 1)).innerHTML = L.map(tarjeta).join('');
      root.querySelector('#n' + (i + 1)).textContent = L.length;
    });
    root.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => cambiar(b.dataset.id, b.dataset.a, b.dataset.u));
    tic();
  }

  function tic() {
    root.querySelectorAll('.tm').forEach(e => {
      const raw = String(e.dataset.d || '').trim();
      const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + (raw.includes('+') || raw.includes('-') ? '' : '-03:00');
      const parsed = new Date(iso).getTime();
      const seg = Number.isNaN(parsed) ? 0 : Math.max(0, (ahoraMs() - parsed) / 1000 | 0);
      const min = seg / 60;
      e.textContent = `${min | 0}:${String(seg % 60).padStart(2, '0')}`;
      const c = e.closest('.c');
      if (c) {
        c.classList.toggle('am', !!data.amarillo && min >= data.amarillo && !(data.rojo && min >= data.rojo));
        c.classList.toggle('rj', !!data.rojo && min >= data.rojo);
      }
    });
  }

  async function cambiar(id, a, volver) {
    const actual = data.tandas.find(x => x.id === id);
    const ahora = fmtLocal();
    const cocinerosTxt = n.join(', ');
    const patch = { estado: a, estado_cocina: a, cocinero: cocinerosTxt, actualizadoEn: ahora };
    if (a === 'EN_PREPARACION') {
      if (!actual?.inicio) patch.inicio = ahora;
      patch.hora_inicio_prep = patch.inicio;
      patch.fin = '';
      patch.hora_fin_prep = '';
    }
    if (a === 'LISTA') {
      patch.fin = ahora;
      patch.hora_fin_prep = ahora;
    }
    await updateDoc(doc(db, 'tandas', id), patch);

    await addDoc(collection(db, 'eventos'), {
      fecha_hora: ahora,
      id_jornada: ses.j,
      entidad: 'TANDA',
      id_entidad: id,
      de_estado: volver,
      a_estado: a,
      usuario: cocinerosTxt
    });

    const kt = root.querySelector('#kt');
    kt.innerHTML = '<button class="sec" id="und">Deshacer</button>';
    const quitar = setTimeout(() => { if (kt) kt.innerHTML = ''; }, 6000);
    kt.querySelector('#und').onclick = async () => {
      clearTimeout(quitar); kt.innerHTML = '';
      const ts = fmtLocal();
      const revert = { estado: volver, estado_cocina: volver, cocinero: cocinerosTxt, actualizadoEn: ts };
      if (volver === 'RECIBIDA') {
        revert.inicio = '';
        revert.hora_inicio_prep = '';
      }
      if (volver === 'EN_PREPARACION') {
        revert.fin = '';
        revert.hora_fin_prep = '';
      }
      await updateDoc(doc(db, 'tandas', id), revert);

      await addDoc(collection(db, 'eventos'), {
        fecha_hora: ts,
        id_jornada: ses.j,
        entidad: 'TANDA',
        id_entidad: id,
        de_estado: a,
        a_estado: volver,
        usuario: cocinerosTxt,
        detalle: 'deshacer'
      });
    };
  }

  // Escucha si la jornada sigue ABIERTA
  unsubs.push(onSnapshot(doc(db, 'jornadas', ses.j), snap => {
    if (!snap.exists() || snap.data()?.estado !== 'ABIERTA') {
      sessionStorage.removeItem('cocina');
      login(root);
    }
  }));

  // Escucha umbrales de demora desde config en tiempo real
  unsubs.push(onSnapshot(collection(db, 'config'), snap => {
    const cfg = {};
    snap.docs.forEach(d => {
      const x = d.data();
      cfg[x.clave || d.id] = x.valor;
    });
    const am = Number(cfg.alerta_demora_amarillo_min ?? data.amarillo) || data.amarillo;
    const rj = Number(cfg.alerta_demora_rojo_min ?? data.rojo) || data.rojo;
    data = { ...data, amarillo: am, rojo: rj };
    tic();
  }));

  // Escucha las tandas de la jornada en tiempo real
  const qTandas = query(collection(db, 'tandas'), where('id_jornada', '==', ses.j));
  unsubs.push(onSnapshot(qTandas, snap => {
    if (!root.querySelector('.kb')) return;
    const tandas = snap.docs
      .map(d => normalizarTanda({ id: d.id, ...d.data() }))
      .filter(t => t.estado !== 'CANCELADO' && t.estado_cocina !== 'CANCELADA' && t.a_cocina !== false);
    data = { ...data, tandas };
    if (vistos && tandas.some(t => t.estado === 'RECIBIDA' && !vistos.has(t.id))) beep();
    vistos = new Set(tandas.map(t => t.id));
    pintar();
  }));

  timers.push(setInterval(tic, 1000));
}
