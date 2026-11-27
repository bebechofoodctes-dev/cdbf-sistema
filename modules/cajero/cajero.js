import { db, authReady } from '../firebase-init/firebase-init.js';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const DEN = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];
const _U = s => String(s ?? '').trim().toUpperCase();
const slugId = s => _U(s).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = n => '$' + Number(n || 0).toLocaleString('es-AR');
const fmtLocal = (d = new Date()) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const fechaDia = s => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s || '').trim());
  return m ? m[1] : fmtLocal().slice(0, 10);
};
const diaActual = () => {
  const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  return dias[new Date().getDay()];
};

const CSS = `
.cj{--card:#202833;--txt:#e9eef4;--tenue:#93a1b3;--acento:#4da3e0;--exito:#56c48f;--alerta:#f0b13c;min-height:100vh;color:var(--txt);font:17px/1.35 system-ui,sans-serif}
.cj h1{font-size:1.9rem;margin:0 0 1rem}.cj button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:.9rem 1.2rem;cursor:pointer;background:var(--acento);color:#06121d;width:100%}
.cj input{font:inherit;padding:.7rem;border-radius:10px;border:2px solid #34404f;background:#10151c;color:var(--txt);width:100%}
.cl{max-width:34rem;margin:0 auto;padding:6vh 1.2rem}.cl label{display:block;margin:1rem 0 .4rem;color:var(--tenue)}
.gr{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem}.gr div{display:flex;align-items:center;gap:.5rem}.gr b{min-width:4.5rem;text-align:right}
.tot{display:flex;justify-content:space-between;font-size:1.3rem;font-weight:700;margin:1rem 0}.err{color:#f0b13c;min-height:1.4em}
.ch{display:flex;justify-content:space-between;align-items:center;gap:.8rem;flex-wrap:wrap;padding:.7rem 1.2rem;color:var(--tenue);border-bottom:1px solid #2a3340}
.ch-stats{display:flex;justify-content:center;align-items:center;gap:.6rem;flex:1;flex-wrap:wrap}
.stat-pill{background:#151a22;border:1px solid #34404f;border-radius:8px;padding:.35rem .75rem;font-size:.85rem;color:var(--txt);white-space:nowrap}
.stat-pill b{color:var(--acento);margin-left:.25rem}
.pn{display:grid;grid-template-columns:1.5fr 1fr;grid-template-rows:1fr 1fr;gap:.8rem;padding:.8rem;height:calc(100vh - 7rem)}
.pn section{background:var(--card);border-radius:12px;padding:1rem;overflow:auto}.pn section:first-child{grid-row:1/3}
.pn h2{margin:0 0 .5rem;font-size:1.1rem;color:var(--acento)}.pn p{color:var(--tenue)}
.dash-delivery-horiz{grid-column:1/3;background:var(--card);border-radius:12px;padding:.7rem .9rem;min-height:10.5rem;height:auto;overflow:visible;box-sizing:border-box}
.track-repartidores{display:flex;gap:.8rem;flex-wrap:wrap;overflow:visible;padding-bottom:.2rem}
.card-rep{background:#151a22;border-radius:8px;padding:.55rem .8rem;min-width:190px;border-left:4px solid var(--acento);flex-shrink:0}
@media(max-width:900px){.pn{grid-template-columns:1fr;grid-template-rows:none;height:auto}.pn section:first-child{grid-row:auto}.dash-delivery-horiz{grid-column:auto;height:auto}}`;

const CSS2 = `
.mi{display:grid;grid-template-columns:1fr auto;gap:.1rem .6rem;padding:.5rem .6rem;margin-bottom:.4rem;border-radius:10px;background:#2a3340;border-left:5px solid var(--alerta)}.mi.EN_PREPARACION,.mi.EN_CAMINO{border-color:var(--acento)}.mi.LISTA,.mi.LIBRE{border-color:var(--exito)}.mi small{grid-column:1/3;color:var(--tenue)}.flash{animation:fl 1s 8}@keyframes fl{50%{background:#2f6b4f}}
.tp{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:.8rem}.cj button.sec{background:#2d3846;color:var(--txt)}.cj button.on{background:var(--acento);color:#06121d}
.fl{display:grid;gap:.5rem;margin-bottom:.8rem}.bd{display:inline-block;padding:.1rem .6rem;border-radius:99px;background:#2d3846;font-size:.9rem}
.rs button{display:flex;justify-content:space-between;width:100%;margin:.25rem 0;text-align:left;font-weight:500}
.ln{display:grid;grid-template-columns:1fr auto;gap:.3rem .6rem;padding:.6rem 0;border-bottom:1px solid #2a3340}.ln .q{display:flex;gap:.4rem;align-items:center}.ln .q button{width:2.4rem;padding:.4rem}
.tt{margin:.8rem 0}.tt div{display:flex;justify-content:space-between}.tt .g{font-size:1.4rem;font-weight:800}.ok{color:var(--exito)}
.chk-manual,.chk-bonif{display:flex;align-items:center;gap:.5rem;margin:.5rem 0;font-size:.95rem;color:var(--acento);cursor:pointer}
.chk-manual input,.chk-bonif input{width:auto!important}
.box-manual{display:flex;gap:.5rem;margin-bottom:.8rem}
.drawer-stock{position:fixed;right:-380px;top:0;width:360px;height:100%;background:#151a22;border-left:2px solid #34404f;box-shadow:-4px 0 15px rgba(0,0,0,.5);transition:right .3s ease;z-index:9999;padding:1rem;display:flex;flex-direction:column;box-sizing:border-box}
.drawer-stock.open{right:0}
.drawer-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid #2a3340;padding-bottom:.5rem}
.drawer-header h3{margin:0;font-size:1.2rem}
.drawer-header button{width:auto;padding:.3rem .7rem;background:#2d3846;color:#fff}
.stock-list{flex-grow:1;overflow-y:auto;margin-top:1rem}
.stock-item{display:flex;justify-content:space-between;align-items:center;padding:.6rem;border-bottom:1px solid #2a3340}
.stock-low{color:var(--alerta);font-weight:bold}
.stock-ok{color:var(--exito);font-weight:bold}
.lbl-stock-cat{font-size:.8rem;padding:.15rem .4rem;border-radius:4px;display:inline-block;margin-left:.3rem}
.hist-fecha{font-size:.85rem;font-weight:700;color:var(--acento);margin:.8rem 0 .4rem;border-bottom:1px solid #2a3340;padding-bottom:.25rem}
.hist-card{background:#1c232e;border:1px solid #34404f;border-left:4px solid var(--exito);border-radius:10px;padding:.65rem .75rem;margin-bottom:.55rem}
.hist-card.cancelada{border-left-color:var(--alerta);background:#261e1a}
.hist-top{display:flex;justify-content:space-between;align-items:center;gap:.5rem}
.hist-items{font-size:.88rem;color:var(--tenue);margin:.3rem 0}
.hist-motivo{font-size:.84rem;color:var(--alerta);margin-top:.3rem}`;

function imprimirTicketDirecto(pedidoData) {
  if (!pedidoData) return;
  const escH = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pForm = n => '$' + Number(n || 0).toLocaleString('es-AR');

  const cliente = escH(pedidoData.cliente || 'Cliente General');
  const nivel = escH(pedidoData.nivel_cliente || 'Cliente');
  const direccion = escH(pedidoData.direccion || (pedidoData.tipo === 'SALON' ? 'Mesa ' + (pedidoData.mesa || '') : 'Retiro en local'));
  const items = pedidoData.items || [];
  const subtotal = Number(pedidoData.subtotal || 0);
  const envio = Number(pedidoData.envio || 0);
  const totalDescuento = Number(pedidoData.total_descuento ?? pedidoData.descuento ?? 0);
  const notaDescuento = escH(pedidoData.nota_descuento || '');
  const totalPagar = Number(pedidoData.total ?? Math.max(0, subtotal - totalDescuento + envio));
  const ahorro = Number(pedidoData.ahorro ?? totalDescuento);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ticket - ${cliente}</title>
<style>
  @page { size: 80mm auto; margin: 2mm; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; margin: 0; padding: 4mm; background: #fff; }
  .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
  .title { font-size: 15px; font-weight: bold; margin: 2px 0; }
  .info { font-size: 9.5px; margin-bottom: 4px; line-height: 1.2; }
  .sucursal { font-weight: bold; margin-top: 3px; }
  .cerrado { font-weight: bold; font-size: 10px; margin: 3px 0; }
  .redes { font-size: 9.5px; margin-top: 3px; }
  .datos-cliente { border-bottom: 1px solid #000; padding: 4px 0; margin-bottom: 6px; font-size: 10.5px; }
  .datos-cliente div { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10.5px; }
  th, td { border: 1px solid #000; padding: 3px 2px; }
  th { background: #eee; font-weight: bold; text-align: center; }
  .num { text-align: right; }
  .cen { text-align: center; }
  .totales { border-top: 1px solid #000; padding-top: 4px; font-size: 10.5px; }
  .totales-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .total-final { font-size: 13px; font-weight: bold; border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; }
  .ahorro-footer { font-size: 13px; font-weight: bold; font-style: italic; text-align: center; margin-top: 10px; padding: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">BEBECHOFOODCTES</div>
    <div class="info">
      <div class="sucursal">ESTRELLA GUTIERREZ 3320</div>
      Martes a Miércoles 20 a 00 y Jueves 21 a 01
      <div class="sucursal">CAVADRINKS MAIPU 2775</div>
      Viernes y Sábados 21 a 01, Domingos 20 a 00
      <div class="cerrado">*** LUNES CERRADO ***</div>
    </div>
    <div class="redes">
      WAPP: 3794000944<br>
      IG: @bebechofoodctes y @cava.drinks
    </div>
  </div>

  <div class="datos-cliente">
    <div><b>SEÑOR(ES):</b> ${cliente}</div>
    <div><b>NIVEL DE CLIENTE:</b> ${nivel}</div>
    <div><b>DIRECCIÓN:</b> ${direccion}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:12%">Cant</th>
        <th style="width:48%">Descripción</th>
        <th style="width:20%">Importe</th>
        <th style="width:20%">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(i => `
        <tr>
          <td class="cen">${i.c || i.cant || 1}</td>
          <td>${escH(i.n || i.nombre || i.desc || i)}${i.op ? ' (' + escH(i.op) + ')' : ''}</td>
          <td class="num">${pForm(i.p || i.precio || 0)}</td>
          <td class="num">${pForm((i.p || i.precio || 0) * (i.c || i.cant || 1))}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totales">
    <div class="totales-row"><span>Subtotal:</span> <span>${pForm(subtotal)}</span></div>
    <div class="totales-row"><span>Envío${pedidoData.envio_bonificado ? ' (bonificado)' : ''}:</span> <span>${pForm(envio)}</span></div>
    <div class="totales-row"><span>Total descuento:</span> <span>${pForm(totalDescuento)}</span></div>
    ${notaDescuento ? `<div class="totales-row"><span><i>${notaDescuento}</i></span> <span></span></div>` : ''}
    <div class="totales-row total-final"><span>Total a pagar:</span> <span>${pForm(totalPagar)}</span></div>
  </div>

  <div class="ahorro-footer">
    *** Ahorraste en tu compra ${pForm(ahorro)}!! ***
  </div>

  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=400,height=600');
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    alert('Por favor autorizá los pop-ups para imprimir el ticket.');
  }
}

let ctx, timers = [], unsubs = [];
function beep() {
  try { ctx ??= new AudioContext(); ctx.resume(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .2; o.start(); o.stop(ctx.currentTime + .25); } catch {}
}
const hace = x => {
  if (!x) return '0 min';
  const t = new Date(String(x).replace(' ', 'T')).getTime();
  return (isNaN(t) ? 0 : Math.max(0, (Date.now() - t) / 60000 | 0)) + ' min';
};

function limpiar() {
  timers.forEach(clearInterval); timers = [];
  unsubs.forEach(fn => { try { fn(); } catch {} }); unsubs = [];
}

function pagoUI(box) {
  box.innerHTML = '<h2>Método de pago</h2><div class="tp"><button type="button" data-p="EFECTIVO">Efectivo</button><button type="button" data-p="TRANSFERENCIA">Transferencia</button><button type="button" data-p="MIXTO">Mixto</button></div><div id="px"></div>';
  let m = '';
  const set = k => {
    m = k; box.querySelectorAll('[data-p]').forEach(b => b.className = b.dataset.p === k ? 'on' : 'sec');
    box.querySelector('#px').innerHTML = k === 'EFECTIVO' ? '<input id="pc" type="number" inputmode="numeric" placeholder="Paga con $ (opcional, para el vuelto)">'
      : k === 'MIXTO' ? '<input id="ef" type="number" inputmode="numeric" placeholder="Efectivo que entrega (el resto es transferencia)"><input id="pc" type="number" inputmode="numeric" placeholder="Paga con $ (opcional)">' : '';
  };
  box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => set(b.dataset.p));
  return () => ({ metodo: m, efectivo: +box.querySelector('#ef')?.value || 0, pagaCon: +box.querySelector('#pc')?.value || 0 });
}

export async function mount(root) {
  limpiar();
  await authReady;
  const ses = JSON.parse(sessionStorage.getItem('cajero') || 'null');
  ses ? panel(root, ses) : login(root);
}

async function obtenerJornadaAbierta() {
  await authReady;
  const snap = await getDocs(query(collection(db, 'jornadas'), where('estado', '==', 'ABIERTA')));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function login(root) {
  limpiar();
  await authReady;
  let est = { jornada: null, error: '' };
  try {
    est.jornada = await obtenerJornadaAbierta();
  } catch (e) {
    est.error = e.message || 'error_conexion';
  }
  const abierta = !!est.jornada;
  root.innerHTML = `<style>${CSS}</style><div class="cj"><div class="cl"><h1>${abierta ? 'Entrar a caja' : 'Apertura de caja'}</h1>
<label>Nombre y apellido</label><input id="nom" placeholder="Nombre y apellido">
${abierta ? '' : `<label>Efectivo inicial: cantidad de billetes</label><div class="gr">${DEN.map(d =>
`<div><b>${pesos(d)}</b><input type="number" min="0" inputmode="numeric" data-d="${d}" placeholder="0"></div>`).join('')}</div>
<div class="tot"><span>Total de apertura</span><span id="tot">${pesos(0)}</span></div>`}
<p class="err">${est.error ? 'No se pudo conectar. Probá de nuevo.' : ''}</p>
<button id="ok">${abierta ? 'Entrar' : 'Iniciar ventas'}</button></div></div>`;
  const err = root.querySelector('.err'), grilla = () => [...root.querySelectorAll('[data-d]')];
  grilla().forEach(i => i.oninput = () => root.querySelector('#tot').textContent = pesos(grilla().reduce((s, x) => s + x.dataset.d * (+x.value || 0), 0)));
  root.querySelector('#ok').onclick = async () => {
    const nombre = root.querySelector('#nom').value.trim();
    if (!nombre) { err.textContent = 'Escribí tu nombre y apellido.'; return; }
    beep();
    try {
      const actual = await obtenerJornadaAbierta();
      const ahora = fmtLocal();
      if (actual) {
        await addDoc(collection(db, 'sesiones'), {
          rol: 'CAJERO',
          nombre,
          id_jornada: actual.id,
          hora_ingreso: ahora,
          hora_egreso: ''
        });
        const s = { nombre, j: actual.id };
        sessionStorage.setItem('cajero', JSON.stringify(s));
        panel(root, s);
        return;
      }
      const billetes = {};
      grilla().forEach(i => billetes[i.dataset.d] = +i.value || 0);
      const apertura = DEN.reduce((t, d) => t + d * (billetes[d] || 0), 0);
      const ref = await addDoc(collection(db, 'jornadas'), {
        estado: 'ABIERTA',
        fecha: ahora.slice(0, 10),
        abierta_por: nombre,
        cajero: nombre,
        hora_apertura: ahora,
        efectivo_apertura: apertura,
        apertura,
        billetes_apertura: billetes
      });
      await addDoc(collection(db, 'arqueos'), {
        id_jornada: ref.id,
        tipo: 'APERTURA',
        realizado_por: nombre,
        hora: ahora,
        efectivo_contado: apertura,
        billetes,
        confirmado: 'SI'
      });
      await addDoc(collection(db, 'sesiones'), {
        rol: 'CAJERO',
        nombre,
        id_jornada: ref.id,
        hora_ingreso: ahora,
        hora_egreso: ''
      });
      const s = { nombre, j: ref.id };
      sessionStorage.setItem('cajero', JSON.stringify(s));
      panel(root, s);
    } catch (e) {
      err.textContent = 'No se pudo abrir la caja: ' + (e.message || 'error');
    }
  };
}

function resolverNivelPorPuntos(puntos, reglas) {
  const ordenadas = [...reglas].sort((a, b) => (b.xp_min || 0) - (a.xp_min || 0));
  for (const r of ordenadas) {
    if (puntos >= (r.xp_min || 0) && (r.xp_max === null || r.xp_max === undefined || puntos <= r.xp_max)) {
      return r;
    }
  }
  return reglas[0] || { nivel: '8 BITS', beneficio: 'segui participando' };
}

async function acreditarPuntosCliente({ nombre, telefono, direccion, tipo, items, config, reglas }) {
  const nomNorm = _U(nombre);
  if (!nomNorm || tipo === 'SALON') return null;

  const cantProductosPuntos = items
    .filter(i => i.suma_puntos !== false)
    .reduce((acc, i) => acc + Number(i.c || 1), 0);

  let puntosBase = cantProductosPuntos * 10 + (tipo === 'DELIVERY' ? 30 : 0);
  if (puntosBase <= 0 && !telefono && !direccion) return null;

  const cliId = slugId(nomNorm);
  const cliRef = doc(db, 'clientes', cliId);
  const diasDobles = String(config.puntos_dobles_dias || 'MIERCOLES, JUEVES')
    .split(',')
    .map(_U)
    .filter(Boolean);
  const topeXP = Number(config.puntos_dobles_tope_xp ?? 800) || 800;
  const esDiaDoble = diasDobles.includes(diaActual());

  return await runTransaction(db, async tx => {
    const snap = await tx.get(cliRef);
    const prev = snap.exists() ? snap.data() : {
      nombre: nomNorm,
      puntos: 0,
      nivel: '8 BITS',
      beneficio: 'segui participando',
      telefono: '',
      direccion: ''
    };
    const ptsActuales = Number(prev.puntos ?? prev.pts ?? 0);
    const multiplicador = (esDiaDoble && ptsActuales < topeXP) ? 2 : 1;
    const puntosGanados = puntosBase * multiplicador;
    const nuevosPuntos = ptsActuales + puntosGanados;
    const reglaNivel = resolverNivelPorPuntos(nuevosPuntos, reglas);

    const payload = {
      nombre: nomNorm,
      puntos: nuevosPuntos,
      nivel: reglaNivel.nivel || prev.nivel || '8 BITS',
      beneficio: reglaNivel.beneficio || prev.beneficio || '',
      telefono: telefono || prev.telefono || '',
      direccion: direccion || prev.direccion || '',
      actualizadoEn: new Date().toISOString()
    };
    tx.set(cliRef, payload, { merge: true });
    return { puntosGanados, nuevosPuntos, nivel: payload.nivel, multiplicador };
  });
}

async function moverStockSocio(productoKey, delta, tipoMov, idCuenta, usuario) {
  const key = _U(productoKey);
  if (!key) return;
  const stRef = doc(db, 'stock_socio', slugId(key));
  await runTransaction(db, async tx => {
    const snap = await tx.get(stRef);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.stock === '' || data.stock === null || data.stock === undefined) return;
    const ant = Number(data.stock) || 0;
    const nuevo = Math.max(0, ant + delta);
    tx.update(stRef, {
      stock: nuevo,
      actualizado_por: usuario || 'Cajero',
      fecha_hora: fmtLocal()
    });
    const movRef = doc(collection(db, 'stock_movimientos'));
    tx.set(movRef, {
      fecha_hora: fmtLocal(),
      producto: data.producto || productoKey,
      tipo: tipoMov,
      cantidad: nuevo - ant,
      stock_resultante: nuevo,
      id_cuenta: idCuenta || '',
      usuario: usuario || 'Cajero'
    });
  });
}

async function cargarDatosCajero() {
  await authReady;
  const [cliSnap, prodSnap, socioSnap, stockSnap, regSnap, tarSnap, cfgSnap] = await Promise.all([
    getDocs(collection(db, 'clientes')),
    getDocs(collection(db, 'productos')),
    getDocs(collection(db, 'catalogo_socio')),
    getDocs(collection(db, 'stock_socio')),
    getDocs(collection(db, 'reglas_nivel')),
    getDocs(collection(db, 'tarifas_envio')),
    getDocs(collection(db, 'config'))
  ]);

  const config = {};
  cfgSnap.docs.forEach(d => {
    const x = d.data();
    config[x.clave || d.id] = x.valor;
  });

  const socioMap = {};
  socioSnap.docs.forEach(d => {
    const x = d.data();
    const nom = _U(x.nombre_producto || d.id);
    if (!nom) return;
    socioMap[nom] = {
      tipo: _U(x.tipo || 'BEBIDA'),
      a_cocina: x.a_cocina === true || _U(x.a_cocina) === 'SI',
      detalle_cocina: String(x.detalle_cocina || '').trim(),
      parte_nuestra: Number(x.parte_nuestra || 0),
      parte_socio: Number(x.parte_socio || 0),
      suma_puntos: x.suma_puntos === true || _U(x.suma_puntos) === 'SI',
      descuenta_de: Array.isArray(x.descuenta_de)
        ? x.descuenta_de
        : String(x.descuenta_de || '').split('/').map(v => v.trim()).filter(Boolean),
      unidades: Number(x.unidades || 1) || 1
    };
  });

  const stock = {};
  stockSnap.docs.forEach(d => {
    const x = d.data();
    const nom = _U(x.producto || d.id);
    if (!nom || x.stock === '' || x.stock === null || x.stock === undefined) return;
    stock[nom] = {
      producto: x.producto || d.id,
      stock: Number(x.stock) || 0,
      minimo: x.minimo === '' || x.minimo === null || x.minimo === undefined ? 0 : Number(x.minimo) || 0
    };
  });

  const clientes = cliSnap.docs.map(d => {
    const x = d.data();
    return {
      id: d.id,
      n: String(x.nombre || x.n || '').trim(),
      nivel: _U(x.nivel || '8 BITS'),
      pts: Number(x.puntos ?? x.pts ?? 0),
      tel: String(x.telefono || x.tel || '').trim(),
      dir: String(x.direccion || x.dir || '').trim()
    };
  });

  const catalogo = [];
  prodSnap.docs.forEach(d => {
    const x = d.data();
    const nombre = String(x.nombre || x.n || d.id).trim();
    const cat = _U(x.categoria || x.cat || 'GENERAL');
    const soc = socioMap[_U(nombre)];
    const esPromo = x.promo === true || _U(x.promo) === 'SI' || /^PROMO\b|^FLASH/i.test(nombre);
    const disp = x.disponible !== false && _U(x.disponible) !== 'NO' && x.disp !== false;

    catalogo.push({
      id: d.id,
      n: nombre,
      p: Number(x.precio ?? x.p ?? 0),
      cat,
      disp,
      promo: esPromo,
      t: soc ? soc.tipo : _U(x.tipo || x.t || 'COMIDA'),
      a_cocina: soc ? soc.a_cocina : true,
      detalle_cocina: soc ? soc.detalle_cocina : '',
      parte_nuestra: soc ? soc.parte_nuestra : Number(x.precio ?? x.p ?? 0),
      parte_socio: soc ? soc.parte_socio : 0,
      suma_puntos: soc ? soc.suma_puntos : true,
      ops: soc ? soc.descuenta_de : (Array.isArray(x.ops) ? x.ops : []),
      unidades: soc ? soc.unidades : 1
    });
  });

  const reglas = regSnap.docs.map(d => {
    const x = d.data();
    const rawPct = Number(x.descuento_pct ?? x.pct ?? 0);
    return {
      nivel: _U(x.nivel || d.id),
      xp_min: Number(x.xp_min ?? 0),
      xp_max: x.xp_max === null || x.xp_max === undefined || x.xp_max === '' ? null : Number(x.xp_max),
      pct: rawPct > 1 ? rawPct / 100 : rawPct,
      dias: _U(x.dias_descuento || x.dias || '').replace(/\s/g, ''),
      gratis: _U(x.envio_gratis || x.gratis || 'NO')
    };
  });

  const tarifas_envio = tarSnap.docs
    .map(d => {
      const x = d.data();
      return { km: Number(x.km_hasta ?? x.km ?? 0), precio: Number(x.precio ?? 0) };
    })
    .filter(t => t.km > 0)
    .sort((a, b) => a.km - b.km);

  const catsDesc = String(config.categorias_con_descuento || 'BURGERS, PIZZAS')
    .split(',')
    .map(_U)
    .filter(Boolean);

  return {
    clientes,
    catalogo,
    socioMap,
    stock,
    cats: catsDesc,
    reglas,
    tarifas_envio,
    config,
    bloqStock: _U(config.stock_bloquear || 'SI') !== 'NO',
    dia: diaActual()
  };
}

async function panel(root, ses) {
  limpiar();
  await authReady;
  root.innerHTML = `<style>${CSS}${CSS2}</style><div class="cj">
<div class="ch">
<span>Hola ${esc(ses.nombre)}, excelente jornada para hoy!</span>
<div class="ch-stats">
<div class="stat-pill">Venta de comidas:<b id="stComidas">${pesos(0)}</b></div>
<div class="stat-pill">Venta socio:<b id="stBebidas">${pesos(0)}</b></div>
<div class="stat-pill">Monto a pagar repartidores:<b id="stRepartidores">${pesos(0)}</b></div>
</div>
<div style="display:flex;gap:.5rem">
<button class="sec" id="btnHistorialDrawer" style="width:auto;padding:.5rem 1rem">📜 Historial</button>
<button class="sec" id="btnStockDrawer" style="width:auto;padding:.5rem 1rem">📦 Stock</button>
<button class="sec" id="cerrar" style="width:auto;padding:.5rem 1rem">Cerrar ventas</button>
</div>
</div>
<div class="pn">
<section id="carga"><h2>Carga de pedidos</h2><p>Leyendo catálogo y clientes…</p></section>
<section><h2>Manejo de Mesas y Tandas</h2><div id="mm"></div></section>
<section><h2>Cocina</h2><div id="mc"></div></section>
<div class="dash-delivery-horiz">
<h2>Repartidores y Rendiciones</h2>
<div id="mx"></div>
<div id="mr" class="track-repartidores"></div>
</div>
</div>
</div>
<div id="drawerHistorial" class="drawer-stock">
<div class="drawer-header">
<h3>Historial de ventas</h3>
<button id="btnCloseHistorial" type="button">✖</button>
</div>
<div id="historialVentasContainer" class="stock-list" style="margin-top:.2rem"><p class="tenue">Cargando historial...</p></div>
</div>
<div id="drawerStock" class="drawer-stock">
<div class="drawer-header">
<h3>Stock del Socio en Vivo</h3>
<button id="btnCloseStock">✖</button>
</div>
<input id="searchStock" placeholder="Buscar producto en stock..." autocomplete="off">
<div id="stockContainer" class="stock-list"><p>Cargando stock...</p></div>
</div>`;

  const el = root.querySelector('#carga'), mon = { mesas: [] }, $ = q => root.querySelector(q);
  let ctl = { mesas() {}, cobrarMesa() {} };
  let D = { clientes: [], catalogo: [], socioMap: {}, stock: {}, cats: ['BURGERS', 'PIZZAS'], reglas: [], tarifas_envio: [], config: {}, bloqStock: true, dia: diaActual() };

  try {
    D = await cargarDatosCajero();
    ctl = carga(el, D, ses, mon);
  } catch (e) {
    el.innerHTML = `<h2>Carga de pedidos</h2><p class="err">No se pudo leer Firestore (${esc(e.message || 'error')}).</p>`;
  }

  let todasTandasJornada = [];
  const TIPOS_ETQ = { SALON: 'Salón', RETIRO: 'Retiro', DELIVERY: 'Delivery' };

  const renderHistorialVentas = () => {
    const cont = $('#historialVentasContainer');
    if (!cont) return;
    if (!todasTandasJornada.length) {
      cont.innerHTML = '<p class="tenue">Sin ventas registradas en esta jornada.</p>';
      return;
    }

    const ordenadas = [...todasTandasJornada].sort((a, b) =>
      String(b.hora_envio || b.fecha || '').localeCompare(String(a.hora_envio || a.fecha || ''))
    );

    const grupos = new Map();
    ordenadas.forEach(t => {
      const dia = fechaDia(t.hora_envio || t.fecha);
      if (!grupos.has(dia)) grupos.set(dia, []);
      grupos.get(dia).push(t);
    });

    cont.innerHTML = [...grupos.entries()].map(([dia, lista]) => `
<div class="hist-fecha">${esc(dia)}</div>
${lista.map(t => {
  const cancelada = _U(t.estado) === 'CANCELADO' || _U(t.estado_cocina) === 'CANCELADA';
  const prodTxt = (t.items || []).map(i => `${i.c || i.cant || 1}x ${i.n || i.nombre}${i.op ? ' (' + i.op + ')' : ''}`).join(', ') || 'Sin detalle';
  const tipoTxt = TIPOS_ETQ[_U(t.tipo)] || (t.tipo || 'Pedido');
  const motivo = t.motivo_cancelacion || t.motivo || 'Sin motivo especificado';
  return `
<div class="hist-card ${cancelada ? 'cancelada' : ''}">
  <div class="hist-top">
    <b>${esc(t.cliente || 'Cliente')}</b>
    <b>${cancelada ? 'CANCELADO' : pesos(t.total)}</b>
  </div>
  <div class="hist-items">${esc(prodTxt)}</div>
  <div class="hist-top" style="font-size:.85rem">
    <span class="tenue">Entrega: <b>${esc(tipoTxt)}</b></span>
    ${!cancelada ? `<span class="tenue">${esc(t.metodoPago || '')}</span>` : ''}
  </div>
  ${cancelada ? `<div class="hist-motivo">Motivo: ${esc(motivo)}</div>` : ''}
</div>`;
}).join('')}
`).join('');
  };

  const drawerHist = $('#drawerHistorial');
  if ($('#btnHistorialDrawer')) $('#btnHistorialDrawer').onclick = () => { drawerHist?.classList.add('open'); renderHistorialVentas(); };
  if ($('#btnCloseHistorial')) $('#btnCloseHistorial').onclick = () => drawerHist?.classList.remove('open');

  const drawer = $('#drawerStock');
  let stockData = D.stock || {};
  const renderStock = (filtro = '') => {
    const container = $('#stockContainer');
    if (!container) return;
    const keys = Object.keys(stockData).filter(k => k.toLowerCase().includes(filtro.toLowerCase())).sort();
    if (!keys.length) {
      container.innerHTML = '<p style="color:var(--tenue)">Sin productos registrados en stock_socio.</p>';
      return;
    }
    container.innerHTML = keys.map(k => {
      const item = stockData[k];
      const cant = item.stock;
      const min = item.minimo || 0;
      const esBajo = cant <= min;
      return `<div class="stock-item">
<div><strong>${esc(item.producto || k)}</strong>${min ? `<br><small style="color:var(--tenue)">Mínimo: ${min}</small>` : ''}</div>
<span class="${esBajo ? 'stock-low' : 'stock-ok'}">${cant} un.</span>
</div>`;
    }).join('');
  };

  if ($('#btnStockDrawer')) $('#btnStockDrawer').onclick = () => { drawer.classList.add('open'); renderStock($('#searchStock')?.value || ''); };
  if ($('#btnCloseStock')) $('#btnCloseStock').onclick = () => drawer.classList.remove('open');
  if ($('#searchStock')) $('#searchStock').oninput = (e) => renderStock(e.target.value);

  const ETQ = { RECIBIDA: 'En espera', EN_PREPARACION: 'Preparando', LISTA: 'Listo', EN_CAMINO: 'En camino' };
  let R = { cocina: [], repartos: [], rendir: [] }, listos = null, entregados = null;
  const flash = new Set();

  const pintarResumen = (src = {}) => {
    if ($('#stComidas')) $('#stComidas').textContent = pesos(src.venta_comidas ?? 0);
    if ($('#stBebidas')) $('#stBebidas').textContent = pesos(src.venta_bebidas ?? 0);
    if ($('#stRepartidores')) $('#stRepartidores').textContent = pesos(src.monto_repartidores ?? 0);
  };

  const pintar = () => {
    if (!$('#mc')) return;
    $('#mc').innerHTML = R.cocina.map(t => `
<div class="mi ${t.estado} ${flash.has(t.id) ? 'flash' : ''}">
<b>${esc(t.tit || t.cliente || 'Pedido')}</b><span>${ETQ[t.estado] || esc(t.estado)}</span>
<small>${esc(t.tipo || 'SALON')}, hace ${hace(t.hora_envio || t.fecha)} ${t.resumen ? '<br>' + esc(t.resumen) : ''}</small>
${t.estado === 'RECIBIDA' ? `<button class="sec" data-x="${esc(t.id)}" style="grid-column:1/3;padding:.4rem;margin-top:.4rem">Cancelar tanda</button>` : ''}
</div>`).join('') || '<p style="color:var(--tenue)">Sin pedidos en cocina.</p>';

    $('#mc').querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
      const tanda = R.cocina.find(x => x.id === b.dataset.x);
      if (!tanda) return;
      if (tanda.estado !== 'RECIBIDA') {
        alert('Cocina ya empezó a preparar este pedido. No se puede cancelar desde acá.');
        return;
      }
      if (!confirm('¿Seguro que querés cancelar esta tanda?')) return;
      const m = prompt('Motivo de la cancelación:');
      if (!m || !m.trim()) return;

      await updateDoc(doc(db, 'tandas', tanda.id), {
        estado: 'CANCELADO',
        estado_cocina: 'CANCELADA',
        motivo_cancelacion: m.trim(),
        canceladoPor: ses.nombre,
        canceladoEn: fmtLocal()
      });

      for (const i of (tanda.itemsRaw || [])) {
        const soc = D.socioMap[_U(i.n)];
        if (!soc) continue;
        const stockKey = i.op || (soc.tipo === 'BEBIDA' ? i.n : '');
        if (stockKey) {
          const cantDevolver = (Number(i.c) || 1) * (soc.descuenta_de.length ? soc.unidades : 1);
          await moverStockSocio(stockKey, cantDevolver, 'DEVOLUCION', tanda.cuenta || tanda.id, ses.nombre);
        }
      }

      await addDoc(collection(db, 'eventos'), {
        fecha_hora: fmtLocal(),
        id_jornada: ses.j,
        entidad: 'TANDA',
        id_entidad: tanda.id,
        de_estado: 'RECIBIDA',
        a_estado: 'CANCELADA',
        usuario: ses.nombre,
        detalle: m.trim()
      });
    });

    if ($('#mr')) {
      $('#mr').innerHTML = R.repartos.map(x => {
        const cobrarRep = x.total_a_pagar ?? x.monto_a_cobrar ?? x.total ?? 0;
        const enRuta = x.estado === 'EN_CAMINO' || !!x.pedido_en_camino;
        return `
<div class="card-rep ${enRuta ? 'EN_CAMINO' : 'LIBRE'}">
<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
<b>${esc(x.repartidor || x.n || x.nombre)}</b>
<b style="color:var(--exito);font-size:.9rem">${pesos(cobrarRep)}</b>
</div>
<span>${enRuta ? 'En camino: ' + esc(x.pedido_en_camino || x.pedido || '') : 'Libre'}</span><br>
<small style="color:var(--tenue)">${x.ultimo_pedido ? 'Última: ' + esc(x.ultimo_pedido) : 'Entregados: ' + (x.envios_entregados ?? x.entregados ?? 0)}</small>
</div>`;
      }).join('') || '<p style="color:var(--tenue)">No hay repartidores activos.</p>';
    }
  };

  let rk = '';
  const pintarX = () => {
    const k = JSON.stringify(R.rendir || []); if (k === rk || !$('#mx')) return; rk = k;
    $('#mx').innerHTML = (R.rendir || []).map(x => {
      const esperado = Number(x.monto_esperado ?? x.efectivo_a_rendir ?? x.esperado ?? 0);
      return `
<div class="mi" style="border-color:var(--alerta);margin-bottom:.5rem">
<b>A la espera de rendición</b><span>${pesos(esperado)}</span>
<small>${esc(x.repartidor)} entregó a ${esc(x.cliente)}</small>
<input type="number" inputmode="numeric" placeholder="Monto que trae" data-r="${esc(x.id)}" value="${esperado}">
<button style="padding:.5rem;margin-top:.3rem" data-rb="${esc(x.id)}">Confirmar</button>
</div>`;
    }).join('');

    $('#mx').querySelectorAll('[data-rb]').forEach(b => b.onclick = async () => {
      const item = R.rendir.find(r => r.id === b.dataset.rb);
      if (!item) return;
      const inputVal = $('#mx').querySelector(`[data-r="${b.dataset.rb}"]`)?.value;
      const monto = Number(inputVal);
      if (inputVal === '' || isNaN(monto) || monto < 0) {
        alert('Ingresá un monto válido.');
        return;
      }
      const esperado = Number(item.monto_esperado ?? item.efectivo_a_rendir ?? item.esperado ?? 0);
      const diferencia = monto - esperado;

      await updateDoc(doc(db, 'rendiciones', item.id), {
        estado: 'RENDIDO',
        monto_ingresado: monto,
        montoRendido: monto,
        diferencia,
        recibido_por: ses.nombre,
        hora_rendicion: fmtLocal()
      });

      if (item.id_envio) {
        try {
          await updateDoc(doc(db, 'envios', item.id_envio), { estado_rendicion: 'RENDIDO' });
        } catch {}
      }

      await addDoc(collection(db, 'eventos'), {
        fecha_hora: fmtLocal(),
        id_jornada: ses.j,
        entidad: 'RENDICION',
        id_entidad: item.id,
        a_estado: 'RENDIDO',
        usuario: ses.nombre,
        detalle: `diferencia ${diferencia}`
      });
    });
  };

  let tandasSnapshotDocs = [];
  let enviosSnapshotDocs = [];

  const recalcularStats = () => {
    let venta_comidas = 0;
    let venta_socio = 0;

    tandasSnapshotDocs.forEach(t => {
      const items = t.items || [];
      let socioTanda = 0;
      let nuestraBaseTanda = 0;
      let nuestraConDescTanda = 0;

      const pctRaw = Number(t.descuentoPct ?? 0);
      const pct = pctRaw > 1 ? pctRaw / 100 : Math.max(0, pctRaw);

      if (items.length) {
        items.forEach(i => {
          const cant = Number(i.c || 1);
          const pSocio = Number(i.parte_socio || 0);
          const pNuestra = i.parte_nuestra !== undefined && i.parte_nuestra !== null && i.parte_nuestra !== ''
            ? Number(i.parte_nuestra)
            : Math.max(0, Number(i.p || 0) - pSocio);

          socioTanda += pSocio * cant;
          nuestraBaseTanda += pNuestra * cant;

          const esComidaDesc = (D.cats || []).includes(_U(i.cat)) && _U(i.t || 'COMIDA') === 'COMIDA' && !/^PROMO\b|^FLASH/i.test(i.n || '');
          const pNuestraFinal = esComidaDesc && pct > 0
            ? Math.ceil((pNuestra * (1 - pct)) / 100) * 100
            : pNuestra;
          nuestraConDescTanda += pNuestraFinal * cant;
        });
      } else {
        socioTanda = Number(t.parte_socio_total || 0);
        const sinEnvio = Math.max(0, Number(t.subtotal ?? t.total ?? 0));
        nuestraBaseTanda = Math.max(0, sinEnvio - socioTanda);
        nuestraConDescTanda = Math.max(0, Number(t.subtotal_redondeado ?? nuestraBaseTanda) - socioTanda);
      }

      venta_socio += socioTanda;
      venta_comidas += nuestraConDescTanda;
    });

    const monto_repartidores = enviosSnapshotDocs
      .filter(e => e.estado_reparto !== 'CANCELADO')
      .filter(e => e.envio_sin_cargo !== 'SI' && !e.envioBonificado)
      .reduce((acc, e) => acc + Number(e.costo_envio_repartidor ?? e.costo_envio ?? 0), 0);

    pintarResumen({ venta_comidas, venta_bebidas: venta_socio, monto_repartidores });
  };

  unsubs.push(onSnapshot(query(collection(db, 'tandas'), where('id_jornada', '==', ses.j)), snap => {
    if (!$('#mc')) return;
    todasTandasJornada = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tandasSnapshotDocs = todasTandasJornada.filter(t => t.estado !== 'CANCELADO' && t.estado_cocina !== 'CANCELADA');

    R.cocina = tandasSnapshotDocs
      .filter(t => t.a_cocina !== false && t.estado !== 'ENTREGADO')
      .map(t => ({
        id: t.id,
        cuenta: t.cuenta,
        estado: t.estado,
        tit: t.tipo === 'SALON' ? `Mesa ${t.mesa || ''}` : (t.cliente || 'Pedido'),
        cliente: t.cliente,
        tipo: t.tipo,
        hora_envio: t.hora_envio || t.fecha,
        itemsRaw: t.items || [],
        resumen: (t.items || []).map(i => `${i.c}x ${i.n}${i.op ? ' (' + i.op + ')' : ''}`).join(', ')
      }))
      .sort((a, b) => String(a.hora_envio || '').localeCompare(String(b.hora_envio || '')));

    const mesasMap = new Map();
    tandasSnapshotDocs.filter(t => t.tipo === 'SALON' && !t.cobrada).forEach(t => {
      const mKey = String(t.mesa || '').trim();
      if (!mKey) return;
      const prev = mesasMap.get(mKey) || { mesa: mKey, total: 0 };
      prev.total += Number(t.total || 0);
      mesasMap.set(mKey, prev);
    });
    mon.mesas = [...mesasMap.values()];
    ctl.mesas();
    recalcularStats();
    renderHistorialVentas();

    const ls = new Set(R.cocina.filter(t => t.estado === 'LISTA').map(t => t.id));
    if (listos) {
      const nuevos = [...ls].filter(x => !listos.has(x));
      if (nuevos.length) {
        beep();
        nuevos.forEach(x => { flash.add(x); setTimeout(() => { flash.delete(x); pintar(); }, 8000); });
      }
    }
    listos = ls;
    pintar();
  }));

  unsubs.push(onSnapshot(query(collection(db, 'envios'), where('id_jornada', '==', ses.j)), snap => {
    enviosSnapshotDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    recalcularStats();
  }));

  unsubs.push(onSnapshot(query(collection(db, 'rendiciones'), where('id_jornada', '==', ses.j), where('estado', '==', 'PENDIENTE')), snap => {
    R.rendir = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pintarX();
  }));

  unsubs.push(onSnapshot(query(collection(db, 'repartidores_jornada'), where('id_jornada', '==', ses.j)), snap => {
    R.repartos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => !r.hora_desactivacion);
    const ent = R.repartos.reduce((t, x) => t + Number(x.envios_entregados ?? x.entregados ?? 0), 0);
    if (entregados !== null && ent > entregados) beep();
    entregados = ent;
    pintar();
  }));

  unsubs.push(onSnapshot(collection(db, 'stock_socio'), snap => {
    const nextStock = {};
    snap.docs.forEach(d => {
      const x = d.data();
      const nom = _U(x.producto || d.id);
      if (!nom || x.stock === '' || x.stock === null || x.stock === undefined) return;
      nextStock[nom] = {
        producto: x.producto || d.id,
        stock: Number(x.stock) || 0,
        minimo: x.minimo === '' || x.minimo === null || x.minimo === undefined ? 0 : Number(x.minimo) || 0
      };
    });
    stockData = nextStock;
    D.stock = nextStock;
    renderStock($('#searchStock')?.value || '');
  }));

  unsubs.push(onSnapshot(collection(db, 'clientes'), snap => {
    D.clientes = snap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id,
        n: String(x.nombre || x.n || '').trim(),
        nivel: _U(x.nivel || '8 BITS'),
        pts: Number(x.puntos ?? x.pts ?? 0),
        tel: String(x.telefono || x.tel || '').trim(),
        dir: String(x.direccion || x.dir || '').trim()
      };
    });
    const dl = $('#cl');
    if (dl) dl.innerHTML = D.clientes.map(c => `<option value="${esc(c.n)}">`).join('');
  }));

  timers = [setInterval(pintar, 30000)];
  if ($('#cerrar')) $('#cerrar').onclick = () => { limpiar(); cierre(root, ses); };
}

function carga(el, D, ses, mon) {
  const S = { tipo: 'SALON', items: {}, manual: false, filtro: '' }, $ = q => el.querySelector(q), val = q => ($(q)?.value || '').trim();
  const NOMBRES = { SALON: 'Salón', RETIRO: 'Retiro', DELIVERY: 'Delivery' };

  const resetFormulario = () => {
    S.items = {};
    if ($('#q')) $('#q').value = '';
    if ($('#res')) $('#res').innerHTML = '';
    if ($('#manNom')) $('#manNom').value = '';
    if ($('#manPre')) $('#manPre').value = '';
    if ($('#mesa')) $('#mesa').value = '';
    if ($('#nom')) $('#nom').value = '';
    if ($('#tel')) $('#tel').value = '';
    if ($('#dir')) $('#dir').value = '';
    if ($('#km')) $('#km').value = '';
    if ($('#mon')) $('#mon').value = '';
    if ($('#chkBonificado')) $('#chkBonificado').checked = false;
    if ($('#tarjetaCliente')) $('#tarjetaCliente').innerHTML = '';
    lineas();
  };

  el.innerHTML = `<h2>Carga de pedidos</h2><div class="tp">${Object.keys(NOMBRES).map(t => `<button type="button" data-t="${t}">${NOMBRES[t]}</button>`).join('')}</div>
<div id="tarjetaCliente"></div>
<div class="fl" id="dat"></div>
<label class="chk-manual"><input type="checkbox" id="chkManual"> Ingreso manual de producto</label>
<div id="boxManual" class="box-manual" style="display:none">
<input id="manNom" placeholder="Nombre del producto libre">
<input id="manPre" type="number" placeholder="Precio $" inputmode="numeric">
<button type="button" class="sec" id="btnAddMan" style="width:auto">Agregar</button>
</div>
<div id="boxNormal">
<div class="tp"><button type="button" class="sec" data-f="COMIDA">Comidas</button><button type="button" class="sec" data-f="BEBIDA">Bebidas</button><button type="button" class="sec" data-f="COMBO">Combos</button></div>
<input id="q" placeholder="Buscar producto…" autocomplete="off"><div class="rs" id="res"></div>
</div>
<div id="car"></div><div class="tt" id="tt"></div><div id="pago"></div><p class="err" id="er"></p>
<div style="display:flex;gap:.5rem;margin-top:.5rem">
  <button type="button" id="env" style="flex:1">CARGAR PEDIDO</button>
  <button type="button" class="sec" id="btnPrint" style="flex:1;background:#2d3846;color:var(--txt)">🖨️ GENERAR TICKET</button>
</div>
<datalist id="cl">${(D.clientes || []).map(c => `<option value="${esc(c.n)}">`).join('')}</datalist>`;

  const obtenerPrecioEnvioCalculado = (km) => {
    const tarifas = D.tarifas_envio || [];
    if (!tarifas.length) return 0;
    let p = tarifas[tarifas.length - 1].precio;
    for (let i = 0; i < tarifas.length; i++) {
      if (km <= tarifas[i].km) { p = tarifas[i].precio; break; }
    }
    return p;
  };

  const calc = () => {
    const L = Object.values(S.items);
    const sub = L.reduce((s, i) => s + i.p * i.c, 0);
    const des = L
      .filter(i => (D.cats || []).includes(_U(i.cat)) && _U(i.t || 'COMIDA') === 'COMIDA' && !i.promo && !/^PROMO\b|^FLASH/i.test(i.n))
      .reduce((s, i) => s + i.p * i.c, 0);

    const tieneCombo = L.some(i => _U(i.t) === 'COMBO' || _U(i.cat) === 'COMBO');

    const cli = S.tipo === 'SALON' ? null : (D.clientes || []).find(c => _U(c.n) === _U(val('#nom')));
    const r = cli && (D.reglas || []).find(x => x.nivel === cli.nivel);
    const aplica = r && (r.dias === 'TODOS' || r.dias.split(',').includes(D.dia));
    const pct = aplica ? r.pct : 0;
    const rd = Math.ceil((sub - des * pct) / 100) * 100;

    const sinDescuentoPorCombo = pct > 0 && tieneCombo && des === 0;
    const avisoComboParcial = pct > 0 && tieneCombo && des > 0;

    const tieneEnvioGratisRegla = !!r && (r.gratis === 'SI' || Number(r.gratis) > 0);
    const minGratis = Number(r && r.gratis) > 0 ? Number(r.gratis) : 15000;
    const gratis = S.tipo === 'DELIVERY' && tieneEnvioGratisRegla && rd >= minGratis;

    const km = S.tipo === 'DELIVERY' ? +val('#km') || 0 : 0;
    const envioBase = S.tipo === 'DELIVERY' ? (val('#mon') !== '' ? +val('#mon') || 0 : obtenerPrecioEnvioCalculado(km)) : 0;
    const bonificado = S.tipo === 'DELIVERY' && $('#chkBonificado') && $('#chkBonificado').checked;
    const envioCliente = (gratis || bonificado) ? 0 : envioBase;
    const ahorroDescuento = Math.max(0, sub - rd);
    const ahorroEnvio = (gratis || bonificado) ? envioBase : 0;
    const totalAhorro = ahorroDescuento + ahorroEnvio;

    const cantPtsItems = L.filter(i => i.suma_puntos !== false).reduce((acc, i) => acc + i.c, 0);
    const ptsGanadosBase = S.tipo === 'SALON' ? 0 : (cantPtsItems * 10 + (S.tipo === 'DELIVERY' ? 30 : 0));

    return {
      sub,
      des,
      pct,
      gratis,
      bonificado,
      km,
      envioBase,
      envioCliente,
      rd,
      total: rd + envioCliente,
      nivel: cli?.nivel || (val('#nom') ? '8 BITS' : ''),
      pts: cli?.pts || 0,
      ptsGanadosBase,
      nuevo: !!val('#nom') && !cli,
      ahorro: totalAhorro,
      ahorroDescuento,
      sinDescuentoPorCombo,
      avisoComboParcial
    };
  };

  const totales = () => {
    const c = calc();
    const tc = $('#tarjetaCliente');
    if (tc) {
      if (S.tipo !== 'SALON' && val('#nom')) {
        tc.innerHTML = `<div style="background:#1a232e;border:1px solid #34404f;border-radius:10px;padding:.6rem .8rem;margin-bottom:.6rem;font-size:.9rem">
<p style="margin:.2rem 0"><strong>👤 Cliente:</strong> ${esc(val('#nom'))} ${c.nuevo ? '<span style="color:var(--alerta)">(Nuevo)</span>' : ''}</p>
<p style="margin:.2rem 0"><strong>Nivel:</strong> ${esc(c.nivel || '8 BITS')} | <strong>Puntos:</strong> ${c.pts} pts ${c.ptsGanadosBase > 0 ? `<span style="color:var(--acento)">(+${c.ptsGanadosBase} pts en este pedido)</span>` : ''}</p>
${c.ahorro > 0 ? `<div style="color:var(--exito);font-weight:bold;margin-top:.3rem">🎉 ¡Ahorra ${pesos(c.ahorro)} en este pedido!</div>` : ''}
</div>`;
      } else {
        tc.innerHTML = '';
      }
    }
    if ($('#tt')) {
      $('#tt').innerHTML = `<div><span>Productos</span><span>${pesos(c.sub)}</span></div>
${c.pct && !c.sinDescuentoPorCombo ? `<div><span>Descuento ${Math.round(c.pct * 100)}% (redondeado)</span><span>${pesos(c.rd)}</span></div>` : ''}
${c.sinDescuentoPorCombo || c.avisoComboParcial ? `<div><span style="color:var(--alerta);font-size:.9rem">Descuento no aplicable en combos</span><span></span></div>` : ''}
${S.tipo === 'DELIVERY' ? `
<div>
<span>Envío ${c.km ? '(' + c.km + ' km)' : ''} ${c.gratis ? '<span class="ok">sin cargo</span>' : c.bonificado ? '<span class="ok">bonificado</span>' : ''}</span>
<span>${pesos(c.envioCliente)} ${(c.gratis || c.bonificado) && c.envioBase > 0 ? `<small style="color:var(--tenue)">(Repartidor: ${pesos(c.envioBase)})</small>` : ''}</span>
</div>` : ''}
<div class="g"><span>Total</span><span>${pesos(c.total)}</span></div>`;
    }
  };

  const lineas = () => {
    if (!$('#car')) return;
    $('#car').innerHTML = Object.values(S.items).map(i => `<div class="ln"><b>${esc(i.n)} ${i.op ? `<small style="color:var(--acento)">(${esc(i.op)})</small>` : ''}</b><div class="q"><button type="button" class="sec" data-m="${esc(i.key)}">-</button>${i.c}<button type="button" class="sec" data-p="${esc(i.key)}">+</button></div>
<input data-o="${esc(i.key)}" placeholder="Nota para cocina" value="${esc(i.o)}"><span>${pesos(i.p * i.c)}</span></div>`).join('');
    $('#car').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const i = S.items[b.dataset.m]; if (--i.c <= 0) delete S.items[b.dataset.m]; lineas(); });
    $('#car').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.items[b.dataset.p].c++; lineas(); });
    $('#car').querySelectorAll('[data-o]').forEach(b => b.oninput = () => S.items[b.dataset.o].o = b.value);
    totales();
  };

  const autocompletarContactoCliente = () => {
    const nombreIngresado = _U(val('#nom'));
    if (!nombreIngresado) return;
    const cli = (D.clientes || []).find(c => _U(c.n) === nombreIngresado);
    if (cli) {
      if ($('#tel') && cli.tel && !val('#tel')) $('#tel').value = cli.tel;
      if ($('#dir') && cli.dir && !val('#dir')) $('#dir').value = cli.dir;
    }
  };

  const datos = () => {
    if (!$('#dat')) return;
    $('#dat').innerHTML = S.tipo === 'SALON' ? '<input id="mesa" placeholder="Mesa N°" inputmode="numeric">'
      : `<input id="nom" list="cl" placeholder="Nombre y apellido del cliente" autocomplete="off">
${S.tipo === 'DELIVERY' ? `
<input id="tel" placeholder="WhatsApp (ej. 3794123456)" inputmode="numeric" maxlength="14">
<input id="dir" placeholder="Dirección o link de Google Maps">
<div style="display:flex;gap:.5rem">
<input id="km" type="number" step="0.1" min="0" placeholder="Km de distancia" inputmode="decimal">
<input id="mon" type="number" min="0" placeholder="Monto manual ($)" inputmode="numeric">
</div>
<label class="chk-bonif">
<input type="checkbox" id="chkBonificado"> Bonificar envío al cliente (Acreditar a repartidor)
</label>
` : ''}`;
    $('#dat').querySelectorAll('input').forEach(i => {
      i.oninput = () => {
        if (i.id === 'nom') autocompletarContactoCliente();
        if (i.id === 'km' && val('#km')) {
          const precioSugerido = obtenerPrecioEnvioCalculado(+val('#km'));
          if ($('#mon')) $('#mon').placeholder = `Sugerido: $${precioSugerido}`;
        }
        totales();
      };
      if (i.type === 'checkbox') i.onchange = totales;
    });
    if ($('#nom')) {
      $('#nom').onchange = () => {
        autocompletarContactoCliente();
        totales();
      };
    }
    totales();
    S.pago = S.tipo === 'SALON' ? null : pagoUI($('#pago'));
    if (S.tipo === 'SALON') $('#pago').innerHTML = '';
    mesas(true);
  };

  const tipo = t => { S.tipo = t; el.querySelectorAll('[data-t]').forEach(b => b.className = b.dataset.t === t ? 'on' : 'sec'); datos(); };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => tipo(b.dataset.t));

  if ($('#chkManual')) {
    $('#chkManual').onchange = (e) => {
      S.manual = e.target.checked;
      $('#boxNormal').style.display = S.manual ? 'none' : 'block';
      $('#boxManual').style.display = S.manual ? 'flex' : 'none';
    };
  }

  if ($('#btnAddMan')) {
    $('#btnAddMan').onclick = () => {
      const nom = val('#manNom'), pre = +val('#manPre');
      if (!nom || !pre) return alert('Ingresá nombre y precio válido.');
      const key = 'MANUAL_' + nom;
      S.items[key] = {
        key,
        n: nom,
        p: pre,
        c: 1,
        o: '',
        cat: 'MANUAL',
        t: 'COMIDA',
        a_cocina: true,
        detalle_cocina: '',
        parte_nuestra: pre,
        parte_socio: 0,
        suma_puntos: true,
        ops: [],
        unidades: 1,
        op: ''
      };
      $('#manNom').value = ''; $('#manPre').value = ''; lineas();
    };
  }

  let ms = '';
  const mesas = forzar => {
    const rootEl = el.closest('.cj') || document;
    const box = rootEl.querySelector('#mm'), k = S.tipo + JSON.stringify(mon.mesas); if (!box || (!forzar && k === ms)) return; ms = k;
    box.innerHTML = (mon.mesas && mon.mesas.length) ? mon.mesas.map(m => `
<div class="mi" style="border-color:var(--acento);margin-bottom:.6rem;display:flex;flex-direction:column;gap:.4rem">
<div style="display:flex;justify-content:space-between"><b>Mesa ${esc(m.mesa)}</b><span>${pesos(m.total)}</span></div>
<div style="display:flex;gap:.4rem">
<button type="button" class="sec" data-tanda="${esc(m.mesa)}" style="padding:.4rem"> + Tanda</button>
<button type="button" data-ms="${esc(m.mesa)}" data-tot="${m.total}" style="padding:.4rem">Cobrar Mesa</button>
</div>
</div>`).join('') : '<p style="color:var(--tenue)">No hay mesas abiertas.</p>';

    box.querySelectorAll('[data-ms]').forEach(b => b.onclick = () => cobrarMesa(b.dataset.ms, +b.dataset.tot));
    box.querySelectorAll('[data-tanda]').forEach(b => b.onclick = () => {
      tipo('SALON');
      if ($('#mesa')) $('#mesa').value = b.dataset.tanda;
      alert(`Mesa ${b.dataset.tanda} seleccionada. Agregá los nuevos productos y hacé clic en CARGAR PEDIDO.`);
    });
  };

  const cobrarMesa = (mesa, total) => {
    tipo('SALON');
    if ($('#mesa')) $('#mesa').value = mesa;
    const rootEl = el.closest('.cj') || document;
    const cm = rootEl.querySelector('#mm');
    cm.innerHTML = `<div class="mi" style="border-color:var(--exito)"><h2>Cobrando mesa ${esc(mesa)}: ${pesos(total)}</h2></div><div id="pg"></div><p class="err" id="ec"></p><button type="button" id="okc">Confirmar cobro</button>`;
    const leer = pagoUI(cm.querySelector('#pg'));
    cm.querySelector('#okc').onclick = async () => {
      const pg = leer(), e = cm.querySelector('#ec');
      if (!pg.metodo) { e.textContent = 'Elegí el método de pago.'; return; }
      const snap = await getDocs(query(collection(db, 'tandas'), where('id_jornada', '==', ses.j), where('tipo', '==', 'SALON'), where('mesa', '==', String(mesa))));
      const abiertas = snap.docs.filter(d => !d.data().cobrada && d.data().estado !== 'CANCELADO');
      if (!abiertas.length) { e.textContent = 'Esa mesa ya no tiene cuenta abierta.'; return; }

      const ef = pg.metodo === 'EFECTIVO' ? total : pg.metodo === 'MIXTO' ? Math.min(Math.max(Number(pg.efectivo) || 0, 0), total) : 0;
      const tr = total - ef;
      const ahora = fmtLocal();

      await Promise.all(abiertas.map((d, idx) => updateDoc(doc(db, 'tandas', d.id), {
        cobrada: true,
        metodoPago: pg.metodo,
        efectivo_monto: idx === 0 ? ef : 0,
        transferencia_monto: idx === 0 ? tr : 0,
        cobradoPor: ses.nombre,
        cobradoEn: ahora
      })));

      const vuelto = pg.pagaCon > ef && ef > 0 ? pg.pagaCon - ef : 0;
      cm.innerHTML = `<p class="ok">Mesa ${esc(mesa)} cobrada.${vuelto ? ' Vuelto: ' + pesos(vuelto) : ''}</p>`;
      ms = '';
    };
  };

  const buscar = () => {
    const q = _U(val('#q')), f = S.filtro, base = (D.catalogo || []).filter(p => p.disp && (!f || p.t === f));
    const L = (q ? base.filter(p => _U(p.n).includes(q) || _U(p.cat).includes(q)) : f ? base : (D.catalogo || []).filter(p => p.disp)).slice(0, 15);
    if (!$('#res')) return;
    $('#res').innerHTML = L.map(p => {
      const stKey = p.ops && p.ops.length === 1 ? _U(p.ops[0]) : _U(p.n);
      const infoStock = (D.stock && D.stock[stKey]) ? D.stock[stKey].stock : null;
      const tieneStock = infoStock !== null;
      const stockTxt = tieneStock ? `${infoStock} un.` : (p.ops && p.ops.length > 1 ? 'Elegir bebida' : 'N/D');
      const estiloStock = tieneStock && infoStock <= 3 ? 'background:var(--alerta);color:#06121d' : 'background:#2d3846;color:var(--exito)';
      return `<button type="button" class="sec" data-n="${esc(p.n)}">
<span>${esc(p.n)} <small>${esc(p.cat)}</small><span class="lbl-stock-cat" style="${estiloStock}">${stockTxt}</span></span>
<span>${pesos(p.p)}</span>
</button>`;
    }).join('');
    $('#res').querySelectorAll('button').forEach(b => b.onclick = () => {
      const p = (D.catalogo || []).find(x => x.n === b.dataset.n);
      if (!p) return;
      let opElegida = '';
      if (p.ops && p.ops.length === 1) {
        opElegida = p.ops[0];
      } else if (p.ops && p.ops.length > 1) {
        const txt = p.ops.map((o, idx) => `${idx + 1}. ${o}`).join('\n');
        const sel = prompt(`Elegí la opción de bebida para ${p.n}:\n${txt}`, '1');
        const idx = parseInt(sel, 10) - 1;
        if (isNaN(idx) || !p.ops[idx]) return alert('Opción inválida.');
        opElegida = p.ops[idx];
      }
      const key = opElegida ? `${p.n}_${opElegida}` : p.n;
      (S.items[key] ??= { key, ...p, op: opElegida, c: 0, o: '' }).c++;
      $('#q').value = ''; $('#res').innerHTML = ''; lineas();
    });
  };

  if ($('#q')) $('#q').oninput = buscar;
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    S.filtro = S.filtro === b.dataset.f ? '' : b.dataset.f;
    el.querySelectorAll('[data-f]').forEach(x => x.className = x.dataset.f === S.filtro ? 'on' : 'sec');
    buscar();
  });

  const obtenerDatosActuales = () => {
    const c = calc();
    const itemsParaTicket = Object.values(S.items).map(i => ({ n: i.n, c: i.c, p: i.p, o: i.o, op: i.op }));
    const notaDescuento = (c.sinDescuentoPorCombo || c.avisoComboParcial)
      ? 'Descuento no aplicable en combos'
      : '';
    return {
      tipo: S.tipo,
      mesa: val('#mesa'),
      cliente: val('#nom') || 'Cliente General',
      nivel_cliente: c.nivel || 'Cliente',
      direccion: val('#dir') || (S.tipo === 'SALON' ? 'Mesa ' + (val('#mesa') || '') : 'Retiro en local'),
      items: itemsParaTicket,
      subtotal: c.sub,
      envio: c.envioCliente,
      envio_bonificado: c.gratis || c.bonificado,
      total_descuento: c.ahorroDescuento,
      nota_descuento: notaDescuento,
      total: c.total,
      ahorro: c.ahorro
    };
  };

  if ($('#btnPrint')) {
    $('#btnPrint').onclick = () => {
      if (Object.keys(S.items).length === 0) {
        alert('Agregá al menos un producto para generar el ticket.');
        return;
      }
      imprimirTicketDirecto(obtenerDatosActuales());
    };
  }

  if ($('#env')) {
    $('#env').onclick = async () => {
      const err = $('#er'); if (err) { err.className = 'err'; err.textContent = ''; }
      const itemsArr = Object.values(S.items);
      if (!itemsArr.length) { if (err) err.textContent = 'Agregá al menos un producto.'; return; }
      if (S.tipo === 'SALON' && !val('#mesa')) { if (err) err.textContent = 'Completá la mesa o el nombre del cliente.'; return; }
      if (S.tipo !== 'SALON' && !val('#nom')) { if (err) err.textContent = 'Completá la mesa o el nombre del cliente.'; return; }
      const telDig = val('#tel').replace(/\D/g, '');
      if (S.tipo === 'DELIVERY') {
        if (!val('#dir') || telDig.length !== 10) {
          if (err) err.textContent = 'Para delivery cargá teléfono de 10 dígitos (sin 0 ni 15) y dirección.';
          return;
        }
      }
      const pg = S.pago ? S.pago() : { metodo: 'PENDIENTE', efectivo: 0, pagaCon: 0 };
      if (S.tipo !== 'SALON' && !pg.metodo) { if (err) err.textContent = 'Elegí el método de pago.'; return; }

      const demanda = {};
      itemsArr.forEach(i => {
        const stockKey = _U(i.op || (i.t === 'BEBIDA' ? i.n : ''));
        if (stockKey) {
          const mult = (i.ops && i.ops.length) ? (Number(i.unidades) || 1) : 1;
          demanda[stockKey] = (demanda[stockKey] || 0) + i.c * mult;
        }
      });
      if (D.bloqStock) {
        for (const k of Object.keys(demanda)) {
          const st = D.stock[k];
          if (st && st.stock < demanda[k]) {
            if (err) err.textContent = `Sin stock suficiente de ${st.producto || k} (quedan ${st.stock} un.).`;
            return;
          }
        }
      }

      const c = calc();
      const ahora = fmtLocal();
      const cuentaId = 'PED-' + Date.now().toString().slice(-6);
      const itemsFormateados = itemsArr.map(i => {
        const notaCompleta = [
          i.a_cocina && i.detalle_cocina ? i.detalle_cocina : '',
          i.op ? 'Bebida: ' + i.op : '',
          i.o || ''
        ].filter(Boolean).join(' - ');
        return {
          n: i.n,
          c: i.c,
          p: i.p,
          o: notaCompleta,
          op: i.op || '',
          t: i.t || 'COMIDA',
          cat: i.cat || '',
          a_cocina: i.a_cocina !== false,
          parte_nuestra: Number(i.parte_nuestra ?? i.p ?? 0),
          parte_socio: Number(i.parte_socio ?? 0),
          suma_puntos: i.suma_puntos !== false
        };
      });

      const tieneCocina = itemsFormateados.some(i => i.a_cocina);
      const parteSocioTotal = itemsFormateados.reduce((acc, i) => acc + i.parte_socio * i.c, 0);
      const ef = pg.metodo === 'EFECTIVO' ? c.total : pg.metodo === 'MIXTO' ? Math.min(Math.max(Number(pg.efectivo) || 0, 0), c.total) : 0;
      const tr = S.tipo === 'SALON' ? 0 : (c.total - ef);

      const docRef = await addDoc(collection(db, 'tandas'), {
        id_jornada: ses.j,
        cuenta: cuentaId,
        tipo: S.tipo,
        mesa: S.tipo === 'SALON' ? val('#mesa') : '',
        cliente: S.tipo === 'SALON' ? `Mesa ${val('#mesa')}` : _U(val('#nom')),
        nivel_cliente: c.nivel || '',
        telefono: S.tipo === 'DELIVERY' ? telDig : '',
        direccion: S.tipo === 'DELIVERY' ? val('#dir') : '',
        km: c.km,
        costo_envio: c.envioCliente,
        costo_envio_repartidor: c.envioBase,
        envio_sin_cargo: (c.gratis || c.bonificado) ? 'SI' : 'NO',
        monto_envio_sin_cargo: (c.gratis || c.bonificado) ? c.envioBase : 0,
        envioBonificado: c.gratis || c.bonificado,
        descuentoPct: c.pct,
        total_descuento: c.ahorroDescuento,
        subtotal: c.sub,
        subtotal_redondeado: c.rd,
        total: c.total,
        ahorro: c.ahorro,
        parte_socio_total: parteSocioTotal,
        metodoPago: pg.metodo,
        efectivo_monto: S.tipo === 'SALON' ? 0 : ef,
        transferencia_monto: tr,
        cobrada: S.tipo === 'RETIRO',
        a_cocina: tieneCocina,
        estado: tieneCocina ? 'RECIBIDA' : 'LISTA',
        items: itemsFormateados,
        hora_envio: ahora,
        fecha: ahora,
        usuario: ses.nombre
      });

      if (S.tipo === 'DELIVERY') {
        await addDoc(collection(db, 'envios'), {
          id_jornada: ses.j,
          id_tanda: docRef.id,
          id_cuenta: cuentaId,
          cliente: _U(val('#nom')),
          telefono_contacto: telDig,
          direccion_texto: val('#dir'),
          ubicacion_link: val('#dir').startsWith('http') ? val('#dir') : '',
          estado_reparto: 'PENDIENTE',
          costo_envio: c.envioCliente,
          costo_envio_repartidor: c.envioBase,
          envio_sin_cargo: (c.gratis || c.bonificado) ? 'SI' : 'NO',
          monto_envio_sin_cargo: (c.gratis || c.bonificado) ? c.envioBase : 0,
          envioBonificado: c.gratis || c.bonificado,
          efectivo_a_rendir: ef,
          estado_rendicion: ef > 0 ? 'PENDIENTE' : 'NO_APLICA',
          hora_creado: ahora
        });
      }

      for (const k of Object.keys(demanda)) {
        await moverStockSocio(k, -demanda[k], 'VENTA', cuentaId, ses.nombre);
      }

      let infoPts = null;
      if (S.tipo !== 'SALON') {
        infoPts = await acreditarPuntosCliente({
          nombre: val('#nom'),
          telefono: telDig,
          direccion: val('#dir'),
          tipo: S.tipo,
          items: itemsFormateados,
          config: D.config,
          reglas: D.reglas
        });
      }

      const vuelto = pg.pagaCon > ef && ef > 0 ? pg.pagaCon - ef : 0;
      resetFormulario();
      if (err) {
        err.className = 'ok';
        const txtPts = infoPts && infoPts.puntosGanados > 0
          ? ` | +${infoPts.puntosGanados} pts (Total: ${infoPts.nuevosPuntos} - ${infoPts.nivel})`
          : '';
        err.textContent = `Pedido ${cuentaId} registrado${tieneCocina ? ' y enviado a cocina' : ' (no pasa por cocina)'}.${vuelto ? ' Vuelto: ' + pesos(vuelto) : ''}${txtPts}`;
      }
    };
  }

  tipo('SALON'); lineas();
  return { mesas, cobrarMesa };
}

async function cierre(root, ses) {
  await authReady;
  root.innerHTML = `<style>${CSS}${CSS2}</style><div class="cj"><div class="cl"><h1>Cerrar ventas</h1><p>Leyendo la jornada…</p></div></div>`;
  const box = root.querySelector('.cl'), q = x => box.querySelectorAll(x);
  const volver = () => { if (box.querySelector('#vol')) box.querySelector('#vol').onclick = () => panel(root, ses); };

  let C = { apertura: 0, efvo: 0, transf: 0, rendido: 0, gastos: 0, pagos: [], socio: 0, bloqueos: [], repDocs: [] };
  try {
    const [tandasSnap, enviosSnap, rendSnap, gastosSnap, repSnap, jSnap] = await Promise.all([
      getDocs(query(collection(db, 'tandas'), where('id_jornada', '==', ses.j))),
      getDocs(query(collection(db, 'envios'), where('id_jornada', '==', ses.j))),
      getDocs(query(collection(db, 'rendiciones'), where('id_jornada', '==', ses.j))),
      getDocs(query(collection(db, 'gastos'), where('id_jornada', '==', ses.j))),
      getDocs(query(collection(db, 'repartidores_jornada'), where('id_jornada', '==', ses.j))),
      getDocs(query(collection(db, 'jornadas'), where('estado', '==', 'ABIERTA')))
    ]);

    const tandas = tandasSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.estado !== 'CANCELADO' && t.estado_cocina !== 'CANCELADA');
    const envios = enviosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rendiciones = rendSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const gastosPrevios = gastosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const repJornada = repSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const bloqueos = [];
    tandas.filter(t => t.tipo === 'SALON' && !t.cobrada).forEach(t => bloqueos.push(`Mesa ${t.mesa || '?'} sin cobrar`));
    tandas.filter(t => t.a_cocina !== false && ['RECIBIDA', 'EN_PREPARACION'].includes(t.estado)).forEach(t => bloqueos.push(`Pedido de ${t.cliente || 'Salón'} sigue en cocina`));
    envios.forEach(e => {
      if (['PENDIENTE', 'EN_CAMINO'].includes(e.estado_reparto)) bloqueos.push(`Envío de ${e.cliente || ''} sin entregar`);
      if (e.estado_rendicion === 'PENDIENTE') bloqueos.push(`Rendición pendiente de ${e.cliente || ''}`);
    });
    rendiciones.filter(r => r.estado === 'PENDIENTE').forEach(r => bloqueos.push(`Rendición pendiente de ${r.cliente || r.repartidor || ''}`));
    C.bloqueos = bloqueos;

    const jDoc = jSnap.docs.find(d => d.id === ses.j) || jSnap.docs[0];
    const jData = jDoc ? jDoc.data() : {};
    C.apertura = Number(jData.efectivo_apertura ?? jData.apertura ?? 0);

    tandas.filter(t => t.cobrada).forEach(t => {
      if (t.tipo !== 'DELIVERY') {
        if (t.efectivo_monto !== undefined) C.efvo += Number(t.efectivo_monto || 0);
        else if (t.metodoPago === 'EFECTIVO') C.efvo += Number(t.total || 0);
      }
      if (t.transferencia_monto !== undefined) C.transf += Number(t.transferencia_monto || 0);
      else if (t.metodoPago === 'TRANSFERENCIA') C.transf += Number(t.total || 0);

      if (t.parte_socio_total !== undefined) C.socio += Number(t.parte_socio_total || 0);
      else (t.items || []).forEach(i => { C.socio += Number(i.parte_socio || 0) * Number(i.c || 1); });
    });

    C.rendido = rendiciones
      .filter(r => r.estado === 'RENDIDO')
      .reduce((acc, r) => acc + Number(r.monto_ingresado ?? r.montoRendido ?? 0), 0);

    C.gastos = gastosPrevios.reduce((acc, g) => acc + Number(g.monto || 0), 0);

    C.repDocs = repJornada.filter(r => r.pagado !== 'SI' && Number(r.total_a_pagar || 0) > 0);
    C.pagos = C.repDocs.map(r => ({
      id: r.id,
      n: r.repartidor || r.nombre || 'Repartidor',
      monto: Number(r.total_a_pagar || 0)
    }));
  } catch {
    box.innerHTML = '<h1>Cerrar ventas</h1><p class="err">No se pudo leer la jornada.</p><button id="vol">Volver a la caja</button>';
    volver();
    return;
  }

  if (C.bloqueos.length) {
    box.innerHTML = `<h1>Todavía no se puede cerrar</h1><ul>${C.bloqueos.map(b => `<li>${esc(b)}</li>`).join('')}</ul><button id="vol">Volver a la caja</button>`;
    volver();
    return;
  }

  const pagos = (C.pagos || []).reduce((t, x) => t + x.monto, 0);
  box.innerHTML = `<h1>Cerrar ventas</h1><label>Efectivo contado: cantidad de billetes</label><div class="gr">${DEN.map(d => `<div><b>${pesos(d)}</b><input type="number" min="0" inputmode="numeric" data-d="${d}" placeholder="0"></div>`).join('')}</div>
<label>Transferencias recibidas</label><input id="tr" type="number" inputmode="numeric" placeholder="Total de transferencias">
<label>Gastos</label><div id="gs"></div><button type="button" class="sec" id="mg" style="margin-top:.5rem">Agregar gasto</button>
${(C.pagos || []).length ? `<label>Pagos a repartidores (salen de la caja)</label>${(C.pagos || []).map(x => `<div class="tot" style="margin:.2rem 0"><span>${esc(x.n)}</span><span>${pesos(x.monto)}</span></div>`).join('')}` : ''}
${C.socio ? `<label>Corresponde al socio de bebidas hoy: <b>${pesos(C.socio)}</b></label><input id="ps" type="number" inputmode="numeric" placeholder="Pago al socio en efectivo (opcional)">` : '<input id="ps" type="hidden" value="0">'}
<div id="bal" class="tt"></div><p class="err" id="ecier"></p><div id="acc"><button type="button" id="cer">Cerrar ventas</button><button type="button" class="sec" id="vol" style="margin-top:.6rem">Volver a la caja</button></div>`;
  volver();

  const leer = () => {
    const bil = {}; q('[data-d]').forEach(i => bil[i.dataset.d] = +i.value || 0);
    const gastos = [...q('#gs .gr')].map(r => { const [c, m] = r.querySelectorAll('input'); return { concepto: c.value.trim(), monto: +m.value || 0 }; }).filter(g => g.concepto && g.monto > 0);
    const pagoSocio = Math.max(0, +box.querySelector('#ps')?.value || 0);
    return { bil, gastos, pagoSocio, contado: DEN.reduce((t, d) => t + d * (bil[d] || 0), 0), gm: gastos.reduce((t, g) => t + g.monto, 0) + pagoSocio };
  };

  const bal = () => {
    const L = leer(), esp = (C.apertura || 0) + (C.efvo || 0) + (C.rendido || 0) - (C.gastos || 0) - L.gm - pagos, dif = L.contado - esp, dt = (+box.querySelector('#tr')?.value || 0) - (C.transf || 0);
    const txt = x => x === 0 ? 'cuadra' : (x > 0 ? 'sobran ' : 'faltan ') + pesos(Math.abs(x));
    if (box.querySelector('#bal')) {
      box.querySelector('#bal').innerHTML = `<div><span>Efectivo esperado</span><span>${pesos(esp)}</span></div><div><span>Efectivo contado</span><span>${pesos(L.contado)}</span></div>
<div class="g"><span>Efectivo</span><span class="${dif === 0 ? 'ok' : ''}">${txt(dif)}</span></div><div><span>Transferencias en el sistema</span><span>${pesos(C.transf || 0)}</span></div><div><span>Transferencias declaradas</span><span class="${dt === 0 ? 'ok' : ''}">${txt(dt)}</span></div>`;
    }
  };

  const mas = () => { if (box.querySelector('#gs')) { box.querySelector('#gs').insertAdjacentHTML('beforeend', '<div class="gr" style="margin-top:.4rem"><input placeholder="Concepto"><input type="number" inputmode="numeric" placeholder="Monto"></div>'); box.querySelectorAll('#gs input').forEach(i => i.oninput = bal); } };
  if (box.querySelector('#mg')) box.querySelector('#mg').onclick = mas;
  q('[data-d],#tr,#ps').forEach(i => i.oninput = bal);
  mas(); bal();

  if (box.querySelector('#cer')) {
    box.querySelector('#cer').onclick = () => {
      if (box.querySelector('#acc')) {
        box.querySelector('#acc').innerHTML = '<p><b>¿Estás seguro que querés cerrar?</b></p><div class="tp" style="grid-template-columns:1fr 1fr"><button type="button" id="si">Sí</button><button type="button" class="sec" id="no">No</button></div>';
        if (box.querySelector('#no')) box.querySelector('#no').onclick = () => cierre(root, ses);
        if (box.querySelector('#si')) {
          box.querySelector('#si').onclick = async () => {
            const L = leer();
            const ahora = fmtLocal();
            const esp = (C.apertura || 0) + (C.efvo || 0) + (C.rendido || 0) - (C.gastos || 0) - L.gm - pagos;
            const dif = L.contado - esp;
            const trDecl = +box.querySelector('#tr')?.value || 0;

            if (L.pagoSocio > 0) {
              await addDoc(collection(db, 'gastos'), {
                id_jornada: ses.j,
                fecha_hora: ahora,
                tipo: 'PAGO_SOCIO',
                concepto: 'Pago al socio de bebidas',
                monto: L.pagoSocio,
                registrado_por: ses.nombre
              });
            }

            for (const g of L.gastos) {
              await addDoc(collection(db, 'gastos'), {
                id_jornada: ses.j,
                fecha_hora: ahora,
                tipo: 'GASTO',
                concepto: g.concepto,
                monto: g.monto,
                registrado_por: ses.nombre
              });
            }

            for (const pRep of C.pagos) {
              const gRef = await addDoc(collection(db, 'gastos'), {
                id_jornada: ses.j,
                fecha_hora: ahora,
                tipo: 'PAGO_REPARTIDOR',
                concepto: 'Pago diario ' + pRep.n,
                monto: pRep.monto,
                registrado_por: ses.nombre
              });
              await updateDoc(doc(db, 'repartidores_jornada', pRep.id), {
                pagado: 'SI',
                id_gasto_pago: gRef.id
              });
            }

            await addDoc(collection(db, 'arqueos'), {
              id_jornada: ses.j,
              tipo: 'CIERRE',
              realizado_por: ses.nombre,
              hora: ahora,
              efectivo_contado: L.contado,
              billetes: L.bil,
              transferencias_declaradas: trDecl,
              transferencias_sistema: C.transf,
              gastos_total: C.gastos + L.gm + pagos,
              efectivo_esperado: esp,
              diferencia: dif,
              confirmado: 'SI'
            });

            await updateDoc(doc(db, 'jornadas', ses.j), {
              estado: 'CERRADA',
              cerrada_por: ses.nombre,
              cerradaPor: ses.nombre,
              hora_cierre: ahora,
              cerradaEn: ahora,
              esperado: esp,
              contado: L.contado,
              diferencia: dif,
              transferenciasDeclaradas: trDecl,
              gastos: L.gastos,
              pagoSocio: L.pagoSocio,
              billetes_cierre: L.bil
            });

            const [sesSnap, repActSnap] = await Promise.all([
              getDocs(query(collection(db, 'sesiones'), where('id_jornada', '==', ses.j))),
              getDocs(query(collection(db, 'repartidores_jornada'), where('id_jornada', '==', ses.j)))
            ]);
            await Promise.all([
              ...sesSnap.docs.filter(d => !d.data().hora_egreso).map(d => updateDoc(doc(db, 'sesiones', d.id), { hora_egreso: ahora })),
              ...repActSnap.docs.filter(d => !d.data().hora_desactivacion).map(d => updateDoc(doc(db, 'repartidores_jornada', d.id), { hora_desactivacion: ahora }))
            ]);

            box.innerHTML = `<h1>Jornada cerrada</h1><div class="tt"><div><span>Efectivo esperado</span><span>${pesos(esp)}</span></div><div><span>Efectivo contado</span><span>${pesos(L.contado)}</span></div><div class="g"><span>Diferencia</span><span>${pesos(dif)}</span></div></div><button type="button" id="fin">Listo</button>`;
            if (box.querySelector('#fin')) box.querySelector('#fin').onclick = () => { sessionStorage.removeItem('cajero'); login(root); };
          };
        }
      }
    };
  }
}
