import { api } from '../../core/api.js';
const DEN = [10, 20, 50, 100, 200, 500, 1000, 2000, 10000, 20000];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = n => '$' + Number(n).toLocaleString('es-AR');
const CSS = `
.cj{--card:#202833;--txt:#e9eef4;--tenue:#93a1b3;--acento:#4da3e0;min-height:100vh;color:var(--txt);font:17px/1.35 system-ui,sans-serif}
.cj h1{font-size:1.9rem;margin:0 0 1rem}.cj button{font:inherit;font-weight:700;border:0;border-radius:10px;padding:.9rem 1.2rem;cursor:pointer;background:var(--acento);color:#06121d;width:100%}
.cj input{font:inherit;padding:.7rem;border-radius:10px;border:2px solid #34404f;background:#10151c;color:var(--txt);width:100%}
.cl{max-width:34rem;margin:0 auto;padding:6vh 1.2rem}.cl label{display:block;margin:1rem 0 .4rem;color:var(--tenue)}
.gr{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem}.gr div{display:flex;align-items:center;gap:.5rem}.gr b{min-width:4.5rem;text-align:right}
.tot{display:flex;justify-content:space-between;font-size:1.3rem;font-weight:700;margin:1rem 0}.err{color:#f0b13c;min-height:1.4em}
.ch{display:flex;justify-content:space-between;align-items:center;padding:.7rem 1.2rem;color:var(--tenue);border-bottom:1px solid #2a3340}
.pn{display:grid;grid-template-columns:1.5fr 1fr;grid-template-rows:1fr 1fr;gap:.8rem;padding:.8rem;height:calc(100vh - 7rem)}
.pn section{background:var(--card);border-radius:12px;padding:1rem;overflow:auto}.pn section:first-child{grid-row:1/3}
.pn h2{margin:0 0 .5rem;font-size:1.1rem;color:var(--acento)}.pn p{color:var(--tenue)}
.dash-delivery-horiz{grid-column:1/3;background:var(--card);border-radius:12px;padding:.6rem .8rem;height:8rem;overflow-x:auto;box-sizing:border-box}
.track-repartidores{display:flex;gap:.8rem;overflow-x:auto;padding-bottom:.2rem}
.card-rep{background:#151a22;border-radius:8px;padding:.5rem .7rem;min-width:180px;border-left:4px solid var(--acento);flex-shrink:0}
@media(max-width:900px){.pn{grid-template-columns:1fr;grid-template-rows:none;height:auto}.pn section:first-child{grid-row:auto}.dash-delivery-horiz{grid-column:auto;height:auto}}`;
const CSS2 = `
.mi{display:grid;grid-template-columns:1fr auto;gap:.1rem .6rem;padding:.5rem .6rem;margin-bottom:.4rem;border-radius:10px;background:#2a3340;border-left:5px solid var(--alerta)}.mi.EN_PREPARACION,.mi.EN_CAMINO{border-color:var(--acento)}.mi.LISTA,.mi.LIBRE{border-color:var(--exito)}.mi small{grid-column:1/3;color:var(--tenue)}.flash{animation:fl 1s 8}@keyframes fl{50%{background:#2f6b4f}}
.tp{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:.8rem}.cj button.sec{background:#2d3846;color:var(--txt)}.cj button.on{background:var(--acento);color:#06121d}
.fl{display:grid;gap:.5rem;margin-bottom:.8rem}.bd{display:inline-block;padding:.1rem .6rem;border-radius:99px;background:#2d3846;font-size:.9rem}
.rs button{display:flex;justify-content:space-between;width:100%;margin:.25rem 0;text-align:left;font-weight:500}
.ln{display:grid;grid-template-columns:1fr auto;gap:.3rem .6rem;padding:.6rem 0;border-bottom:1px solid #2a3340}.ln .q{display:flex;gap:.4rem;align-items:center}.ln .q button{width:2.4rem;padding:.4rem}
.tt{margin:.8rem 0}.tt div{display:flex;justify-content:space-between}.tt .g{font-size:1.4rem;font-weight:800}.ok{color:var(--exito)}
.chk-manual{display:flex;align-items:center;gap:.5rem;margin:.5rem 0;font-size:.95rem;color:var(--acento);cursor:pointer}
.chk-manual input{width:auto!important}
.box-manual{display:flex;gap:.5rem;margin-bottom:.8rem}
.drawer-stock{position:fixed;right:-360px;top:0;width:340px;height:100%;background:#151a22;border-left:2px solid #34404f;box-shadow:-4px 0 15px rgba(0,0,0,.5);transition:right .3s ease;z-index:9999;padding:1rem;display:flex;flex-direction:column;box-sizing:border-box}
.drawer-stock.open{right:0}
.drawer-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid #2a3340;padding-bottom:.5rem}
.drawer-header h3{margin:0;font-size:1.2rem}
.drawer-header button{width:auto;padding:.3rem .7rem;background:#2d3846;color:#fff}
.stock-list{flex-grow:1;overflow-y:auto;margin-top:1rem}
.stock-item{display:flex;justify-content:space-between;align-items:center;padding:.6rem;border-bottom:1px solid #2a3340}
.stock-low{color:var(--alerta);font-weight:bold}
.stock-ok{color:var(--exito);font-weight:bold}
.lbl-stock-cat{font-size:.8rem;padding:.15rem .4rem;border-radius:4px;display:inline-block;margin-left:.3rem}`;

/**
 * Genera e imprime el ticket/comanda digital de BEBECHOFOODCTES directamente con datos de la carga
 */
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
  const total = Number(pedidoData.total || 0);
  const ahorro = Number(pedidoData.ahorro || 0);

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
  .total-final { font-size: 13px; font-weight: bold; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px; }
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
      WA: 3794000944<br>
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
    <div class="totales-row"><span>Costo de envíos($0 "Envio bonificado"):</span> <span>${envio > 0 ? pForm(envio) : pForm(0)}</span></div>
    <div class="totales-row total-final"><span>TOTAL(Con descuento solo si aplica):</span> <span>${pForm(total)}</span></div>
  </div>

  <div class="ahorro-footer">
    *** Ahorraste ${pForm(ahorro)}!! ***
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

let ctx, timers = [];
function beep() {
try { ctx ??= new AudioContext(); ctx.resume(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .2; o.start(); o.stop(ctx.currentTime + .25); } catch {}
}
const hace = x => Math.max(0, (Date.now() - new Date(String(x).replace(' ', 'T'))) / 60000 | 0) + ' min';
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
export function mount(root) {
const ses = JSON.parse(sessionStorage.getItem('cajero') || 'null');
ses ? panel(root, ses) : login(root);
}
async function login(root) {
const est = await api('cajero_estado');
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
beep(); const billetes = {}; grilla().forEach(i => billetes[i.dataset.d] = +i.value || 0);
const r = await api('abrir_jornada', { nombre, billetes });
if (r.error) { err.textContent = 'No se pudo abrir la caja: ' + r.error; return; }
const s = { nombre, j: r.id_jornada };
sessionStorage.setItem('cajero', JSON.stringify(s)); panel(root, s);
};
}
async function panel(root, ses) {
timers.forEach(clearInterval); timers = [];
root.innerHTML = `<style>${CSS}${CSS2}</style><div class="cj">
<div class="ch">
<span>Hola ${esc(ses.nombre)}, excelente jornada para hoy!</span>
<div style="display:flex;gap:.5rem">
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
<div id="drawerStock" class="drawer-stock">
<div class="drawer-header">
<h3>Stock en Vivo</h3>
<button id="btnCloseStock">✖</button>
</div>
<input id="searchStock" placeholder="Buscar producto en stock..." autocomplete="off">
<div id="stockContainer" class="stock-list"><p>Cargando stock...</p></div>
</div>`;
const D = await api('datos_cajero'), el = root.querySelector('#carga'), mon = { mesas: [] }, $ = q => root.querySelector(q);
let ctl = { mesas() {}, cobrarMesa() {} };
if (D.error) el.innerHTML = `<h2>Carga de pedidos</h2><p class="err">No se pudo leer la planilla (${esc(D.error)}).</p>`; else ctl = carga(el, D, ses, mon);
const drawer = $('#drawerStock');
let stockData = D.stock || {};
const renderStock = (filtro = '') => {
const container = $('#stockContainer');
const keys = Object.keys(stockData).filter(k => k.toLowerCase().includes(filtro.toLowerCase()));
if (!keys.length) {
container.innerHTML = '<p style="color:var(--tenue)">Sin productos registrados en stock.</p>';
return;
}
container.innerHTML = keys.map(k => {
const item = stockData[k];
const cant = item.stock;
const min = item.minimo || 0;
const esBajo = cant <= min;
return `<div class="stock-item">
<div><strong>${esc(k)}</strong>${min ? `<br><small style="color:var(--tenue)">Mínimo: ${min}</small>` : ''}</div>
<span class="${esBajo ? 'stock-low' : 'stock-ok'}">${cant} un.</span>
</div>`;
}).join('');
};
if ($('#btnStockDrawer')) $('#btnStockDrawer').onclick = () => { drawer.classList.add('open'); renderStock($('#searchStock').value); };
if ($('#btnCloseStock')) $('#btnCloseStock').onclick = () => drawer.classList.remove('open');
if ($('#searchStock')) $('#searchStock').oninput = (e) => renderStock(e.target.value);
const ETQ = { RECIBIDA: 'En espera', EN_PREPARACION: 'Preparando', LISTA: 'Listo', EN_CAMINO: 'En camino' };
let v = '', R = { cocina: [], repartos: [] }, listos = null, entregados = null; const flash = new Set();
const pintar = () => {
if (!$('#mc')) return;
$('#mc').innerHTML = R.cocina.map(t => `
<div class="mi ${t.estado} ${flash.has(t.id) ? 'flash' : ''}">
<b>#${esc(t.id)} - ${esc(t.tit || t.cliente || 'Pedido')}</b><span>${ETQ[t.estado] || esc(t.estado)}</span>
<small>${esc(t.tipo || 'SALON')}, hace ${hace(t.envio || t.fecha)} ${t.resumen ? '<br>' + esc(t.resumen) : ''}</small>
${t.estado !== 'ENTREGADO' ? `<button class="sec" data-x="${esc(t.id)}" style="grid-column:1/3;padding:.4rem;margin-top:.4rem">Cancelar pedido</button>` : ''}
</div>`).join('') || '<p style="color:var(--tenue)">Sin pedidos en cocina.</p>';
$('#mc').querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
if (!confirm('¿Seguro que querés cancelar este pedido?')) return;
const m = prompt('Motivo de la cancelación:'); if (!m) return;
const r = await api('cancelar_tanda', { id: b.dataset.x, motivo: m, usuario: ses.nombre });
if (r.error) alert('No se pudo cancelar: ' + r.error);
v = ''; cargar();
});
if ($('#mr')) {
$('#mr').innerHTML = R.repartos.map(x => `
<div class="card-rep ${x.estado}">
<b>${esc(x.n || x.nombre)}</b><br>
<span>${x.estado === 'EN_CAMINO' ? 'En camino: #' + esc(x.pedido || x.id_pedido) : 'Libre'}</span><br>
<small style="color:var(--tenue)">${x.ultimo ? 'Última: ' + esc(x.ultimo) : 'Pendiente: ' + pesos(x.pendiente || 0)}</small>
</div>`).join('') || '<p style="color:var(--tenue)">No hay repartidores activos.</p>';
}
};
let rk = '';
const pintarX = () => {
const k = JSON.stringify(R.rendir || []); if (k === rk || !$('#mx')) return; rk = k;
$('#mx').innerHTML = (R.rendir || []).map(x => `
<div class="mi" style="border-color:var(--alerta);margin-bottom:.5rem">
<b>A la espera de rendición</b><span>${pesos(x.esperado)}</span>
<small>${esc(x.repartidor)} entregó a ${esc(x.cliente)}</small>
<input type="number" inputmode="numeric" placeholder="Monto que trae" data-r="${esc(x.id)}">
<button style="padding:.5rem;margin-top:.3rem" data-rb="${esc(x.id)}">Confirmar</button>
</div>`).join('');
$('#mx').querySelectorAll('[data-rb]').forEach(b => b.onclick = async () => {
const r = await api('rendir', { id: b.dataset.rb, monto: $('#mx').querySelector(`[data-r="${b.dataset.rb}"]`).value, usuario: ses.nombre });
if (r.error) { alert(r.error === 'monto_invalido' ? 'Ingresá el monto que trae el repartidor.' : 'No se pudo registrar: ' + r.error); return; }
v = ''; rk = ''; cargar();
});
};
const cargar = async () => {
if (!$('#mc')) return;
const r = await api('cajero_monitor', { v });
if (r.error || r.sin_cambios) return;
v = r.v; R = r; mon.mesas = r.mesas || []; ctl.mesas();
if (r.stock) { stockData = r.stock; renderStock($('#searchStock')?.value || ''); }
const ls = new Set((r.cocina || []).filter(t => t.estado === 'LISTA').map(t => t.id));
if (listos) { const nuevos = [...ls].filter(x => !listos.has(x)); if (nuevos.length) { beep(); nuevos.forEach(x => { flash.add(x); setTimeout(() => { flash.delete(x); pintar(); }, 8000); }); } }
listos = ls;
const ent = (r.repartos || []).reduce((t, x) => t + (x.entregados || 0), 0); if (entregados !== null && ent > entregados) beep(); entregados = ent;
pintar(); pintarX();
};
timers = [setInterval(cargar, 3000), setInterval(pintar, 30000)]; cargar();
if ($('#cerrar')) $('#cerrar').onclick = () => { timers.forEach(clearInterval); cierre(root, ses); };
}
function carga(el, D, ses, mon) {
const S = { tipo: 'SALON', items: {}, manual: false }, $ = q => el.querySelector(q), val = q => ($(q)?.value || '').trim();
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
<div id="car"></div><div class="tt" id="tt"></div><div id="pago"></div><p class="err" id="er"></p><button type="button" id="env">CARGAR PEDIDO</button>
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
const L = Object.values(S.items), sub = L.reduce((s, i) => s + i.p * i.c, 0), des = L.filter(i => (D.cats || []).includes(i.cat)).reduce((s, i) => s + i.p * i.c, 0);
const cli = S.tipo === 'SALON' ? null : (D.clientes || []).find(c => c.n.toUpperCase() === val('#nom').toUpperCase());
const r = cli && (D.reglas || []).find(x => x.nivel === cli.nivel), aplica = r && (r.dias === 'TODOS' || r.dias.split(',').includes(D.dia));
const pct = aplica ? r.pct : 0, gratis = S.tipo === 'DELIVERY' && !!r && r.gratis === 'SI';
const km = S.tipo === 'DELIVERY' ? +val('#km') || 0 : 0;
const envioBase = S.tipo === 'DELIVERY' ? (val('#mon') !== '' ? +val('#mon') || 0 : obtenerPrecioEnvioCalculado(km)) : 0;
const bonificado = S.tipo === 'DELIVERY' && $('#chkBonificado') && $('#chkBonificado').checked;
const envioCliente = (gratis || bonificado) ? 0 : envioBase;
const rd = Math.ceil((sub - des * pct) / 100) * 100;
const ahorroDescuento = sub - rd;
const ahorroEnvio = (gratis || bonificado) ? envioBase : 0;
const totalAhorro = ahorroDescuento + ahorroEnvio;
return { 
sub, pct, gratis, bonificado, km, envioBase, envioCliente, rd, 
total: rd + envioCliente, 
nivel: cli?.nivel, pts: cli?.pts || 0, nuevo: !!val('#nom') && !cli,
ahorro: totalAhorro
};
};
const totales = () => {
const c = calc();
const tc = $('#tarjetaCliente');
if (tc) {
if (S.tipo !== 'SALON' && val('#nom')) {
tc.innerHTML = `<div style="background:#1a232e;border:1px solid #34404f;border-radius:10px;padding:.6rem .8rem;margin-bottom:.6rem;font-size:.9rem">
<p style="margin:.2rem 0"><strong>👤 Cliente:</strong> ${esc(val('#nom'))} ${c.nuevo ? '<span style="color:var(--alerta)">(Nuevo)</span>' : ''}</p>
${!c.nuevo ? `<p style="margin:.2rem 0"><strong>Nivel:</strong> ${esc(c.nivel || 'Sin Nivel')} | <strong>Puntos:</strong> ${c.pts} pts</p>` : ''}
${c.ahorro > 0 ? `<div style="color:var(--exito);font-weight:bold;margin-top:.3rem">🎉 ¡Ahorra ${pesos(c.ahorro)} en este pedido!</div>` : ''}
</div>`;
} else {
tc.innerHTML = '';
}
}
if ($('#tt')) {
$('#tt').innerHTML = `<div><span>Productos</span><span>${pesos(c.sub)}</span></div>
${c.pct ? `<div><span>Descuento ${c.pct * 100}% (redondeado)</span><span>${pesos(c.rd)}</span></div>` : ''}
${S.tipo === 'DELIVERY' ? `
<div>
<span>Envío ${c.km ? '(' + c.km + ' km)' : ''} ${c.gratis ? '<span class="ok">sin cargo</span>' : c.bonificado ? '<span class="ok">bonificado</span>' : ''}</span>
<span>${pesos(c.envioCliente)} ${c.bonificado ? `<small style="color:var(--tenue)">(Repartidor: ${pesos(c.envioBase)})</small>` : ''}</span>
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
const nombreIngresado = val('#nom').toUpperCase();
if (!nombreIngresado) return;
const cli = (D.clientes || []).find(c => c.n.toUpperCase() === nombreIngresado);
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
S.pago = S.tipo === 'SALON' ? null : pagoUI($('#pago')); if (S.tipo === 'SALON') $('#pago').innerHTML = ''; mesas(true);
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
S.items[key] = { key, n: nom, p: pre, c: 1, o: '', cat: 'MANUAL', op: '' };
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
const r = await api('cobrar_mesa', { mesa, usuario: ses.nombre, ...leer() }), e = cm.querySelector('#ec');
if (r.error) { e.textContent = { falta_metodo_pago: 'Elegí el método de pago.', mesa_sin_cuenta: 'Esa mesa ya no tiene cuenta abierta.' }[r.error] || 'No se pudo cobrar: ' + r.error; return; }
cm.innerHTML = `<p class="ok">Mesa ${esc(mesa)} cobrada.${r.vuelto ? ' Vuelto: ' + pesos(r.vuelto) : ''}</p>`; ms = '';
};
};
const buscar = () => {
const q = val('#q').toUpperCase(), f = S.filtro, base = (D.catalogo || []).filter(p => p.disp && (!f || p.t === f));
const L = (q ? base.filter(p => p.n.toUpperCase().includes(q) || p.cat.includes(q)) : f ? base : (D.catalogo || []).filter(p => p.disp)).slice(0, 15);
if (!$('#res')) return;
$('#res').innerHTML = L.map(p => {
const infoStock = (D.stock && D.stock[p.n.toUpperCase()]) ? D.stock[p.n.toUpperCase()].stock : null;
const tieneStock = infoStock !== null;
const stockTxt = tieneStock ? `${infoStock} un.` : 'N/D';
const estiloStock = tieneStock && infoStock <= 3 ? 'background:var(--alerta);color:#06121d' : 'background:#2d3846;color:var(--exito)';
return `<button type="button" class="sec" data-n="${esc(p.n)}">
<span>${esc(p.n)} <small>${esc(p.cat)}</small><span class="lbl-stock-cat" style="${estiloStock}">${stockTxt}</span></span>
<span>${pesos(p.p)}</span>
</button>`;
}).join('');
$('#res').querySelectorAll('button').forEach(b => b.onclick = () => {
const p = (D.catalogo || []).find(x => x.n === b.dataset.n);
let opElegida = '';
if (p.ops && p.ops.length > 0) {
let txt = p.ops.map((o, idx) => `${idx + 1}. ${o}`).join('\n'); let sel = prompt(`Elegí la opción de bebida para ${p.n}:\n${txt}`, "1");
let idx = parseInt(sel) - 1;
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
el.querySelectorAll('[data-f]').forEach(x => x.className = x.dataset.f === S.filtro ? 'on' : 'sec'); buscar();
});
if ($('#env')) {
$('#env').onclick = async () => {
const err = $('#er'); if (err) { err.className = 'err'; err.textContent = ''; }
if (S.tipo === 'DELIVERY' && val('#tel').replace(/\D/g, '').length !== 10) { if (err) err.textContent = 'El teléfono tiene que tener 10 dígitos: código de área y número, sin 0 ni 15 (ej. 3794123456).'; return; }
const c = calc();

// Preparación completa de datos puros desde la carga antes del envío y reset
const itemsParaTicket = Object.values(S.items).map(i => ({ n: i.n, c: i.c, p: i.p, o: i.o, op: i.op }));
const datosTicket = {
  tipo: S.tipo,
  mesa: val('#mesa'),
  cliente: val('#nom') || 'Cliente General',
  nivel_cliente: c.nivel || 'Cliente',
  direccion: val('#dir') || (S.tipo === 'SALON' ? 'Mesa ' + (val('#mesa') || '') : 'Retiro en local'),
  items: itemsParaTicket,
  subtotal: c.sub,
  envio: c.envioCliente,
  total: c.total,
  ahorro: c.ahorro
};

const r = await api('crear_pedido', { 
tipo: S.tipo, 
mesa: val('#mesa'), 
cliente: val('#nom'), 
telefono: val('#tel'), 
direccion: val('#dir'), 
km: c.km,
envio: c.envioBase,
envioBonificado: c.bonificado,
items: Object.values(S.items).map(i => ({ n: i.n, c: i.c, o: i.o, op: i.op })), 
usuario: ses.nombre, 
...(S.pago ? S.pago() : {}) 
});
if (r.error) { if (err) err.textContent = { pedido_vacio: 'Agregá al menos un producto.', faltan_datos: 'Completá la mesa o el nombre del cliente.', faltan_datos_de_envio: 'Para delivery cargá teléfono y dirección.', falta_metodo_pago: 'Elegí el método de pago.', telefono_invalido: 'El teléfono tiene que tener 10 dígitos, sin 0 ni 15.' }[r.error] || 'No se pudo enviar: ' + r.error; return; }

// Notificación/Confirmación inmediata para imprimir ticket
if (confirm('¿Deseás imprimir el ticket de compra?')) {
  imprimirTicketDirecto(datosTicket);
}

resetFormulario();
if (err) {
err.className = 'ok';
err.textContent = `Pedido ${r.id_cuenta} registrado${r.tanda ? ' y enviado a cocina (tanda ' + r.tanda + ')' : ' (solo bebidas: no pasa por cocina)'}.${r.vuelto ? ' Vuelto: ' + pesos(r.vuelto) : ''}`;
}
};
}
tipo('SALON'); lineas();
return { mesas, cobrarMesa };
}
async function cierre(root, ses) {
root.innerHTML = `<style>${CSS}${CSS2}</style><div class="cj"><div class="cl"><h1>Cerrar ventas</h1><p>Leyendo la jornada…</p></div></div>`;
const C = await api('cierre_datos'), box = root.querySelector('.cl'), q = x => box.querySelectorAll(x);
const volver = () => { if (box.querySelector('#vol')) box.querySelector('#vol').onclick = () => panel(root, ses); };
if (C.error) { box.innerHTML = '<h1>Cerrar ventas</h1><p class="err">No se pudo leer la jornada.</p><button id="vol">Volver a la caja</button>'; volver(); return; }
if (C.bloqueos && C.bloqueos.length) { box.innerHTML = `<h1>Todavía no se puede cerrar</h1><ul>${C.bloqueos.map(b => `<li>${esc(b)}</li>`).join('')}</ul><button id="vol">Volver a la caja</button>`; volver(); return; }
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
const gastos = [...q('#gs .gr')].map(r => { const [c, m] = r.querySelectorAll('input'); return { concepto: c.value.trim(), monto: +m.value || 0 }; });
return { bil, gastos, contado: DEN.reduce((t, d) => t + d * (bil[d] || 0), 0), gm: gastos.filter(g => g.concepto && g.monto > 0).reduce((t, g) => t + g.monto, 0) + (+box.querySelector('#ps')?.value || 0) };
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
q('[data-d],#tr,#ps').forEach(i => i.oninput = bal); mas(); bal();
if (box.querySelector('#cer')) {
box.querySelector('#cer').onclick = () => {
if (box.querySelector('#acc')) {
box.querySelector('#acc').innerHTML = '<p><b>¿Estás seguro que querés cerrar?</b></p><div class="tp" style="grid-template-columns:1fr 1fr"><button type="button" id="si">Sí</button><button type="button" class="sec" id="no">No</button></div>';
if (box.querySelector('#no')) box.querySelector('#no').onclick = () => cierre(root, ses);
if (box.querySelector('#si')) {
box.querySelector('#si').onclick = async () => {
const L = leer(), r = await api('cerrar_jornada', { nombre: ses.nombre, billetes: L.bil, gastos: L.gastos, transferencias: +box.querySelector('#tr')?.value || 0, pagoSocio: +box.querySelector('#ps')?.value || 0 });
if (r.error) { alert(r.error === 'hay_pendientes' ? 'Apareció algo pendiente: revisá la caja antes de cerrar.' : 'No se pudo cerrar: ' + r.error); return cierre(root, ses); }
box.innerHTML = `<h1>Jornada cerrada</h1><div class="tt"><div><span>Efectivo esperado</span><span>${pesos(r.esperado)}</span></div><div><span>Efectivo contado</span><span>${pesos(r.contado)}</span></div><div class="g"><span>Diferencia</span><span>${pesos(r.diferencia)}</span></div></div><button type="button" id="fin">Listo</button>`;
if (box.querySelector('#fin')) box.querySelector('#fin').onclick = () => { sessionStorage.removeItem('cajero'); login(root); };
};
}
}
};
}
}
