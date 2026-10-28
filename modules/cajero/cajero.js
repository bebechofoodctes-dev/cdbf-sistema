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
.pn h2{margin:0 0 .5rem;font-size:1.1rem}.pn p{color:var(--tenue)}
@media(max-width:900px){.pn{grid-template-columns:1fr;grid-template-rows:none;height:auto}.pn section:first-child{grid-row:auto}}`;

let ctx, timers = [];
function beep() {
  try { ctx ??= new AudioContext(); ctx.resume(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .2; o.start(); o.stop(ctx.currentTime + .25); } catch { /* sin audio */ }
}
const hace = x => Math.max(0, (Date.now() - new Date(String(x).replace(' ', 'T'))) / 60000 | 0) + ' min';

// Controles de pago: efectivo (con "paga con"), transferencia o mixto. Devuelve una función que lee lo elegido.
function pagoUI(box) {
  box.innerHTML = '<h2>Método de pago</h2><div class="tp"><button data-p="EFECTIVO">Efectivo</button><button data-p="TRANSFERENCIA">Transferencia</button><button data-p="MIXTO">Mixto</button></div><div id="px"></div>';
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

const CSS2 = `
.mi{display:grid;grid-template-columns:1fr auto;gap:.1rem .6rem;padding:.5rem .6rem;margin-bottom:.4rem;border-radius:10px;background:#2a3340;border-left:5px solid #f0b13c}.mi.EN_PREPARACION,.mi.EN_CAMINO{border-color:#4da3e0}.mi.LISTA,.mi.LIBRE{border-color:#56c48f}.mi small{grid-column:1/3;color:#93a1b3}.flash{animation:fl 1s 8}@keyframes fl{50%{background:#2f6b4f}}
.tp{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:.8rem}.cj button.sec{background:#2d3846;color:var(--txt)}.cj button.on{background:var(--acento);color:#06121d}
.fl{display:grid;gap:.5rem;margin-bottom:.8rem}.bd{display:inline-block;padding:.1rem .6rem;border-radius:99px;background:#2d3846;font-size:.9rem}
.rs button{display:flex;justify-content:space-between;width:100%;margin:.25rem 0;text-align:left;font-weight:500}
.ln{display:grid;grid-template-columns:1fr auto;gap:.3rem .6rem;padding:.6rem 0;border-bottom:1px solid #2a3340}.ln .q{display:flex;gap:.4rem;align-items:center}.ln .q button{width:2.4rem;padding:.4rem}
.tt{margin:.8rem 0}.tt div{display:flex;justify-content:space-between}.tt .g{font-size:1.4rem;font-weight:800}.ok{color:#56c48f}`;

async function panel(root, ses) {
  timers.forEach(clearInterval); timers = [];
  root.innerHTML = `<style>${CSS}${CSS2}</style><div class="cj"><div class="ch"><span>Hola ${esc(ses.nombre)}, excelente jornada para hoy!</span><button class="sec" id="cerrar" style="width:auto;padding:.5rem 1rem">Cerrar ventas</button></div>
    <div class="pn"><section id="carga"><h2>Carga de pedidos</h2><p>Leyendo catálogo y clientes…</p></section>
    <section><h2>Cocina</h2><div id="mc"></div></section><section><h2>Repartidores</h2><div id="mx"></div><div id="mr"></div></section></div></div>`;
  const D = await api('datos_cajero'), el = root.querySelector('#carga'), mon = { mesas: [] }, $ = q => root.querySelector(q);
  let ctl = { mesas() {} };
  if (D.error) el.innerHTML = `<h2>Carga de pedidos</h2><p class="err">No se pudo leer la planilla (${esc(D.error)}).</p>`; else ctl = carga(el, D, ses, mon);

  const ETQ = { RECIBIDA: 'En espera', EN_PREPARACION: 'Preparando', LISTA: 'Listo' };
  let v = '', R = { cocina: [], repartos: [] }, listos = null, entregados = null; const flash = new Set();
  const pintar = () => {
    if (!$('#mc')) return;
    $('#mc').innerHTML = R.cocina.map(t => `<div class="mi ${t.estado} ${flash.has(t.id) ? 'flash' : ''}"><b>${esc(t.tit)}</b><span>${ETQ[t.estado]}</span><small>${esc(t.tipo.toLowerCase())}, hace ${hace(t.envio)}</small>${t.estado === 'RECIBIDA' ? `<button class="sec" data-x="${esc(t.id)}" style="grid-column:1/3;padding:.4rem">Cancelar pedido</button>` : ''}</div>`).join('') || '<p>Sin pedidos en cocina.</p>';
    $('#mc').querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
      const m = prompt('Motivo de la cancelación:'); if (!m) return;
      const r = await api('cancelar_tanda', { id: b.dataset.x, motivo: m, usuario: ses.nombre });
      if (r.error) alert(r.error === 'ya_en_preparacion' ? 'Cocina ya empezó ese pedido: no se puede cancelar.' : 'No se pudo cancelar: ' + r.error);
      v = ''; cargar();
    });
    $('#mr').innerHTML = R.repartos.map(x => `<div class="mi ${x.estado}"><b>${esc(x.n)}</b><span>${x.estado === 'EN_CAMINO' ? 'En camino: ' + esc(x.pedido) : 'Libre'}</span><small>${x.ultimo ? 'Última entrega: ' + esc(x.ultimo) : 'Sin entregas todavía'}</small></div>`).join('') || '<p>No hay repartidores activos.</p>';
  };
  let rk = '';
  const pintarX = () => {
    const k = JSON.stringify(R.rendir || []); if (k === rk || !$('#mx')) return; rk = k;
    $('#mx').innerHTML = (R.rendir || []).map(x => `<div class="mi" style="border-color:#f0b13c"><b>A la espera de rendición de dinero</b><span>${pesos(x.esperado)}</span>
      <small>${esc(x.repartidor)} entregó a ${esc(x.cliente)}</small><input type="number" inputmode="numeric" placeholder="Monto que trae" data-r="${esc(x.id)}"><button style="padding:.5rem" data-rb="${esc(x.id)}">Confirmar</button></div>`).join('');
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
    v = r.v; R = r; mon.mesas = r.mesas; ctl.mesas();
    const ls = new Set(r.cocina.filter(t => t.estado === 'LISTA').map(t => t.id));
    if (listos) { const nuevos = [...ls].filter(x => !listos.has(x)); if (nuevos.length) { beep(); nuevos.forEach(x => { flash.add(x); setTimeout(() => { flash.delete(x); pintar(); }, 8000); }); } }
    listos = ls;
    const ent = r.repartos.reduce((t, x) => t + x.entregados, 0); if (entregados !== null && ent > entregados) beep(); entregados = ent;
    pintar(); pintarX();
  };
  timers = [setInterval(cargar, 3000), setInterval(pintar, 30000)]; cargar();
  $('#cerrar').onclick = () => { timers.forEach(clearInterval); cierre(root, ses); };
}

function carga(el, D, ses, mon) {
  const S = { tipo: 'SALON', items: {} }, $ = q => el.querySelector(q), val = q => ($(q)?.value || '').trim();
  const NOMBRES = { SALON: 'Salón', RETIRO: 'Retiro', DELIVERY: 'Delivery' };
  el.innerHTML = `<h2>Carga de pedidos</h2><div class="tp">${Object.keys(NOMBRES).map(t => `<button data-t="${t}">${NOMBRES[t]}</button>`).join('')}</div>
    <div id="mesas"></div><div class="fl" id="dat"></div><div class="tp"><button class="sec" data-f="COMIDA">Comidas</button><button class="sec" data-f="BEBIDA">Bebidas</button><button class="sec" data-f="COMBO">Combos</button></div><input id="q" placeholder="Buscar producto…" autocomplete="off"><div class="rs" id="res"></div>
    <div id="car"></div><div class="tt" id="tt"></div><div id="pago"></div><p class="err" id="er"></p><button id="env">CARGAR PEDIDO</button>
    <datalist id="cl">${D.clientes.map(c => `<option value="${esc(c.n)}">`).join('')}</datalist>`;

  const calc = () => {
    const L = Object.values(S.items), sub = L.reduce((s, i) => s + i.p * i.c, 0), des = L.filter(i => D.cats.includes(i.cat)).reduce((s, i) => s + i.p * i.c, 0);
    const cli = S.tipo === 'SALON' ? null : D.clientes.find(c => c.n.toUpperCase() === val('#nom').toUpperCase());
    const r = cli && D.reglas.find(x => x.nivel === cli.nivel), aplica = r && (r.dias === 'TODOS' || r.dias.split(',').includes(D.dia));
    const pct = aplica ? r.pct : 0, gratis = S.tipo === 'DELIVERY' && !!r && r.gratis === 'SI', env = S.tipo === 'DELIVERY' ? +val('#mon') || 0 : 0;
    const rd = Math.ceil((sub - des * pct) / 100) * 100;
    return { sub, pct, gratis, env, rd, total: rd + (gratis ? 0 : env), nivel: cli?.nivel, nuevo: !!val('#nom') && !cli };
  };
  const totales = () => {
    const c = calc(), n = $('#niv');
    if (n) n.textContent = c.nuevo ? 'Cliente nuevo (sin nivel)' : c.nivel ? 'Nivel ' + c.nivel : '';
    $('#tt').innerHTML = `<div><span>Productos</span><span>${pesos(c.sub)}</span></div>
      ${c.pct ? `<div><span>Descuento ${c.pct * 100}% (redondeado)</span><span>${pesos(c.rd)}</span></div>` : ''}
      ${S.tipo === 'DELIVERY' ? `<div><span>Envío ${c.gratis ? '<span class="ok">sin cargo</span>' : ''}</span><span>${pesos(c.gratis ? 0 : c.env)}</span></div>` : ''}
      <div class="g"><span>Total</span><span>${pesos(c.total)}</span></div>`;
  };
  const lineas = () => {
    $('#car').innerHTML = Object.values(S.items).map(i => `<div class="ln"><b>${esc(i.n)}</b><div class="q"><button class="sec" data-m="${esc(i.n)}">-</button>${i.c}<button class="sec" data-p="${esc(i.n)}">+</button></div>
      <input data-o="${esc(i.n)}" placeholder="Nota para cocina" value="${esc(i.o)}"><span>${pesos(i.p * i.c)}</span></div>`).join('');
    $('#car').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const i = S.items[b.dataset.m]; if (--i.c <= 0) delete S.items[i.n]; lineas(); });
    $('#car').querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.items[b.dataset.p].c++; lineas(); });
    $('#car').querySelectorAll('[data-o]').forEach(b => b.oninput = () => S.items[b.dataset.o].o = b.value);
    totales();
  };
  const datos = () => {
    $('#dat').innerHTML = S.tipo === 'SALON' ? '<input id="mesa" placeholder="Mesa N°" inputmode="numeric">'
      : `<input id="nom" list="cl" placeholder="Nombre y apellido del cliente" autocomplete="off"><span class="bd" id="niv"></span>
         ${S.tipo === 'DELIVERY' ? '<input id="tel" placeholder="WhatsApp: código de área y número, sin 0 ni 15 (ej. 3794123456)" inputmode="numeric" maxlength="14"><input id="dir" placeholder="Dirección o link de Google Maps"><input id="mon" type="number" min="0" placeholder="Monto del envío" inputmode="numeric">' : ''}`;
    $('#dat').querySelectorAll('input').forEach(i => i.oninput = totales); totales();
    S.pago = S.tipo === 'SALON' ? null : pagoUI($('#pago')); if (S.tipo === 'SALON') $('#pago').innerHTML = ''; mesas(true);
  };
  const tipo = t => { S.tipo = t; el.querySelectorAll('[data-t]').forEach(b => b.className = b.dataset.t === t ? 'on' : 'sec'); datos(); };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => tipo(b.dataset.t));

  let ms = '';
  const mesas = forzar => {
    const box = $('#mesas'), k = S.tipo + JSON.stringify(mon.mesas); if (!box || (!forzar && k === ms)) return; ms = k;
    box.innerHTML = S.tipo === 'SALON' && mon.mesas.length ? '<h2>Mesas abiertas</h2>' + mon.mesas.map(m => `<button class="sec" data-ms="${esc(m.mesa)}" data-tot="${m.total}">Cobrar mesa ${esc(m.mesa)}: ${pesos(m.total)}</button>`).join('') + '<div id="cm"></div>' : '';
    box.querySelectorAll('[data-ms]').forEach(b => b.onclick = () => cobrarMesa(b.dataset.ms, +b.dataset.tot));
  };
  const cobrarMesa = (mesa, total) => {
    const cm = $('#cm'); cm.innerHTML = `<h2>Cobrar mesa ${esc(mesa)}: ${pesos(total)}</h2><div id="pg"></div><p class="err" id="ec"></p><button id="okc">Confirmar cobro</button>`;
    const leer = pagoUI(cm.querySelector('#pg'));
    cm.querySelector('#okc').onclick = async () => {
      const r = await api('cobrar_mesa', { mesa, usuario: ses.nombre, ...leer() }), e = cm.querySelector('#ec');
      if (r.error) { e.textContent = { falta_metodo_pago: 'Elegí el método de pago.', mesa_sin_cuenta: 'Esa mesa ya no tiene cuenta abierta.' }[r.error] || 'No se pudo cobrar: ' + r.error; return; }
      cm.innerHTML = `<p class="ok">Mesa ${esc(mesa)} cobrada.${r.vuelto ? ' Vuelto: ' + pesos(r.vuelto) : ''}</p>`; ms = '';
    };
  };

  const buscar = () => {
    const q = val('#q').toUpperCase(), f = S.filtro, base = D.catalogo.filter(p => p.disp && (!f || p.t === f));
    const L = (q ? base.filter(p => p.n.toUpperCase().includes(q) || p.cat.includes(q)) : f ? base : []).slice(0, 12);
    $('#res').innerHTML = L.map(p => `<button class="sec" data-n="${esc(p.n)}"><span>${esc(p.n)} <small>${esc(p.cat)}</small></span><span>${pesos(p.p)}</span></button>`).join('');
    $('#res').querySelectorAll('button').forEach(b => b.onclick = () => {
      const p = D.catalogo.find(x => x.n === b.dataset.n); (S.items[p.n] ??= { ...p, c: 0, o: '' }).c++;
      $('#q').value = ''; $('#res').innerHTML = ''; lineas();
    });
  };
  $('#q').oninput = buscar;
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
    S.filtro = S.filtro === b.dataset.f ? '' : b.dataset.f;
    el.querySelectorAll('[data-f]').forEach(x => x.className = x.dataset.f === S.filtro ? 'on' : 'sec'); buscar();
  });

  $('#env').onclick = async () => {
    const err = $('#er'); err.className = 'err'; err.textContent = '';
    if (S.tipo === 'DELIVERY' && val('#tel').replace(/\D/g, '').length !== 10) { err.textContent = 'El teléfono tiene que tener 10 dígitos: código de área y número, sin 0 ni 15 (ej. 3794123456).'; return; }
    const r = await api('crear_pedido', { tipo: S.tipo, mesa: val('#mesa'), cliente: val('#nom'), telefono: val('#tel'), direccion: val('#dir'), envio: val('#mon'),
      items: Object.values(S.items).map(i => ({ n: i.n, c: i.c, o: i.o })), usuario: ses.nombre, ...(S.pago ? S.pago() : {}) });
    if (r.error) { err.textContent = { pedido_vacio: 'Agregá al menos un producto.', faltan_datos: 'Completá la mesa o el nombre del cliente.', faltan_datos_de_envio: 'Para delivery cargá teléfono y dirección.', falta_metodo_pago: 'Elegí el método de pago.', telefono_invalido: 'El teléfono tiene que tener 10 dígitos, sin 0 ni 15.' }[r.error] || 'No se pudo enviar: ' + r.error; return; }
    S.items = {}; datos(); lineas();
    err.className = 'ok'; err.textContent = `Pedido ${r.id_cuenta} registrado${r.tanda ? ' y enviado a cocina (tanda ' + r.tanda + ')' : ' (solo bebidas: no pasa por cocina)'}.${r.vuelto ? ' Vuelto: ' + pesos(r.vuelto) : ''}`;
  };
  tipo('SALON'); lineas();
  return { mesas };
}

async function cierre(root, ses) {
  root.innerHTML = `<style>${CSS}${CSS2}</style><div class="cj"><div class="cl"><h1>Cerrar ventas</h1><p>Leyendo la jornada…</p></div></div>`;
  const C = await api('cierre_datos'), box = root.querySelector('.cl'), q = x => box.querySelectorAll(x);
  const volver = () => { box.querySelector('#vol').onclick = () => panel(root, ses); };
  if (C.error) { box.innerHTML = '<h1>Cerrar ventas</h1><p class="err">No se pudo leer la jornada.</p><button id="vol">Volver a la caja</button>'; volver(); return; }
  if (C.bloqueos.length) { box.innerHTML = `<h1>Todavía no se puede cerrar</h1><ul>${C.bloqueos.map(b => `<li>${esc(b)}</li>`).join('')}</ul><button id="vol">Volver a la caja</button>`; volver(); return; }
  const pagos = C.pagos.reduce((t, x) => t + x.monto, 0);
  box.innerHTML = `<h1>Cerrar ventas</h1><label>Efectivo contado: cantidad de billetes</label><div class="gr">${DEN.map(d => `<div><b>${pesos(d)}</b><input type="number" min="0" inputmode="numeric" data-d="${d}" placeholder="0"></div>`).join('')}</div>
    <label>Transferencias recibidas</label><input id="tr" type="number" inputmode="numeric" placeholder="Total de transferencias">
    <label>Gastos</label><div id="gs"></div><button class="sec" id="mg" style="margin-top:.5rem">Agregar gasto</button>
    ${C.pagos.length ? `<label>Pagos a repartidores (salen de la caja)</label>${C.pagos.map(x => `<div class="tot" style="margin:.2rem 0"><span>${esc(x.n)}</span><span>${pesos(x.monto)}</span></div>`).join('')}` : ''}
    ${C.socio ? `<label>Corresponde al socio de bebidas hoy: <b>${pesos(C.socio)}</b></label><input id="ps" type="number" inputmode="numeric" placeholder="Pago al socio en efectivo (opcional)">` : '<input id="ps" type="hidden" value="0">'}
    <div id="bal" class="tt"></div><p class="err"></p><div id="acc"><button id="cer">Cerrar ventas</button><button class="sec" id="vol" style="margin-top:.6rem">Volver a la caja</button></div>`;
  volver();
  const leer = () => {
    const bil = {}; q('[data-d]').forEach(i => bil[i.dataset.d] = +i.value || 0);
    const gastos = [...q('#gs .gr')].map(r => { const [c, m] = r.querySelectorAll('input'); return { concepto: c.value.trim(), monto: +m.value || 0 }; });
    return { bil, gastos, contado: DEN.reduce((t, d) => t + d * (bil[d] || 0), 0), gm: gastos.filter(g => g.concepto && g.monto > 0).reduce((t, g) => t + g.monto, 0) + (+box.querySelector('#ps').value || 0) };
  };
  const bal = () => {
    const L = leer(), esp = C.apertura + C.efvo + C.rendido - C.gastos - L.gm - pagos, dif = L.contado - esp, dt = (+box.querySelector('#tr').value || 0) - C.transf;
    const txt = x => x === 0 ? 'cuadra' : (x > 0 ? 'sobran ' : 'faltan ') + pesos(Math.abs(x));
    box.querySelector('#bal').innerHTML = `<div><span>Efectivo esperado</span><span>${pesos(esp)}</span></div><div><span>Efectivo contado</span><span>${pesos(L.contado)}</span></div>
      <div class="g"><span>Efectivo</span><span class="${dif === 0 ? 'ok' : ''}">${txt(dif)}</span></div><div><span>Transferencias en el sistema</span><span>${pesos(C.transf)}</span></div><div><span>Transferencias declaradas</span><span class="${dt === 0 ? 'ok' : ''}">${txt(dt)}</span></div>`;
  };
  const mas = () => { box.querySelector('#gs').insertAdjacentHTML('beforeend', '<div class="gr" style="margin-top:.4rem"><input placeholder="Concepto"><input type="number" inputmode="numeric" placeholder="Monto"></div>'); box.querySelectorAll('#gs input').forEach(i => i.oninput = bal); };
  box.querySelector('#mg').onclick = mas; q('[data-d],#tr,#ps').forEach(i => i.oninput = bal); mas(); bal();
  box.querySelector('#cer').onclick = () => {
    box.querySelector('#acc').innerHTML = '<p><b>¿Estás seguro que querés cerrar?</b></p><div class="tp" style="grid-template-columns:1fr 1fr"><button id="si">Sí</button><button class="sec" id="no">No</button></div>';
    box.querySelector('#no').onclick = () => cierre(root, ses);
    box.querySelector('#si').onclick = async () => {
      const L = leer(), r = await api('cerrar_jornada', { nombre: ses.nombre, billetes: L.bil, gastos: L.gastos, transferencias: +box.querySelector('#tr').value || 0, pagoSocio: +box.querySelector('#ps').value || 0 });
      if (r.error) { alert(r.error === 'hay_pendientes' ? 'Apareció algo pendiente: revisá la caja antes de cerrar.' : 'No se pudo cerrar: ' + r.error); return cierre(root, ses); }
      box.innerHTML = `<h1>Jornada cerrada</h1><div class="tt"><div><span>Efectivo esperado</span><span>${pesos(r.esperado)}</span></div><div><span>Efectivo contado</span><span>${pesos(r.contado)}</span></div><div class="g"><span>Diferencia</span><span>${pesos(r.diferencia)}</span></div></div><button id="fin">Listo</button>`;
      box.querySelector('#fin').onclick = () => { sessionStorage.removeItem('cajero'); login(root); };
    };
  };
}
