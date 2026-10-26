import { api } from '../../core/api.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const NOMBRE = { SALON: 'Salón', RETIRO: 'Retiro', DELIVERY: 'Delivery' };
const CSS = `
.ad{--card:#202833;--txt:#e9eef4;--tenue:#93a1b3;--acento:#4da3e0;--ok:#56c48f;--aviso:#f0b13c;max-width:70rem;margin:0 auto;padding:1rem;color:var(--txt);font:16px/1.4 system-ui,sans-serif}
.ad h1{margin:.2rem 0 1rem}.ad h2{font-size:1.05rem;color:var(--tenue);margin:0 0 .6rem}.ad button,.ad input,.ad select{font:inherit;border-radius:10px;border:2px solid #34404f;background:#10151c;color:var(--txt);padding:.6rem .8rem}
.ad button{background:var(--acento);color:#06121d;font-weight:700;border:0;cursor:pointer}.ad button.sec{background:#2d3846;color:var(--txt)}.ad .pin{max-width:22rem;margin:12vh auto;text-align:center}.ad .pin input{width:100%;margin:.8rem 0;text-align:center;font-size:1.6rem;letter-spacing:.4rem}
.ad .bar{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem;align-items:end}.ad .bar label{display:block;color:var(--tenue);font-size:.85rem}.ad .err{color:var(--aviso)}
.ad .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.6rem;margin-bottom:1rem}.ad .kpi,.ad .box{background:var(--card);border-radius:12px;padding:.9rem}.ad .kpi b{display:block;font-size:1.5rem}.ad .kpi span{color:var(--tenue)}
.ad .gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:.8rem}.ad .row{display:grid;grid-template-columns:9rem 1fr auto;gap:.5rem;align-items:center;margin:.3rem 0}.ad .row i{display:block;height:.9rem;border-radius:6px;background:var(--acento)}
.ad .dias{display:flex;align-items:flex-end;gap:.25rem;height:10rem;overflow-x:auto}.ad .dias div{flex:1;min-width:1.6rem;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;font-size:.7rem;color:var(--tenue)}.ad .dias i{display:block;width:100%;background:var(--ok);border-radius:4px 4px 0 0}
.ad table{width:100%;border-collapse:collapse}.ad td,.ad th{padding:.4rem .3rem;text-align:right;border-bottom:1px solid #2a3340}.ad td:first-child,.ad th:first-child{text-align:left}.ad .off{opacity:.5}
@media print{body{background:#fff!important}#main-nav,.np{display:none!important}.ad{--card:#fff;--txt:#000;--tenue:#444;color:#000}.ad .kpi,.ad .box{border:1px solid #ccc}}`;

export function mount(root) {
  sessionStorage.getItem('admin_t') ? tablero(root) : login(root);
}

function login(root, aviso = '') {
  root.innerHTML = `<style>${CSS}</style><div class="ad"><div class="pin"><h1>Admin</h1><p style="color:var(--tenue)">Ingresá tu PIN</p>
    <input id="pin" type="password" inputmode="numeric" autocomplete="off"><p class="err">${esc(aviso)}</p><button id="ok" style="width:100%">Entrar</button></div></div>`;
  const entrar = async () => {
    const r = await api('admin_login', { pin: root.querySelector('#pin').value });
    if (r.ok) { sessionStorage.setItem('admin_t', r.token); return tablero(root); }
    login(root, { pin_incorrecto: 'PIN incorrecto.', bloqueado: 'Demasiados intentos. Esperá 5 minutos.', pin_no_configurado: 'Todavía no definiste el PIN (función definirPin en Apps Script).' }[r.error] || 'No se pudo conectar.');
  };
  root.querySelector('#ok').onclick = entrar; root.querySelector('#pin').onkeydown = e => e.key === 'Enter' && entrar();
}

function tablero(root) {
  const token = sessionStorage.getItem('admin_t'), hoy = new Date(), iso = d => d.toISOString().slice(0, 10);
  const salir = () => { sessionStorage.removeItem('admin_t'); login(root); };
  root.innerHTML = `<style>${CSS}</style><div class="ad"><div class="bar np"><h1 style="margin:0;flex:1">Admin</h1><button class="sec" id="t1">Reportes</button><button class="sec" id="t2">Catálogo</button><button class="sec" id="t3">Puntos extra</button><button class="sec" id="t4">Repartidores hoy</button><button class="sec" id="t5">Planillas</button><button class="sec" id="t6">Seguridad</button><button class="sec" id="out">Salir</button></div><div id="vista"></div></div>`;
  const $ = q => root.querySelector(q), vista = $('#vista');
  $('#out').onclick = salir; $('#t1').onclick = () => reportes(); $('#t2').onclick = catalogo; $('#t3').onclick = puntos; $('#t4').onclick = repartidores; $('#t5').onclick = planillas; $('#t6').onclick = seguridad;

  const barras = (L, fmt) => { const mx = Math.max(1, ...L.map(x => x.m)); return L.map(x => `<div class="row"><span>${esc(x.n)}</span><i style="width:${Math.max(2, x.m / mx * 100)}%"></i><b>${fmt(x.m)}</b></div>`).join('') || '<p style="color:var(--tenue)">Sin datos en este período.</p>'; };

  async function reportes(f = { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy), tipo: '', producto: '' }, lista = []) {
    vista.innerHTML = '<p>Calculando…</p>';
    const r = await api('admin_datos', { token, ...f });
    if (r.error === 'no_autorizado') return salir();
    if (r.error) { vista.innerHTML = `<p class="err">No se pudo leer Operacion (${esc(r.error)}).</p>`; return; }
    lista = lista.length ? lista : r.lista; const T = r.totales, mx = Math.max(1, ...r.dias.map(d => d.m));
    vista.innerHTML = `<div class="bar"><div><label>Desde</label><input type="date" id="d" value="${f.desde}"></div><div><label>Hasta</label><input type="date" id="h" value="${f.hasta}"></div>
      <div><label>Tipo de entrega</label><select id="t"><option value="">Todos</option>${Object.keys(NOMBRE).map(k => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${NOMBRE[k]}</option>`).join('')}</select></div>
      <div><label>Producto</label><select id="p"><option value="">Todos</option>${lista.map(x => `<option ${f.producto === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div><button id="go">Actualizar</button><button class="sec np" id="pdf">Descargar PDF</button><button class="sec np" id="mail">Enviar por correo</button><span id="msg" class="np"></span></div>
      <div class="kpis"><div class="kpi"><span>Ventas</span><b>${pesos(T.ventas)}</b></div><div class="kpi"><span>Pedidos</span><b>${T.pedidos}</b></div><div class="kpi"><span>Ticket promedio</span><b>${pesos(T.ticket)}</b></div>
      <div class="kpi"><span>Efectivo / transferencia</span><b>${pesos(T.efectivo)} / ${pesos(T.transferencia)}</b></div><div class="kpi"><span>Envíos sin cargo</span><b>${T.sinCargo}</b><span>${pesos(T.sinCargoMonto)} desde la caja</span></div></div>
      <div class="gr"><div class="box"><h2>Ventas por día</h2><div class="dias">${r.dias.map(d => `<div title="${d.f}: ${pesos(d.m)}"><i style="height:${Math.max(2, d.m / mx * 100)}%"></i>${d.f.slice(8)}/${d.f.slice(5, 7)}</div>`).join('') || '<p style="color:var(--tenue)">Sin datos.</p>'}</div></div>
      <div class="box"><h2>Ventas por tipo de entrega</h2>${barras(r.tipos.map(x => ({ n: NOMBRE[x.n] || x.n, m: x.m })), pesos)}</div>
      <div class="box"><h2>Productos más vendidos</h2>${barras(r.productos.map(x => ({ n: x.n, m: x.cant })), x => x + ' u.')}</div>
      <div class="box"><h2>Tiempos promedio</h2><div class="row"><span>Espera en cocina</span><i style="width:${Math.min(100, r.tiempos.espera * 3)}%"></i><b>${r.tiempos.espera} min</b></div><div class="row"><span>Preparación</span><i style="width:${Math.min(100, r.tiempos.prep * 3)}%"></i><b>${r.tiempos.prep} min</b></div><div class="row"><span>Reparto</span><i style="width:${Math.min(100, r.tiempos.reparto * 3)}%"></i><b>${r.tiempos.reparto} min</b></div></div></div>
      <div class="box" style="margin-top:.8rem;overflow-x:auto"><h2>Repartidores (en el período, sin filtrar por tipo ni producto)</h2><table><tr><th>Nombre</th><th>Envíos</th><th>Sin cargo</th><th>Básico</th><th>Total pagado</th><th>Dif. rendiciones</th></tr>
      ${r.repartidores.map(x => `<tr><td>${esc(x.n)}</td><td>${x.envios}</td><td>${x.sc}</td><td>${pesos(x.basico)}</td><td>${pesos(x.total)}</td><td>${pesos(x.dif)}</td></tr>`).join('') || '<tr><td colspan="6">Sin datos.</td></tr>'}</table></div>`;
    const filtros = () => ({ desde: $('#d').value, hasta: $('#h').value, tipo: $('#t').value, producto: $('#p').value });
    $('#go').onclick = () => reportes(filtros(), lista);
    $('#pdf').onclick = () => window.print();
    $('#mail').onclick = async () => {
      $('#msg').textContent = 'Enviando…'; const x = await api('admin_enviar_reporte', { token, ...filtros() });
      $('#msg').textContent = x.ok ? 'Reporte enviado a ' + x.enviados + ' correo(s).' : ({ sin_correos: 'Cargá los correos en config (correos_reporte).', no_autorizado: 'Sesión vencida: volvé a entrar.' }[x.error] || 'No se pudo enviar: ' + x.error);
    };
  }

  async function catalogo() {
    vista.innerHTML = '<p>Leyendo catálogo…</p>';
    const r = await api('admin_catalogo', { token });
    if (r.error === 'no_autorizado') return salir();
    if (r.error) { vista.innerHTML = `<p class="err">No se pudo leer el catálogo (${esc(r.error)}).</p>`; return; }
    vista.innerHTML = `<div class="box"><h2>Disponibilidad de productos (precios y nombres se editan en tu planilla)</h2><table>
      ${r.items.map((p, i) => `<tr class="${p.disp ? '' : 'off'}"><td>${esc(p.n)}</td><td>${esc(p.cat)}</td><td>${pesos(p.p)}</td><td><button class="${p.disp ? 'sec' : ''}" data-i="${i}">${p.disp ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('')}</table></div>`;
    vista.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
      const p = r.items[b.dataset.i]; b.disabled = true;
      const x = await api('admin_disponible', { token, n: p.n, disp: !p.disp });
      if (x.error === 'no_autorizado') return salir(); catalogo();
    });
  }

  function puntos() {
    vista.innerHTML = `<div class="box"><h2>Etiqueta, participación y logro (puntos extra)</h2><div class="bar"><div><label>Nombre y apellido del cliente</label><input id="n" style="min-width:18rem"></div><button id="b">Buscar ventas</button></div><div id="fl"></div></div>`;
    $('#b').onclick = async () => {
      const nombre = $('#n').value.trim(), r = await api('admin_filas_cliente', { token, nombre });
      if (r.error === 'no_autorizado') return salir();
      if (r.error) { $('#fl').innerHTML = `<p class="err">No se pudo leer LISTA OFICIAL (${esc(r.error)}).</p>`; return; }
      $('#fl').innerHTML = r.filas.length ? `<table><tr><th>Fecha</th><th>Producto</th><th>Etiqueta</th><th>Participación</th><th>Logro</th></tr>${r.filas.map(f => `<tr><td>${esc(f.fecha)}</td><td>${esc(f.producto)}</td>
        ${['etiqueta', 'participacion', 'logro'].map(c => `<td><input type="checkbox" data-f="${f.fila}" data-c="${c}" ${f[c] ? 'checked' : ''}></td>`).join('')}</tr>`).join('')}</table>` : '<p style="color:var(--tenue)">No hay ventas con ese nombre exacto.</p>';
      $('#fl').querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = async () => {
        const x = await api('admin_marcar', { token, nombre, fila: c.dataset.f, campo: c.dataset.c, valor: c.checked });
        if (x.error) { c.checked = !c.checked; alert('No se pudo guardar: ' + x.error); }
      });
    };
  }

  async function repartidores() {
    vista.innerHTML = '<p>Leyendo…</p>';
    const r = await api('admin_repartidores', { token });
    if (r.error === 'no_autorizado') return salir();
    if (r.error) { vista.innerHTML = `<div class="box"><p class="err">${r.error === 'sin_jornada' ? 'No hay una jornada abierta.' : 'No se pudo leer: ' + esc(r.error)}</p></div>`; return; }
    vista.innerHTML = `<div class="box"><h2>Básico de hoy (ajuste puntual; el valor normal sale de tu lista de staff)</h2><table><tr><th>Repartidor</th><th>Básico</th><th>Total del día</th><th></th></tr>
      ${r.rows.map((x, i) => `<tr><td>${esc(x.n)}</td><td><input type="number" value="${x.basico}" id="b${i}" ${x.pagado === 'SI' ? 'disabled' : ''}></td><td>${pesos(x.total)}</td><td>${x.pagado === 'SI' ? 'Pagado' : `<button data-i="${i}">Guardar</button>`}</td></tr>`).join('') || '<tr><td colspan="4">Todavía no hay repartidores activos.</td></tr>'}</table></div>`;
    vista.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
      const x = await api('admin_basico', { token, n: r.rows[b.dataset.i].n, monto: $('#b' + b.dataset.i).value });
      if (x.error === 'no_autorizado') return salir(); if (x.error) alert('No se pudo guardar: ' + x.error); repartidores();
    });
  }

  async function planillas(aviso = '') {
    vista.innerHTML = '<p>Verificando planillas…</p>';
    const r = await api('admin_planillas', { token });
    if (r.error === 'no_autorizado') return salir();
    const est = x => !x || !x.configurada ? '<span class="err">Sin configurar</span>' : x.error ? '<span class="err">No se pudo abrir: revisá el enlace y los permisos</span>'
      : x.faltan.length ? `<span class="err">${esc(x.nombre)}: faltan pestañas (${esc(x.faltan.join(', '))})</span>` : `<span style="color:var(--ok)">${esc(x.nombre)}: todo en orden</span>`;
    vista.innerHTML = `<div class="box"><h2>Planillas en uso (pegá el enlace o el ID de cada una; tienen que ser hojas de cálculo de Google)</h2>
      <label style="color:var(--tenue)">Operacion_CDBF</label><input id="op" style="width:100%" placeholder="Enlace o ID"><p>${est(r.op)}</p>
      <label style="color:var(--tenue)">LISTA OFICIAL (la actualizada con las últimas ventas)</label><input id="lo" style="width:100%" placeholder="Enlace o ID"><p>${est(r.lo)}</p>
      <button id="gp">Guardar y verificar</button> <span id="mp">${esc(aviso)}</span></div>`;
    $('#gp').onclick = async () => {
      const g = await api('admin_planillas_guardar', { token, op: $('#op').value.trim(), lo: $('#lo').value.trim() });
      if (g.error === 'no_autorizado') return salir();
      const t = k => !g[k] ? '' : g[k].ok ? `${k === 'op' ? 'Operacion' : 'LISTA OFICIAL'} guardada. ` : g[k].error === 'faltan_pestanas' ? `${k === 'op' ? 'Operacion' : 'LISTA OFICIAL'}: faltan pestañas (${g[k].faltan.join(', ')}). ` : `${k === 'op' ? 'Operacion' : 'LISTA OFICIAL'}: no se pudo abrir. `;
      planillas(t('op') + t('lo'));
    };
  }

  async function seguridad() {
    const r = await api('admin_clave', { token });
    if (r.error === 'no_autorizado') return salir();
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    vista.innerHTML = `<div class="box"><h2>Clave del local</h2>
      <p>${r.configurada ? 'Hay una clave activa.' : '<span class="err">Todavía no hay clave: cualquiera que tenga la dirección puede usar el sistema.</span>'}</p>
      <div class="bar"><input id="k" style="min-width:18rem" placeholder="Nueva clave (mínimo 8 caracteres)"><button class="sec" id="gen">Generar</button><button id="gk">Guardar clave</button></div>
      <p style="color:var(--tenue)">Al guardar una clave nueva, los enlaces anteriores dejan de funcionar en todos los dispositivos.</p><div id="enl"></div></div>`;
    $('#gen').onclick = () => $('#k').value = Array.from(crypto.getRandomValues(new Uint8Array(14)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    $('#gk').onclick = async () => {
      const clave = $('#k').value.trim(), x = await api('admin_clave_guardar', { token, clave });
      if (x.error === 'no_autorizado') return salir();
      if (x.error) { $('#enl').innerHTML = `<p class="err">${x.error === 'clave_corta' ? 'La clave tiene que tener al menos 8 caracteres.' : 'No se pudo guardar: ' + esc(x.error)}</p>`; return; }
      localStorage.setItem('cdbf_k', clave);
      $('#enl').innerHTML = '<h2>Enlaces para enviar</h2>' + ['cocina', 'cajero', 'delivery', 'admin'].map(a => `<p><b>${a[0].toUpperCase() + a.slice(1)}</b><br><code style="word-break:break-all">${esc(base + a + '.html?k=' + clave)}</code></p>`).join('');
    };
  }
  reportes();
}

const pinInput = document.getElementById('pin'); // Cambia 'pin' si tu ID es otro

if (pinInput) {
  // Al hacer clic en el input o en su contenedor, forzamos el foco
  pinInput.addEventListener('click', () => {
    pinInput.focus();
  });
}
